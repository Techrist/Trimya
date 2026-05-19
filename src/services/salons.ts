import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';
import { Salon } from '@/types';

/**
 * Activate a salon kiosk using a one-time activation code.
 *
 * Sécurité : la résolution code → salonId passe par la collection dédiée
 * `activationCodes/{code}` qui n'autorise QUE le get par doc id, pas le list.
 * Impossible d'énumérer les codes existants, contrairement à un `where`
 * sur la collection `salons` (qui requérait `list: if true`).
 *
 * L'admin maintient cette collection : à chaque création/régénération de
 * code, un doc `activationCodes/{code}` est créé avec `{ salonId }`.
 */
export async function activateSalonByCode(code: string): Promise<Salon> {
  const normalized = code.trim().toUpperCase();

  // 1) Résoudre le code → salonId via la collection dédiée (lookup-only).
  const codeRef = doc(db, 'activationCodes', normalized);
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) {
    throw new Error('Code invalide. Vérifie auprès de Trimya.');
  }
  const codeData = codeSnap.data() as {
    salonId: string;
    usedAt?: number;
    oneShot?: boolean;
  };

  // 2) Charger le doc salon (lecture restreinte aux authentifiés).
  const salonRef = doc(db, 'salons', codeData.salonId);
  const salonSnap = await getDoc(salonRef);
  if (!salonSnap.exists()) {
    throw new Error('Salon introuvable.');
  }
  const salonData = salonSnap.data() as Omit<Salon, 'id'>;
  if (salonData.disabledAt && salonData.disabledAt > 0) {
    throw new Error('Ce salon est désactivé.');
  }
  return { id: salonSnap.id, ...salonData };
}

/** Souscrit en temps réel à un salon. */
export function subscribeSalon(
  salonId: string,
  cb: (salon: Salon | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'salons', salonId),
    (snap) => {
      cb(
        snap.exists()
          ? { id: snap.id, ...(snap.data() as Omit<Salon, 'id'>) }
          : null,
      );
    },
    (err) => {
      console.warn('[salons] subscribeSalon error:', err.message);
      cb(null);
    },
  );
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

export async function setSalonKioskPushToken(
  salonId: string,
  token: string,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    kioskPushToken: token,
    kioskPushTokenUpdatedAt: Date.now(),
  });
}

/**
 * Register the current authenticated UID as an authorized kiosk for this salon.
 * Used by Firestore rules to enforce that only declared salon kiosks can
 * mutate this salon's customers/cuts/etc.
 */
export async function registerSalonKioskUid(
  salonId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    kioskUserIds: arrayUnion(uid),
    // Marqueur d'activation effective (premier kiosque appairé).
    activatedAt: Date.now(),
  });
}
