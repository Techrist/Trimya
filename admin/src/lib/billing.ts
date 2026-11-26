import "server-only";
import { adminDb } from "./firebase-admin";
import {
  DAY_MS,
  PERIOD_DAYS,
  PLANS,
  PLAN_RANK,
  getInheritedSalonPlan,
  planPriceFor,
  type BillingPeriod,
  type OwnerPlanId,
  type PlanId,
  type SalonPlanId,
} from "./plans";

/**
 * Facturation Trimya — logique métier partagée entre /api/billing/* et le
 * webhook SasPay.
 *
 * Règles produit :
 *  - Deux périodes : mensuelle (30 j) ou annuelle (365 j, 2 mois offerts).
 *  - Même plan, encore actif       → RENOUVELLEMENT : la durée s'ajoute à l'expiration.
 *  - Plan supérieur, encore actif  → UPGRADE : la valeur des jours restants du plan
 *    actuel est déduite du prix, et la nouvelle période démarre maintenant.
 *  - Plan inférieur, encore actif  → REFUSÉ jusqu'à l'expiration (pas de downgrade
 *    en cours de période).
 *  - Salon couvert par un owner Entreprise → il ne peut pas acheter de plan salon.
 */

export type TargetType = "salon" | "owner";
export type PurchaseKind = "new" | "renew" | "upgrade";

/** Prix minimum encaissable (garde-fou si le crédit d'upgrade couvre presque tout). */
export const MIN_CHARGE_FCFA = 500;

export class BillingError extends Error {
  constructor(
    public readonly code:
      | "invalid_target"
      | "forbidden"
      | "target_not_found"
      | "target_disabled"
      | "plan_not_allowed"
      | "covered_by_owner"
      | "downgrade_not_allowed"
      | "already_active"
      | "not_found",
    public readonly httpStatus: number,
  ) {
    super(code);
    this.name = "BillingError";
  }
}

export interface Quote {
  targetType: TargetType;
  targetId: string;
  planId: PlanId;
  period: BillingPeriod;
  kind: PurchaseKind;
  /** Prix catalogue de la période. */
  listPrice: number;
  /** Crédit déduit (valeur des jours restants) — upgrade uniquement. */
  credit: number;
  /** Montant à payer (hors frais SasPay, à la charge du payeur en plus). */
  amount: number;
  currency: "XAF";
  /** Jours de service accordés. */
  days: number;
  /** Date d'expiration prévue après paiement (ms) — indicatif. */
  newExpiresAt: number;
}

const SALON_PLANS: SalonPlanId[] = ["standard", "pro"];
const OWNER_PLANS: OwnerPlanId[] = ["enterprise_standard", "enterprise"];

// ─── Autorisation ───────────────────────────────────────────

/**
 * Vérifie que `uid` peut payer pour la cible :
 *  - salon : l'uid est un kiosque appairé du salon (kioskUserIds)
 *  - owner : l'uid EST le propriétaire (owners/{uid})
 */
export async function assertCanPay(
  uid: string,
  targetType: TargetType,
  targetId: string,
): Promise<Record<string, unknown>> {
  if (targetType === "owner") {
    if (targetId !== uid) throw new BillingError("forbidden", 403);
    const snap = await adminDb.collection("owners").doc(targetId).get();
    if (!snap.exists) throw new BillingError("target_not_found", 404);
    const data = snap.data() ?? {};
    if (typeof data.disabledAt === "number" && data.disabledAt > 0) {
      throw new BillingError("target_disabled", 403);
    }
    return data;
  }

  const snap = await adminDb.collection("salons").doc(targetId).get();
  if (!snap.exists) throw new BillingError("target_not_found", 404);
  const data = snap.data() ?? {};
  const kiosks = Array.isArray(data.kioskUserIds) ? (data.kioskUserIds as string[]) : [];
  if (!kiosks.includes(uid)) throw new BillingError("forbidden", 403);
  if (typeof data.disabledAt === "number" && data.disabledAt > 0) {
    throw new BillingError("target_disabled", 403);
  }
  return data;
}

// ─── Devis ──────────────────────────────────────────────────

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Calcule le devis à partir de l'état ACTUEL de la cible. Le montant est
 * toujours dérivé du catalogue côté serveur.
 */
