import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { DAY_MS } from "@/lib/plans";

/**
 * Gère le plan d'un salon depuis Trimya Admin (Chemin A — paiement manuel).
 *
 * Actions :
 *  - upgrade   : passer un salon à standard/pro avec une durée en mois
 *  - downgrade : forcer le retour à free (annulation, fraude, demande client)
 *  - extend    : prolonger la date d'expiration de N mois
 *  - set-trial : (re)définir un essai Pro de N jours
 *  - notes     : modifier la référence de paiement / notes admin
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upgrade"),
    plan: z.enum(["standard", "pro"]),
    months: z.number().int().min(1).max(36),
    paymentRef: z.string().max(120).optional(),
  }),
  z.object({ action: z.literal("downgrade") }),
  z.object({
    action: z.literal("extend"),
    months: z.number().int().min(1).max(36),
  }),
  z.object({
    action: z.literal("set-trial"),
    days: z.number().int().min(0).max(120),
  }),
  z.object({
    action: z.literal("notes"),
    adminNotes: z.string().max(500).optional(),
    paymentRef: z.string().max(120).optional(),
  }),
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
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const ref = adminDb.collection("salons").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "salon_not_found" }, { status: 404 });
  }
  const data = snap.data() ?? {};
  const now = Date.now();

  switch (parsed.data.action) {
    case "upgrade": {
      const expiresAt = now + parsed.data.months * 30 * DAY_MS;
      const batch = adminDb.batch();
      batch.update(ref, {
        plan: parsed.data.plan,
        planActivatedAt: now,
        planExpiresAt: expiresAt,
        trialEndsAt: 0,
      });
      // La référence de paiement est isolée dans la sous-collection privée :
      // ne pas l'exposer aux lectures publiques du doc salon.
      if (parsed.data.paymentRef) {
        batch.set(
          ref.collection("private").doc("data"),
          { lastPaymentRef: parsed.data.paymentRef, updatedAt: now },
          { merge: true },
        );
      }
      await batch.commit();
      return NextResponse.json({
        ok: true,
        plan: parsed.data.plan,
        planExpiresAt: expiresAt,
      });
    }
    case "downgrade": {
      await ref.update({
        plan: "free",
        planActivatedAt: 0,
        planExpiresAt: 0,
      });
      return NextResponse.json({ ok: true, plan: "free" });
    }
    case "extend": {
      const current =
        typeof data.planExpiresAt === "number" && data.planExpiresAt > now
          ? data.planExpiresAt
          : now;
      const newExpiry = current + parsed.data.months * 30 * DAY_MS;
      await ref.update({ planExpiresAt: newExpiry });
      return NextResponse.json({ ok: true, planExpiresAt: newExpiry });
    }
    case "set-trial": {
      const trialEndsAt =
        parsed.data.days === 0 ? 0 : now + parsed.data.days * DAY_MS;
      await ref.update({ trialEndsAt });
      return NextResponse.json({ ok: true, trialEndsAt });
    }
    case "notes": {
      // adminNotes + lastPaymentRef sont SENSIBLES → sous-collection privée.
      const updates: Record<string, unknown> = { updatedAt: now };
      if (parsed.data.adminNotes !== undefined)
        updates.adminNotes = parsed.data.adminNotes;
      if (parsed.data.paymentRef !== undefined)
        updates.lastPaymentRef = parsed.data.paymentRef;
      await ref.collection("private").doc("data").set(updates, { merge: true });
      return NextResponse.json({ ok: true });
    }
  }
}
