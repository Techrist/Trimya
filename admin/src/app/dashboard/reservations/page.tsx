"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  Reservation,
  ReservationStatus,
  Salon,
  Period,
} from "@/lib/types";
import { periodSinceMs, RESERVATION_SERVICE_LABELS } from "@/lib/types";
import { cn } from "@/lib/cn";

const STATUS_META: Record<
  ReservationStatus,
  { label: string; tone: "success" | "danger" | "muted" | "warn" }
> = {
  pending: { label: "En attente", tone: "warn" },
  confirmed: { label: "Confirmée", tone: "success" },
  refused: { label: "Refusée", tone: "danger" },
  proposed: { label: "Contre-prop.", tone: "warn" },
  cancelled: { label: "Annulée", tone: "danger" },
  completed: { label: "Terminée", tone: "muted" },
};

export default function ReservationsAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [salonFilter, setSalonFilter] = useState<string>("");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setReservations(null);
    const since = periodSinceMs(period);
    const constraints = [];
    if (salonFilter) constraints.push(where("salonId", "==", salonFilter));
    if (since > 0) constraints.push(where("createdAt", ">=", since));

    (async () => {
      const snap = await getDocs(
        query(collection(db, "reservations"), ...constraints),
      );
      if (cancelled) return;
      setReservations(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Reservation)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [period, salonFilter]);

  const stats = useMemo(() => {
    if (!reservations) return null;
    const total = reservations.length;
    const confirmed = reservations.filter((r) => r.status === "confirmed")
      .length;
    const cancelled = reservations.filter((r) => r.status === "cancelled")
      .length;
    const completed = reservations.filter((r) => r.status === "completed")
      .length;
    const refused = reservations.filter((r) => r.status === "refused").length;
    const cancellationRate = total > 0 ? (cancelled + refused) / total : 0;
    return { total, confirmed, cancelled, completed, cancellationRate };
  }, [reservations]);

  const salonNameById = useMemo(
    () => new Map(salons.map((s) => [s.id, s.name] as const)),
    [salons],
  );

  // Volume par salon (top 5)
  const topSalons = useMemo(() => {
    if (!reservations) return [];
    const m = new Map<string, number>();
    for (const r of reservations) {
      m.set(r.salonId, (m.get(r.salonId) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([salonId, count]) => ({
        salonId,
        salonName: salonNameById.get(salonId) ?? salonId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reservations, salonNameById]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Réservations</h1>
          <p className="mt-1 text-sm text-text-muted">
            Volume, taux d&apos;annulation, dernières demandes
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      <div className="min-w-[200px] max-w-sm">
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total"
          value={stats ? formatNumber(stats.total) : "—"}
          icon={CalendarDays}
          tone="primary"
        />
        <KpiCard
          label="Confirmées"
          value={stats ? formatNumber(stats.confirmed) : "—"}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Terminées"
          value={stats ? formatNumber(stats.completed) : "—"}
          icon={Clock}
          tone="accent"
        />
        <KpiCard
          label="Taux d'annulation"
          value={
            stats
              ? `${(stats.cancellationRate * 100).toFixed(1)} %`
              : "—"
          }
          hint="Annulées + refusées / total"
          icon={XCircle}
          tone="neutral"
        />
      </section>

      <Card>
        <CardTitle>Top salons par volume</CardTitle>
        <CardDescription>
          Salons avec le plus de réservations sur la période
        </CardDescription>
        <div className="mt-4 divide-y divide-border">
          {topSalons.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Aucune réservation sur cette période.
            </p>
          ) : null}
          {topSalons.map((s, i) => (
            <div
              key={s.salonId}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.salonName}</span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatNumber(s.count)} réservation{s.count > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Dernières réservations</CardTitle>
        <CardDescription>
          {reservations === null
            ? "Chargement…"
            : reservations.length === 0
              ? "Aucune"
              : `${reservations.length} au total — 100 plus récentes`}
        </CardDescription>

        {reservations === null ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-surface-elevated"
              />
            ))}
          </div>
        ) : reservations.length === 0 ? null : (
          <div className="mt-4 divide-y divide-border">
            {reservations.slice(0, 100).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {r.customerName}
                    {RESERVATION_SERVICE_LABELS[r.service] ? (
                      <span className="text-xs font-normal text-text-muted">
                        · {RESERVATION_SERVICE_LABELS[r.service]}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-text-dim">
                    Prévu pour {formatDateTime(r.scheduledFor)} ·{" "}
                    {salonNameById.get(r.salonId) ?? r.salonId}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status];
  const Icon =
    meta.tone === "success"
      ? CheckCircle2
      : meta.tone === "danger"
        ? XCircle
        : meta.tone === "warn"
          ? AlertCircle
          : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.tone === "success" && "bg-success/15 text-success",
        meta.tone === "danger" && "bg-danger/15 text-danger",
        meta.tone === "warn" && "bg-accent/15 text-accent",
        meta.tone === "muted" && "bg-surface-elevated text-text-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      {meta.label}
    </span>
  );
}
