/**
 * Authentification par magic link email (Firebase Email Link Authentication).
 *
 * Pourquoi magic link plutôt que SMS ?
 * ─────────────────────────────────────
 * Firebase Phone Auth exige le plan Blaze ET une infrastructure SMS qui, au
 * Cameroun et dans la plupart de l'Afrique de l'Ouest, est peu fiable
 * (MTN Cameroun drop silencieusement les SMS Firebase). Le magic link email
 * reste dans le quota Spark gratuit (10 000 envois/jour) et marche partout
 * où Gmail / Yahoo / Outlook sont accessibles — c'est-à-dire partout.
 *
 * Flux UX
 * ───────
 *   1. Utilisateur saisit son email → appelle `sendMagicLink(email)`
 *   2. Firebase envoie un email avec un lien d'auth signé
 *   3. Utilisateur clique sur le lien → ouvre la PWA à une URL spéciale
 *   4. Au boot, l'app détecte l'URL via `isMagicLinkUrl(window.location.href)`
 *      et appelle `completeMagicLinkSignIn()` pour finaliser la session
 *   5. L'app nettoie l'URL (history.replaceState) pour éviter les re-logins
 *      si l'utilisateur recharge la page
 *
 * Persistance de l'email entre l'envoi et le clic
 * ────────────────────────────────────────────────
 * Firebase exige de repasser l'email saisi lors du `signInWithEmailLink`,
 * comme preuve de non-interception du lien. On le stocke dans localStorage
 * sur le device d'envoi. Si l'utilisateur clique le lien depuis un AUTRE
 * device (ordinateur → téléphone), on lui redemande l'email dans l'UI.
 *
 * En natif (iOS/Android) les deep links Firebase passent par Dynamic Links,
 * dépréciés en 2025. On garde ce service web-only — en natif, l'app ouvre le
 * lien dans le navigateur, qui route vers la PWA, qui complète la connexion,
 * puis le serveur Vercel renvoie l'utilisateur vers l'app native via un
 * universal link ou un intent. Pour MVP on couvre uniquement PWA.
 */

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  ActionCodeSettings,
  User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';
import { isProApp } from '@/lib/appTarget';

const STORAGE_KEY_EMAIL = 'trimya.magicLink.email';
const STORAGE_KEY_TARGET = 'trimya.magicLink.target';

/**
 * Détermine l'URL de retour du magic link.
 *
 * On veut que Firebase ouvre LA MÊME app que celle d'où l'utilisateur a
 * demandé le lien : trimya-pro.web.app pour le flux Pro, trimya-68ae2.web.app
 * pour le flux Client. Si on n'est pas en web (natif en dev), on utilise
 * localhost:8081 comme fallback (Expo web dev-server).
 *
 * `continuePath` permet au caller de préciser la route vers laquelle rediriger
 * après signin (ex : `/#/ClientName` pour un nouveau compte).
 */
function buildContinueUrl(continuePath: string = '/'): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    const isPro = isProApp();
    const host = isPro
      ? 'https://pro.trimya.app'
      : 'https://app.trimya.app';
    return `${host}${continuePath}`;
  }
  // Web : on part de l'origin courant. Garantit que si l'user clique le lien
  // depuis un email, il revient sur l'app d'où il a initié la demande (évite
  // d'envoyer un client Trimya vers trimya-pro.web.app et inversement).
  return `${window.location.origin}${continuePath}`;
}

/**
 * Envoie un magic link à l'email donné.
 *
 * @param email   Adresse email de l'utilisateur
 * @param target  'client' | 'owner' — stocké en localStorage pour router
 *                correctement après signin
 * @param continuePath Chemin optionnel à ajouter à l'URL de retour, utile
 *                     pour forcer un deep-link après signin (ex: '/ClientName')
 */
