export type AppMode = 'client' | 'salon' | 'owner';

import type { PlanId, SalonPlanId, OwnerPlanId } from '@/lib/plans';

export interface Salon {
  id: string;
  name: string;
  city?: string;
  ownerName?: string;
  phone?: string;
  logo?: string;
  activationCode: string;
  activatedAt: number;
  createdAt: number;
  currency?: string;
  defaultPrice?: number;
  kioskPushToken?: string;
  kioskPushTokenUpdatedAt?: number;
  /** Firebase Auth UIDs allowed to act as a kiosk for this salon. */
  kioskUserIds?: string[];
  /** UID Firebase du propriétaire (compte 'owner' multi-salons). */
  ownerId?: string;
  /** Plan SALON souscrit (free/standard/pro). Absent = considéré comme 'free'. */
  plan?: SalonPlanId;
  /**
   * Plan hérité de l'owner (uniquement défini si owner.plan === 'enterprise' actif).
   * Champ DÉNORMALISÉ maintenu par l'admin (et nulle part ailleurs côté client) :
   *  - Owner upgrade Entreprise → 'pro' poussé sur chacun de ses salons
   *  - Owner downgrade / expiration → cleared sur tous les salons
   *  - Salon assigné à un owner Entreprise actif → 'pro' poussé sur le salon
   *  - Salon retiré → cleared
   *
   * Cette dénormalisation contourne la limitation : le kiosk salon n'a pas
   * accès au doc owner (règle stricte), donc on apporte l'info à lui.
   */
  inheritedPlan?: SalonPlanId;
  /** Date d'activation du plan payant courant (ms). */
  planActivatedAt?: number;
  /** Expiration du plan payant (ms). 0 = pas d'expiration. */
  planExpiresAt?: number;
  /** Fin de l'essai Pro gratuit (ms). 0 = pas de trial. */
  trialEndsAt?: number;
  /** Désactivation soft pilotée depuis Trimya Admin. */
  disabledAt?: number;
  /** Horaires d'ouverture par jour de la semaine. */
  openingHours?: OpeningHours;
  /** Fermetures exceptionnelles (jours fériés, vacances, etc.). */
  closures?: SalonClosure[];
  /**
   * Prix mensuel d'un abonnement "coupes illimitées" configuré par le salon.
   * Affiché et pré-rempli au moment d'activer un client. Devise = salon.currency.
   */
  subscriptionPrice?: number;
  /**
   * Seuil de récompense fidélité : nombre de coupes payantes avant la coupe
   * offerte. Défaut 4 (4 payées → 5ᵉ offerte). Configurable par le salon.
   * Valeur valide : entier entre 1 et 20.
   */
  rewardThreshold?: number;
  /**
   * Seuil effectivement appliqué (dénormalisé par l'admin) :
   *  - Si l'owner du salon est en mode fidélité partagée → owner.chainRewardThreshold
   *  - Sinon → salon.rewardThreshold
   * Le mobile lit ce champ pour avoir un seul point de vérité.
   */
  effectiveRewardThreshold?: number;
  /**
   * True si l'owner du salon a activé la fidélité partagée (loyaltyMode='shared').
   * Dénormalisé par l'admin pour que le kiosk puisse décider sans lire l'owner.
   */
  loyaltySharedWithOwner?: boolean;
}

/** Format d'une heure : "HH:MM" (24h). */
export type TimeOfDay = string;

/**
 * Horaire d'un jour : ouvert ou fermé, avec heures d'ouverture/fermeture
 * si ouvert. Une seule plage par jour pour le MVP.
 */
export interface DayHours {
  closed: boolean;
  open?: TimeOfDay;  // ex. "09:00"
  close?: TimeOfDay; // ex. "19:00"
}

/** Configuration des horaires hebdomadaires d'un salon. */
export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

/**
 * Fermeture exceptionnelle d'une journée précise (jour férié, vacances,
 * événement spécial). Override les openingHours pour ce jour.
 */
export interface SalonClosure {
  /** Date au format YYYY-MM-DD. */
  date: string;
  /** Raison optionnelle affichée au client (ex. "1er mai", "Vacances"). */
  reason?: string;
}

/** Index d'un jour de la semaine pour mapper Date.getDay() → DayHours. */
export const DAYS_OF_WEEK: (keyof OpeningHours)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Horaires par défaut pour un nouveau salon : ouvert 9h-19h tous les jours sauf dimanche. */
export const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday: { closed: false, open: '09:00', close: '19:00' },
  tuesday: { closed: false, open: '09:00', close: '19:00' },
  wednesday: { closed: false, open: '09:00', close: '19:00' },
  thursday: { closed: false, open: '09:00', close: '19:00' },
  friday: { closed: false, open: '09:00', close: '19:00' },
  saturday: { closed: false, open: '09:00', close: '19:00' },
  sunday: { closed: true },
};

