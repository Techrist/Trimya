import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Persistance Firebase Auth — critique pour la PWA.
 *
 * Natif (iOS/Android) : AsyncStorage via `getReactNativePersistence`. Le
 *   module Firebase Auth n'exporte ce helper qu'en runtime natif, on le
 *   require à la demande pour éviter de polluer le bundle web.
 *
 * Web (PWA) : on préfère `indexedDBLocalPersistence` à `browserLocalPersistence`
 *   car iOS Safari peut effacer localStorage à partir de 7 jours d'inactivité
 *   (cf. risque n°1 du PDF). IndexedDB tient un peu plus longtemps et peut
 *   être couplé à un service worker. Si IndexedDB échoue (mode privé),
 *   on retombe sur localStorage, puis sur la session en mémoire.
 *
 * Dans tous les cas on NE throw PAS : `getAuth` fournit un fallback valide.
 */
let auth: ReturnType<typeof getAuth>;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } else {
    // Natif : lazy require pour que le bundler web ne charge pas AsyncStorage
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default;
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
    };
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage) as never,
    });
  }
} catch {
  // Déjà initialisé (hot reload) ou plateforme particulière → fallback
  // sur l'instance par défaut, qui réutilise la persistance existante.
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
