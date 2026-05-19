"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ── App Check (reCAPTCHA v3) ────────────────────────────────────
// Active la protection contre les requêtes provenant de scripts ou bots :
// seules les requêtes signées par reCAPTCHA passent Firestore + Functions.
// La clé publique reCAPTCHA est exposée volontairement (c'est public).
//
// Configuration : Firebase Console → App Check → Enregistrer cette app web
// avec un site key reCAPTCHA v3 (créé dans Google Cloud Console).
let appCheckInstance: AppCheck | null = null;
if (typeof window !== "undefined") {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // App Check déjà initialisé (HMR Next.js) — on ignore.
    }
  }
}
export { appCheckInstance };

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
