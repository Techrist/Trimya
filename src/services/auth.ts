import {
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as fbSignOut,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

let currentConfirmation: ConfirmationResult | null = null;

/**
 * In Expo Go we can't run real reCAPTCHA, so we leverage Firebase's
 * "app verification disabled for testing" mode + Test Phone Numbers
 * (configured in Firebase Console → Authentication → Sign-in method → Phone).
 *
 * For production / real SMS to real numbers, you'll need an EAS dev build
 * with a real reCAPTCHA verifier wired into PhoneSignupScreen.
 */
auth.settings.appVerificationDisabledForTesting = true;

const stubVerifier = {
  type: 'recaptcha',
  verify: () => Promise.resolve('test-verification-token'),
  _reset: () => {},
  clear: () => {},
  render: () => Promise.resolve(0),
} as any;

export async function sendOtp(phoneE164: string): Promise<void> {
  currentConfirmation = await signInWithPhoneNumber(auth, phoneE164, stubVerifier);
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
