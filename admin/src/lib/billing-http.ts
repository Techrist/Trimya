import "server-only";
import type { NextResponse } from "next/server";
import { json } from "./http";
import { BillingError } from "./billing";
import { SasPayError } from "./saspay";

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

export { json, requireUid } from "./http";
