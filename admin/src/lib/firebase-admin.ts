import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

/**
 * Server-only Firebase Admin singleton.
 * Reads the service account JSON from `FIREBASE_SERVICE_ACCOUNT_JSON`.
 * Never import this from a client component.
 */

function buildApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not defined. Add it to .env.local",
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full service-account JSON on one line.",
    );
  }

  return initializeApp({
    credential: cert(parsed as Parameters<typeof cert>[0]),
  });
}

const app = buildApp();
export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminMessaging: Messaging = getMessaging(app);
