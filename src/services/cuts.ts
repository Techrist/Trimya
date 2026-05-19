import {
  doc,
  collection,
  runTransaction,
  query,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { db } from './firebase';
import { getApp } from 'firebase/app';
import { Cut, ScanResult, isSubscriptionActive } from '@/types';
import { REWARD_THRESHOLD } from '@/theme';

let functionsInstance: Functions | null = null;
function getFns(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getApp(), 'europe-west1');
  }
  return functionsInstance;
}

/**
 * Atomically add a cut for a customer in a given salon.
 * - Increments currentCount.
 * - If currentCount reaches REWARD_THRESHOLD before this cut (i.e. this cut IS the reward),
 *   the cut is marked as reward and counter resets to 0.
 *
 * Model: 4 paid cuts → 5th is free (reward).
 *   currentCount 0..3 → +1 paid cut, counter becomes 1..4
 *   currentCount 4   → this cut is the FREE reward, counter resets to 0
 *
 * Optional barberId/barberName/price track who did the cut and how much
 * was charged (price is forced to 0 for reward cuts).
 */
/**
 * Tente l'appel Cloud Function sécurisée `addCutSecure` (rate-limit +
 * anti-replay + App Check). Si la fonction n'est pas encore déployée
 * (`unavailable` / `not-found`), retombe sur la transaction client
 * (mode legacy). Cette stratégie permet de migrer progressivement sans
 * casser l'app pendant que la fonction est en cours de déploiement.
 */
export async function addCut(params: {
  customerId: string;
  salonId: string;
  barberId?: string;
  barberName?: string;
  price?: number;
  /** Si fourni : `exp` du payload QR v3 → vérifié serveur. */
  qrExp?: number;
}): Promise<ScanResult> {
  const { customerId, salonId, barberId, barberName, price, qrExp } = params;

  // Tentative Cloud Function en premier.
  try {
    const call = httpsCallable<
      Record<string, unknown>,
      { ok: true; cutId: string; newCount: number; wasReward: boolean; rewardUnlocked: boolean }
    >(getFns(), 'addCutSecure');
    const res = await call({
      customerId,
      salonId,
      barberId,
      barberName,
      price,
      qrExp,
    });
    const r = res.data;
    return {
      customer: {
        id: customerId,
        phone: '',
        salonId,
        currentCount: r.newCount,
        totalCuts: 0,
        totalRewards: 0,
        createdAt: 0,
        lastVisitAt: Date.now(),
      },
      newCount: r.newCount,
      wasReward: r.wasReward,
      rewardUnlocked: r.rewardUnlocked,
    };
  } catch (e: unknown) {
    // Repli sur transaction client si la fonction n'est pas dispo.
    const code = (e as { code?: string }).code ?? '';
    const fallbackOnDeploy =
      code === 'functions/not-found' ||
      code === 'functions/unavailable' ||
      code === 'functions/internal' ||
      code === 'not-found' ||
      code === 'unavailable';
    if (!fallbackOnDeploy) throw e;
  }

  const customerRef = doc(db, 'customers', customerId);
  const cutRef = doc(collection(db, 'cuts'));

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) {
      throw new Error('Client introuvable.');
    }
    const data = snap.data() as {
      currentCount: number;
      totalCuts: number;
      totalRewards: number;
      salonId: string;
      phone: string;
      name?: string;
      subscriptionExpiresAt?: number;
    };

    if (data.salonId !== salonId) {
      throw new Error('Ce client appartient à un autre salon.');
    }

    // ─── Cas client abonné (coupes illimitées) ────────────────
    // Le compteur 4/4 ne bouge pas, ce n'est pas une récompense fidélité,
    // mais on log la coupe et on incrémente totalCuts (statistique d'activité).
    const subscribed = isSubscriptionActive({
      subscriptionExpiresAt: data.subscriptionExpiresAt,
    });
    if (subscribed) {
      tx.update(customerRef, {
        totalCuts: data.totalCuts + 1,
        lastVisitAt: Date.now(),
        // currentCount et totalRewards INCHANGÉS
      });

      const cut: Cut = {
        id: cutRef.id,
        customerId,
        salonId,
        createdAt: Date.now(),
        wasReward: false,
        isSubscription: true,
        ...(barberId ? { barberId } : {}),
        ...(barberName ? { barberName } : {}),
        // Prix forcé à 0 : le client a déjà payé via son abonnement
        price: 0,
      };
      tx.set(cutRef, cut);

      return {
        customer: {
          id: customerId,
          phone: data.phone,
          name: data.name,
          salonId,
          currentCount: data.currentCount,
          totalCuts: data.totalCuts + 1,
          totalRewards: data.totalRewards,
          createdAt: 0,
          lastVisitAt: Date.now(),
          subscriptionExpiresAt: data.subscriptionExpiresAt,
        },
        newCount: data.currentCount,
        wasReward: false,
        rewardUnlocked: false,
      };
    }

    // ─── Cas standard fidélité 4/4 ─────────────────────────────
    const isReward = data.currentCount >= REWARD_THRESHOLD;
    const newCount = isReward ? 0 : data.currentCount + 1;
    const rewardUnlocked = !isReward && newCount === REWARD_THRESHOLD;

    tx.update(customerRef, {
      currentCount: newCount,
      totalCuts: data.totalCuts + 1,
      totalRewards: data.totalRewards + (isReward ? 1 : 0),
      lastVisitAt: Date.now(),
    });

    const cut: Cut = {
      id: cutRef.id,
      customerId,
      salonId,
      createdAt: Date.now(),
      wasReward: isReward,
      ...(barberId ? { barberId } : {}),
      ...(barberName ? { barberName } : {}),
      price: isReward ? 0 : (price ?? 0),
    };
    tx.set(cutRef, cut);

    return {
      customer: {
        id: customerId,
        phone: data.phone,
        name: data.name,
        salonId,
        currentCount: newCount,
        totalCuts: data.totalCuts + 1,
        totalRewards: data.totalRewards + (isReward ? 1 : 0),
        createdAt: 0,
        lastVisitAt: Date.now(),
      },
      newCount,
      wasReward: isReward,
      rewardUnlocked,
    };
  });
}

export function subscribeSalonCuts(
  salonId: string,
  cb: (cuts: Cut[]) => void,
): () => void {
  const q = query(collection(db, 'cuts'), where('salonId', '==', salonId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Cut, 'id'>),
      }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    (err) => {
      console.warn('[cuts] subscribeSalonCuts error:', err.message);
      cb([]);
    },
  );
}

export async function getRecentCuts(
  customerId: string,
  max = 50,
): Promise<Cut[]> {
  const q = query(
    collection(db, 'cuts'),
    where('customerId', '==', customerId),
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) }));
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list.slice(0, max);
}

export function subscribeRecentCuts(
  customerId: string,
  cb: (cuts: Cut[]) => void,
  max = 50,
): () => void {
  const q = query(
    collection(db, 'cuts'),
    where('customerId', '==', customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list.slice(0, max));
    },
    (err) => {
      console.warn('[cuts] subscribeRecentCuts error:', err.message);
      cb([]);
    },
  );
}
