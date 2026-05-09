import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Cut, Customer, SalonStats } from '@/types';

function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfWeek(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1; // Monday-based
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfMonth(d = new Date()): number {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Real-time salon stats: cuts (today/week/month), rewards (month),
 * total customers, VIP customers.
 *
 * Computes client-side from the cuts and customers subscriptions to
 * avoid extra Firestore composite indexes.
 */
export function subscribeSalonStats(
  salonId: string,
  cb: (stats: SalonStats) => void,
): () => void {
  let cuts: Cut[] = [];
  let customers: Customer[] = [];

  const compute = () => {
    const tDay = startOfDay();
    const tWeek = startOfWeek();
    const tMonth = startOfMonth();

    let cutsToday = 0;
    let cutsWeek = 0;
    let cutsMonth = 0;
    let rewardsMonth = 0;

    for (const c of cuts) {
      if (c.createdAt >= tDay) cutsToday++;
      if (c.createdAt >= tWeek) cutsWeek++;
      if (c.createdAt >= tMonth) {
        cutsMonth++;
        if (c.wasReward) rewardsMonth++;
      }
    }

    cb({
      cutsToday,
      cutsWeek,
      cutsMonth,
      rewardsMonth,
      totalCustomers: customers.length,
      vipCustomers: customers.filter((c) => c.vip).length,
    });
  };

  const cutsQuery = query(collection(db, 'cuts'), where('salonId', '==', salonId));
  const unsubCuts = onSnapshot(cutsQuery, (snap) => {
    cuts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) }));
    compute();
  });

  const customersQuery = query(
    collection(db, 'customers'),
    where('salonId', '==', salonId),
  );
  const unsubCustomers = onSnapshot(customersQuery, (snap) => {
    customers = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Customer, 'id'>),
    }));
    compute();
  });

  return () => {
    unsubCuts();
    unsubCustomers();
  };
}