/**
 * Compte propriétaire de salons (plan Entreprise).
 * Stocké dans Firestore à `owners/{uid}` où uid = Firebase Auth UID.
 *
 * Le propriétaire se connecte par email/password et a un dashboard
 * consolidé pour ses N salons. Tous les salons listés dans `salonIds`
 * et dont `salons.{id}.ownerId == this.uid` héritent automatiquement
 * du plan Pro tant que `plan === 'enterprise'` est actif.
 */
export interface Owner {
  id: string;
  email: string;
  name: string;
  phone?: string;
  /** Plan OWNER : 'enterprise' uniquement pour l'instant. */
  plan?: OwnerPlanId;
  planActivatedAt?: number;
  planExpiresAt?: number;
  /**
   * Fin de l'essai Entreprise Pro gratuit accordé à l'owner (ms).
   * 0 ou absent = pas de trial. L'admin propage en cascade
   * `salon.trialEndsAt` sur chaque salon de la chaîne pour que le mobile
   * applique l'effet Pro sans logique supplémentaire (le mécanisme trial
   * existant côté salon prend le relais).
   */
  trialEndsAt?: number;
  /** IDs des salons possédés (dénormalisé pour lookup rapide côté app). */
  salonIds?: string[];
  /**
   * Mode de fidélité pour la chaîne du propriétaire :
   *  - 'shared' : un client compte ses coupes sur tous les salons de la chaîne
   *    (carte unique pour la marque)
   *  - 'blocked' (défaut) : chaque salon est indépendant, le client doit migrer
   *    pour changer de salon
   */
  loyaltyMode?: 'shared' | 'blocked';
  /**
   * Seuil de récompense appliqué à toute la chaîne quand loyaltyMode='shared'.
   * Surcharge le rewardThreshold de chaque salon de la chaîne.
   * Ignoré si loyaltyMode!='shared'. Défaut 4.
   */
  chainRewardThreshold?: number;
  /** Référence de paiement (privée, stockée dans owners/{id}/private/data). */
  createdAt: number;
  /** Désactivation soft. */
  disabledAt?: number;
}

export interface Barber {
  id: string;
  salonId: string;
  name: string;
  photo?: string;
  active: boolean;
  createdAt: number;
}

export interface BarberPeriodStats {
  barber: Barber;
  cutCount: number;
  rewardCount: number;
  totalAmount: number;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  photo?: string;
  salonId: string;
  currentCount: number;
  totalCuts: number;
  totalRewards: number;
  createdAt: number;
  lastVisitAt?: number;
  vip?: boolean;
  notes?: string;
  pushToken?: string;
  pushTokenUpdatedAt?: number;
  pushEnabled?: boolean;
  // ── Informations personnelles enrichies ──────────
  /**
   * Nom de famille du client (optionnel, défini dans le profil).
   * Le champ `name` reste le PRÉNOM affiché partout dans l'app
   * (greetings, listings, etc.) pour ne rien casser. Si tu veux un
   * affichage complet « Prénom Nom », concatène `name + lastName`.
   */
  lastName?: string;
  /** Email du client (optionnel, sert aux reçus + récup compte). */
  email?: string;
  /** Date de naissance en ISO YYYY-MM-DD. */
  birthdate?: string;
  /** Préférences capillaires libres (struct évolutive). */
  preferences?: {
    cutNote?: string;        // ex. "tondeuse 2 sur les côtés"
    beardNote?: string;      // ex. "barbe de 7 jours"
    favoriteBarberId?: string;
    allergies?: string;
  };
  // ── Abonnement "coupes illimitées" ────────────────
  /**
   * Timestamp (ms) de fin de l'abonnement courant.
   * Si > Date.now() → client en abonnement actif (coupes illimitées,
   * compteur 4/4 figé). Si absent ou dépassé → pas d'abonnement actif.
   */
  subscriptionExpiresAt?: number;
  /** Première activation d'abonnement de ce client (ms). Persistant. */
  subscriptionFirstActivatedAt?: number;
  // ── RGPD ─────────────────────────────────────────
  /** Si défini : le client a demandé la suppression. Hard-delete N jours plus tard. */
  deletionRequestedAt?: number;
  /** Timestamp of the most recent salon migration, if any. */
  migratedAt?: number;
  /** Salon the customer was registered with prior to the last migration. */
  previousSalonId?: string;
  /** A pending request from another salon asking the customer to migrate. */
  pendingMigrationTo?: {
    salonId: string;
    salonName: string;
    requestedAt: number;
    expiresAt: number;
  } | null;
}

