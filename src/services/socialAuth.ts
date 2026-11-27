import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

/**
 * Connexion sociale (Google). Disponible sur la PWA (web) uniquement pour
 * l'instant : les builds natifs (Google Play / App Store) demanderont des
 * modules natifs et, côté Apple, un compte développeur. Apple viendra à ce
 * moment-là, avec la publication sur les stores.
 */
export const socialSignInAvailable = Platform.OS === 'web';

/**
 * Ouvre la fenêtre de connexion Google et renvoie l'utilisateur Firebase.
 * Lève `auth/popup-closed-by-user` si la personne ferme la fenêtre (à ignorer
 * côté UI) et `auth/popup-blocked` si le navigateur la bloque.
 */
export async function signInWithGoogle(): Promise<User> {
  if (!socialSignInAvailable) throw new Error('social_unavailable');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}
