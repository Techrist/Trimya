/**
 * Source de vérité des plans Trimya — côté MOBILE.
 *
 * Ce fichier est MIROIR de `admin/src/lib/plans.ts`. Toute modification
 * doit être répercutée des deux côtés pour rester cohérent entre l'admin
 * (qui pilote les plans) et le mobile (qui les applique).
 *
 * Catégories de plans :
 *  - SALON plans : free, standard, pro     → attachés à 1 salon
 *  - OWNER plans : enterprise              → attachés à 1 propriétaire (couvre N salons)
 *
 * Quand un salon a un `ownerId` et que cet owner a un plan Entreprise actif,
 * le salon hérite automatiquement des features Pro (cf. effectivePlan).
 */

export type SalonPlanId = 'free' | 'standard' | 'pro';
export type OwnerPlanId = 'enterprise' | 'enterprise_standard';
export type PlanId = SalonPlanId | OwnerPlanId;

export interface PlanLimits {
  /** null = illimité. */
  maxClients: number | null;
  maxBarbers: number | null;
  /** null = pas applicable (plans salon). Sinon : limite de salons par owner. */
  maxSalons: number | null;
  messaging: boolean;
  reservations: boolean;
  vipAndNotes: boolean;
  messageTemplates: boolean;
  advancedStats: boolean;
  perBarberStats: boolean;
  prioritySupport: boolean;
  /** Vue consolidée multi-salons côté owner. */
  multiSalonDashboard: boolean;
  /** Édition des horaires d'ouverture + fermetures exceptionnelles. */
  openingHours: boolean;
  /** File d'attente "Je suis en route" (client signale, salon reçoit). */
  queueSignal: boolean;
  /** Abonnement client coupes illimitées (activation/prolongation par salon). */
  subscriptions: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  label: string;
  shortLabel: string;
  /** Prix mensuel en FCFA. 0 pour Free. */
  monthlyPriceFcfa: number;
  tagline: string;
  bullets: string[];
  accent: string;
  limits: PlanLimits;
  /** Plans salon vs plan owner. */
  scope: 'salon' | 'owner';
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    label: 'Découverte',
    shortLabel: 'Free',
    monthlyPriceFcfa: 0,
    tagline: 'Pour démarrer et tester Trimya',
    bullets: [
      'Carte de fidélité 4/4 avec QR',
      'Jusqu\'à 50 clients',
      'Profil salon basique',
    ],
    accent: '#6B6B70',
    scope: 'salon',
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
    id: 'standard',
    label: 'Standard',
    shortLabel: 'Standard',
    monthlyPriceFcfa: 10_000,
    tagline: 'Pour faire grandir ton fichier client',
    bullets: [
      'Clients illimités',
      'Messagerie client ↔ salon',
      'Horaires d\'ouverture configurables',
      'File d\'attente "Je suis en route"',
      'Jusqu\'à 2 coiffeurs',
      'Notes privées + clients VIP',
      'Support par email',
    ],
    accent: '#FF5722',
    scope: 'salon',
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
    id: 'pro',
    label: 'Pro',
    shortLabel: 'Pro',
    monthlyPriceFcfa: 15_000,
    tagline: 'Toute la puissance de Trimya pour un salon ambitieux',
    bullets: [
      'Tout Standard, plus :',
      'Réservations en ligne (prise de RDV)',
      'Abonnement client coupes illimitées',
      'Coiffeurs illimités + stats par coiffeur',
      'Stats avancées (revenus, périodes)',
      'Templates de messages',
      'Support prioritaire WhatsApp',
    ],
    accent: '#FFEB3B',
    scope: 'salon',
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
    id: 'enterprise_standard',
    label: 'Entreprise Standard',
    shortLabel: 'Entreprise S.',
    monthlyPriceFcfa: 25_000,
    tagline: 'Plusieurs salons, features essentielles',
    bullets: [
      'Jusqu\'à 5 salons sous un même compte',
      'Tous les salons inclus passent en Standard',
      'Tableau de bord consolidé multi-salons',
      'Messagerie + file d\'attente + horaires',
      'Transferts de coiffeurs entre salons',
      'Facturation et support unifiés',
    ],
    accent: '#FF5722',
    scope: 'owner',
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
    id: 'enterprise',
    label: 'Entreprise Pro',
    shortLabel: 'Entreprise Pro',
    monthlyPriceFcfa: 40_000,
    tagline: 'Plusieurs salons, toute la puissance Pro',
    bullets: [
      'Jusqu\'à 5 salons sous un même compte',
      'Tous les salons inclus passent en Pro',
      'Tableau de bord consolidé multi-salons',
      'Réservations + abonnements + stats avancées',
      'Transferts de coiffeurs entre salons',
      'Facturation et support prioritaires',
    ],
    accent: '#FFEB3B',
    scope: 'owner',
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
export const SALON_PLAN_IDS: SalonPlanId[] = ['free', 'standard', 'pro'];
export const OWNER_PLAN_IDS: OwnerPlanId[] = ['enterprise_standard', 'enterprise'];

/**
 * Mapping owner plan → plan effectif hérité par chaque salon couvert.
 *  - enterprise_standard → 'standard'
 *  - enterprise          → 'pro'
 */
export function getInheritedSalonPlan(ownerPlan: OwnerPlanId): SalonPlanId {
  return ownerPlan === 'enterprise' ? 'pro' : 'standard';
}

// ─── Helpers i18n pour les strings des plans ─────────────
//
// Les `label`, `tagline` et `bullets` dans la définition `PLANS` ci-dessus
// sont des FALLBACKS en français — utilisés si l'i18n n'est pas disponible
// ou pour la doc. Côté UI, on doit TOUJOURS passer par ces helpers pour
// avoir les versions traduites selon la locale active.
//
// Signature loose pour `t` : on accepte n'importe quelle string parce que
// les clés sont construites dynamiquement (`plan.${id}.bullet${i}`).
// Le système i18n renvoie la clé brute si elle n'existe pas → fallback safe.
type LooseT = (key: any, params?: Record<string, string | number>) => string;

export function getPlanLabel(id: PlanId, t: LooseT): string {
  return t(`plan.${id}.label`);
}

export function getPlanShortLabel(id: PlanId, t: LooseT): string {
  return t(`plan.${id}.shortLabel`);
}

export function getPlanTagline(id: PlanId, t: LooseT): string {
  return t(`plan.${id}.tagline`);
}

/**
 * Renvoie la liste des bullets traduits pour un plan. On itère sur des clés
 * `plan.{id}.bullet1`, `plan.{id}.bullet2`, ... jusqu'à 12 max. La boucle
 * s'arrête dès qu'on trouve une clé qui retourne sa propre valeur (= clé
 * inexistante dans le dico), garantissant qu'on n'affiche aucune string brute.
 */
export function getPlanBullets(id: PlanId, t: LooseT): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const key = `plan.${id}.bullet${i}`;
    const value = t(key);
    if (value === key) break;
    out.push(value);
  }
  return out;
}