export async function sendMagicLink(
  email: string,
  target: 'client' | 'owner',
  continuePath: string = '/',
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('auth/invalid-email');
  }

  const actionCodeSettings: ActionCodeSettings = {
    // URL de retour — DOIT être un domaine autorisé dans la console Firebase
    // (Authentication → Settings → Authorized domains). En prod : trimya-68ae2.web.app,
    // trimya-pro.web.app, trimya-68ae2.firebaseapp.com. En dev : localhost.
    url: buildContinueUrl(continuePath),
    // handleCodeInApp = true : Firebase renvoie vers notre URL avec un
    // paramètre `?apiKey=...&oobCode=...` qu'on détecte via
    // isSignInWithEmailLink. Sans ça, Firebase affiche sa propre page de
    // confirmation hébergée, qu'on ne veut pas (UX cassée).
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);

  // On ne persiste QUE côté web : en natif on ne s'en sert pas (pas de flux
  // magic link natif pour l'instant).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_EMAIL, normalizedEmail);
      window.localStorage.setItem(STORAGE_KEY_TARGET, target);
    } catch {
      // Mode privé Safari / storage plein → on fallback : l'user devra
      // ressaisir son email sur l'écran de confirmation.
    }
  }
}

/**
 * Vérifie si l'URL courante est un magic link Firebase.
 * Appelé au boot de l'app pour décider s'il faut compléter la connexion.
 */
export function isMagicLinkUrl(url?: string): boolean {
  if (Platform.OS !== 'web') return false;
  const target = url || (typeof window !== 'undefined' ? window.location.href : '');
  if (!target) return false;
  return isSignInWithEmailLink(auth, target);
}

/**
 * Récupère l'email mémorisé lors du `sendMagicLink`. Peut être null si
 * l'utilisateur ouvre le lien depuis un autre device.
 */
export function getStoredMagicLinkEmail(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY_EMAIL);
  } catch {
    return null;
  }
}

/**
 * Récupère la cible d'origine (client|owner) stockée lors du `sendMagicLink`.
 * Utilisé par RootNavigator pour router correctement après signin.
 */
export function getStoredMagicLinkTarget(): 'client' | 'owner' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_TARGET);
    if (val === 'client' || val === 'owner') return val;
    return null;
  } catch {
    return null;
  }
}

/**
 * Finalise la connexion à partir d'un magic link.
 *
 * @param email Si l'utilisateur ouvre le lien depuis un autre device, on
 *              lui redemande son email dans l'UI et on le passe ici. Sinon
 *              on utilise l'email mémorisé localement.
 * @returns     L'utilisateur Firebase connecté
 */
export async function completeMagicLinkSignIn(email?: string): Promise<User> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('Magic link signin disponible uniquement en PWA.');
  }

  const url = window.location.href;
  if (!isSignInWithEmailLink(auth, url)) {
    throw new Error('URL invalide — ce n\'est pas un lien de connexion.');
  }

  const effectiveEmail = (email || getStoredMagicLinkEmail() || '').trim().toLowerCase();
  if (!effectiveEmail) {
    throw new Error('NEED_EMAIL');
  }

  const result = await signInWithEmailLink(auth, effectiveEmail, url);

  // Nettoyage : on supprime l'email stocké et on nettoie l'URL (retire les
  // query params Firebase) pour éviter qu'un reload de la page re-déclenche
  // le flux. `replaceState` ne recharge pas la page.
  try {
    window.localStorage.removeItem(STORAGE_KEY_EMAIL);
    window.localStorage.removeItem(STORAGE_KEY_TARGET);
  } catch {
    // best-effort
  }
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    // best-effort
  }

  return result.user;
}

/**
 * Efface l'état pending d'un magic link sans compléter la connexion.
 * Utile si l'utilisateur annule ou si le token a expiré.
 */
export function clearMagicLinkPending(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_EMAIL);
    window.localStorage.removeItem(STORAGE_KEY_TARGET);
  } catch {
    // best-effort
  }
}
