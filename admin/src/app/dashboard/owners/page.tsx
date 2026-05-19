"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Plus, Search, Building2, Crown, Ban } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/format";
import {
  PLANS,
  isOwnerEnterpriseActive,
  planExpiresInDays,
} from "@/lib/plans";
import type { Owner } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function OwnersListPage() {
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "owners"), orderBy("createdAt", "desc")),
      (snap) => {
        setOwners(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Owner));
      },
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!owners) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return owners;
    return owners.filter(
      (o) =>
        o.email.toLowerCase().includes(needle) ||
        o.name.toLowerCase().includes(needle) ||
        (o.phone ?? "").toLowerCase().includes(needle),
    );
  }, [owners, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Propriétaires</h1>
          <p className="mt-1 text-sm text-text-muted">
            Comptes Entreprise qui gèrent plusieurs salons
          </p>
        </div>
        <Link href="/dashboard/owners/new">
          <Button>
            <Plus className="h-4 w-4" /> Nouveau propriétaire
          </Button>
        </Link>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder="Rechercher un propriétaire, email, téléphone…"
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
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Salons</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {filtered === null ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-5 animate-pulse rounded bg-surface-elevated" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-text-muted">
                    Aucun propriétaire enregistré.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => <OwnerRow key={o.id} owner={o} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function OwnerRow({ owner }: { owner: Owner }) {
  const enterprise = isOwnerEnterpriseActive(owner);
  const expiresInDays = planExpiresInDays(owner);
  const disabled = !!owner.disabledAt;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
      <td className="px-5 py-4">
        <Link
          href={`/dashboard/owners/${owner.id}`}
          className="font-semibold hover:text-primary"
        >
          {owner.name}
        </Link>
        {owner.phone ? (
          <div className="mt-0.5 text-xs text-text-dim">{owner.phone}</div>
        ) : null}
      </td>
      <td className="px-5 py-4 text-text-muted">{owner.email}</td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
          <Building2 className="h-3.5 w-3.5" />
          {(owner.salonIds?.length ?? 0)} / {PLANS.enterprise.limits.maxSalons}
        </span>
      </td>
      <td className="px-5 py-4">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger">
            <Ban className="h-3.5 w-3.5" />
            Désactivé
          </span>
        ) : enterprise ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              expiresInDays !== null && expiresInDays <= 14 && expiresInDays > 0
                ? "bg-accent/15 text-accent"
                : "bg-success/15 text-success",
            )}
          >
            <Crown className="h-3.5 w-3.5" />
            Entreprise
            {expiresInDays !== null && expiresInDays > 0
              ? ` · ${expiresInDays}j`
              : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-muted">
            Sans plan
          </span>
        )}
      </td>
      <td className="px-5 py-4 text-text-muted">
        {formatDate(owner.createdAt)}
      </td>
    </tr>
  );
}
