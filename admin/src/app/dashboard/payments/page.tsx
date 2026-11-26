"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/cn";

/**
 * Paiements d'abonnement (SasPay) — lecture seule.
 * Les docs `payments/*` sont écrits uniquement par le serveur.
 */
interface PaymentRow {
  id: string;
  targetType: "salon" | "owner";
  targetId: string;
  planId: PlanId;
  period: "monthly" | "yearly";
  kind: "new" | "renew" | "upgrade";
  amount: number;
  charged?: number;
  network: string;
  phone: string;
  status: string;
  failureCode?: string;
  fulfilledAt: number;
  resultingExpiresAt?: number;
  createdAt: number;
}

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "text-emerald-400",
  PENDING: "text-amber-400",
  INITIATING: "text-amber-400",
  FAILED: "text-red-400",
  REVIEW: "text-red-400",
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    return onSnapshot(q, (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentRow)),
    );
  }, []);

  const stats = useMemo(() => {
    const ok = (rows ?? []).filter((r) => r.fulfilledAt > 0);
    return {
      revenue: ok.reduce((s, r) => s + r.amount, 0),
      count: ok.length,
      review: (rows ?? []).filter((r) => r.status === "REVIEW").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paiements</h1>
        <p className="text-sm text-muted">
          Abonnements encaissés via SasPay (200 derniers).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Encaissé (FCFA)" value={formatNumber(stats.revenue)} />
        <KpiCard label="Paiements réussis" value={formatNumber(stats.count)} />
        <KpiCard label="À vérifier" value={formatNumber(stats.review)} />
      </div>

      <Card>
        <CardTitle>Historique</CardTitle>
        <CardDescription>
          « À vérifier » = montant payé inférieur au devis : aucune activation
          automatique, à traiter manuellement.
        </CardDescription>
        <div className="mt-4 overflow-x-auto">
          {rows === null ? (
            <p className="text-sm text-muted">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">Aucun paiement pour l'instant.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Cible</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2 pr-4">Réseau</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Expire le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      {r.targetType === "owner" ? "Owner" : "Salon"}{" "}
                      <span className="text-muted">{r.targetId.slice(0, 8)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      {PLANS[r.planId]?.label ?? r.planId} ·{" "}
                      {r.period === "yearly" ? "1 an" : "1 mois"}
                      <span className="ml-1 text-muted">({r.kind})</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatPrice(r.amount)}
                    </td>
                    <td className="py-2 pr-4">{r.network}</td>
                    <td
                      className={cn(
                        "py-2 pr-4 font-medium",
                        STATUS_STYLE[r.status] ?? "text-muted",
                      )}
                    >
                      {r.status}
                      {r.failureCode ? (
                        <span className="ml-1 text-xs text-muted">
                          {r.failureCode}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {r.resultingExpiresAt
                        ? formatDateTime(r.resultingExpiresAt)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
