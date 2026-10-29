import {
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as fbSignOut,
  signInAnonymously,
  onAuthStateChanged,
  PhoneAuthProvider,
  updatePhoneNumber,
  User,
  type ApplicationVerifier,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

let currentConfirmation: ConfirmationResult | null = null;

/**
 * SÉCURITÉ CRITIQUE — Ce flag désactive reCAPTCHA et accepte les codes OTP
 * Firebase "test numbers". En production il OUVRE UN BYPASS COMPLET de l'auth
 * SMS si un attaquant connaît un test number.
 *
 * Règle absolue : ne JAMAIS activer en prod. On guarde via __DEV__ qui est
 * `true` dans Expo Go / dev client / `npm start`, et `false` dans tous les
 * builds EAS production. En PWA (Platform.OS === 'web') on force reCAPTCHA
 * réel même en dev car Firebase Phone Auth web EXIGE un vérificateur réel.
 */
if (__DEV__ && Platform.OS !== 'web') {
  auth.settings.appVerificationDisabledForTesting = true;
}

/**
 * Stub verifier pour le natif en mode dev — Firebase accepte un stub car
 * `appVerificationDisabledForTesting = true` fait sauter la vérification.
 * En PWA on NE PEUT PAS utiliser ce stub : Firebase refusera, il faut un
 * vrai RecaptchaVerifier.
 */
const stubVerifier = {
  type: 'recaptcha',
  verify: () => Promise.resolve('test-verification-token'),
  _reset: () => {},
  clear: () => {},
  render: () => Promise.resolve(0),
} as unknown as ApplicationVerifier;

/**
 * Cache du RecaptchaVerifier web — on en garde UN seul par cycle de vie de
 * la page sinon Firebase râle (« RecaptchaVerifier has already been rendered »).
 * On le ré-instancie après chaque OTP envoyé (le token est single-use).
 */
let webRecaptcha: ApplicationVerifier | null = null;

/**
 * Crée (ou renvoie l'existant) un RecaptchaVerifier invisible côté web.
 * On attache l'instance à un conteneur caché injecté dans le DOM — si le
 * conteneur n'existe pas encore, on le crée. Jamais throw : si reCAPTCHA
 * refuse de se charger (bloqué par un adblock, pays sans Google), on
 * remonte une erreur claire au caller.
 */
async function getWebRecaptcha(): Promise<ApplicationVerifier> {
  if (webRecaptcha) return webRecaptcha;
  const { RecaptchaVerifier } = await import('firebase/auth');
  const CONTAINER_ID = 'trimya-recaptcha';
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
  }
  webRecaptcha = new RecaptchaVerifier(auth, CONTAINER_ID, {
    size: 'invisible',
  });
  return webRecaptcha;
}

export async function sendOtp(phoneE164: string): Promise<void> {
  const verifier =
    Platform.OS === 'web' ? await getWebRecaptcha() : stubVerifier;
  try {
    currentConfirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (err) {
    // Un vérificateur reCAPTCHA ne peut servir qu'une fois : on reset
    // pour permettre une nouvelle tentative avec un token frais.
    if (Platform.OS === 'web' && webRecaptcha) {
      try {
        (webRecaptcha as unknown as { clear?: () => void }).clear?.();
      } catch {
        // best-effort
      }
      webRecaptcha = null;
    }
    throw err;
  }
}

export async function verifyOtp(code: string): Promise<User> {
  if (!currentConfirmation) {
    throw new Error('Aucun code en attente. Recommence l\'envoi.');
  }
  const result = await currentConfirmation.confirm(code);
  currentConfirmation = null;
  return result.user;
}

/**
 * For salon kiosks: anonymous sign-in so the device has request.auth
 * and can read customers / write cuts under Firestore rules.
 */
export async function signInAsSalonKiosk(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export function onAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export function currentUser(): User | null {
  return auth.currentUser;
}

// ─── Changement de numéro de téléphone ──────────────────────
//
// Le client a changé de SIM ou de carte mais veut garder son compte
// (totalCuts, abonnement, historique). On utilise `updatePhoneNumber`
// qui re-link une nouvelle credential téléphone au MÊME uid Firebase.
// Le doc Firestore `customers/{uid}` garde donc tout son contenu, on
// met juste à jour le champ `phone`.

let pendingPhoneChangeVerificationId: string | null = null;

/**
 * Étape 1 du changement de numéro : envoie un SMS OTP au NOUVEAU numéro.
 * L'utilisateur doit déjà être authentifié (current user non-null).
 * Stocke l'identifiant de vérification en module-state, qui sera repris
 * dans `confirmPhoneChange` avec le code reçu.
 */
export async function sendOtpForPhoneChange(newPhoneE164: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Pas de session active.');
  }
  const provider = new PhoneAuthProvider(auth);
  // Natif Expo Go / dev client : stub verifier accepté par Firebase quand
  // appVerificationDisabledForTesting = true. PWA : vrai reCAPTCHA invisible
  // (sinon Firebase refuse l'envoi SMS).
  const verifier =
    Platform.OS === 'web' ? await getWebRecaptcha() : stubVerifier;
  try {
    pendingPhoneChangeVerificationId = await provider.verifyPhoneNumber(
      newPhoneE164,
      verifier,
    );
  } catch (err) {
    if (Platform.OS === 'web' && webRecaptcha) {
      try {
        (webRecaptcha as unknown as { clear?: () => void }).clear?.();
      } catch {
        // best-effort
      }
      webRecaptcha = null;
    }
    throw err;
  }
}

/**
 * Étape 2 : valide le code reçu et applique le changement au compte Firebase.
 * Retourne le `uid` (inchangé) — le caller doit mettre à jour `customers.{uid}.phone`.
 */
export async function confirmPhoneChange(
  code: string,
  newPhoneE164: string,
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Pas de session active.');
  }
  if (!pendingPhoneChangeVerificationId) {
    throw new Error('Aucun code en attente — relance l\'envoi du SMS.');
  }
  const credential = PhoneAuthProvider.credential(
    pendingPhoneChangeVerificationId,
    code,
  );
  await updatePhoneNumber(auth.currentUser, credential);
  pendingPhoneChangeVerificationId = null;
  // Note : le caller appelle ensuite `setCustomerPhone(uid, newPhone)`
  // pour aligner le doc Firestore avec la nouvelle valeur.
  void newPhoneE164;
  return auth.currentUser.uid;
}
