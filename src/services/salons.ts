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
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://admin.trimya.app';

/**
 * Active un kiosque salon via code one-shot. Désormais l'activation PASSE
 * ENTIÈREMENT par l'endpoint Vercel `/api/activate` : la résolution
 * code → salon + l'inscription du UID dans `kioskUserIds` + l'invalidation
 * du code se font en une seule transaction côté serveur.
 *
 * Avant : le client faisait d'abord `getDoc(activationCodes/{code})` pour
 * récupérer le salon à afficher, PUIS l'endpoint Vercel pour finaliser.
 * Cette lecture directe exposait les codes à un brute-force (allow get si
 * auth : n'importe quel user anonyme pouvait probe 24M codes).
 *
 * Maintenant : un seul appel réseau, l'endpoint retourne le doc salon dans
 * sa réponse, zéro lecture Firestore côté client sur la collection
 * `activationCodes`.
 */
export async function activateSalonByCode(code: string): Promise<Salon> {
  const normalized = code.trim().toUpperCase();
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
    body: JSON.stringify({ code: normalized }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'internal_error' }));
    const err = (data as { error?: string }).error ?? 'internal_error';
    // On mappe les codes serveur en messages français pour humanizeError.
    if (err === 'invalid_code') throw new Error('Code invalide. Vérifie auprès de Trimya.');
    if (err === 'code_already_used') throw new Error('Ce code a déjà été utilisé.');
    if (err === 'salon_not_found') throw new Error('Salon introuvable.');
    if (err === 'salon_disabled') throw new Error('Ce salon est désactivé.');
    throw new Error(err);
  }
  const data = (await res.json()) as {
    ok: true;
    salonId: string;
    salon: Salon;
  };
  return data.salon;
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
 * @deprecated — Depuis le refactor /api/activate, `activateSalonByCode`
 * fait déjà la transaction complète côté serveur (validation du code +
 * inscription du UID dans `kioskUserIds` + invalidation one-shot).
 *
 * Cette fonction est conservée uniquement pour compat avec les callers
 * existants mais est devenue un no-op. À retirer au prochain refactor
 * de SalonActivationScreen.
 */
export async function registerSalonKioskUid(
  salonId: string,
  code: string,
): Promise<void> {
  void salonId;
  void code;
  // No-op : activateSalonByCode fait déjà toute la transaction côté
  // serveur. Appeler l'endpoint une seconde fois échouerait avec
  // "code_already_used" (le code est one-shot, consommé au premier appel).
}

// ─── Inscription libre d'un salon (email vérifié par code) ─────────────

/** Erreur applicative : `message` = code serveur (ex. `email_already_registered`). */
async function signupCall<T>(
  path: string,
  body: unknown,
  withAuth: boolean,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('missing_bearer_token');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('network_error');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'internal_error');
  return data as T;
}

/** Étape 1 : envoie un code à 6 chiffres à l'email. */
export async function requestSalonSignupCode(email: string): Promise<void> {
  await signupCall('/api/salon-signup/send', { email: email.trim() }, false);
}

export interface SalonSignupInput {
  email: string;
  code: string;
  name: string;
  city: string;
  ownerName: string;
  phone: string;
}

/**
 * Étape 2 : vérifie le code, crée le salon et appaire cet appareil comme
 * kiosque (l'appelant doit déjà avoir une session anonyme Firebase).
 * Renvoie aussi le code de secours à conserver.
 */
export async function createSalonAccount(
  input: SalonSignupInput,
): Promise<{ salon: Salon; activationCode: string }> {
  const r = await signupCall<{ salon: Salon; activationCode: string }>(
    '/api/salon-signup/create',
    { ...input, consent: true },
    true,
  );
  return { salon: r.salon, activationCode: r.activationCode };
}
