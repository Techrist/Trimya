import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

/**
 * Configure le seuil de récompense fidélité du salon (1-20).
 * En cas de fidélité partagée côté owner, ce champ est ignoré au profit
 * de owner.chainRewardThreshold (qui surcharge via effectiveRewardThreshold).
 */
export async function setSalonRewardThreshold(
  salonId: string,
  threshold: number,
): Promise<void> {
  const safe = Math.max(1, Math.min(20, Math.round(threshold)));
  await updateDoc(doc(db, 'salons', salonId), { rewardThreshold: safe });
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
 * Enregistre l'UID authentifié comme kiosque autorisé pour ce salon, via
 * la Cloud Function `claimKioskSlot`.
 *
 * Pourquoi une Cloud Function et pas un `updateDoc` direct ? Sécurité.
 * Avant ce fix, la règle Firestore autorisait n'importe quel auth user à
 * ajouter son UID à `salons.{id}.kioskUserIds` — donc n'importe qui qui
 * connaissait un salonId pouvait devenir kiosque de ce salon et lire
 * tous ses clients. La Cloud Function valide en transaction que le code
 * d'activation correspond au salon et n'a pas déjà été consommé.
 *
 * Le second paramètre `code` est obligatoire : c'est le code saisi par
 * l'utilisateur sur SalonActivationScreen. Si l'appel se fait sans code
 * (ré-activation auto), il faut au préalable récupérer un code valide.
 */
export async function registerSalonKioskUid(
  salonId: string,
  code: string,
): Promise<void> {
  const functions = getFunctions(undefined, 'europe-west1');
  const claim = httpsCallable<
    { salonId: string; code: string },
    { ok: boolean; salonId: string }
  >(functions, 'claimKioskSlot');
  await claim({ salonId, code });
}
