import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Salon } from '@/types';

/**
 * URL du backend admin Vercel qui héberge l'endpoint `/api/activate`.
 * Remplace la Cloud Function Firebase `claimKioskSlot` (qui exigeait le
 * plan Blaze non activé au Cameroun). Override via EXPO_PUBLIC_ADMIN_API_URL
 * en dev si besoin.
 */
const ADMIN_API_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://trimya-admin.vercel.app';

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
  // Migration de Cloud Function (plan Blaze non activé au Cameroun) vers
  // endpoint Vercel admin /api/activate. L'auth se fait par Firebase ID
  // token du user anonyme (ou authentifié) — le serveur vérifie avec
  // adminAuth.verifyIdToken avant de toucher à Firestore.
  //
  // Note : le paramètre `salonId` n'est pas envoyé — le serveur le dérive
  // du code d'activation (source de vérité). On le garde dans la signature
  // pour compat avec les appelants existants.
  void salonId;

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Session anonyme manquante. Redémarre l\'application.');
  }
  const idToken = await user.getIdToken();

  const res = await fetch(`${ADMIN_API_URL}/api/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'internal_error' }));
    const code = (data as { error?: string }).error ?? 'internal_error';
    throw new Error(code);
  }
}
