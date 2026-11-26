import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions, withCors } from "@/lib/cors";
import { renderSalonSignupEmail, sendBrevoEmail } from "@/lib/brevo";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import {
  emailKey,
  generateOtp,
  isDisposableEmail,
  otpHash,
  signupEnabled,
} from "@/lib/salon-signup";

/**
 * POST /api/salon-signup/send — étape 1 de l'inscription libre d'un salon :
 * envoie un code à 6 chiffres à l'email saisi.
 *
 * Protections :
 *  - interrupteur d'urgence SALON_SIGNUP_ENABLED
 *  - emails jetables refusés
 *  - 1 salon par email canonique (alias +x et points Gmail ignorés)
 *  - limites : 10 envois / heure / IP, cooldown 60 s et 5 envois / 15 min / email
 *  - code haché + salé, jamais stocké en clair, expire en 5 min
 *
 * Firestore `salonSignupOtps/{emailKey}` (serveur uniquement) :
 *   { codeHash, expiresAt, createdAt, attempts, sends, firstSendAt }
 */
const Body = z.object({ email: z.string().email().max(254) });

const EXPIRY_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_SENDS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function fail(origin: string | null, error: string, status: number, extra = {}) {
  return withCors(NextResponse.json({ error, ...extra }, { status }), origin);
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (!signupEnabled()) return fail(origin, "signup_disabled", 503);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(origin, "invalid_json", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(origin, "invalid_payload", 400);

  const email = parsed.data.email.trim().toLowerCase();
  if (isDisposableEmail(email)) return fail(origin, "email_not_allowed", 422);

  try {
    await consumeLimit(`signup-send:ip:${ipHash(clientIp(req))}`, 10, 60 * 60 * 1000);

    const key = emailKey(email);

    // Un seul salon (et donc un seul essai gratuit) par email.
    const existing = await adminDb.collection("salonSignups").doc(key).get();
    if (existing.exists) return fail(origin, "email_already_registered", 409);

    const code = generateOtp();
    const docRef = adminDb.collection("salonSignupOtps").doc(key);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
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

      tx.set(docRef, {
        codeHash: otpHash(key, code),
        expiresAt: now + EXPIRY_MS,
        createdAt: now,
        attempts: 0,
        sends: inWindow ? sends + 1 : 1,
        firstSendAt: inWindow ? firstSendAt : now,
      });
    });

    const { html, text } = renderSalonSignupEmail({ code, expiresInMinutes: 5 });
    const result = await sendBrevoEmail({
      to: email,
      subject: "Ton code Trimya pour créer ton salon",
      htmlContent: html,
      textContent: text,
      tags: ["salon-signup-otp"],
    });
    if (!result.ok) logServerError("salon-signup/send/brevo", result.error ?? "unknown");

    return withCors(
      NextResponse.json({ ok: true, expiresInSeconds: EXPIRY_MS / 1000 }),
      origin,
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return fail(origin, "rate_limited", 429, { retryAfterSeconds: e.retryAfterSeconds });
    }
    logServerError("salon-signup/send", e);
    return fail(origin, "internal_error", 500);
  }
}
