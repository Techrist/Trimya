/**
 * PIN 6 chiffres pour déverrouillage rapide de l'app Trimya Client.
 *
 * Sécurité :
 *  - Le PIN n'est JAMAIS stocké en clair, même côté local
 *  - On stocke `hash = SHA-256(pin + salt)` dans expo-secure-store
 *    (= keychain iOS / EncryptedSharedPreferences Android)
 *  - Le salt est généré au moment de la création du PIN et stocké à côté
 *  - 3 essais max avant lock 5 minutes (compteur en SecureStore)
 *
 * Mode d'emploi côté UI :
 *  - `setPin('123456')` : enregistre un nouveau PIN
 *  - `clearPin()` : supprime le PIN (retour SMS OTP comme seule auth)
 *  - `verifyPin('123456')` : true/false
 *  - `hasPin()` : true si un PIN est configuré
 *
 * Quand l'app boote ET que `hasPin()` retourne true, on affiche
 * `ClientPinUnlockScreen` avant ClientTabs (cf. RootNavigator).
 */

// On passe par l'abstraction @/platform/secureStore qui fait le routage
// natif (expo-secure-store) vs web (IndexedDB). Nécessaire pour que le PIN
// fonctionne dans la PWA.
import { secureStore as SecureStore } from '@/platform';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'trimya.client.pinHash';
const PIN_SALT_KEY = 'trimya.client.pinSalt';
const PIN_ATTEMPTS_KEY = 'trimya.client.pinAttempts';
const PIN_LOCK_UNTIL_KEY = 'trimya.client.pinLockUntil';

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 min après 3 essais

// ─── Hash helper (SHA-256 cryptographique uniquement) ──
//
// On utilise expo-crypto qui est garanti dispo dans tout build Expo (dev
// client + EAS). Si un jour le module échoue à charger, on refuse de
// stocker un PIN plutôt que de retomber sur un hash faible — la sécurité
// ne tolère pas de "best effort".

async function sha256(message: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
  );
}

/**
 * Génère un salt cryptographiquement aléatoire (16 octets / 128 bits)
 * via le CSPRNG natif de la plateforme (iOS SecRandomCopyBytes,
 * Android SecureRandom). `Math.random()` était utilisé avant — c'est un
 * PRNG non-crypto avec ~53 bits d'entropie max et état prévisible.
 */
function generateSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

// ─── API publique ─────────────────────────────────────────────

/** Vrai si un PIN est actuellement configuré sur cet appareil. */
export async function hasPin(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return !!hash;
}

/** Définit un nouveau PIN (ou remplace l'existant). */
export async function setPin(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Le PIN doit contenir exactement 6 chiffres.');
  }
  const salt = generateSalt();
  const hash = await sha256(pin + salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(PIN_LOCK_UNTIL_KEY);
}

/** Supprime le PIN. L'app reviendra au flow standard (SMS OTP). */
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(PIN_LOCK_UNTIL_KEY);
}

/**
 * Résultat d'une tentative de PIN.
 *  - `ok`            : PIN correct, déverrouillage autorisé
 *  - `wrong`         : PIN faux, il reste des essais
 *  - `locked`        : trop de tentatives → l'app est verrouillée jusqu'à `lockUntil` (ms)
 *  - `noPin`         : aucun PIN configuré (cas d'appel par erreur)
 */
export type PinVerifyResult =
  | { kind: 'ok' }
  | { kind: 'wrong'; attemptsLeft: number }
  | { kind: 'locked'; lockUntil: number }
  | { kind: 'noPin' };

/** Vérifie un PIN saisi par l'utilisateur, en gérant le rate-limit. */
export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  if (!storedHash || !salt) return { kind: 'noPin' };

  // Lock en cours ?
  const lockUntilStr = await SecureStore.getItemAsync(PIN_LOCK_UNTIL_KEY);
  const lockUntil = lockUntilStr ? Number(lockUntilStr) : 0;
  if (lockUntil > Date.now()) {
    return { kind: 'locked', lockUntil };
  }

  // Calcul du hash et comparaison
  const inputHash = await sha256(pin + salt);
  if (inputHash === storedHash) {
    // Succès : reset le compteur d'erreurs
    await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
    return { kind: 'ok' };
  }

  // Échec : incrémente le compteur
  const attemptsStr = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
  const attempts = (attemptsStr ? Number(attemptsStr) : 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const newLockUntil = Date.now() + LOCK_DURATION_MS;
    await SecureStore.setItemAsync(PIN_LOCK_UNTIL_KEY, String(newLockUntil));
    await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
    return { kind: 'locked', lockUntil: newLockUntil };
  }
  await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, String(attempts));
  return { kind: 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts };
}
