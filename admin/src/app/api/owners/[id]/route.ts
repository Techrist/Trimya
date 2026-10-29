import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { classifyError, logServerError } from "@/lib/api-errors";
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
 * Propage un trial owner sur les salons : pour chaque salon de la chaîne,
 * on écrit `salon.trialEndsAt = max(existing, ownerTrial)`.
 *
 * Pourquoi le `max` ? Un salon peut avoir un trial individuel plus long
 * que celui de l'owner (par exemple obtenu avant son rattachement à la
 * chaîne). On ne veut pas le raccourcir.
 *
 * Si `ownerTrialEndsAt === 0` (= annulation), on NE TOUCHE PAS les salons :
 * leurs trials individuels restent valides. C'est volontaire — un admin
 * qui veut tout couper doit faire le ménage salon par salon.
 */
async function propagateOwnerTrialToSalons(
  salonIds: string[],
  ownerTrialEndsAt: number,
): Promise<void> {
  if (salonIds.length === 0 || ownerTrialEndsAt <= 0) return;
  // Lecture des trials actuels pour préserver les plus longs.
  const refs = salonIds.map((sid) => adminDb.collection("salons").doc(sid));
  const snaps = await adminDb.getAll(...refs);
  const batch = adminDb.batch();
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const existing = typeof data.trialEndsAt === "number" ? data.trialEndsAt : 0;
    const next = Math.max(existing, ownerTrialEndsAt);
    if (next !== existing) {
      batch.update(snap.ref, { trialEndsAt: next });
    }
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
    action: z.literal("set-trial"),
    days: z.number().int().min(0).max(120),
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
      case "set-trial": {
        // Accorde (ou annule) un essai Pro à l'owner, et propage sur
        // chacun de ses salons via salon.trialEndsAt. Le mécanisme de
        // bascule en Pro pendant l'essai est déjà géré côté salon
        // (effectivePlan prend trialEndsAt en priorité).
        const trialEndsAt =
          parsed.data.days === 0 ? 0 : now + parsed.data.days * DAY_MS;
        await ownerRef.update({ trialEndsAt });
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        // En cas d'annulation (trialEndsAt=0), on ne touche pas aux salons
        // pour préserver d'éventuels trials individuels en cours.
        if (trialEndsAt > 0) {
          await propagateOwnerTrialToSalons(salonIds, trialEndsAt);
        }
        return NextResponse.json({
          ok: true,
          trialEndsAt,
          propagatedSalons: trialEndsAt > 0 ? salonIds.length : 0,
        });
      }
      case "assign-salon": {
        await assignSalonToOwner(id, parsed.data.salonId);
        // 1) Si l'owner est en Entreprise actif → inheritedPlan immédiat
        //    (Standard ou Pro selon le tier).
        const ownerPlan = activeOwnerPlan(data);
        if (ownerPlan) {
          await syncSalonsInheritedPlan(
            [parsed.data.salonId],
            getInheritedSalonPlan(ownerPlan),
          );
        }
        // 2) Si l'owner a un essai Pro actif → le propage sur le nouveau
        //    salon. Le max() interne préserve un éventuel trial individuel
        //    plus long que celui de l'owner (cas rare mais propre).
        const ownerTrialEndsAt =
          typeof data.trialEndsAt === "number" ? data.trialEndsAt : 0;
        if (ownerTrialEndsAt > now) {
          await propagateOwnerTrialToSalons(
            [parsed.data.salonId],
            ownerTrialEndsAt,
          );
        }
        return NextResponse.json({
          ok: true,
          inheritedPlanApplied: ownerPlan
            ? getInheritedSalonPlan(ownerPlan)
            : null,
          trialApplied: ownerTrialEndsAt > now ? ownerTrialEndsAt : null,
        });
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
        // des salons de l'owner selon son état Entreprise actuel, et
        // ré-applique l'essai owner s'il est actif.
        // Utile après une action manuelle en base ou pour rattraper un état
        // incohérent (héritage non posé, trial pas propagé).
        const salonIds = Array.isArray(data.salonIds) ? (data.salonIds as string[]) : [];
        const ownerPlan = activeOwnerPlan(data);
        const target = ownerPlan ? getInheritedSalonPlan(ownerPlan) : null;
        // Trial propagation pendant le sync — le max() évite les régressions
        // si certains salons ont déjà un trial plus long.
        const ownerTrialEndsAt =
          typeof data.trialEndsAt === "number" ? data.trialEndsAt : 0;
        if (ownerTrialEndsAt > now) {
          await propagateOwnerTrialToSalons(salonIds, ownerTrialEndsAt);
        }
        await syncSalonsInheritedPlan(salonIds, target);
        return NextResponse.json({
          ok: true,
          synced: salonIds.length,
          inheritedPlan: target,
          trialApplied: ownerTrialEndsAt > now ? ownerTrialEndsAt : null,
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
    logServerError("owners.patch", e);
    const code = classifyError(e);
    const status = code === "salon_already_owned" ? 409 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
