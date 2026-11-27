import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import {
  PROMO_MAX_MONTHS,
  PROMO_MAX_PERCENT,
  PROMO_MIN_PERCENT,
  activatePromo,
  deactivatePromo,
  getPromoConfig,
} from "@/lib/promo";
import { logServerError } from "@/lib/api-errors";

/**
 * Offre de lancement (admin uniquement).
 *  GET  → état actuel
 *  POST → { action: "activate", percent, months, includeYearly } | { action: "deactivate" }
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("activate"),
    percent: z.number().int().min(PROMO_MIN_PERCENT).max(PROMO_MAX_PERCENT),
    months: z.number().int().min(1).max(PROMO_MAX_MONTHS),
    includeYearly: z.boolean(),
  }),
  z.object({ action: z.literal("deactivate") }),
]);

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;
  try {
    return NextResponse.json({ ok: true, promo: await getPromoConfig() });
  } catch (e) {
    logServerError("promo.get", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  try {
    if (parsed.data.action === "deactivate") {
      await deactivatePromo(guard.ctx.uid);
      return NextResponse.json({ ok: true, promo: await getPromoConfig() });
    }
    const promo = await activatePromo({ ...parsed.data, by: guard.ctx.uid });
    return NextResponse.json({ ok: true, promo });
  } catch (e) {
    logServerError("promo.set", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
