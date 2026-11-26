import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { RateLimitError } from "./rate-limit";
import { emailKey, generateOtp, otpHash } from "./account-utils";

/**
 * Codes de vérification par email (6 chiffres), pour deux finalités :
 *  - "signup" : confirmer l'email d'une demande de compte
 *  - "reset"  : réinitialiser un mot de passe
 *
 * Firestore `authOtps/{purpose}:{emailKey}` (serveur uniquement) :
 *   { codeHash, expiresAt, createdAt, attempts, sends, firstSendAt }
 *
 * Limites : 60 s entre deux envois, 5 envois / 15 min / email+finalité,
 * 5 tentatives par code, usage unique, expiration à 5 minutes.
 * Le code est haché + salé (jamais stocké en clair).
 */
export type OtpPurpose = "signup" | "reset";

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_SENDS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function docId(purpose: OtpPurpose, email: string): string {
  return `${purpose}:${emailKey(email)}`;
}
function salt(purpose: OtpPurpose, email: string): string {
  return `${purpose}:${emailKey(email)}`;
}

/**
 * Génère et enregistre un code. Lève `RateLimitError` si trop d'envois.
 * Renvoie le code EN CLAIR pour l'envoyer par email (jamais le logger).
 */
export async function issueOtp(purpose: OtpPurpose, email: string): Promise<string> {
  const code = generateOtp();
  const ref = adminDb.collection("authOtps").doc(docId(purpose, email));

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const prev = snap.exists ? (snap.data() ?? {}) : {};
    const lastSendAt = typeof prev.createdAt === "number" ? prev.createdAt : 0;
    const firstSendAt = typeof prev.firstSendAt === "number" ? prev.firstSendAt : now;
    const sends = typeof prev.sends === "number" ? prev.sends : 0;

    if (lastSendAt && now - lastSendAt < COOLDOWN_MS) {
      throw new RateLimitError(Math.ceil((COOLDOWN_MS - (now - lastSendAt)) / 1000));
    }
    const inWindow = now - firstSendAt < WINDOW_MS;
    if (inWindow && sends + 1 > MAX_SENDS) {
      throw new RateLimitError(Math.ceil((WINDOW_MS - (now - firstSendAt)) / 1000));
    }

    tx.set(ref, {
      codeHash: otpHash(salt(purpose, email), code),
      expiresAt: now + OTP_EXPIRY_MS,
      createdAt: now,
      attempts: 0,
      sends: inWindow ? sends + 1 : 1,
      firstSendAt: inWindow ? firstSendAt : now,
    });
  });
  return code;
}

export type OtpVerdict = "ok" | "invalid_code" | "code_expired" | "too_many_attempts";

/**
 * Vérifie un code. Le verdict est RETOURNÉ (jamais levé) pour que le
 * compteur de tentatives et la suppression soient bien commités.
 * Un code valide est consommé (usage unique).
 */
export async function verifyOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
): Promise<OtpVerdict> {
  const ref = adminDb.collection("authOtps").doc(docId(purpose, email));
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "invalid_code" as const;
    const d = snap.data() ?? {};
    const attempts = typeof d.attempts === "number" ? d.attempts : 0;

    if (typeof d.expiresAt !== "number" || d.expiresAt < Date.now()) {
      tx.delete(ref);
      return "code_expired" as const;
    }
    if (attempts >= MAX_ATTEMPTS) {
      tx.delete(ref);
      return "too_many_attempts" as const;
    }
    const expected = Buffer.from(otpHash(salt(purpose, email), code));
    const stored = Buffer.from(typeof d.codeHash === "string" ? d.codeHash : "");
    if (expected.length !== stored.length || !timingSafeEqual(expected, stored)) {
      tx.update(ref, { attempts: attempts + 1 });
      return "invalid_code" as const;
    }
    tx.delete(ref);
    return "ok" as const;
  });
}

// ─── Preuve de vérification d'email ─────────────────────────
//
// Après un code valide, /signup/verify délivre une preuve aléatoire (15 min,
// usage unique). Elle permet de séparer l'étape « code » de l'étape
// « profil » sans redemander le code à la fin du formulaire.

const PROOF_TTL_MS = 15 * 60 * 1000;

function proofRef(email: string) {
  return adminDb.collection("authOtps").doc(`proof:${emailKey(email)}`);
}

function sha256hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Délivre une preuve (en clair, à renvoyer au client) ; seul son hash est stocké. */
export async function issueProof(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await proofRef(email).set({
    tokenHash: sha256hex(token),
    expiresAt: Date.now() + PROOF_TTL_MS,
    createdAt: Date.now(),
  });
  return token;
}

/** Consomme la preuve. Vrai uniquement si elle correspond et n'a pas expiré. */
export async function consumeProof(email: string, token: string): Promise<boolean> {
  const ref = proofRef(email);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const d = snap.data() ?? {};
    if (typeof d.expiresAt !== "number" || d.expiresAt < Date.now()) {
      tx.delete(ref);
      return false;
    }
    const a = Buffer.from(sha256hex(token));
    const b = Buffer.from(typeof d.tokenHash === "string" ? d.tokenHash : "");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    tx.delete(ref);
    return true;
  });
}
