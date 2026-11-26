import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { renderCodeEmail, sendBrevoEmail } from "@/lib/brevo";
import { issueOtp, OTP_EXPIRY_MS } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";

/**
 * POST /api/auth/password-reset/send — « mot de passe oublié » : envoie un
 * code à 6 chiffres par email (branding Trimya, sans lien externe).
 *
 * Anti-énumération : la réponse est TOUJOURS `{ ok: true }`, que l'email
 * existe ou non, y compris quand la limite d'envoi par email est atteinte.
 * Seule la limite par IP (10 / heure) renvoie une erreur explicite.
 * Un code n'est émis que pour un compte existant et actif (avec ou sans mot
 * de passe : les anciens comptes clients n'en avaient pas).
 */
const Body = z.object({ email: z.string().email().max(254) });

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);
  const email = parsed.data.email.trim().toLowerCase();

  try {
    await consumeLimit(`reset-send:ip:${ipHash(clientIp(req))}`, 10, 60 * 60 * 1000);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/reset/send/limit", e);
    return json(origin, { error: "internal_error" }, 500);
  }

  const ok = () => json(origin, { ok: true, expiresInSeconds: OTP_EXPIRY_MS / 1000 });

  try {
    let eligible = false;
    try {
      const user = await adminAuth.getUserByEmail(email);
      // Tout compte actif : un ancien compte « client » (connexion par code,
      // sans mot de passe) peut ainsi en définir un. Le code prouve l'email.
      eligible = !user.disabled;
    } catch (e) {
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
    }
    if (!eligible) return ok();

    let code: string;
    try {
      code = await issueOtp("reset", email);
    } catch (e) {
      if (e instanceof RateLimitError) return ok(); // ne rien révéler
      throw e;
    }
    const { html, text } = renderCodeEmail({
      title: "Réinitialise ton mot de passe",
      intro: "Entre ce code dans l'app pour choisir un nouveau mot de passe.",
      code,
      expiresInMinutes: OTP_EXPIRY_MS / 60000,
      footer:
        "Tu n'as pas demandé cette réinitialisation ? Ignore cet email : ton mot de passe reste inchangé.",
    });
    const result = await sendBrevoEmail({
      to: email,
      subject: "Ton code de réinitialisation Trimya",
      htmlContent: html,
      textContent: text,
      tags: ["password-reset"],
    });
    if (!result.ok) logServerError("auth/reset/send/brevo", result.error ?? "unknown");
    return ok();
  } catch (e) {
    logServerError("auth/reset/send", e);
    return ok(); // même réponse : on ne distingue jamais les cas côté client
  }
}
