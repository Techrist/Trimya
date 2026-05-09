import {
  doc,
  collection,
  runTransaction,
  query,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { Cut, ScanResult } from '@/types';
import { REWARD_THRESHOLD } from '@/theme';

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
export async function addCut(params: {
  customerId: string;
  salonId: string;
  barberId?: string;
  barberName?: string;
  price?: number;
}): Promise<ScanResult> {
  const { customerId, salonId, barberId, barberName, price } = params;
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
    };

    if (data.salonId !== salonId) {
      throw new Error('Ce client appartient à un autre salon.');
    }

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
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Cut, 'id'>),
    }));
    list.sort((a, b) => b.createdAt - a.createdAt);
    cb(list);
  });
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
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) }));
    list.sort((a, b) => b.createdAt - a.createdAt);
    cb(list.slice(0, max));
  });
}