export type CustomerSort = 'lastVisit' | 'progress' | 'totalCuts' | 'name';

export interface SalonStats {
  cutsToday: number;
  cutsWeek: number;
  cutsMonth: number;
  rewardsMonth: number;
  totalCustomers: number;
  vipCustomers: number;
}

export type SenderRole = 'customer' | 'salon';

export interface Conversation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  customerPhoto?: string;
  customerVip?: boolean;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderRole: SenderRole;
  unreadByCustomer: number;
  unreadBySalon: number;
  lastReadByCustomerAt?: number;
  lastReadBySalonAt?: number;
  createdAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
  createdAt: number;
}

export type ReservationService = 'cut' | 'beard' | 'cut_beard' | 'color' | 'other';

export const RESERVATION_SERVICES: { key: ReservationService; label: string }[] = [
  { key: 'cut', label: 'Coupe' },
  { key: 'beard', label: 'Barbe' },
  { key: 'cut_beard', label: 'Coupe + barbe' },
  { key: 'color', label: 'Coloration' },
  { key: 'other', label: 'Autre' },
];

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'refused'
  | 'proposed'
  | 'cancelled'
  | 'completed';

export interface Reservation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  service: ReservationService;
  scheduledFor: number;
  note?: string;
  status: ReservationStatus;
  proposedFor?: number;
  proposedNote?: string;
  refusedReason?: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: SenderRole;
}

// ═══════════════════════════════════════════════════════════════
// Service à domicile — un client commande UN coiffeur précis pour
// qu'il vienne chez lui. Le salon confirme, contre-propose un autre
// coiffeur/créneau, ou refuse. Inspiré du modèle Reservation.
// ═══════════════════════════════════════════════════════════════

export type HomeServiceStatus =
  | 'pending'    // demande envoyée par le client, en attente côté salon
  | 'confirmed'  // salon a confirmé (ou client a accepté la contre-proposition)
  | 'proposed'   // salon contre-propose un autre coiffeur / créneau
  | 'refused'    // salon refuse la demande
  | 'cancelled'  // client annule
  | 'completed'; // coupe effectuée (auto-marquée après scan QR à domicile)

export interface HomeServiceRequest {
  id: string;
  customerId: string;
  /** Dénormalisé pour affichage côté salon sans relookup. */
  customerName: string;
  customerPhone: string;
  salonId: string;

  /** Coiffeur initialement choisi par le client. */
  barberId: string;
  barberName: string;

  /** Adresse libre (ville, quartier, rue, immeuble). */
  address: string;
  /** Détails complémentaires : « maison verte, portail noir, 2ᵉ étage ». */
  addressNotes?: string;
  /** Ville extraite si renseignée séparément, sinon vide. */
  city?: string;

  /** Timestamp ms du créneau souhaité par le client. */
  requestedFor: number;

  /** Description libre du service voulu (« coupe homme + barbe »). */
  message?: string;

  status: HomeServiceStatus;
  createdAt: number;
  updatedAt: number;
  updatedBy: SenderRole;

  // ── Contre-proposition (status === 'proposed') ──
  /** Coiffeur alternatif proposé par le salon (si différent). */
  proposedBarberId?: string;
  proposedBarberName?: string;
  /** Créneau alternatif proposé (si différent). */
  proposedFor?: number;
  /** Message d'accompagnement de la contre-proposition. */
  proposeMessage?: string;

  // ── Refus ──
  refuseMessage?: string;
}

export interface Cut {
  id: string;
  customerId: string;
  salonId: string;
  createdAt: number;
  wasReward: boolean;
  barberId?: string;
  barberName?: string;
  price?: number;
  /**
   * Coupe effectuée alors que le client avait un abonnement actif.
   * Conséquences :
   *  - le compteur `currentCount` n'incrémente PAS
   *  - `wasReward` reste `false` (ce n'est pas une récompense fidélité)
   *  - le prix est généralement 0 / undefined côté kiosk
   */
  isSubscription?: boolean;
}

/**
 * Document d'historique d'une activation/prolongation d'abonnement.
 * Stocké dans `customerSubscriptions/{id}` pour permettre au salon de
 * voir combien chaque client a dépensé en abonnements au fil du temps.
 */
