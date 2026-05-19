import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Customer,
  QueueEntry,
  QueueEta,
  QueueStatus,
  Salon,
  SenderRole,
} from '@/types';
import { sendPush } from './push';

/**
 * Service "File d'attente" : un client signale son arrivée imminente
 * pour réduire le temps d'attente côté salon. Une seule entrée active
 * (statut `signaled`) par client/salon à la fois.
 *
 * Convention : on garde l'historique récent (arrived/cancelled/expired)
 * dans la même collection pour pouvoir afficher les passages du jour.
 */

const COLLECTION = 'queueEntries';

/**
 * Récupère l'entrée active du client (statut `signaled`) si elle existe.
 * Utilisé pour éviter les doublons quand un client retape "Je suis en route".
 */
export async function findActiveEntryForCustomer(
  customerId: string,
): Promise<QueueEntry | null> {
  const q = query(
    collection(db, COLLECTION),
    where('customerId', '==', customerId),
    where('status', '==', 'signaled' as QueueStatus),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<QueueEntry, 'id'>) };
}

interface SignalArrivalParams {
  customer: Customer;
  etaMinutes: QueueEta;
  salon?: Salon | null;
}

/**
 * Crée une entrée dans la file d'attente. Si une entrée active existe déjà,
 * on la met à jour avec le nouvel ETA (le client a changé d'avis) plutôt
 * que d'en créer une seconde.
 *
 * Envoie une notif push au salon si on a un kioskPushToken disponible.
 */
export async function signalArrival(
  p: SignalArrivalParams,
): Promise<QueueEntry> {
  const now = Date.now();
  const expectedAt = now + p.etaMinutes * 60 * 1000;

  const existing = await findActiveEntryForCustomer(p.customer.id);
  if (existing) {
    const ref = doc(db, COLLECTION, existing.id);
    await updateDoc(ref, {
      etaMinutes: p.etaMinutes,
      expectedAt,
      updatedAt: now,
    });
    const updated: QueueEntry = {
      ...existing,
      etaMinutes: p.etaMinutes,
      expectedAt,
      updatedAt: now,
    };
    notifySalonIfPossible(p.salon, updated, 'updated');
    return updated;
  }

  const ref = doc(collection(db, COLLECTION));
  const entry: QueueEntry = {
    id: ref.id,
    customerId: p.customer.id,
    salonId: p.customer.salonId,
    customerName: p.customer.name || '',
    customerPhone: p.customer.phone,
    customerVip: p.customer.vip || false,
    etaMinutes: p.etaMinutes,
    expectedAt,
    status: 'signaled',
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, entry);
  notifySalonIfPossible(p.salon, entry, 'created');
  return entry;
}

/**
 * Annulation du signal — par le client ou par le salon.
 * On garde la trace en passant simplement le statut à `cancelled`.
 */
export async function cancelQueueEntry(
  entryId: string,
  by: SenderRole,
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, COLLECTION, entryId), {
    status: 'cancelled' as QueueStatus,
    cancelledAt: now,
    cancelledBy: by,
    updatedAt: now,
  });
}

/**
 * Marque le client comme physiquement arrivé. Action salon uniquement.
 */
export async function markQueueEntryArrived(entryId: string): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, COLLECTION, entryId), {
    status: 'arrived' as QueueStatus,
    arrivedAt: now,
    updatedAt: now,
  });
}

/**
 * Souscrit aux entrées actives d'un salon (signaled + arrived dans la journée).
 * Utilisé pour la section "File d'attente" côté salon.
 *
 * En cas d'erreur (typiquement permission-denied tant que les règles Firestore
 * n'ont pas été déployées), on log silencieusement et on renvoie une liste vide
 * plutôt que de laisser onSnapshot remonter un crash non-géré.
 */
export function subscribeSalonQueue(
  salonId: string,
  cb: (list: QueueEntry[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('salonId', '==', salonId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QueueEntry, 'id'>),
      }));
      // On filtre les entrées encore pertinentes :
      // - tout ce qui est `signaled`
      // - les `arrived` de moins de 4h (utile pour debrief salon)
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
      const filtered = all.filter((e) => {
        if (e.status === 'signaled') return true;
        if (e.status === 'arrived' && (e.arrivedAt || 0) >= cutoff) return true;
        return false;
      });
      // Signalés d'abord (par expectedAt croissant), puis arrivés récents.
      filtered.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'signaled' ? -1 : 1;
        }
        if (a.status === 'signaled') {
          return a.expectedAt - b.expectedAt;
        }
        return (b.arrivedAt || 0) - (a.arrivedAt || 0);
      });
      cb(filtered);
    },
    (err) => {
      console.warn('[queue] subscribeSalonQueue error:', err.message);
      cb([]);
    },
  );
}

/**
 * Souscrit à l'entrée active du client courant (statut `signaled`).
 * Utilisé pour afficher l'état "Je suis en route" sur le dashboard client.
 *
 * Même garde-fou que subscribeSalonQueue : permission-denied → null silencieux.
 */
export function subscribeCustomerActiveEntry(
  customerId: string,
  cb: (entry: QueueEntry | null) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('customerId', '==', customerId),
    where('status', '==', 'signaled' as QueueStatus),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        cb(null);
        return;
      }
      const d = snap.docs[0];
      cb({ id: d.id, ...(d.data() as Omit<QueueEntry, 'id'>) });
    },
    (err) => {
      console.warn('[queue] subscribeCustomerActiveEntry error:', err.message);
      cb(null);
    },
  );
}

/**
 * Format lisible d'un ETA : "5 min", "1 h".
 */
export function formatEta(eta: QueueEta): string {
  if (eta >= 60) return `${Math.round(eta / 60)} h`;
  return `${eta} min`;
}

// ───────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────

async function notifySalonIfPossible(
  salon: Salon | null | undefined,
  entry: QueueEntry,
  kind: 'created' | 'updated',
): Promise<void> {
  const token = salon?.kioskPushToken;
  if (!token) return;
  const who = entry.customerName?.trim() || entry.customerPhone || 'Un client';
  const title =
    kind === 'created'
      ? '🚶 Client en route'
      : '🔄 ETA mis à jour';
  const body = `${who} arrive dans ${formatEta(entry.etaMinutes)}.`;
  try {
    await sendPush({
      token,
      title,
      body,
      data: { type: 'queue', entryId: entry.id, salonId: entry.salonId },
    });
  } catch {
    /* ignore — pas critique si le push échoue */
  }
}
