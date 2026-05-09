import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Salon } from '@/types';

/**
 * Activate a salon kiosk using a one-time activation code.
 * Codes are pre-provisioned by the developer in Firestore (collection `salons`).
 *
 * Activation is tracked locally on the device (storage.setSalonId) — we don't
 * write back to Firestore so security rules can keep `salons` write-locked.
 */
export async function activateSalonByCode(code: string): Promise<Salon> {
  const normalized = code.trim().toUpperCase();
  const q = query(
    collection(db, 'salons'),
    where('activationCode', '==', normalized),
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('Code invalide. Vérifie auprès de Trimya.');
  }
  const docRef = snap.docs[0];
  const data = docRef.data() as Omit<Salon, 'id'>;
  return { id: docRef.id, ...data };
}

export async function getSalon(salonId: string): Promise<Salon | null> {
  const ref = doc(db, 'salons', salonId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Salon, 'id'>) };
}

export async function setSalonLogo(
  salonId: string,
  logo: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), { logo: logo ?? null });
}
