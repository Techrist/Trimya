import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { renderCodeEmail, sendBrevoEmail } from "@/lib/brevo";
import { issueOtp, OTP_EXPIRY_MS } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import { emailKey, isDisposableEmail, signupEnabled } from "@/lib/account-utils";

/**
 * POST /api/auth/signup/send — étape 1 d'une demande de compte (salon ou
 * propriétaire) : envoie un code à 6 chiffres à l'email saisi.
 *
 * Refus clairs (l'utilisateur doit savoir quoi faire) :
 *  - email jetable                        → email_not_allowed
 *  - email déjà inscrit (compte ou demande) → email_already_registered
 * Limites : 30 envois / heure / IP (les réseaux mobiles partagent des IP), puis cooldown et plafond par email
 * (cf. lib/email-otp.ts).
 */
const Body = z.object({
  email: z.string().email().max(254),
  /** Public de l'inscription : adapte les textes de l'email. */
  audience: z.enum(["client", "pro"]).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

/** Vrai si cet email est déjà pris par un compte Trimya Pro ou une demande. */
async function emailTaken(email: string): Promise<boolean> {
  // 1) Alias (a.b@gmail.com / ab+x@gmail.com) : index sur la clé canonique.
  const byKey = await adminDb
    .collection("accounts")
    .where("emailKey", "==", emailKey(email))
    .limit(1)
    .get();
  if (!byKey.empty) return true;

  // 2) Compte Firebase existant : on bloque s'il est déjà un compte Pro
  //    (mot de passe, propriétaire). Un simple compte « client » (code par
  //    email) peut, lui, ajouter un mot de passe : le code prouve l'email.
  try {
    const user = await adminAuth.getUserByEmail(email);
    if (user.disabled) return true;
    const hasPassword = user.providerData.some((p) => p.providerId === "password");
    if (hasPassword) return true;
    const owner = await adminDb.collection("owners").doc(user.uid).get();
    if (owner.exists) return true;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code !== "auth/user-not-found") throw e;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (!signupEnabled()) return json(origin, { error: "signup_disabled" }, 503);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);

  const email = parsed.data.email.trim().toLowerCase();
  if (isDisposableEmail(email)) return json(origin, { error: "email_not_allowed" }, 422);

  try {
    await consumeLimit(`signup-send:ip:${ipHash(clientIp(req))}`, 30, 60 * 60 * 1000);

    if (await emailTaken(email)) {
      return json(origin, { error: "email_already_registered" }, 409);
    }

    const pro = parsed.data.audience !== "client";
    const code = await issueOtp("signup", email);
    const { html, text } = renderCodeEmail({
      title: pro ? "Crée ton compte Trimya Pro" : "Crée ton compte Trimya",
      intro: "Entre ce code dans l'app pour confirmer ton email.",
      code,
      expiresInMinutes: OTP_EXPIRY_MS / 60000,
      footer: "Tu n'as pas demandé ce code ? Ignore cet email, rien ne sera créé.",
    });
    const result = await sendBrevoEmail({
      to: email,
      subject: pro ? "Ton code Trimya Pro" : "Ton code Trimya",
      htmlContent: html,
      textContent: text,
      tags: ["signup-otp"],
    });
    if (!result.ok) logServerError("auth/signup/send/brevo", result.error ?? "unknown");

    return json(origin, { ok: true, expiresInSeconds: OTP_EXPIRY_MS / 1000 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/signup/send", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
