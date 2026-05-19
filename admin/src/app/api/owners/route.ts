import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { createOwner } from "@/lib/owners";

const CreateOwnerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  phone: z.string().min(5).max(20).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = CreateOwnerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { uid, tempPassword } = await createOwner(parsed.data);
    return NextResponse.json({ ok: true, uid, tempPassword });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    if (msg.includes("auth/email-already-exists")) {
      return NextResponse.json({ error: "email_already_used" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
