"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Search, Crown, Scissors, Gift } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatDate, formatNumber } from "@/lib/format";
import type { Customer, Salon } from "@/lib/types";
import { cn } from "@/lib/cn";

type SortBy = "recent" | "totalCuts" | "rewards";

export default function ClientsListPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [salonFilter, setSalonFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");

  // Load all salons for the filter dropdown
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

  // Load customers (filtered by salon if a salon is picked).
  // For global view, we cap to the most recent 200 to keep the page snappy.
  useEffect(() => {
    setCustomers(null);
    const constraints = salonFilter
      ? [where("salonId", "==", salonFilter), orderBy("createdAt", "desc")]
      : [orderBy("createdAt", "desc")];
    const unsub = onSnapshot(
      query(collection(db, "customers"), ...constraints),
      (snap) => {
        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Customer,
        );
        setCustomers(salonFilter ? docs : docs.slice(0, 200));
      },
    );
    return unsub;
  }, [salonFilter]);

  const salonNameById = useMemo(
    () => new Map(salons.map((s) => [s.id, s.name] as const)),
    [salons],
  );

  const filteredSorted = useMemo(() => {
    if (!customers) return null;
    let list = customers;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(needle) ||
          c.phone.toLowerCase().includes(needle),
      );
    }
    const sorted = [...list];
    if (sortBy === "totalCuts") {
      sorted.sort((a, b) => b.totalCuts - a.totalCuts);
    } else if (sortBy === "rewards") {
      sorted.sort((a, b) => b.totalRewards - a.totalRewards);
    } else {
      sorted.sort(
        (a, b) => (b.lastVisitAt ?? b.createdAt) - (a.lastVisitAt ?? a.createdAt),
      );
    }
    return sorted;
  }, [customers, q, sortBy]);

  const topClients = useMemo(() => {
    if (!customers) return [];
    return [...customers]
      .sort((a, b) => b.totalCuts - a.totalCuts)
      .slice(0, 5);
  }, [customers]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="mt-1 text-sm text-text-muted">
          {salonFilter
            ? "Clients d'un salon"
            : "Vue globale — 200 plus récents tous salons confondus"}
        </p>
      </header>

      <Card>
        <CardTitle>Top fidèles</CardTitle>
        <CardDescription>
          Les 5 clients avec le plus de coupes
          {salonFilter
            ? ` chez ${salonNameById.get(salonFilter) ?? "—"}`
            : " (vue globale)"}
        </CardDescription>
        <div className="mt-4 divide-y divide-border">
          {topClients.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Pas encore de clients à classer.
            </p>
          ) : null}
          {topClients.map((c, i) => (
            <Link
              key={c.id}
              href={`/dashboard/clients/${c.id}`}
              className="flex items-center justify-between py-3 hover:text-primary"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted">
                  {i === 0 ? <Crown className="h-3.5 w-3.5 text-accent" /> : i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">
                    {c.name ?? c.phone}
                  </div>
                  <div className="text-xs text-text-dim">
                    {salonNameById.get(c.salonId) ?? c.salonId}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">
                  {formatNumber(c.totalCuts)} coupes
                </div>
                <div className="text-xs text-text-dim">
                  {formatNumber(c.totalRewards)} récompense
                  {c.totalRewards > 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

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
            <option value="">Tous les salons (200 plus récents)</option>
            {salons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.city}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Trier par
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="recent">Dernière visite</option>
            <option value="totalCuts">Coupes (total)</option>
            <option value="rewards">Récompenses</option>
          </select>
        </div>

        <div className="relative max-w-sm flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Rechercher
          </label>
          <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-text-dim" />
          <Input
            placeholder="Nom ou téléphone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Salon</th>
                <th className="px-5 py-3">Progression</th>
                <th className="px-5 py-3">Coupes / Récompenses</th>
                <th className="px-5 py-3">Dernière visite</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted === null ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-5 animate-pulse rounded bg-surface-elevated" />
                    </td>
                  </tr>
                ))
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-text-muted"
                  >
                    Aucun client pour ces critères.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((c) => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    salonName={salonNameById.get(c.salonId) ?? c.salonId}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CustomerRow({
  customer,
  salonName,
}: {
  customer: Customer;
  salonName: string;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
      <td className="px-5 py-4">
        <Link
          href={`/dashboard/clients/${customer.id}`}
          className="flex items-center gap-2 font-semibold hover:text-primary"
        >
          {customer.vip ? (
            <Crown className="h-3.5 w-3.5 text-accent" />
          ) : null}
          {customer.name ?? "(Sans nom)"}
        </Link>
        <div className="mt-0.5 text-xs text-text-dim">{customer.phone}</div>
      </td>
      <td className="px-5 py-4 text-text-muted">{salonName}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={cn(
                "h-full",
                customer.currentCount >= 4 ? "bg-accent" : "bg-primary",
              )}
              style={{
                width: `${Math.min(100, (customer.currentCount / 4) * 100)}%`,
              }}
            />
          </div>
          <span className="text-xs text-text-muted">
            {customer.currentCount}/4
          </span>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1">
            <Scissors className="h-3.5 w-3.5 text-text-dim" />
            {formatNumber(customer.totalCuts)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Gift className="h-3.5 w-3.5 text-accent" />
            {formatNumber(customer.totalRewards)}
          </span>
        </div>
      </td>
      <td className="px-5 py-4 text-text-muted">
        {customer.lastVisitAt
          ? formatDate(customer.lastVisitAt)
          : "—"}
      </td>
    </tr>
  );
}
