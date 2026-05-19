"use client";

import { useEffect, useState } from "react";
import {
  Store,
  Users,
  Scissors,
  Gift,
  Wallet,
  Coins,
  Clock,
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { CutsChart } from "@/components/CutsChart";
import { BarChartSimple } from "@/components/BarChartSimple";
import { PeriodFilter } from "@/components/PeriodFilter";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { loadDashboardStats, type DashboardStats } from "@/lib/stats";
import { formatNumber, formatPrice } from "@/lib/format";
import { PERIOD_LABELS, type Period } from "@/lib/types";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDashboardStats(period)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Erreur de chargement");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-text-muted">
            Plateforme Trimya — période :{" "}
            <span className="text-text">{PERIOD_LABELS[period]}</span>
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      {err ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {err}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Salons actifs"
          value={stats ? `${stats.activeSalons} / ${stats.totalSalons}` : "—"}
          hint={
            stats && stats.pendingSalons > 0
              ? `${stats.pendingSalons} en attente d'activation`
              : "Tous activés"
          }
          icon={Store}
          tone="primary"
        />
        <KpiCard
          label="Clients fidélisés"
          value={stats ? formatNumber(stats.totalCustomers) : "—"}
          hint="Comptes inscrits, tous salons"
          icon={Users}
          tone="accent"
        />
        <KpiCard
          label={`Coupes (${PERIOD_LABELS[period].toLowerCase()})`}
          value={stats ? formatNumber(stats.cutsPeriod) : "—"}
          icon={Scissors}
          tone="primary"
        />
        <KpiCard
          label={`Récompenses (${PERIOD_LABELS[period].toLowerCase()})`}
          value={stats ? formatNumber(stats.rewardsPeriod) : "—"}
          hint="5ᵉ coupes offertes"
          icon={Gift}
          tone="accent"
        />
        <KpiCard
          label={`Revenu (${PERIOD_LABELS[period].toLowerCase()})`}
          value={stats ? formatPrice(stats.revenuePeriod) : "—"}
          hint="Coupes payantes uniquement"
          icon={Wallet}
          tone="success"
        />
        <KpiCard
          label="Revenu cumulé total"
          value={stats ? formatPrice(stats.revenueAllTime) : "—"}
          hint="Toutes périodes confondues"
          icon={Coins}
          tone="success"
        />
        <KpiCard
          label="Coupes / jour"
          value={
            stats
              ? formatNumber(
                  Math.round(
                    stats.cutsPeriod /
                      Math.max(
                        1,
                        period === "today"
                          ? 1
                          : period === "7d"
                            ? 7
                            : period === "30d"
                              ? 30
                              : period === "90d"
                                ? 90
                                : 90,
                      ),
                  ),
                )
              : "—"
          }
          icon={Clock}
          tone="neutral"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <CardTitle>Coupes par jour</CardTitle>
            <CardDescription>{PERIOD_LABELS[period]}</CardDescription>
          </div>
          {stats ? (
            <CutsChart data={stats.daily} />
          ) : (
            <div className="h-[260px] animate-pulse rounded bg-surface-elevated" />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <CardTitle>Nouveaux clients par jour</CardTitle>
            <CardDescription>{PERIOD_LABELS[period]}</CardDescription>
          </div>
          {stats ? (
            <BarChartSimple
              data={stats.newCustomersDaily}
              xKey="date"
              yKey="cuts"
              color="#FFEB3B"
            />
          ) : (
            <div className="h-[220px] animate-pulse rounded bg-surface-elevated" />
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-baseline justify-between">
          <CardTitle>Nouveaux salons par mois</CardTitle>
          <CardDescription>12 derniers mois</CardDescription>
        </div>
        {stats ? (
          <BarChartSimple
            data={stats.newSalonsMonthly}
            xKey="month"
            yKey="salons"
            color="#FF5722"
            height={200}
          />
        ) : (
          <div className="h-[200px] animate-pulse rounded bg-surface-elevated" />
        )}
      </Card>

      <Card>
        <CardTitle>Top salons</CardTitle>
        <CardDescription>
          Par nombre de coupes sur la période
        </CardDescription>
        <div className="mt-4 divide-y divide-border">
          {stats?.topSalons.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Aucune coupe sur cette période.
            </p>
          ) : null}
          {stats?.topSalons.map((s, i) => (
            <div key={s.salonId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.salonName}</span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatNumber(s.cuts)} coupes
              </span>
            </div>
          )) ?? null}
          {!stats && loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="py-3">
                  <div className="h-5 animate-pulse rounded bg-surface-elevated" />
                </div>
              ))
            : null}
        </div>
      </Card>
    </div>
  );
}
