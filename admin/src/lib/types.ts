/**
 * Shared domain types — kept aligned with /src/types/index.ts in the mobile app.
 */

export type SenderRole = "customer" | "salon";

import type { PlanId, SalonPlanId, OwnerPlanId } from "./plans";

export interface Salon {
  id: string;
  name: string;
  city: string;
  ownerName: string;
  phone: string;
  activationCode: string;
  activatedAt: number;
  createdAt: number;
  disabledAt?: number;
  kioskUserIds?: string[];
  kioskPushToken?: string;
  logoUrl?: string;
  /** UID du propriétaire (compte Owner multi-salons), si attaché. */
  ownerId?: string;
  /** Plan SALON. Absent = considéré comme 'free'. */
  plan?: SalonPlanId;
  /** Date d'activation du plan payant courant (ms). */
  planActivatedAt?: number;
  /** Expiration du plan payant (ms). 0 = pas d'expiration. */
  planExpiresAt?: number;
  /** Fin de l'essai Pro gratuit à l'activation (ms). 0 = pas de trial. */
  trialEndsAt?: number;
}

/**
 * Données privées du salon, stockées dans la sous-collection
 * `salons/{salonId}/private/data`. Lisible uniquement par l'admin et
 * le kiosque autorisé. Ne JAMAIS exposer publiquement.
 */
export interface SalonPrivateData {
  /** Référence libre de paiement (n° transaction, virement…). */
  lastPaymentRef?: string;
  /** Notes internes de l'admin (jamais visibles côté client / salon). */
  adminNotes?: string;
  /** Timestamp de dernière modif des champs privés. */
  updatedAt?: number;
}

/**
 * Compte propriétaire de salons (plan Entreprise). Stocké à
 * `owners/{uid}` où uid = Firebase Auth UID.
 */
export interface Owner {
  id: string;
  email: string;
  name: string;
  phone?: string;
  /** Plan OWNER : 'enterprise' pour l'instant. */
  plan?: OwnerPlanId;
  planActivatedAt?: number;
  planExpiresAt?: number;
  /** IDs des salons possédés (dénormalisé). */
  salonIds?: string[];
  createdAt: number;
  disabledAt?: number;
}

/** Données privées d'un owner (notes admin, ref paiement). */
export interface OwnerPrivateData {
  lastPaymentRef?: string;
  adminNotes?: string;
  updatedAt?: number;
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
  migratedAt?: number;
  previousSalonId?: string;
  pendingMigrationTo?: {
    salonId: string;
    salonName: string;
    requestedAt: number;
    expiresAt: number;
  } | null;
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
}

export interface Barber {
  id: string;
  salonId: string;
  name: string;
  photo?: string;
  active: boolean;
  createdAt: number;
}

export type ReservationService =
  | "cut"
  | "beard"
  | "cut_beard"
  | "color"
  | "other";

export const RESERVATION_SERVICE_LABELS: Record<ReservationService, string> = {
  cut: "Coupe",
  beard: "Barbe",
  cut_beard: "Coupe + barbe",
  color: "Coloration",
  other: "Autre",
};

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "refused"
  | "proposed"
  | "cancelled"
  | "completed";

export interface Reservation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  service: ReservationService;
  scheduledFor: number;
  status: ReservationStatus;
  createdAt: number;
  updatedAt: number;
  updatedBy: SenderRole;
}

export interface Conversation {
  id: string;
  customerId: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
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

export interface AdminPushLog {
  id: string;
  sentBy: string;
  sentAt: number;
  audience:
    | { kind: "salon-customers"; salonId: string; salonName: string }
    | { kind: "all-kiosks" }
    | { kind: "all-customers" };
  title: string;
  body: string;
  deliveredCount: number;
  failedCount: number;
  totalTargets: number;
}

/**
 * Avis client laissé après une coupe.
 * Mirror de `src/types/index.ts > CutReview` côté mobile.
 */
export interface CutReview {
  id: string;
  cutId: string;
  customerId: string;
  salonId: string;
  barberId?: string;
  barberName?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: number;
  updatedAt?: number;
}

/** Period filters used across dashboard / activity views. */
export type Period = "today" | "7d" | "30d" | "90d" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
  all: "Tout",
};

export function periodSinceMs(p: Period): number {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  switch (p) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "7d":
      return now - 7 * DAY;
    case "30d":
      return now - 30 * DAY;
    case "90d":
      return now - 90 * DAY;
    case "all":
      return 0;
  }
}
