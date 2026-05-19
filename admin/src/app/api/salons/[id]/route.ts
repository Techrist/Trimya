import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { buildActivationCode } from "@/lib/slug";
import { rotateActivationCode, deleteActivationCode } from "@/lib/activation-codes";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("regenerate-code") }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("reset-kiosks") }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const salonRef = adminDb.collection("salons").doc(id);
  const snap = await salonRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "salon_not_found" }, { status: 404 });
  }
  const data = snap.data() ?? {};

  switch (parsed.data.action) {
    case "regenerate-code": {
      const newCode = buildActivationCode();
      const oldCode = (data.activationCode as string | undefined) ?? null;

      // Rotation atomique de l'entrée dans `activationCodes/`
      await rotateActivationCode(id, oldCode, newCode);

      // Maj du doc salon + reset des kiosques
      await salonRef.update({
        activationCode: newCode,
        kioskUserIds: [],
        activatedAt: 0,
      });
      return NextResponse.json({ ok: true, activationCode: newCode });
    }
    case "disable": {
      await salonRef.update({ disabledAt: Date.now() });
      return NextResponse.json({ ok: true });
    }
    case "enable": {
      await salonRef.update({ disabledAt: 0 });
      return NextResponse.json({ ok: true });
    }
    case "reset-kiosks": {
      // Invalide le code en cours pour empêcher la ré-association du
      // matériel perdu/volé sur l'ancien code.
      const oldCode = (data.activationCode as string | undefined) ?? null;
      const newCode = buildActivationCode();
      await rotateActivationCode(id, oldCode, newCode);

      await salonRef.update({
        activationCode: newCode,
        kioskUserIds: [],
        activatedAt: 0,
      });
      return NextResponse.json({ ok: true, activationCode: newCode });
    }
  }
}
