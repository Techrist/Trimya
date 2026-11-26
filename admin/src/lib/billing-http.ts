import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";
import { withCors } from "./cors";
import { BillingError } from "./billing";
import { SasPayError } from "./saspay";

/** Réponse JSON + CORS (à utiliser sur TOUTES les réponses, erreurs comprises). */
export function json(
  origin: string | null,
  body: unknown,
  status = 200,
): NextResponse {
  return withCors(NextResponse.json(body, { status }), origin);
}

/** Authentifie l'appelant via son Firebase ID token (kiosque anonyme ou owner). */
export async function requireUid(
  req: NextRequest,
  origin: string | null,
): Promise<{ uid: string } | { res: NextResponse }> {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  if (!match) {
    return { res: json(origin, { error: "missing_bearer_token" }, 401) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]!);
    return { uid: decoded.uid };
  } catch {
    return { res: json(origin, { error: "invalid_token" }, 401) };
  }
}

/**
 * Traduit une erreur de facturation / SasPay en réponse sûre (code applicatif
 * whitelisté, jamais de message brut).
 */
export function billingErrorResponse(
  origin: string | null,
  e: unknown,
): NextResponse {
  if (e instanceof BillingError) {
    return json(origin, { error: e.code }, e.httpStatus);
  }
  if (e instanceof SasPayError) {
    // 429 / 5xx / réseau : transitoire. 4xx : on remonte un code lisible.
    if (e.status === 429) return json(origin, { error: "rate_limited" }, 429);
    if (e.status === 0 || e.status >= 500) {
      return json(origin, { error: "payment_provider_unavailable" }, 502);
    }
    const safe = new Set([
      "insufficient_balance",
      "invalid_customer",
      "invalid_method",
      "no_route_available",
      "prepayment_otp_missing",
    ]);
    return json(
      origin,
      { error: safe.has(e.code) ? e.code : "payment_rejected" },
      422,
    );
  }
  return json(origin, { error: "internal_error" }, 500);
}
