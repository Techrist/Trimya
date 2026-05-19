"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Plus, Search, CheckCircle2, Clock, Ban } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PlanBadge } from "@/components/PlanBadge";
import { formatDate } from "@/lib/format";
import type { Salon } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function SalonsListPage() {
  const [salons, setSalons] = useState<Salon[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "salons"), orderBy("createdAt", "desc")),
      (snap) => {
        setSalons(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Salon),
        );
      },
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!salons) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return salons;
    return salons.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.city.toLowerCase().includes(needle) ||
        s.ownerName.toLowerCase().includes(needle) ||
        s.activationCode.toLowerCase().includes(needle),
    );
  }, [salons, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Salons</h1>
          <p className="mt-1 text-sm text-text-muted">
            Crée, active et pilote les salons partenaires
          </p>
        </div>
        <Link href="/dashboard/salons/new">
          <Button>
            <Plus className="h-4 w-4" /> Nouveau salon
          </Button>
        </Link>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder="Rechercher un salon, une ville, un code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Ville</th>
                <th className="px-5 py-3">Propriétaire</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {filtered === null ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-5 animate-pulse rounded bg-surface-elevated" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-text-muted"
                  >
                    Aucun salon pour l&apos;instant.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => <SalonRow key={s.id} salon={s} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SalonRow({ salon }: { salon: Salon }) {
  const status = salon.disabledAt
    ? { label: "Désactivé", tone: "danger" as const, Icon: Ban }
    : salon.activatedAt > 0
      ? { label: "Activé", tone: "success" as const, Icon: CheckCircle2 }
      : { label: "En attente", tone: "muted" as const, Icon: Clock };

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
      <td className="px-5 py-4">
        <Link
          href={`/dashboard/salons/${salon.id}`}
          className="font-semibold text-text hover:text-primary"
        >
          {salon.name}
        </Link>
        <div className="mt-0.5 text-xs text-text-dim">{salon.id}</div>
      </td>
      <td className="px-5 py-4 text-text-muted">{salon.city}</td>
      <td className="px-5 py-4 text-text-muted">
        <div>{salon.ownerName}</div>
        <div className="text-xs text-text-dim">{salon.phone}</div>
      </td>
      <td className="px-5 py-4">
        <code className="rounded bg-surface-elevated px-2 py-1 text-xs font-mono">
          {salon.activationCode}
        </code>
      </td>
      <td className="px-5 py-4">
        <PlanBadge salon={salon} />
      </td>
      <td className="px-5 py-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            status.tone === "success" && "bg-success/15 text-success",
            status.tone === "danger" && "bg-danger/15 text-danger",
            status.tone === "muted" && "bg-surface-elevated text-text-muted",
          )}
        >
          <status.Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          {status.label}
        </span>
      </td>
      <td className="px-5 py-4 text-text-muted">
        {formatDate(salon.createdAt)}
      </td>
    </tr>
  );
}
