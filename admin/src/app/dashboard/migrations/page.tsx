"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { ArrowRightLeft, AlertTriangle, Clock } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Customer, Salon, Period } from "@/lib/types";
import { periodSinceMs } from "@/lib/types";

/**
 * Trimya does not yet keep a separate `migrations/` collection.
 * We reconstruct the picture from two signals on `customers`:
 *  - `migratedAt` + `previousSalonId` → an accepted migration
 *  - `pendingMigrationTo` → an in-flight request awaiting consent
 */
export default function MigrationsPage() {
  const [period, setPeriod] = useState<Period>("90d");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [migrated, setMigrated] = useState<Customer[] | null>(null);
  const [pending, setPending] = useState<Customer[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "salons"), (snap) => {
      setSalons(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Salon),
      );
    });
    return unsub;
  }, []);

  // Pending migration requests (live)
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "customers"),
        where("pendingMigrationTo", "!=", null),
      ),
      (snap) => {
        setPending(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer),
        );
      },
    );
    return unsub;
  }, []);

  // Accepted migrations within period
  useEffect(() => {
    let cancelled = false;
    setMigrated(null);
    const since = periodSinceMs(period);
    const constraints =
      since > 0
        ? [
            where("migratedAt", ">=", since),
            orderBy("migratedAt", "desc"),
          ]
        : [where("migratedAt", ">", 0), orderBy("migratedAt", "desc")];

    (async () => {
      const snap = await getDocs(
        query(collection(db, "customers"), ...constraints),
      );
      if (cancelled) return;
      setMigrated(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer));
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const salonNameById = useMemo(
    () => new Map(salons.map((s) => [s.id, s.name] as const)),
    [salons],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Migrations</h1>
          <p className="mt-1 text-sm text-text-muted">
            Suivi des clients qui changent de salon
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Migrations acceptées"
          value={migrated ? formatNumber(migrated.length) : "—"}
          icon={ArrowRightLeft}
          tone="primary"
        />
        <KpiCard
          label="Demandes en attente"
          value={formatNumber(pending.length)}
          hint="En attente de consentement client"
          icon={Clock}
          tone="accent"
        />
        <KpiCard
          label="TTL des demandes"
          value="5 min"
          hint="Expiration automatique"
          icon={AlertTriangle}
          tone="neutral"
        />
      </section>

      {pending.length > 0 ? (
        <Card>
          <CardTitle>Demandes en cours</CardTitle>
          <CardDescription>
            Migrations envoyées par un salon, en attente du oui/non du client
          </CardDescription>
          <div className="mt-4 divide-y divide-border">
            {pending.map((c) => {
              if (!c.pendingMigrationTo) return null;
              const expired = c.pendingMigrationTo.expiresAt < Date.now();
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="text-sm font-semibold hover:text-primary"
                    >
                      {c.name ?? c.phone}
                    </Link>
                    <div className="mt-0.5 text-xs text-text-dim">
                      {salonNameById.get(c.salonId) ?? c.salonId} →{" "}
                      <span className="text-primary">
                        {c.pendingMigrationTo.salonName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-text-dim">
                      Demandé le{" "}
                      {formatDateTime(c.pendingMigrationTo.requestedAt)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      expired
                        ? "bg-danger/15 text-danger"
                        : "bg-accent/15 text-accent"
                    }`}
                  >
                    {expired ? "Expirée" : "En attente"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Migrations acceptées</CardTitle>
        <CardDescription>
          {migrated === null
            ? "Chargement…"
            : migrated.length === 0
              ? "Aucune migration sur la période"
              : `${migrated.length} client${migrated.length > 1 ? "s" : ""} ${migrated.length > 1 ? "ont" : "a"} changé de salon`}
        </CardDescription>

        {migrated === null ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-surface-elevated"
              />
            ))}
          </div>
        ) : migrated.length === 0 ? null : (
          <div className="mt-4 divide-y divide-border">
            {migrated.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {c.name ?? c.phone}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-dim">
                    <span>
                      {c.previousSalonId
                        ? salonNameById.get(c.previousSalonId) ?? c.previousSalonId
                        : "—"}
                    </span>
                    <ArrowRightLeft className="h-3 w-3" strokeWidth={2.2} />
                    <span className="text-primary">
                      {salonNameById.get(c.salonId) ?? c.salonId}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-text-dim">
                  {c.migratedAt ? formatDateTime(c.migratedAt) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