export function computeQuote(
  targetType: TargetType,
  targetId: string,
  target: Record<string, unknown>,
  planId: PlanId,
  period: BillingPeriod,
  now = Date.now(),
): Quote {
  const allowed = targetType === "salon" ? SALON_PLANS : OWNER_PLANS;
  if (!(allowed as PlanId[]).includes(planId)) {
    throw new BillingError("plan_not_allowed", 422);
  }
  if (targetType === "salon" && target.inheritedPlan) {
    // Salon rattaché à une chaîne Entreprise : le plan est piloté par l'owner.
    throw new BillingError("covered_by_owner", 409);
  }

  const currentPlan = (typeof target.plan === "string" ? target.plan : "free") as PlanId;
  const expiresAt = num(target.planExpiresAt);
  const hasPlan = currentPlan !== "free" && PLANS[currentPlan] !== undefined;
  // expiresAt === 0 avec un plan = plan accordé sans échéance (admin).
  const active = hasPlan && (expiresAt === 0 || expiresAt > now);

  const listPrice = planPriceFor(planId, period);
  const days = PERIOD_DAYS[period];

  let kind: PurchaseKind = "new";
  let credit = 0;
  let startFrom = now;

  if (active) {
    const curRank = PLAN_RANK[currentPlan];
    const newRank = PLAN_RANK[planId];
    if (planId === currentPlan) {
      if (expiresAt === 0) throw new BillingError("already_active", 409);
      kind = "renew";
      startFrom = expiresAt;
    } else if (newRank > curRank) {
      kind = "upgrade";
      if (expiresAt > now) {
        const remainingDays = (expiresAt - now) / DAY_MS;
        credit = Math.floor((remainingDays / 30) * PLANS[currentPlan].monthlyPriceFcfa);
      }
      startFrom = now;
    } else {
      throw new BillingError("downgrade_not_allowed", 409);
    }
  }

  // On ne déduit jamais plus que (prix − minimum encaissable).
  credit = Math.min(credit, Math.max(0, listPrice - MIN_CHARGE_FCFA));
  const amount = Math.max(listPrice - credit, MIN_CHARGE_FCFA);

  return {
    targetType,
    targetId,
    planId,
    period,
    kind,
    listPrice,
    credit,
    amount,
    currency: "XAF",
    days,
    newExpiresAt: startFrom + days * DAY_MS,
  };
}

// ─── Activation ─────────────────────────────────────────────

export interface FulfillResult {
  /** True si CET appel a activé le plan (false = déjà traité). */
  applied: boolean;
  planId: PlanId;
  expiresAt: number;
}

/**
 * Active le plan correspondant au paiement `paymentId`. Idempotent : le doc
 * `payments/{id}` est verrouillé en transaction, `fulfilledAt` empêche toute
 * double activation (webhook rejoué, polling concurrent, retry…).
 *
 * À n'appeler QUE après avoir confirmé `SUCCESS` auprès de SasPay (verify).
 */
export async function fulfillPayment(
  paymentId: string,
  extra: { charged?: number | null } = {},
): Promise<FulfillResult> {
  const payRef = adminDb.collection("payments").doc(paymentId);

  return adminDb.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) throw new BillingError("not_found", 404);
    const pay = paySnap.data() ?? {};
    const planId = pay.planId as PlanId;
    const period = pay.period as BillingPeriod;
    const targetType = pay.targetType as TargetType;
    const targetId = pay.targetId as string;

    if (num(pay.fulfilledAt) > 0) {
      return { applied: false, planId, expiresAt: num(pay.resultingExpiresAt) };
    }

    const targetRef = adminDb
      .collection(targetType === "owner" ? "owners" : "salons")
      .doc(targetId);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) throw new BillingError("target_not_found", 404);
    const target = targetSnap.data() ?? {};

    // Salons de l'owner : lus AVANT toute écriture (contrainte des transactions).
    const salonIds =
      targetType === "owner" && Array.isArray(target.salonIds)
        ? (target.salonIds as string[])
        : [];
    const salonRefs = salonIds.map((sid) => adminDb.collection("salons").doc(sid));
    const salonSnaps = salonRefs.length ? await tx.getAll(...salonRefs) : [];

    const now = Date.now();
    const days = PERIOD_DAYS[period];
    const currentPlan = (typeof target.plan === "string" ? target.plan : "free") as PlanId;
    const curExpiry = num(target.planExpiresAt);
    // Renouvellement du même plan encore actif → on prolonge ; sinon on repart de maintenant.
    const prolongs = currentPlan === planId && curExpiry > now;
    const expiresAt = (prolongs ? curExpiry : now) + days * DAY_MS;

    if (targetType === "salon") {
      tx.update(targetRef, {
        plan: planId,
        planActivatedAt: prolongs ? num(target.planActivatedAt) || now : now,
        planExpiresAt: expiresAt,
        trialEndsAt: 0,
      });
    } else {
      tx.update(targetRef, {
        plan: planId,
        planActivatedAt: prolongs ? num(target.planActivatedAt) || now : now,
        planExpiresAt: expiresAt,
      });
      const inherited = getInheritedSalonPlan(planId as OwnerPlanId);
      salonSnaps.forEach((s) => {
        if (s.exists) tx.update(s.ref, { inheritedPlan: inherited });
      });
    }

    // Référence de paiement : sous-collection privée (jamais dans le doc public).
    tx.set(
      targetRef.collection("private").doc("data"),
      { lastPaymentRef: `saspay:${pay.saspayPaymentId ?? paymentId}`, updatedAt: now },
      { merge: true },
    );

    tx.update(payRef, {
      status: "SUCCESS",
      fulfilledAt: now,
      resultingExpiresAt: expiresAt,
      updatedAt: now,
      ...(extra.charged != null ? { charged: extra.charged } : {}),
    });

    return { applied: true, planId, expiresAt };
  });
}
