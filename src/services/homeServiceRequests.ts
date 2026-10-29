/**
 * Service de gestion des demandes « coiffeur à domicile ».
 *
 * Flow simplifié (cf. `HomeServiceStatus` dans types/index.ts) :
 *
 *   client crée → PENDING
 *     ├── salon confirme        → CONFIRMED
 *     ├── salon contre-propose  → PROPOSED
 *     │     ├── client accepte  → CONFIRMED (avec barber/créneau proposés appliqués)
 *     │     └── client refuse   → CANCELLED
 *     ├── salon refuse          → REFUSED
 *     └── client annule         → CANCELLED
 *
 *   Le statut COMPLETED est posé manuellement par le salon une fois que le
 *   coiffeur a fini la prestation (ou automatiquement à la prochaine
 *   itération via un trigger sur addCut).
 *
 * Plan gating : Firestore rules exigent le plan Pro côté salon.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  HomeServiceRequest,
  HomeServiceStatus,
  Customer,
  Salon,
} from '@/types';
import { sendPush } from './push';

const COLLECTION = 'homeServiceRequests';

// ─── Création ────────────────────────────────────────────────

interface CreateHomeRequestParams {
  customer: Customer;
  barberId: string;
  barberName: string;
  address: string;
  addressNotes?: string;
  city?: string;
  requestedFor: number;
  message?: string;
  /** Optionnel : pour envoyer une push au salon à la création. */
  salon?: Salon | null;
}

export async function createHomeServiceRequest(
  p: CreateHomeRequestParams,
): Promise<HomeServiceRequest> {
  const ref = doc(collection(db, COLLECTION));
  const now = Date.now();
  const req: HomeServiceRequest = {
    id: ref.id,
    customerId: p.customer.id,
    customerName: p.customer.name || '',
    customerPhone: p.customer.phone,
    salonId: p.customer.salonId,
    barberId: p.barberId,
    barberName: p.barberName,
    address: p.address.trim(),
    ...(p.addressNotes ? { addressNotes: p.addressNotes.trim() } : {}),
    ...(p.city ? { city: p.city.trim() } : {}),
    requestedFor: p.requestedFor,
    ...(p.message ? { message: p.message.trim() } : {}),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    updatedBy: 'customer',
  };
  await setDoc(ref, req);

  // Push au kiosk salon (best effort — pas critique si ça échoue)
  if (p.salon?.kioskPushToken) {
    try {
      await sendPush({
        token: p.salon.kioskPushToken,
        title: '🏠 Nouvelle demande à domicile',
        body: `${req.customerName || req.customerPhone} demande ${req.barberName}.`,
        data: { type: 'homeRequest', requestId: req.id },
      });
    } catch {
      /* ignore */
    }
  }

  return req;
}

// ─── Subscriptions ───────────────────────────────────────────

export function subscribeCustomerHomeRequests(
  customerId: string,
  cb: (list: HomeServiceRequest[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('customerId', '==', customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<HomeServiceRequest, 'id'>),
      }));
      list.sort((a, b) => b.requestedFor - a.requestedFor);
      cb(list);
    },
    (err) => {
      console.warn(
        '[homeRequests] subscribeCustomerHomeRequests:',
        err.message,
      );
      cb([]);
    },
  );
}

export function subscribeSalonHomeRequests(
  salonId: string,
  cb: (list: HomeServiceRequest[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('salonId', '==', salonId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<HomeServiceRequest, 'id'>),
      }));
      // Tri : pending en premier, puis par requestedFor desc
      list.sort((a, b) => {
        const aPending = a.status === 'pending' ? 1 : 0;
        const bPending = b.status === 'pending' ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return b.requestedFor - a.requestedFor;
      });
      cb(list);
    },
    (err) => {
      console.warn('[homeRequests] subscribeSalonHomeRequests:', err.message);
      cb([]);
    },
  );
}

export async function getHomeServiceRequest(
  id: string,
): Promise<HomeServiceRequest | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<HomeServiceRequest, 'id'>) };
}

// ─── Actions ─────────────────────────────────────────────────

interface UpdateStatusParams {
  request: HomeServiceRequest;
  status: HomeServiceStatus;
  by: 'customer' | 'salon';
  /** Pour status='proposed' : un OU plusieurs des 3 champs ci-dessous. */
  proposedBarberId?: string;
  proposedBarberName?: string;
  proposedFor?: number;
  proposeMessage?: string;
  refuseMessage?: string;
  /** Pour push notif après l'update. */
  customer?: Customer | null;
}

export async function updateHomeServiceRequestStatus(
  p: UpdateStatusParams,
): Promise<void> {
  const ref = doc(db, COLLECTION, p.request.id);
  const now = Date.now();
  const patch: Record<string, unknown> = {
    status: p.status,
    updatedAt: now,
    updatedBy: p.by,
  };

  // Champs contre-proposition
  if (p.proposedBarberId !== undefined) patch.proposedBarberId = p.proposedBarberId;
  if (p.proposedBarberName !== undefined) patch.proposedBarberName = p.proposedBarberName;
  if (p.proposedFor !== undefined) patch.proposedFor = p.proposedFor;
  if (p.proposeMessage !== undefined) patch.proposeMessage = p.proposeMessage;
  if (p.refuseMessage !== undefined) patch.refuseMessage = p.refuseMessage;

  // Cas particulier : le client accepte la contre-proposition.
  // On verrouille les champs proposés en valeurs finales et on nettoie les
  // champs « proposed* » pour ne plus polluer l'UI ultérieure.
  if (
    p.status === 'confirmed' &&
    p.by === 'customer' &&
    p.request.status === 'proposed'
  ) {
    if (p.request.proposedBarberId) {
      patch.barberId = p.request.proposedBarberId;
      patch.barberName = p.request.proposedBarberName ?? '';
    }
    if (p.request.proposedFor) {
      patch.requestedFor = p.request.proposedFor;
    }
  }

  await updateDoc(ref, patch);

  // Push notif (best effort) au client lorsque le salon a agi
  if (p.by === 'salon' && p.customer?.pushToken && p.customer.pushEnabled !== false) {
    let title = 'Trimya';
    let body = '';
    switch (p.status) {
      case 'confirmed':
        title = '🏠 Demande confirmée ✅';
        body = `${p.request.barberName} viendra à ton adresse.`;
        break;
      case 'proposed':
        title = '🏠 Nouvelle proposition';
        body = p.proposeMessage || 'Le salon te propose une alternative.';
        break;
      case 'refused':
        title = '🏠 Demande refusée';
        body =
          p.refuseMessage ||
          'Le salon ne peut pas servir ta demande pour le moment.';
        break;
      case 'completed':
        title = '🏠 Prestation terminée';
        body = 'À très bientôt pour la prochaine coupe !';
        break;
    }
    if (body) {
      try {
        await sendPush({
          token: p.customer.pushToken,
          title,
          body,
          data: { type: 'homeRequest', requestId: p.request.id },
        });
      } catch {
        /* ignore */
      }
    }
  }
}

// ─── Helpers d'affichage ─────────────────────────────────────

export function formatHomeRequestDateTime(ts: number): {
  date: string;
  time: string;
  full: string;
} {
  const d = new Date(ts);
  const date = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time, full: `${date} à ${time}` };
}

/** Retourne true si l'utilisateur peut encore agir sur la demande. */
export function isHomeRequestActionable(req: HomeServiceRequest): boolean {
  return (
    req.status === 'pending' ||
    req.status === 'proposed' ||
    req.status === 'confirmed'
  );
}
