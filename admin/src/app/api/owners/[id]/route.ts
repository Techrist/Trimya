import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import {
  DAY_MS,
  getInheritedSalonPlan,
  type OwnerPlanId,
  type SalonPlanId,
} from "@/lib/plans";
import {
  assignSalonToOwner,
  removeSalonFromOwner,
} from "@/lib/owners";

/**
 * Helper : retourne le plan owner actif (non expiré) du doc, ou null.
 * Couvre les deux variantes : `enterprise` (Pro) et `enterprise_standard`.
 */
function activeOwnerPlan(
  owner: Record<string, unknown>,
): OwnerPlanId | null {
  const plan = owner.plan;
  if (plan !== "enterprise" && plan !== "enterprise_standard") return null;
  const exp = typeof owner.planExpiresAt === "number" ? owner.planExpiresAt : 0;
  if (exp !== 0 && exp <= Date.now()) return null;
  return plan;
}

/**
 * Pousse (ou retire) inheritedPlan sur chacun des salons listés.
 * Le tier (`standard` / `pro`) est dérivé du plan owner via getInheritedSalonPlan.
 */
async function syncSalonsInheritedPlan(
  salonIds: string[],
  inheritedPlan: SalonPlanId | null,
): Promise<void> {
  if (salonIds.length === 0) return;
  const batch = adminDb.batch();
  for (const sid of salonIds) {
    batch.update(adminDb.collection("salons").doc(sid), {
      inheritedPlan: inheritedPlan ?? null,
    });
  }
  await batch.commit();
}

/**
 * Actions sur un owner : upgrade plan, extend, downgrade, set-trial,
 * assign/remove salon, désactivation, notes privées.
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upgrade"),
    plan: z.enum(["enterprise", "enterprise_standard"]),
    months: z.number().int().min(1).max(36),
    paymentRef: z.string().max(120).optional(),
  }),
  z.object({ action: z.literal("downgrade") }),
  z.object({
    action: z.literal("extend"),
    months: z.number().int().min(1).max(36),
  }),
  z.object({
    action: z.literal("assign-salon"),
    salonId: z.string().min(1),
  }),
  z.object({
    action: z.literal("remove-salon"),
    salonId: z.string().min(1),
  }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("sync-salons") }),
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

  const ownerRef = adminDb.collection("owners").doc(id);
  const snap = await ownerRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "owner_not_found" }, { status: 404 });
  }
  const data = snap.data() ?? {};
  const now = Date.now();

  try {
    switch (parsed.data.action) {
      case "upgrade": {
        const expiresAt = now + parsed.data.months * 30 * DAY_MS;
        const newOwnerPlan = parsed.data.plan; // 'enterprise' | 'enterprise_standard'
        const batch = adminDb.batch();
        batch.update(ownerRef, {
          plan: newOwnerPlan,
          planActivatedAt: now,
          planExpiresAt: expiresAt,
        });
        if (parsed.data.paymentRef) {
          batch.set(
            ownerRef.collection("private").doc("data"),
            { lastPaymentRef: parsed.data.paymentRef, updatedAt: now },
            { merge: true },
          );
        }
        await batch.commit();
        // Propagation : tous les salons de cet owner héritent du tier correspondant.
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        await syncSalonsInheritedPlan(salonIds, getInheritedSalonPlan(newOwnerPlan));
        return NextResponse.json({ ok: true, plan: newOwnerPlan, planExpiresAt: expiresAt });
      }
      case "extend": {
        const current =
          typeof data.planExpiresAt === "number" && data.planExpiresAt > now
            ? data.planExpiresAt
            : now;
        const newExpiry = current + parsed.data.months * 30 * DAY_MS;
        await ownerRef.update({ planExpiresAt: newExpiry });
        // Si l'owner réactive après une période d'inactivité, on s'assure
        // que l'héritage est posé sur ses salons selon son plan actuel.
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        const ownerPlan = activeOwnerPlan({ ...data, planExpiresAt: newExpiry });
        if (ownerPlan) {
          await syncSalonsInheritedPlan(salonIds, getInheritedSalonPlan(ownerPlan));
        }
        return NextResponse.json({ ok: true, planExpiresAt: newExpiry });
      }
      case "downgrade": {
        await ownerRef.update({
          plan: null,
          planActivatedAt: 0,
          planExpiresAt: 0,
        });
        // Propagation : on retire l'héritage de tous les salons.
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        await syncSalonsInheritedPlan(salonIds, null);
        return NextResponse.json({ ok: true });
      }
      case "assign-salon": {
        await assignSalonToOwner(id, parsed.data.salonId);
        // Si l'owner est en Entreprise actif, le salon hérite immédiatement
        // selon le tier (Standard ou Pro).
        const ownerPlan = activeOwnerPlan(data);
        if (ownerPlan) {
          await syncSalonsInheritedPlan(
            [parsed.data.salonId],
            getInheritedSalonPlan(ownerPlan),
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "remove-salon": {
        await removeSalonFromOwner(id, parsed.data.salonId);
        // On retire l'héritage du salon désaffilié.
        await syncSalonsInheritedPlan([parsed.data.salonId], null);
        return NextResponse.json({ ok: true });
      }
      case "disable": {
        await ownerRef.update({ disabledAt: now });
        return NextResponse.json({ ok: true });
      }
      case "enable": {
        await ownerRef.update({ disabledAt: 0 });
        return NextResponse.json({ ok: true });
      }
      case "sync-salons": {
        // Backfill / réparation manuelle : recalcule inheritedPlan pour chacun
        // des salons de l'owner selon son état Entreprise actuel.
        // Utile après une action manuelle en base ou pour rattraper un état
        // incohérent (héritage non posé).
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        const ownerPlan = activeOwnerPlan(data);
        const target = ownerPlan ? getInheritedSalonPlan(ownerPlan) : null;
        await syncSalonsInheritedPlan(salonIds, target);
        return NextResponse.json({
          ok: true,
          synced: salonIds.length,
          inheritedPlan: target,
        });
      }
      case "notes": {
        const updates: Record<string, unknown> = { updatedAt: now };
        if (parsed.data.adminNotes !== undefined)
          updates.adminNotes = parsed.data.adminNotes;
        if (parsed.data.paymentRef !== undefined)
          updates.lastPaymentRef = parsed.data.paymentRef;
        await ownerRef
          .collection("private")
          .doc("data")
          .set(updates, { merge: true });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    const status = msg === "salon_already_owned" ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
