import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { consumeProof } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import {
  dayStamp,
  emailKey,
  isDisposableEmail,
  passwordSchema,
  signupEnabled,
} from "@/lib/account-utils";

/**
 * POST /api/auth/signup/client — création immédiate d'un compte CLIENT
 * (app Trimya) : email vérifié (preuve de /signup/verify) + mot de passe.
 * Pas de validation admin : le client accède tout de suite à son compte.
 *
 * Le profil (prénom, nom, consentement) est ensuite saisi dans l'app, qui
 * crée la fiche `customers/{uid}` comme avant.
 *
 * Particularités :
 *  - un ancien compte client (connexion par code, sans mot de passe) peut en
 *    définir un ici : le code vient de prouver que l'email est le sien ;
 *  - un email déjà utilisé par un compte avec mot de passe, un propriétaire
 *    ou un compte Pro (accounts) est refusé : 1 email = 1 rôle ;
 *  - limites : 30 créations / 24 h / IP (les réseaux mobiles partagent des
 *    IP) et plafond global CLIENT_SIGNUP_DAILY_CAP (défaut 1000) par jour.
 */
const Body = z.object({
  email: z.string().email().max(254),
  proof: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema,
});

function clientDailyCap(): number {
  const n = Number(process.env.CLIENT_SIGNUP_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : 1000;
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
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
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return json(origin, { error: weak ? "weak_password" : "invalid_payload" }, 400);
  }
  const b = parsed.data;
  const email = b.email.trim().toLowerCase();
  if (isDisposableEmail(email)) return json(origin, { error: "email_not_allowed" }, 422);

  try {
    await consumeLimit(`client-signup:ip:${ipHash(clientIp(req))}`, 30, 24 * 60 * 60 * 1000);
    await consumeLimit(`client-signup:global:${dayStamp()}`, clientDailyCap(), 24 * 60 * 60 * 1000);

    // Email déjà pris par un compte / une demande Pro (alias compris).
    const dup = await adminDb
      .collection("accounts")
      .where("emailKey", "==", emailKey(email))
      .limit(1)
      .get();
    if (!dup.empty) return json(origin, { error: "email_already_registered" }, 409);

    // Contrôle du compte existant AVANT de consommer la preuve (pour ne pas
    // la brûler sur un refus prévisible).
    let existingUid: string | null = null;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      const owner = await adminDb.collection("owners").doc(existing.uid).get();
      const hasPassword = existing.providerData.some((p) => p.providerId === "password");
      if (existing.disabled || owner.exists || hasPassword) {
        return json(origin, { error: "email_already_registered" }, 409);
      }
      existingUid = existing.uid;
    } catch (e) {
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
    }

    if (!(await consumeProof(email, b.proof))) {
      return json(origin, { error: "verification_required" }, 400);
    }

    if (existingUid) {
      await adminAuth.updateUser(existingUid, { password: b.password, emailVerified: true });
    } else {
      await adminAuth.createUser({ email, password: b.password, emailVerified: true });
    }
    return json(origin, { ok: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/signup/client", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
