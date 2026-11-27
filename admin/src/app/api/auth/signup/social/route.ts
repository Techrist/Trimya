import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { createAccountRequest } from "@/lib/accounts";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import {
  cleanPhone,
  cleanText,
  dailyCap,
  dayStamp,
  emailKey,
  proProfileSchema,
  signupEnabled,
} from "@/lib/account-utils";

/**
 * POST /api/auth/signup/social — demande de compte Pro (salon ou
 * propriétaire) pour un utilisateur DÉJÀ connecté via Google ou Apple.
 *
 * Pas de code ni de mot de passe : le fournisseur a déjà vérifié l'email.
 * On exige donc un ID token dont le fournisseur est google.com / apple.com et
 * dont l'email est vérifié ; l'email vient du jeton, jamais du corps.
 *
 * Comme pour l'inscription classique : aucun salon / propriétaire n'est créé
 * ici, la demande reste « pending » jusqu'à validation par l'admin. Mêmes
 * protections : consentement CGU Pro, 3 demandes / 24 h / IP, plafond global,
 * 1 email = 1 compte Pro, textes nettoyés.
 */
const Body = z.object({
  consent: z.literal(true),
  profile: proProfileSchema,
});

const SOCIAL_PROVIDERS = new Set(["google.com", "apple.com"]);

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!signupEnabled()) return json(origin, { error: "signup_disabled" }, 503);

  // ─── Auth : jeton d'un utilisateur connecté via Google / Apple ───
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  if (!match) return json(origin, { error: "missing_bearer_token" }, 401);
  let uid: string;
  let email: string;
  let provider: "google.com" | "apple.com";
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]!);
    const p = decoded.firebase?.sign_in_provider ?? "";
    if (!SOCIAL_PROVIDERS.has(p)) return json(origin, { error: "provider_not_allowed" }, 403);
    if (!decoded.email || decoded.email_verified !== true) {
      return json(origin, { error: "email_not_verified" }, 403);
    }
    uid = decoded.uid;
    email = decoded.email.trim().toLowerCase();
    provider = p as "google.com" | "apple.com";
  } catch {
    return json(origin, { error: "invalid_token" }, 401);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);
  const b = parsed.data;

  const phone = cleanPhone(b.profile.phone);
  if (!phone) return json(origin, { error: "invalid_phone" }, 400);
  const ipH = ipHash(clientIp(req));

  try {
    await consumeLimit(`signup-create:ip:${ipH}`, 3, 24 * 60 * 60 * 1000);
    await consumeLimit(`signup-create:global:${dayStamp()}`, dailyCap(), 24 * 60 * 60 * 1000);

    const key = emailKey(email);
    const [acc, owner, dup] = await Promise.all([
      adminDb.collection("accounts").doc(uid).get(),
      adminDb.collection("owners").doc(uid).get(),
      adminDb.collection("accounts").where("emailKey", "==", key).limit(1).get(),
    ]);
    if (acc.exists || owner.exists || !dup.empty) {
      return json(origin, { error: "email_already_registered" }, 409);
    }

    const profile =
      b.profile.type === "salon"
        ? {
            name: cleanText(b.profile.name),
            city: cleanText(b.profile.city),
            ownerName: cleanText(b.profile.ownerName),
            phone,
          }
        : {
            name: cleanText(b.profile.name),
            phone,
            ...(b.profile.salonCount ? { salonCount: b.profile.salonCount } : {}),
            ...(b.profile.companyName ? { companyName: cleanText(b.profile.companyName) } : {}),
          };

    await createAccountRequest({
      uid,
      email,
      emailKey: key,
      type: b.profile.type,
      profile,
      ipHash: ipH,
      provider,
    });
    return json(origin, { ok: true, status: "pending" });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/signup/social", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}

