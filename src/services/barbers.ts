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
import { Barber } from '@/types';
import { pickPhotoSquare } from './photos';

interface CreateBarberInput {
  salonId: string;
  name: string;
  photo?: string;
}

export async function createBarber(input: CreateBarberInput): Promise<Barber> {
  const ref = doc(collection(db, 'barbers'));
  const barber: Barber = {
    id: ref.id,
    salonId: input.salonId,
    name: input.name.trim(),
    photo: input.photo,
    active: true,
    createdAt: Date.now(),
  };
  await setDoc(ref, barber);
  return barber;
}

export async function updateBarber(
  id: string,
  patch: Partial<Pick<Barber, 'name' | 'photo' | 'active'>>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.photo !== undefined) update.photo = patch.photo;
  if (patch.active !== undefined) update.active = patch.active;
  await updateDoc(doc(db, 'barbers', id), update);
}

export async function getBarber(id: string): Promise<Barber | null> {
  const snap = await getDoc(doc(db, 'barbers', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Barber, 'id'>) };
}

export function subscribeBarbers(
  salonId: string,
  cb: (list: Barber[]) => void,
  options: { activeOnly?: boolean } = {},
): () => void {
  const q = query(collection(db, 'barbers'), where('salonId', '==', salonId));
  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Barber, 'id'>),
      }));
      if (options.activeOnly) {
        list = list.filter((b) => b.active);
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      cb(list);
    },
    (err) => {
      console.warn('[barbers] subscribeBarbers error:', err.message);
      cb([]);
    },
  );
}

export const pickBarberPhoto = pickPhotoSquare;
