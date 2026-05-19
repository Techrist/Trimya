import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Customer,
  CustomerSubscription,
  Salon,
  SUBSCRIPTION_DURATION_MS,
  isSubscriptionActive,
} from '@/types';

/**
 * Service "Abonnement client illimité".
 *
 * Modèle :
 *  - `customers.{id}.subscriptionExpiresAt` : timestamp de fin de la période
 *    en cours. Si > now → client en abonnement actif (coupes illimitées,
 *    compteur 4/4 figé).
 *  - `customerSubscriptions/{id}` : log d'audit de chaque activation /
 *    prolongation (qui, combien, période). Permet de reconstruire le CA
 *    abonnement par salon ou par client.
 *
 * Renouvellement : on PROLONGE — si une période est encore active, on ajoute
 * 30 jours à la date d'expiration actuelle. Sinon on démarre 30 jours à
 * partir de maintenant. Aucune journée payée n'est perdue.
 */

const SUB_COLLECTION = 'customerSubscriptions';

interface ActivateSubscriptionParams {
  customer: Customer;
  salon: Salon;
  amount: number;
}

interface ActivateSubscriptionResult {
  subscription: CustomerSubscription;
  newExpiresAt: number;
  wasExtension: boolean;
}

/**
 * Active ou prolonge l'abonnement du client. À appeler côté salon après
 * encaissement offline du paiement.
 *
 * Returns le doc d'audit + la nouvelle date d'expiration.
 */
export async function activateSubscription(
  p: ActivateSubscriptionParams,
): Promise<ActivateSubscriptionResult> {
  const now = Date.now();
  const uid = auth.currentUser?.uid || 'unknown';

  const wasActive = isSubscriptionActive(p.customer, now);
  const periodStart = wasActive
    ? p.customer.subscriptionExpiresAt!
    : now;
  const newExpiresAt = periodStart + SUBSCRIPTION_DURATION_MS;

  // 1) Met à jour le customer
  const customerPatch: Record<string, unknown> = {
    subscriptionExpiresAt: newExpiresAt,
  };
  if (!p.customer.subscriptionFirstActivatedAt) {
    customerPatch.subscriptionFirstActivatedAt = now;
  }
  await updateDoc(doc(db, 'customers', p.customer.id), customerPatch);

  // 2) Log d'audit dans customerSubscriptions
  const subRef = doc(collection(db, SUB_COLLECTION));
  const subscription: CustomerSubscription = {
    id: subRef.id,
    customerId: p.customer.id,
    salonId: p.customer.salonId,
    periodStart,
    periodEnd: newExpiresAt,
    amount: p.amount,
    wasExtension: wasActive,
    createdAt: now,
    createdBy: uid,
  };
  await setDoc(subRef, subscription);

  return {
    subscription,
    newExpiresAt,
    wasExtension: wasActive,
  };
}

/**
 * Annulation immédiate de l'abonnement (le salon a fait une erreur de saisie,
 * remboursement, etc.). Remet subscriptionExpiresAt à 0 et conserve le log
 * d'audit pour traçabilité.
 */
export async function cancelSubscription(customerId: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), {
    subscriptionExpiresAt: 0,
  });
}

/**
 * Souscrit à l'historique d'abonnement d'un client (ordre antéchronologique).
 * Utilisé pour afficher au salon l'historique des activations du client.
 */
export function subscribeCustomerSubscriptionHistory(
  customerId: string,
  cb: (list: CustomerSubscription[]) => void,
): () => void {
  const q = query(
    collection(db, SUB_COLLECTION),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CustomerSubscription, 'id'>),
        })),
      );
    },
    (err) => {
      console.warn('[subscriptions] history listener error:', err.message);
      cb([]);
    },
  );
}

/**
 * Configure le prix mensuel d'abonnement du salon.
 * Affiché et pré-rempli à chaque activation.
 */
export async function setSalonSubscriptionPrice(
  salonId: string,
  price: number | null,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    subscriptionPrice: price ?? 0,
  });
}

/**
 * Nombre de jours restants sur l'abonnement actuel (arrondi au sup).
 * Renvoie 0 si pas d'abonnement actif.
 */
export function daysRemaining(
  customer: Pick<Customer, 'subscriptionExpiresAt'>,
  now: number = Date.now(),
): number {
  if (!customer.subscriptionExpiresAt || customer.subscriptionExpiresAt <= now) {
    return 0;
  }
  return Math.ceil((customer.subscriptionExpiresAt - now) / (24 * 60 * 60 * 1000));
}

/**
 * Format lisible de la date d'expiration ("15 juin 2026", "15 June 2026").
 */
export function formatExpiry(expiresAt: number, locale = 'fr-FR'): string {
  return new Date(expiresAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
