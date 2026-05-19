/**
 * Source de vérité unique pour les plans Trimya.
 *
 * Ce fichier doit être MIROIR du même fichier dans l'app mobile
 * (`src/lib/plans.ts`). Toute modification ici doit être répercutée
 * de l'autre côté pour garder une vue cohérente entre l'admin
 * et le runtime mobile.
 *
 * Catégories :
 *  - SALON plans : free, standard, pro     → attachés à 1 salon
 *  - OWNER plans : enterprise              → attachés à 1 propriétaire (couvre N salons)
 */

export type SalonPlanId = "free" | "standard" | "pro";
export type OwnerPlanId = "enterprise" | "enterprise_standard";
export type PlanId = SalonPlanId | OwnerPlanId;

export interface PlanLimits {
  maxClients: number | null;
  maxBarbers: number | null;
  /** Plans owner uniquement : limite de salons. null sinon. */
  maxSalons: number | null;
  messaging: boolean;
  reservations: boolean;
  vipAndNotes: boolean;
  messageTemplates: boolean;
  advancedStats: boolean;
  perBarberStats: boolean;
  prioritySupport: boolean;
  multiSalonDashboard: boolean;
  /** Édition des horaires d'ouverture + fermetures exceptionnelles. */
  openingHours: boolean;
  /** File d'attente "Je suis en route". */
  queueSignal: boolean;
  /** Abonnement client coupes illimitées. */
  subscriptions: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  label: string;
  shortLabel: string;
  monthlyPriceFcfa: number;
  tagline: string;
  bullets: string[];
  accent: string;
  limits: PlanLimits;
  scope: "salon" | "owner";
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Découverte",
    shortLabel: "Free",
    monthlyPriceFcfa: 0,
    tagline: "Pour démarrer et tester Trimya",
    bullets: [
      "Carte de fidélité 4/4 avec QR",
      "Jusqu'à 50 clients",
      "Profil salon basique",
    ],
    accent: "#6B6B70",
    scope: "salon",
    limits: {
      maxClients: 50,
      maxBarbers: 1,
      maxSalons: null,
      messaging: false,
      reservations: false,
      vipAndNotes: false,
      messageTemplates: false,
      advancedStats: false,
      perBarberStats: false,
      prioritySupport: false,
      multiSalonDashboard: false,
      openingHours: false,
      queueSignal: false,
      subscriptions: false,
    },
  },
  standard: {
    id: "standard",
    label: "Standard",
    shortLabel: "Standard",
    monthlyPriceFcfa: 10_000,
    tagline: "Pour faire grandir ton fichier client",
    bullets: [
      "Clients illimités",
      "Messagerie client ↔ salon",
      "Horaires d'ouverture configurables",
      "File d'attente \"Je suis en route\"",
      "Jusqu'à 2 coiffeurs",
      "Notes privées + clients VIP",
      "Support par email",
    ],
    accent: "#FF5722",
    scope: "salon",
    limits: {
      maxClients: null,
      maxBarbers: 2,
      maxSalons: null,
      messaging: true,
      reservations: false,
      vipAndNotes: true,
      messageTemplates: false,
      advancedStats: false,
      perBarberStats: false,
      prioritySupport: false,
      multiSalonDashboard: false,
      openingHours: true,
      queueSignal: true,
      subscriptions: false,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    shortLabel: "Pro",
    monthlyPriceFcfa: 15_000,
    tagline: "Toute la puissance de Trimya pour un salon ambitieux",
    bullets: [
      "Tout Standard, plus :",
      "Réservations en ligne (prise de RDV)",
      "Abonnement client coupes illimitées",
      "Coiffeurs illimités + stats par coiffeur",
      "Stats avancées (revenus, périodes)",
      "Templates de messages",
      "Support prioritaire WhatsApp",
    ],
    accent: "#FFEB3B",
    scope: "salon",
    limits: {
      maxClients: null,
      maxBarbers: null,
      maxSalons: null,
      messaging: true,
      reservations: true,
      vipAndNotes: true,
      messageTemplates: true,
      advancedStats: true,
      perBarberStats: true,
      prioritySupport: true,
      multiSalonDashboard: false,
      openingHours: true,
      queueSignal: true,
      subscriptions: true,
    },
  },
  enterprise_standard: {
    id: "enterprise_standard",
    label: "Entreprise Standard",
    shortLabel: "Entreprise S.",
    monthlyPriceFcfa: 25_000,
    tagline: "Plusieurs salons, features essentielles",
    bullets: [
      "Jusqu'à 5 salons sous un même compte",
      "Tous les salons inclus passent en Standard",
      "Tableau de bord consolidé multi-salons",
      "Messagerie + file d'attente + horaires",
      "Transferts de coiffeurs entre salons",
      "Facturation et support unifiés",
    ],
    accent: "#FF5722",
    scope: "owner",
    limits: {
      maxClients: null,
      maxBarbers: 2,
      maxSalons: 5,
      messaging: true,
      reservations: false,
      vipAndNotes: true,
      messageTemplates: false,
      advancedStats: false,
      perBarberStats: false,
      prioritySupport: false,
      multiSalonDashboard: true,
      openingHours: true,
      queueSignal: true,
      subscriptions: false,
    },
  },
  enterprise: {
    id: "enterprise",
    label: "Entreprise Pro",
    shortLabel: "Entreprise Pro",
    monthlyPriceFcfa: 40_000,
    tagline: "Plusieurs salons, toute la puissance Pro",
    bullets: [
      "Jusqu'à 5 salons sous un même compte",
      "Tous les salons inclus passent en Pro",
      "Tableau de bord consolidé multi-salons",
      "Réservations + abonnements + stats avancées",
      "Transferts de coiffeurs entre salons",
      "Facturation et support prioritaires",
    ],
    accent: "#FFEB3B",
    scope: "owner",
    limits: {
      maxClients: null,
      maxBarbers: null,
      maxSalons: 5,
      messaging: true,
      reservations: true,
      vipAndNotes: true,
      messageTemplates: true,
      advancedStats: true,
      perBarberStats: true,
      prioritySupport: true,
      multiSalonDashboard: true,
      openingHours: true,
      queueSignal: true,
      subscriptions: true,
    },
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const SALON_PLAN_IDS: SalonPlanId[] = ["free", "standard", "pro"];
export const OWNER_PLAN_IDS: OwnerPlanId[] = ["enterprise_standard", "enterprise"];

/**
 * Mapping owner plan → plan effectif hérité par chaque salon couvert.
 *  - enterprise_standard → 'standard'
 *  - enterprise          → 'pro'
 */
export function getInheritedSalonPlan(ownerPlan: OwnerPlanId): SalonPlanId {
  return ownerPlan === "enterprise" ? "pro" : "standard";
}

export const TRIAL_PRO_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_PRO_MS = TRIAL_PRO_DAYS * DAY_MS;

export interface SalonPlanShape {
  plan?: SalonPlanId;
  planExpiresAt?: number;
  trialEndsAt?: number;
  ownerId?: string;
  /**
   * Plan dénormalisé hérité de l'owner. Maintenu par l'admin uniquement :
   *  - Owner upgrade Entreprise → 'pro' sur tous ses salons
   *  - Owner downgrade/expire → cleared
   *  - Assign-salon vers owner Entreprise actif → 'pro'
   *  - Remove-salon → cleared
   */
  inheritedPlan?: SalonPlanId;
}

export interface OwnerPlanShape {
  plan?: OwnerPlanId;
  planExpiresAt?: number;
}

export function effectivePlan(
  salon: SalonPlanShape,
  owner?: OwnerPlanShape | null,
): SalonPlanId {
  const now = Date.now();

  // 1) Héritage dénormalisé (poussé par l'admin)
  if (salon.inheritedPlan) {
    return salon.inheritedPlan;
  }

  // 2) Héritage live via owner explicitement chargé
  if (
    owner &&
    (owner.plan === "enterprise" || owner.plan === "enterprise_standard") &&
    (!owner.planExpiresAt || owner.planExpiresAt === 0 || owner.planExpiresAt > now)
  ) {
    return getInheritedSalonPlan(owner.plan);
  }

  if (salon.trialEndsAt && salon.trialEndsAt > now) return "pro";

  const raw: SalonPlanId = salon.plan ?? "free";
  if (raw === "free") return "free";
  if (
    salon.planExpiresAt &&
    salon.planExpiresAt > 0 &&
    salon.planExpiresAt < now
  ) {
    return "free";
  }
  return raw;
}

export function getLimits(
  salon: SalonPlanShape,
  owner?: OwnerPlanShape | null,
): PlanLimits {
  return PLANS[effectivePlan(salon, owner)].limits;
}

export function isTrialActive(salon: SalonPlanShape): boolean {
  return !!salon.trialEndsAt && salon.trialEndsAt > Date.now();
}

export function trialDaysLeft(salon: SalonPlanShape): number {
  if (!salon.trialEndsAt) return 0;
  return Math.max(0, Math.ceil((salon.trialEndsAt - Date.now()) / DAY_MS));
}

export function planExpiresInDays(s: {
  plan?: PlanId;
  planExpiresAt?: number;
}): number | null {
  if (!s.plan || s.plan === "free") return null;
  if (!s.planExpiresAt || s.planExpiresAt === 0) return null;
  const ms = s.planExpiresAt - Date.now();
  return Math.ceil(ms / DAY_MS);
}

export function formatPlanPrice(p: PlanDefinition): string {
  if (p.monthlyPriceFcfa === 0) return "Gratuit";
  return `${new Intl.NumberFormat("fr-FR").format(p.monthlyPriceFcfa)} FCFA / mois`;
}

export function isOwnerEnterpriseActive(owner: OwnerPlanShape): boolean {
  if (owner.plan !== "enterprise" && owner.plan !== "enterprise_standard") {
    return false;
  }
  if (!owner.planExpiresAt || owner.planExpiresAt === 0) return true;
  return owner.planExpiresAt > Date.now();
}
