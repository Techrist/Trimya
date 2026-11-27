import { NextRequest } from "next/server";
import { z } from "zod";
import { assertCanPay, computeQuote, getPaidMonthlyRate } from "@/lib/billing";
import { billingErrorResponse, json, requireUid } from "@/lib/billing-http";
import { getActivePromo } from "@/lib/promo";
import { handleOptions } from "@/lib/cors";
import { logServerError } from "@/lib/api-errors";

/**
 * POST /api/billing/quote — devis (prix réel, crédit d'upgrade, expiration).
 * Aucun effet de bord : sert uniquement à afficher le bon montant dans l'app.
 */
const Body = z.object({
  targetType: z.enum(["salon", "owner"]),
  targetId: z.string().min(1).max(128),
  planId: z.enum(["standard", "pro", "enterprise_standard", "enterprise"]),
  period: z.enum(["monthly", "yearly"]),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const auth = await requireUid(req, origin);
  if ("res" in auth) return auth.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);
  const b = parsed.data;

  try {
    const target = await assertCanPay(auth.uid, b.targetType, b.targetId);
    const quote = computeQuote(
      b.targetType,
      b.targetId,
      target,
      b.planId,
      b.period,
      Date.now(),
      await getActivePromo(),
      await getPaidMonthlyRate(b.targetType, b.targetId),
    );
    return json(origin, { ok: true, quote });
  } catch (e) {
    logServerError("billing.quote", e);
    return billingErrorResponse(origin, e);
  }
}
