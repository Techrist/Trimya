import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { logServerError } from "@/lib/api-errors";
import {
  AccountError,
  approveAccount,
  rejectAccount,
  sendApprovalEmail,
} from "@/lib/accounts";

/**
 * PATCH /api/requests/{uid} — l'admin valide ou refuse une demande de compte.
 *  - approve : crée le salon / le compte propriétaire et prévient par email
 *  - reject  : refuse, avec un motif (facultatif) envoyé par email
 *  - resend-email : renvoie l'email de bienvenue d'un compte actif
 */
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("resend-email") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(300).optional() }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  try {
    if (parsed.data.action === "approve") {
      const r = await approveAccount(id, guard.ctx.uid);
      return NextResponse.json({ ok: true, ...r });
    }
    if (parsed.data.action === "resend-email") {
      const emailSent = await sendApprovalEmail(id);
      return NextResponse.json({ ok: true, emailSent });
    }
    await rejectAccount(id, guard.ctx.uid, parsed.data.reason ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccountError) {
      return NextResponse.json({ error: e.code }, { status: e.httpStatus });
    }
    logServerError("requests.patch", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
