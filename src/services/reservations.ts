import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Reservation,
  ReservationService,
  ReservationStatus,
  Customer,
} from '@/types';
import { sendPush } from './push';

interface CreateReservationParams {
  customer: Customer;
  service: ReservationService;
  scheduledFor: number;
  note?: string;
}

export async function createReservation(
  p: CreateReservationParams,
): Promise<Reservation> {
  const ref = doc(collection(db, 'reservations'));
  const now = Date.now();
  const reservation: Reservation = {
    id: ref.id,
    customerId: p.customer.id,
    salonId: p.customer.salonId,
    customerName: p.customer.name || '',
    customerPhone: p.customer.phone,
    service: p.service,
    scheduledFor: p.scheduledFor,
    note: p.note?.trim() || '',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    updatedBy: 'customer',
  };
  await setDoc(ref, reservation);
  return reservation;
}

export function subscribeCustomerReservations(
  customerId: string,
  cb: (list: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'reservations'),
    where('customerId', '==', customerId),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Reservation, 'id'>),
    }));
    list.sort((a, b) => b.scheduledFor - a.scheduledFor);
    cb(list);
  });
}

export function subscribeSalonReservations(
  salonId: string,
  cb: (list: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'reservations'),
    where('salonId', '==', salonId),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Reservation, 'id'>),
    }));
    list.sort((a, b) => b.scheduledFor - a.scheduledFor);
    cb(list);
  });
}

export async function getReservation(id: string): Promise<Reservation | null> {
  const snap = await getDoc(doc(db, 'reservations', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Reservation, 'id'>) };
}

interface UpdateStatusParams {
  reservation: Reservation;
  status: ReservationStatus;
  by: 'customer' | 'salon';
  proposedFor?: number;
  proposedNote?: string;
  refusedReason?: string;
  customer?: Customer | null;
}

export async function updateReservationStatus(
  p: UpdateStatusParams,
): Promise<void> {
  const ref = doc(db, 'reservations', p.reservation.id);
  const patch: Record<string, unknown> = {
    status: p.status,
    updatedAt: Date.now(),
    updatedBy: p.by,
  };
  if (p.proposedFor) patch.proposedFor = p.proposedFor;
  if (p.proposedNote !== undefined) patch.proposedNote = p.proposedNote;
  if (p.refusedReason !== undefined) patch.refusedReason = p.refusedReason;

  // When the customer accepts a salon counter-proposal, lock-in the proposed
  // time as the new scheduledFor so all future displays show the right slot.
  if (
    p.status === 'confirmed' &&
    p.by === 'customer' &&
    p.reservation.status === 'proposed' &&
    p.reservation.proposedFor
  ) {
    patch.scheduledFor = p.reservation.proposedFor;
  }

  await updateDoc(ref, patch);

  const c = p.customer;
  if (
    p.by === 'salon' &&
    c?.pushToken &&
    c.pushEnabled !== false
  ) {
    let title = 'Trimya';
    let body = '';
    switch (p.status) {
      case 'confirmed':
        title = 'Rendez-vous confirmé ✅';
        body = 'Ton coiffeur a confirmé ton créneau.';
        break;
      case 'refused':
        title = 'Rendez-vous refusé';
        body = p.refusedReason || 'Le créneau n\'est pas disponible.';
        break;
      case 'proposed':
        title = 'Nouveau créneau proposé';
        body = 'Ton coiffeur te propose un autre horaire.';
        break;
    }
    if (body) {
      try {
        await sendPush({
          token: c.pushToken,
          title,
          body,
          data: { type: 'reservation', reservationId: p.reservation.id },
        });
      } catch {
        /* ignore */
      }
    }
  }
}

export function formatReservationDateTime(ts: number): {
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

export function serviceLabel(s: ReservationService): string {
  switch (s) {
    case 'cut':
      return 'Coupe';
    case 'beard':
      return 'Barbe';
    case 'cut_beard':
      return 'Coupe + barbe';
    case 'color':
      return 'Coloration';
    case 'other':
      return 'Autre prestation';
  }
}
