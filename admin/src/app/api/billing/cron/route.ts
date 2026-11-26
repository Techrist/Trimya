import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { sendExpiryReminder } from "@/lib/billing-notify";
import { syncSalonsInheritedPlan } from "@/lib/owners";
import { DAY_MS, PLANS, type PlanId } from "@/lib/plans";

/**
 * GET /api/billing/cron — tâche quotidienne (Vercel Cron, cf. vercel.json).
 *
 *  1. Plans Entreprise expirés : retire `inheritedPlan` des salons de la
 *     chaîne. Sans ça, `inheritedPlan` (prioritaire dans les règles
 *     Firestore ET dans l'app) laissait les salons en Pro indéfiniment.
 *  2. Rappel J-3 avant expiration (email owner / push kiosque), une seule
 *     fois par échéance.
 *
 * Protégé par `Authorization: Bearer $CRON_SECRET` (envoyé par Vercel Cron).
 * Les plans salon expirés n'ont rien à faire : `effectivePlan` les ramène
 * à Free automatiquement (règles + app).
 */
export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MS = 3 * DAY_MS;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  const report = { ownersExpired: 0, salonsCleared: 0, reminders: 0, errors: 0 };

  // 1) Owners dont le plan Entreprise est échu
  try {
    const expired = await adminDb
      .collection("owners")
      .where("planExpiresAt", ">", 0)
      .where("planExpiresAt", "<", now)
      .get();
    for (const o of expired.docs) {
      const d = o.data();
      if (!d.plan) continue;
      const salonIds = Array.isArray(d.salonIds) ? (d.salonIds as string[]) : [];
      if (salonIds.length === 0) continue;
      const snaps = await adminDb.getAll(
        ...salonIds.map((sid) => adminDb.collection("salons").doc(sid)),
      );
      const toClear = snaps
        .filter((s) => s.exists && s.data()?.inheritedPlan)
        .map((s) => s.id);
      if (toClear.length) {
        await syncSalonsInheritedPlan(toClear, null);
        report.ownersExpired += 1;
        report.salonsCleared += toClear.length;
      }
    }
  } catch (e) {
    report.errors += 1;
    logServerError("billing.cron.owners", e);
  }

  // 2) Rappels J-3
  for (const coll of ["salons", "owners"] as const) {
    try {
      const soon = await adminDb
        .collection(coll)
        .where("planExpiresAt", ">", now)
        .where("planExpiresAt", "<=", now + REMINDER_WINDOW_MS)
        .get();
      for (const doc of soon.docs) {
        const d = doc.data();
        const plan = d.plan as PlanId | undefined;
        if (!plan || plan === "free" || !PLANS[plan]) continue;
        const expiresAt = d.planExpiresAt as number;
        const priv = doc.ref.collection("private").doc("data");
        const privSnap = await priv.get();
        if (privSnap.data()?.reminderForExpiry === expiresAt) continue;
        try {
          await sendExpiryReminder({
            targetType: coll === "owners" ? "owner" : "salon",
            targetId: doc.id,
            planLabel: PLANS[plan].label,
            expiresAt,
          });
          await priv.set({ reminderForExpiry: expiresAt }, { merge: true });
          report.reminders += 1;
        } catch (e) {
          report.errors += 1;
          logServerError("billing.cron.reminder", e);
        }
      }
    } catch (e) {
      report.errors += 1;
      logServerError(`billing.cron.${coll}`, e);
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
