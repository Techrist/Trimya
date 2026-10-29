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

/**
 * Transfère un coiffeur d'un salon source vers un autre salon de la même
 * chaîne (= même owner). Réservé au propriétaire connecté en mode owner :
 *  - La rule Firestore exige isOwner(source) ET isOwner(destination),
 *    ce qui garantit côté serveur que les deux salons partagent le même
 *    ownerId. Inutile de re-vérifier côté client.
 *  - L'historique des coupes (cuts.salonId) reste inchangé : les stats
 *    par établissement gardent leur cohérence historique. Le coiffeur,
 *    lui, bascule pour les nouvelles coupes.
 *  - L'agrégat de notes (cutReviews indexé par barberId) suit automatiquement
 *    le coiffeur — sa réputation voyage avec lui.
 */
export async function transferBarber(params: {
  barberId: string;
  fromSalonId: string;
  toSalonId: string;
}): Promise<void> {
  if (params.fromSalonId === params.toSalonId) {
    throw new Error('transfer_same_salon');
  }
  await updateDoc(doc(db, 'barbers', params.barberId), {
    salonId: params.toSalonId,
  });
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