export interface CustomerSubscription {
  id: string;
  customerId: string;
  salonId: string;
  /** Début de la période payée (ms). */
  periodStart: number;
  /** Fin de la période payée (ms). */
  periodEnd: number;
  /** Montant facturé pour cette période (devise = salon.currency). */
  amount: number;
  /** True si c'était une prolongation d'un abonnement déjà actif. */
  wasExtension: boolean;
  /** Timestamp (ms) de création du document. */
  createdAt: number;
  /** UID Firebase du kiosk qui a activé. */
  createdBy: string;
}

/** Durée d'une période d'abonnement : 30 jours exacts. */
export const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Helper : true si le client a un abonnement actif à `now`. */
export function isSubscriptionActive(
  customer: Pick<Customer, 'subscriptionExpiresAt'>,
  now: number = Date.now(),
): boolean {
  return !!customer.subscriptionExpiresAt && customer.subscriptionExpiresAt > now;
}

/**
 * Renvoie le seuil de récompense effectif d'un salon (avec fallbacks) :
 *  1. effectiveRewardThreshold (poussé par l'admin si fidélité partagée)
 *  2. rewardThreshold (configuré par le salon directement)
 *  3. defaultThreshold (constant fallback)
 */
export function getSalonRewardThreshold(
  salon: Pick<Salon, 'rewardThreshold' | 'effectiveRewardThreshold'> | null | undefined,
  defaultThreshold = 4,
): number {
  if (!salon) return defaultThreshold;
  return (
    salon.effectiveRewardThreshold ??
    salon.rewardThreshold ??
    defaultThreshold
  );
}

/**
 * Avis client laissé après une coupe.
 * Stocké dans `cutReviews/{cutId}` — l'ID est volontairement = cutId pour
 * garantir un seul avis par coupe (idempotence + récup directe par doc.get).
 */
export interface CutReview {
  /** Identique à cuts/{cutId}. */
  id: string;
  cutId: string;
  customerId: string;
  salonId: string;
  /** Coiffeur évalué — pris depuis le cut au moment de l'avis. */
  barberId?: string;
  barberName?: string;
  /** Note de 1 à 5 étoiles. */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Commentaire libre optionnel (max 280 caractères). */
  comment?: string;
  createdAt: number;
  /** Dernière modification (si l'utilisateur a édité dans la fenêtre 24h). */
  updatedAt?: number;
}

/** Fenêtre pendant laquelle un avis reste éditable par le client. */
export const REVIEW_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Coupes plus anciennes que ce délai ne déclenchent plus de prompt d'avis. */
export const REVIEW_PROMPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type StatsPeriod = 'today' | 'week' | 'month' | 'all';

export interface ScanResult {
  customer: Customer;
  newCount: number;
  wasReward: boolean;
  rewardUnlocked: boolean;
}

// ───────────────────────────────────────────────────────────────────
// File d'attente "Je suis en route"
// ───────────────────────────────────────────────────────────────────

/**
 * ETA possibles côté client lorsqu'il signale son arrivée imminente.
 * Liste fermée pour rester simple et éviter les saisies fantaisistes.
 */
export type QueueEta = 5 | 10 | 15 | 30 | 60;

export const QUEUE_ETAS: QueueEta[] = [5, 10, 15, 30, 60];

/**
 * Statut d'une entrée dans la file d'attente "Je suis en route".
 * - signaled : le client a appuyé sur "Je suis en route".
 * - arrived  : le salon a confirmé que le client est arrivé.
 * - cancelled: le client a annulé / le salon a fermé l'entrée.
 * - expired  : l'ETA est dépassée depuis trop longtemps (auto-clean).
 */
export type QueueStatus = 'signaled' | 'arrived' | 'cancelled' | 'expired';

/**
 * Document Firestore d'une entrée dans la file d'attente.
 * Stocké dans `queueEntries/{id}` — un seul document actif par
 * couple (customerId, salonId) à la fois (enforcé côté service).
 */
export interface QueueEntry {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  customerVip?: boolean;
  /** ETA en minutes au moment du signal. */
  etaMinutes: QueueEta;
  /** Timestamp d'arrivée estimée (signalAt + etaMinutes). */
  expectedAt: number;
  status: QueueStatus;
  createdAt: number;
  updatedAt: number;
  /** Quand le salon a marqué l'entrée comme "Arrivé". */
  arrivedAt?: number;
  /** Quand l'entrée a été annulée (par qui que ce soit). */
  cancelledAt?: number;
  /** Qui a annulé l'entrée. */
  cancelledBy?: SenderRole;
}
