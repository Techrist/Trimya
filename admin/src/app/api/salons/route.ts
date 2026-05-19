import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { slugify, buildActivationCode } from "@/lib/slug";
import { TRIAL_PRO_MS } from "@/lib/plans";
import { createActivationCode } from "@/lib/activation-codes";

const CreateSalonSchema = z.object({
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  ownerName: z.string().min(2).max(80),
  phone: z.string().min(5).max(20),
  salonId: z.string().min(2).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateSalonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Build a unique salonId
  const baseId = parsed.data.salonId
    ? slugify(parsed.data.salonId)
    : slugify(parsed.data.name);
  if (!baseId) {
    return NextResponse.json({ error: "empty_slug" }, { status: 400 });
  }

  let id = baseId;
  let counter = 1;
  while ((await adminDb.collection("salons").doc(id).get()).exists) {
    counter += 1;
    id = `${baseId}-${counter}`;
    if (counter > 50) {
      return NextResponse.json({ error: "too_many_collisions" }, { status: 500 });
    }
  }

  const now = Date.now();
  const activationCode = buildActivationCode();

  // Création atomique : doc salon + doc activationCode dans une seule
  // transaction (ou batch) pour éviter les états incohérents.
  const batch = adminDb.batch();
  batch.set(adminDb.collection("salons").doc(id), {
    name: parsed.data.name,
    city: parsed.data.city,
    ownerName: parsed.data.ownerName,
    phone: parsed.data.phone,
    // Le champ activationCode reste sur le doc salon UNIQUEMENT pour
    // affichage admin. La résolution code → salonId passe par la collection
    // dédiée `activationCodes` (qui est lookup-only et invalidable).
    activationCode,
    activatedAt: 0,
    createdAt: now,
    kioskUserIds: [],
    plan: "free",
    planActivatedAt: 0,
    planExpiresAt: 0,
    trialEndsAt: now + TRIAL_PRO_MS,
  });
  batch.set(adminDb.collection("activationCodes").doc(activationCode), {
    salonId: id,
    createdAt: now,
    usedAt: 0,
    usedByUid: "",
    oneShot: true,
  });
  await batch.commit();

  return NextResponse.json({
    ok: true,
    salonId: id,
    activationCode,
  });
}
