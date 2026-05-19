import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { CustomerSubscription, OpeningHours, QueueEntry } from '@/types';

/**
 * Service d'agrégation pour les tableaux de bord propriétaire et admin.
 *
 * Toutes les fonctions sont des **lectures à la demande** (one-shot), pas des
 * subscriptions live. C'est volontaire :
 *  - Les métriques agrégées changent lentement (échelle horaire)
 *  - Maintenir une subscription live sur des collections potentiellement
 *    grandes (cuts, customerSubscriptions) coûte cher en reads facturés
 *  - Un pull-to-refresh manuel est suffisant pour ce use case
 *
 * Pattern : fonctions atomiques par salon, à appeler en boucle côté caller
 * pour agréger sur N salons d'un owner.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Abonnements ──────────────────────────────────────────────

export interface SubscriptionMetrics {
  /** Nombre d'abonnements actuellement actifs (subscriptionExpiresAt > now). */
  activeCount: number;
  /** CA total des activations/prolongations du mois calendaire courant. */
  revenueThisMonth: number;
  /** Nombre d'activations (nouvelles + prolongations) du mois courant. */
  activationsThisMonth: number;
}

/**
 * Compte les abonnements actifs du salon (clients avec subscriptionExpiresAt
 * dans le futur) + agrège le CA et les activations du mois calendaire courant.
 */
export async function getSalonSubscriptionMetrics(
  salonId: string,
): Promise<SubscriptionMetrics> {
  const now = Date.now();
  const monthStart = startOfCurrentMonth().getTime();

  // 1) Compteur d'actifs : on filtre customers du salon avec subscriptionExpiresAt > now.
  // Pas d'index disjoint disponible, on prend le compte agrégé puis on filtre côté client
  // pour les actifs. Pour un salon avec < 1000 clients, c'est raisonnable.
  // (À optimiser plus tard avec un index composite + count si volume grandit.)
  let activeCount = 0;
  try {
    const customersSnap = await getDocs(
      query(
        collection(db, 'customers'),
        where('salonId', '==', salonId),
        where('subscriptionExpiresAt', '>', now),
      ),
    );
    activeCount = customersSnap.size;
  } catch {
    // L'index composite (salonId + subscriptionExpiresAt) peut manquer.
    // Fallback : lecture complète + filtre client.
    const all = await getDocs(
      query(collection(db, 'customers'), where('salonId', '==', salonId)),
    );
    activeCount = all.docs.filter((d) => {
      const v = d.data().subscriptionExpiresAt as number | undefined;
      return !!v && v > now;
    }).length;
  }

  // 2) Activations du mois → on lit customerSubscriptions du salon depuis le 1er du mois.
  let revenueThisMonth = 0;
  let activationsThisMonth = 0;
  try {
    const subsSnap = await getDocs(
      query(
        collection(db, 'customerSubscriptions'),
        where('salonId', '==', salonId),
        where('createdAt', '>=', monthStart),
      ),
    );
    for (const d of subsSnap.docs) {
      const sub = d.data() as CustomerSubscription;
      activationsThisMonth += 1;
      revenueThisMonth += sub.amount || 0;
    }
  } catch {
    // Ignore si index manque — métriques restent à 0.
  }

  return { activeCount, revenueThisMonth, activationsThisMonth };
}

// ─── File d'attente ───────────────────────────────────────────

export interface QueueMetrics {
  /** Nb de signaux émis aujourd'hui (créés depuis minuit). */
  signaledToday: number;
  /** Nb de signaux émis sur les 7 derniers jours. */
  signaledWeek: number;
  /**
   * Taux d'arrivée sur les 7 derniers jours, en % (0-100).
   * arrived / (arrived + cancelled). Null si aucune entrée terminée.
   */
  arrivalRate: number | null;
}

/**
 * Statistiques d'utilisation de la file d'attente "Je suis en route" pour un salon.
 */
export async function getSalonQueueMetrics(
  salonId: string,
): Promise<QueueMetrics> {
  const now = Date.now();
  const dayStart = startOfToday().getTime();
  const weekStart = now - 7 * DAY_MS;

  try {
    const snap = await getDocs(
      query(
        collection(db, 'queueEntries'),
        where('salonId', '==', salonId),
        where('createdAt', '>=', weekStart),
      ),
    );
    const entries = snap.docs.map((d) => d.data() as QueueEntry);

    const signaledToday = entries.filter((e) => e.createdAt >= dayStart).length;
    const signaledWeek = entries.length;

    const arrived = entries.filter((e) => e.status === 'arrived').length;
    const cancelled = entries.filter((e) => e.status === 'cancelled').length;
    const finalized = arrived + cancelled;
    const arrivalRate = finalized > 0 ? Math.round((arrived / finalized) * 100) : null;

    return { signaledToday, signaledWeek, arrivalRate };
  } catch {
    return { signaledToday: 0, signaledWeek: 0, arrivalRate: null };
  }
}

// ─── Horaires d'ouverture ─────────────────────────────────────

export interface OpeningHoursMetrics {
  /** Le salon a au moins un jour configuré (openingHours non null). */
  configured: boolean;
  /** Nombre de jours ouverts dans la semaine. */
  openDaysCount: number;
}

/**
 * Indicateur de complétude des horaires pour un salon. Lecture du doc salon
 * directement (sans count agrégé), s'appuie sur le doc déjà disponible
 * côté caller pour éviter une read inutile.
 */
export function computeOpeningHoursMetrics(
  openingHours: OpeningHours | null | undefined,
): OpeningHoursMetrics {
  if (!openingHours) {
    return { configured: false, openDaysCount: 0 };
  }
  const days: (keyof OpeningHours)[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const openDays = days.filter((d) => !openingHours[d]?.closed).length;
  return { configured: true, openDaysCount: openDays };
}

// ─── Helpers internes ────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Agrégation multi-salons (pour OwnerDashboard) ───────────

export interface OwnerAggregatedMetrics {
  totalActiveSubscriptions: number;
  totalSubscriptionRevenueThisMonth: number;
  totalSignaledToday: number;
  totalSignaledWeek: number;
  /** Salons avec horaires configurés / total. */
  salonsWithHours: number;
  totalSalons: number;
}

/**
 * Agrège les métriques de tous les salons d'un owner. Lecture parallèle pour
 * minimiser la latence.
 */
export async function getOwnerAggregatedMetrics(
  salons: { id: string; openingHours?: OpeningHours }[],
): Promise<OwnerAggregatedMetrics> {
  if (salons.length === 0) {
    return {
      totalActiveSubscriptions: 0,
      totalSubscriptionRevenueThisMonth: 0,
      totalSignaledToday: 0,
      totalSignaledWeek: 0,
      salonsWithHours: 0,
      totalSalons: 0,
    };
  }

  const subsResults = await Promise.all(
    salons.map((s) => getSalonSubscriptionMetrics(s.id)),
  );
  const queueResults = await Promise.all(
    salons.map((s) => getSalonQueueMetrics(s.id)),
  );

  return {
    totalActiveSubscriptions: subsResults.reduce((s, x) => s + x.activeCount, 0),
    totalSubscriptionRevenueThisMonth: subsResults.reduce(
      (s, x) => s + x.revenueThisMonth,
      0,
    ),
    totalSignaledToday: queueResults.reduce((s, x) => s + x.signaledToday, 0),
    totalSignaledWeek: queueResults.reduce((s, x) => s + x.signaledWeek, 0),
    salonsWithHours: salons.filter(
      (s) => computeOpeningHoursMetrics(s.openingHours).configured,
    ).length,
    totalSalons: salons.length,
  };
}