export const TRIAL_PRO_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_PRO_MS = TRIAL_PRO_DAYS * DAY_MS;

export interface SalonPlanShape {
  plan?: SalonPlanId;
  planExpiresAt?: number;
  trialEndsAt?: number;
  /** Si défini : le salon appartient à un owner, qui peut avoir son propre plan. */
  ownerId?: string;
  /**
   * Plan dénormalisé hérité de l'owner (cf. Salon.inheritedPlan).
   * Si défini, prend priorité absolue (maintenu par l'admin uniquement
   * quand owner.plan === 'enterprise' actif).
   */
  inheritedPlan?: SalonPlanId;
}

export interface OwnerPlanShape {
  plan?: OwnerPlanId;
  planExpiresAt?: number;
}

/**
 * Plan effectivement appliqué au SALON :
 *  - Si salon.inheritedPlan est défini (owner Entreprise actif) → ce plan
 *  - Sinon si owner explicite passé en arg et en Entreprise actif → 'pro'
 *  - Sinon : essai actif → 'pro', plan expiré → 'free', sinon plan brut
 *
 * Le paramètre `owner` est optionnel. La voie normale (kiosk) repose sur
 * `salon.inheritedPlan` qui est dénormalisé par l'admin. Le param `owner`
 * sert quand l'owner lui-même consulte ses salons et a chargé son doc.
 */
export function effectivePlan(
  salon: SalonPlanShape,
  owner?: OwnerPlanShape | null,
): SalonPlanId {
  const now = Date.now();

  // 1) Héritage dénormalisé : inheritedPlan poussé par l'admin
  if (salon.inheritedPlan) {
    return salon.inheritedPlan;
  }

  // 2) Héritage live : owner chargé explicitement (côté propriétaire)
  if (
    owner &&
    (owner.plan === 'enterprise' || owner.plan === 'enterprise_standard') &&
    (!owner.planExpiresAt || owner.planExpiresAt === 0 || owner.planExpiresAt > now)
  ) {
    return getInheritedSalonPlan(owner.plan);
  }

  // 3) Essai Pro temporaire
  if (salon.trialEndsAt && salon.trialEndsAt > now) return 'pro';

  // 4) Plan brut + check d'expiration
  const raw: SalonPlanId = salon.plan ?? 'free';
  if (raw === 'free') return 'free';
  if (
    salon.planExpiresAt &&
    salon.planExpiresAt > 0 &&
    salon.planExpiresAt < now
  ) {
    return 'free';
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

export function planExpiresInDays(
  s: { plan?: PlanId; planExpiresAt?: number },
): number | null {
  if (!s.plan || s.plan === 'free') return null;
  if (!s.planExpiresAt || s.planExpiresAt === 0) return null;
  const ms = s.planExpiresAt - Date.now();
  return Math.ceil(ms / DAY_MS);
}

export function formatPlanPrice(p: PlanDefinition): string {
  if (p.monthlyPriceFcfa === 0) return 'Gratuit';
  return `${new Intl.NumberFormat('fr-FR').format(p.monthlyPriceFcfa)} FCFA / mois`;
}

/**
 * Vrai si l'owner est en plan Entreprise actif (non expiré).
 * Couvre les deux variantes : `enterprise` (Pro) et `enterprise_standard`.
 * Utilisé pour les vérifications d'éligibilité multi-salons.
 */
export function isOwnerEnterpriseActive(owner: OwnerPlanShape): boolean {
  if (owner.plan !== 'enterprise' && owner.plan !== 'enterprise_standard') {
    return false;
  }
  if (!owner.planExpiresAt || owner.planExpiresAt === 0) return true;
  return owner.planExpiresAt > Date.now();
}
