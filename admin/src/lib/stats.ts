"use client";

import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase-client";
import { dayKey } from "./format";
import type { Cut, Customer, Salon, Period } from "./types";
import { periodSinceMs } from "./types";
import type { DailyPoint } from "@/components/CutsChart";

/**
 * Lightweight queries that power the dashboard.
 * All counts are computed in memory after one pass per collection.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardStats {
  totalSalons: number;
  activeSalons: number;
  pendingSalons: number;
  totalCustomers: number;
  cutsPeriod: number;
  rewardsPeriod: number;
  revenuePeriod: number;
  revenueAllTime: number;
  daily: DailyPoint[];
  newCustomersDaily: DailyPoint[];
  newSalonsMonthly: { month: string; salons: number }[];
  topSalons: { salonId: string; salonName: string; cuts: number }[];
}

export async function loadDashboardStats(period: Period): Promise<DashboardStats> {
  const since = periodSinceMs(period);

  // 1) Salons (small, fetch all)
  const salonsSnap = await getDocs(collection(db, "salons"));
  const salons = salonsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Salon,
  );

  // 2) Customers count (server-side aggregation)
  const customersCount = await getCountFromServer(collection(db, "customers"));

  // 3) ALL cuts (for revenueAllTime). At small scale this is OK.
  //    Replace by a daily-rollup doc once you cross ~5k cuts.
  const allCutsSnap = await getDocs(collection(db, "cuts"));
  const allCuts = allCutsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Cut,
  );

  const revenueAllTime = allCuts
    .filter((c) => !c.wasReward)
    .reduce((sum, c) => sum + (c.price || 0), 0);

  // Restrict the rest of the calculation to the chosen period
  const periodCuts = since === 0 ? allCuts : allCuts.filter((c) => c.createdAt >= since);

  let cutsPeriod = 0;
  let rewardsPeriod = 0;
  let revenuePeriod = 0;
  const cutsByDay = new Map<string, number>();
  const cutsBySalon = new Map<string, number>();

  // Pre-seed each day in the active window (cap at 90 to keep chart readable)
  const chartDays =
    period === "today"
      ? 1
      : period === "7d"
        ? 7
        : period === "30d"
          ? 30
          : period === "90d"
            ? 90
            : 90;
  const now = Date.now();
  for (let i = chartDays - 1; i >= 0; i--) {
    cutsByDay.set(dayKey(now - i * DAY_MS), 0);
  }

  for (const c of periodCuts) {
    cutsPeriod++;
    if (c.wasReward) rewardsPeriod++;
    else revenuePeriod += c.price || 0;
    cutsBySalon.set(c.salonId, (cutsBySalon.get(c.salonId) ?? 0) + 1);

    if (period !== "all") {
      const key = dayKey(c.createdAt);
      if (cutsByDay.has(key))
        cutsByDay.set(key, (cutsByDay.get(key) ?? 0) + 1);
    } else {
      const key = dayKey(c.createdAt);
      cutsByDay.set(key, (cutsByDay.get(key) ?? 0) + 1);
    }
  }
  const daily: DailyPoint[] = Array.from(cutsByDay.entries()).map(
    ([date, cuts]) => ({ date, cuts }),
  );

  // 4) Top salons (within the chosen period)
  const salonNameById = new Map(salons.map((s) => [s.id, s.name] as const));
  const topSalons = Array.from(cutsBySalon.entries())
    .map(([salonId, cuts]) => ({
      salonId,
      salonName: salonNameById.get(salonId) ?? salonId,
      cuts,
    }))
    .sort((a, b) => b.cuts - a.cuts)
    .slice(0, 5);

  // 5) New customers per day (over the chosen period)
  const newCustsSnap =
    since === 0
      ? await getDocs(collection(db, "customers"))
      : await getDocs(
          query(collection(db, "customers"), where("createdAt", ">=", since)),
        );
  const newCusts = newCustsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Customer,
  );
  const newByDay = new Map<string, number>();
  for (let i = chartDays - 1; i >= 0; i--) {
    newByDay.set(dayKey(now - i * DAY_MS), 0);
  }
  for (const c of newCusts) {
    const k = dayKey(c.createdAt);
    if (newByDay.has(k)) newByDay.set(k, (newByDay.get(k) ?? 0) + 1);
    else if (period === "all") newByDay.set(k, (newByDay.get(k) ?? 0) + 1);
  }
  const newCustomersDaily: DailyPoint[] = Array.from(newByDay.entries()).map(
    ([date, cuts]) => ({ date, cuts }),
  );

  // 6) New salons per month (always show last 12 months)
  const monthMap = new Map<string, number>();
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const k = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() % 100}`;
    monthMap.set(k, 0);
  }
  for (const s of salons) {
    const d = new Date(s.createdAt);
    const k = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() % 100}`;
    if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
  }
  const newSalonsMonthly = Array.from(monthMap.entries()).map(
    ([month, salons]) => ({ month, salons }),
  );

  return {
    totalSalons: salons.length,
    activeSalons: salons.filter((s) => s.activatedAt > 0 && !s.disabledAt)
      .length,
    pendingSalons: salons.filter((s) => s.activatedAt === 0).length,
    totalCustomers: customersCount.data().count,
    cutsPeriod,
    rewardsPeriod,
    revenuePeriod,
    revenueAllTime,
    daily,
    newCustomersDaily,
    newSalonsMonthly,
    topSalons,
  };
}
