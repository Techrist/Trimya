"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { Scissors, Gift, Trophy, Clock } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { PeriodFilter } from "@/components/PeriodFilter";
import { Heatmap, buildHeatmap } from "@/components/Heatmap";
import {
  formatDateTime,
  formatNumber,
  formatPrice,
} from "@/lib/format";
import type { Cut, Salon, Period } from "@/lib/types";
import { periodSinceMs, PERIOD_LABELS } from "@/lib/types";
import { cn } from "@/lib/cn";

type CutFilter = "all" | "paid" | "reward";

export default function ActivityPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [salonFilter, setSalonFilter] = useState<string>("");
  const [cutFilter, setCutFilter] = useState<CutFilter>("all");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [cuts, setCuts] = useState<Cut[] | null>(null);

  // Salons for the dropdown
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "salons"), (snap) => {
      setSalons(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Salon)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
    return unsub;
  }, []);

  // Load cuts for the current period (optionally filtered by salon)
  useEffect(() => {
    let cancelled = false;
    setCuts(null);
    const since = periodSinceMs(period);
    const constraints = [];
    if (salonFilter) constraints.push(where("salonId", "==", salonFilter));
    if (since > 0) constraints.push(where("createdAt", ">=", since));

    (async () => {
      const snap = await getDocs(
        query(collection(db, "cuts"), ...constraints),
      );
      if (cancelled) return;
      setCuts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Cut)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [period, salonFilter]);

  const salonNameById = useMemo(
    () => new Map(salons.map((s) => [s.id, s.name] as const)),
    [salons],
  );

  const filtered = useMemo(() => {
    if (!cuts) return null;
    if (cutFilter === "paid") return cuts.filter((c) => !c.wasReward);
    if (cutFilter === "reward") return cuts.filter((c) => c.wasReward);
    return cuts;
  }, [cuts, cutFilter]);

  // Top barbiers across the dataset
  const topBarbers = useMemo(() => {
    if (!cuts) return [];
    const m = new Map<
      string,
      { name: string; salonId: string; cuts: number; revenue: number }
    >();
    for (const c of cuts) {
      const key = `${c.salonId}::${c.barberId ?? "none"}`;
      const name = c.barberName ?? "(Sans barbier)";
      const cur = m.get(key) ?? { name, salonId: c.salonId, cuts: 0, revenue: 0 };
      cur.cuts += 1;
      if (!c.wasReward) cur.revenue += c.price ?? 0;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => b.cuts - a.cuts)
      .slice(0, 10);
  }, [cuts]);

  // Heatmap (uses all cuts, not just filtered, so toggling paid/reward
  // doesn't shrink the heatmap unexpectedly)
  const heatmap = useMemo(
    () => (cuts ? buildHeatmap(cuts.map((c) => c.createdAt)) : null),
    [cuts],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Activité</h1>
          <p className="mt-1 text-sm text-text-muted">
            Historique des coupes, top barbiers et heures de pointe
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Salon
          </label>
          <select
            value={salonFilter}
            onChange={(e) => setSalonFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Tous les salons</option>
            {salons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.city}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Type
          </label>
          <select
            value={cutFilter}
            onChange={(e) => setCutFilter(e.target.value as CutFilter)}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Toutes les coupes</option>
            <option value="paid">Payantes seulement</option>
            <option value="reward">Récompenses seulement</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <CardTitle>Heures de pointe</CardTitle>
            <CardDescription>{PERIOD_LABELS[period]}</CardDescription>
          </div>
          {heatmap ? (
            <Heatmap matrix={heatmap} />
          ) : (
            <div className="h-[180px] animate-pulse rounded bg-surface-elevated" />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <CardTitle>Top barbiers</CardTitle>
            <CardDescription>
              {PERIOD_LABELS[period]} ·{" "}
              {salonFilter
                ? salonNameById.get(salonFilter)
                : "tous salons"}
            </CardDescription>
          </div>
          {!cuts ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-surface-elevated"
                />
              ))}
            </div>
          ) : topBarbers.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Aucune donnée sur cette période.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {topBarbers.map((b, i) => (
                <div
                  key={b.key}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted">
                      {i === 0 ? (
                        <Trophy className="h-3.5 w-3.5 text-accent" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{b.name}</div>
                      <div className="text-xs text-text-dim">
                        {salonNameById.get(b.salonId) ?? b.salonId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-primary">
                      {formatNumber(b.cuts)} coupes
                    </div>
                    <div className="text-xs text-text-dim">
                      {formatPrice(b.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-baseline justify-between">
          <CardTitle>
            Historique des coupes
            {filtered ? (
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({formatNumber(filtered.length)})
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            <Clock className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Les 200 plus récentes affichées
          </CardDescription>
        </div>

        {!filtered ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-surface-elevated"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Aucune coupe pour ces critères.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.slice(0, 200).map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.customerId}`}
                className="flex items-center justify-between py-3 hover:text-primary"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      c.wasReward
                        ? "bg-accent/15 text-accent"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {c.wasReward ? (
                      <Gift className="h-4 w-4" strokeWidth={2.2} />
                    ) : (
                      <Scissors className="h-4 w-4" strokeWidth={2.2} />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {c.wasReward ? "Coupe offerte" : "Coupe payante"}
                    </div>
                    <div className="text-xs text-text-dim">
                      {formatDateTime(c.createdAt)} ·{" "}
                      {salonNameById.get(c.salonId) ?? c.salonId}
                      {c.barberName ? ` · ${c.barberName}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {c.wasReward ? "—" : formatPrice(c.price ?? 0)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
