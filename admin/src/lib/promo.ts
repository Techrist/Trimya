import "server-only";
import { adminDb } from "./firebase-admin";

/**
 * Offre de lancement : remise en % sur les paiements d'abonnement, pour
 * les salons ET les propriétaires, pendant une durée limitée.
 *
 * Stockée dans `appConfig/launchPromo` (collection fermée aux clients : seul le
 * serveur la lit / l'écrit). La remise s'arrête toute seule à `endsAt` : on
 * compare toujours la date à l'instant du devis, aucune tâche planifiée.
 */
export interface Promo {
  active: boolean;
  percent: number;
  startedAt: number;
  endsAt: number;
  /** Si faux, seule la formule mensuelle est remisée. */
  includeYearly: boolean;
}

const REF = () => adminDb.collection("appConfig").doc("launchPromo");

export const PROMO_MIN_PERCENT = 5;
export const PROMO_MAX_PERCENT = 90;
export const PROMO_MAX_MONTHS = 12;

function parse(data: Record<string, unknown> | undefined): Promo | null {
  if (!data) return null;
  const percent = typeof data.percent === "number" ? data.percent : 0;
  const endsAt = typeof data.endsAt === "number" ? data.endsAt : 0;
  return {
    active: data.active === true,
    percent,
    startedAt: typeof data.startedAt === "number" ? data.startedAt : 0,
    endsAt,
    includeYearly: data.includeYearly === true,
  };
}

/** Promo configurée (même expirée ou désactivée) — pour l'écran admin. */
export async function getPromoConfig(): Promise<Promo | null> {
  const snap = await REF().get();
  return snap.exists ? parse(snap.data()) : null;
}

/** Promo en cours à l'instant `now`, ou null. */
export async function getActivePromo(now = Date.now()): Promise<Promo | null> {
  const p = await getPromoConfig();
  if (!p || !p.active) return null;
  if (!(p.percent >= PROMO_MIN_PERCENT && p.percent <= PROMO_MAX_PERCENT)) return null;
  if (p.endsAt <= now) return null;
  return p;
}

export async function activatePromo(input: {
  percent: number;
  months: number;
  includeYearly: boolean;
  by: string;
}): Promise<Promo> {
  const now = Date.now();
  const end = new Date(now);
  end.setMonth(end.getMonth() + input.months);
  const promo: Promo = {
    active: true,
    percent: input.percent,
    startedAt: now,
    endsAt: end.getTime(),
    includeYearly: input.includeYearly,
  };
  await REF().set({ ...promo, activatedBy: input.by, updatedAt: now });
  return promo;
}

export async function deactivatePromo(by: string): Promise<void> {
  await REF().set({ active: false, deactivatedBy: by, updatedAt: Date.now() }, { merge: true });
}
