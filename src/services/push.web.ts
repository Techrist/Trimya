import { doc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from './firebase';
import { setSalonKioskPushToken } from './salons';
import { detectPlatform } from '@/platform/detectPlatform';

/**
 * Push notifications pour la cible WEB (PWA) — remplace l'implémentation
 * Expo Push qui ne fonctionne pas en navigateur.
 *
 * Fonctionnement :
 *   1. On vérifie que l'environnement supporte FCM Web (`isSupported()`).
 *      Sur iOS c'est VRAI uniquement si la PWA est installée + iOS ≥ 16.4.
 *   2. On enregistre le service worker `firebase-messaging-sw.js` (déjà
 *      présent dans public/).
 *   3. On demande la permission notifications et on récupère un token FCM.
 *   4. On persiste le token dans `customers.{uid}.webPushToken` (champ
 *      séparé de `pushToken` natif, pour que les Cloud Functions puissent
 *      router vers le bon canal selon la plateforme de l'utilisateur).
 *
 * JAMAIS de succès fictif : si l'API n'est pas supportée on retourne `null`
 * et le caller affiche un message adapté (via le guide d'installation).
 */

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * État de la permission notifications, exposé à l'UI pour décider quoi
 * afficher dans le guide (bouton « Activer les notifications » vs « Déjà
 * activées » vs « Bloquées — ouvre les réglages du navigateur »).
 */
export type WebPushPermission =
  | 'unsupported'
  | 'requires_install'
  | 'default'
  | 'granted'
  | 'denied';

export interface PushRegisterOptions {
  /**
   * true UNIQUEMENT quand l'appel découle d'un geste explicite de
   * l'utilisateur (bouton « Activer »). Par défaut (false), on ne
   * déclenche jamais la fenêtre d'autorisation du navigateur : on
   * rafraîchit le token seulement si la permission est déjà accordée.
   */
  askPermission?: boolean;
}

async function resolvePermission(ask?: boolean): Promise<NotificationPermission> {
  const current = Notification.permission;
  if (current !== 'default' || !ask) return current;
  return Notification.requestPermission();
}

/**
 * Vérifie l'état courant sans demander la permission.
 * À appeler au mount de l'écran qui propose d'activer les notifs.
 */
export async function getWebPushPermission(): Promise<WebPushPermission> {
  // 1) FCM Web supporté globalement sur ce navigateur ?
  const supported = await isSupported().catch(() => false);
  if (!supported) return 'unsupported';

  // 2) Cas spécial iOS : exige PWA installée + iOS ≥ 16.4
  const info = detectPlatform();
  if (info.os === 'ios' && (!info.standalone || (info.iosVersion ?? 0) < 16.4)) {
    return 'requires_install';
  }

  // 3) Permission actuelle (navigateur)
  const perm = (globalThis as { Notification?: { permission?: NotificationPermission } })
    .Notification?.permission;
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

/**
 * Enregistre le token FCM Web pour un customer. Retourne null si impossible.
 *
 * Caller doit afficher à l'utilisateur ce que signifie l'absence de token
 * (ex: « Pour recevoir les notifications sur iPhone, installez d'abord
 * Trimya sur votre écran d'accueil »).
 */
export async function registerWebPushForCustomer(
  customerId: string,
  options: PushRegisterOptions = {},
): Promise<string | null> {
  if (!(await isSupported().catch(() => false))) return null;

  try {
    // Enregistre explicitement le SW FCM (sinon getToken() le fait avec
    // un scope qui peut conflicter avec notre sw.js racine).
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const permission = await resolvePermission(options.askPermission);
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;

    await updateDoc(doc(db, 'customers', customerId), {
      webPushToken: token,
      webPushTokenUpdatedAt: Date.now(),
    });
    return token;
  } catch {
    // Jamais throw depuis cette fonction — retour null = « push non actif ».
    return null;
  }
}

/**
 * Identique à registerWebPushForCustomer mais pour le kiosque salon.
 * Le token est enregistré sur le doc salon (champ `kioskWebPushToken`).
 */
export async function registerWebPushForSalonKiosk(
  salonId: string,
  options: PushRegisterOptions = {},
): Promise<string | null> {
  if (!(await isSupported().catch(() => false))) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const permission = await resolvePermission(options.askPermission);
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;

    await setSalonKioskPushToken(salonId, token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Souscrit aux messages FCM reçus pendant que l'app est au PREMIER PLAN.
 * (Les messages arrière-plan sont traités par firebase-messaging-sw.js.)
 *
 * Au premier plan, le navigateur n'affiche PAS de notification automatique :
 * c'est à nous de le faire via `new Notification(...)` ou de montrer une
 * bannière in-app. On passe le payload au caller qui décide.
 */
export function subscribeForegroundMessages(
  cb: (payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) => void,
): () => void {
  let unsub: (() => void) | undefined;
  isSupported()
    .then((ok) => {
      if (!ok) return;
      const messaging = getMessaging(app);
      unsub = onMessage(messaging, (payload) => {
        cb({
          title: payload.notification?.title ?? 'Trimya',
          body: payload.notification?.body ?? '',
          data: payload.data as Record<string, string> | undefined,
        });
      });
    })
    .catch(() => {});
  return () => {
    unsub?.();
  };
}

// ─── Alias d'API alignés sur `push.ts` (natif) ─────────────────
//
// Metro remplace `push.ts` par CE fichier côté web → tous les écrans qui
// importent `registerPushTokenForCustomer`, `registerSalonKioskPushToken`
// ou `sendPush` depuis `@/services/push` doivent trouver ces noms ici,
// sinon on obtient `TypeError: registerPushTokenForCustomer is not a
// function` au premier appel. On réexpose donc les mêmes signatures que
// la version native, en déléguant aux implémentations FCM Web.

export const registerPushTokenForCustomer = registerWebPushForCustomer;
export const registerSalonKioskPushToken = registerWebPushForSalonKiosk;

/**
 * Pas d'envoi de push depuis le navigateur (ce serait un risque de
 * fuite de secrets si on exposait un token admin FCM côté client). Les
 * push se déclenchent via Cloud Functions. On expose quand même la
 * fonction pour que l'import ne casse pas ; elle no-op silencieusement
 * et retourne une Promise résolue.
 */
export async function sendPush(_params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  // Volontairement no-op côté web — l'envoi se fait depuis les
  // Cloud Functions. L'appeler côté client est un bug applicatif, pas
  // une raison de crasher l'app en démo salon.
}
