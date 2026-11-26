import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { json, requireUid } from "@/lib/http";
import { consumeLimit, RateLimitError } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/account-utils";

/**
 * POST /api/owner/salons/{id}/password — le propriétaire change le mot de
 * passe de connexion d'un de SES salons (salon créé par lui). Les sessions
 * ouvertes du salon sont révoquées.
 *
 * Le compte du salon est retrouvé via `accounts` (serveur uniquement), pas
 * via le doc salon que le kiosque peut modifier.
 */
const Body = z.object({ password: passwordSchema });

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get("origin");
  const auth = await requireUid(req, origin);
  if ("res" in auth) return auth.res;
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "weak_password" }, 400);

  try {
    await consumeLimit(`owner-salon-pw:${auth.uid}`, 10, 60 * 60 * 1000);

    const salon = await adminDb.collection("salons").doc(id).get();
    if (!salon.exists || salon.data()?.ownerId !== auth.uid) {
      return json(origin, { error: "forbidden" }, 403);
    }
    const acc = await adminDb
      .collection("accounts")
      .where("salonId", "==", id)
      .where("createdByOwnerId", "==", auth.uid)
      .limit(1)
      .get();
    if (acc.empty) return json(origin, { error: "no_login_account" }, 404);

    const uid = acc.docs[0]!.id;
    await adminAuth.updateUser(uid, { password: parsed.data.password });
    await adminAuth.revokeRefreshTokens(uid);
    return json(origin, { ok: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("owner/salons/password", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
