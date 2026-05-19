"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import {
  ArrowLeft,
  Scissors,
  Gift,
  Crown,
  Phone,
  Store,
  AlertTriangle,
  Calendar,
  ArrowRightLeft,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import type { Customer, Cut, Salon } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [missing, setMissing] = useState(false);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [previousSalon, setPreviousSalon] = useState<Salon | null>(null);
  const [cuts, setCuts] = useState<Cut[] | null>(null);

  // Subscribe to customer
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "customers", id), (snap) => {
      if (!snap.exists()) {
        setMissing(true);
        return;
      }
      setCustomer({ id: snap.id, ...snap.data() } as Customer);
    });
    return unsub;
  }, [id]);

  // Load current salon
  useEffect(() => {
    if (!customer?.salonId) return;
    const unsub = onSnapshot(doc(db, "salons", customer.salonId), (snap) => {
      setSalon(snap.exists() ? ({ id: snap.id, ...snap.data() } as Salon) : null);
    });
    return unsub;
  }, [customer?.salonId]);

  // Load previous salon if migrated
  useEffect(() => {
    if (!customer?.previousSalonId) {
      setPreviousSalon(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "salons", customer.previousSalonId),
      (snap) => {
        setPreviousSalon(
          snap.exists() ? ({ id: snap.id, ...snap.data() } as Salon) : null,
        );
      },
    );
    return unsub;
  }, [customer?.previousSalonId]);

  // Load cuts history (most recent 100)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await getDocs(
        query(
          collection(db, "cuts"),
          where("customerId", "==", id),
          orderBy("createdAt", "desc"),
        ),
      );
      if (cancelled) return;
      setCuts(
        snap.docs.slice(0, 100).map((d) => ({ id: d.id, ...d.data() }) as Cut),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
          <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h1 className="mt-4 text-xl font-bold">Client introuvable</h1>
        <Link href="/dashboard/clients" className="mt-6 inline-block">
          <Button>Retour aux clients</Button>
        </Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse rounded bg-surface-elevated" />
        <div className="h-10 w-64 animate-pulse rounded bg-surface-elevated" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-surface-elevated"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {customer.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.photo}
              alt={customer.name ?? customer.phone}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-elevated text-2xl font-bold text-text-muted">
              {(customer.name ?? customer.phone).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {customer.name ?? "(Sans nom)"}
              {customer.vip ? (
                <Crown className="h-5 w-5 text-accent" />
              ) : null}
            </h1>
            <p className="mt-1 flex items-center gap-3 text-sm text-text-muted">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
              {salon ? (
                <Link
                  href={`/dashboard/salons/${salon.id}`}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  <Store className="h-3.5 w-3.5" />
                  {salon.name}
                </Link>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-text-dim">
              Inscrit le {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
      </header>

      {customer.migratedAt && previousSalon ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          <ArrowRightLeft
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            strokeWidth={2.2}
          />
          <div>
            <div className="font-semibold text-primary">
              Migration de salon
            </div>
            <div className="mt-0.5 text-text-muted">
              Anciennement chez{" "}
              <span className="text-text">{previousSalon.name}</span> · migré le{" "}
              {formatDate(customer.migratedAt)}
            </div>
          </div>
        </div>
      ) : null}

      {customer.notes ? (
        <Card>
          <CardTitle>Notes du salon</CardTitle>
          <p className="mt-2 whitespace-pre-line text-sm text-text-muted">
            {customer.notes}
          </p>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Coupes totales"
          value={formatNumber(customer.totalCuts)}
          icon={Scissors}
          tone="primary"
        />
        <KpiCard
          label="Récompenses obtenues"
          value={formatNumber(customer.totalRewards)}
          icon={Gift}
          tone="accent"
        />
        <KpiCard
          label="Progression actuelle"
          value={`${customer.currentCount}/4`}
          hint={
            customer.currentCount >= 4
              ? "Prochaine coupe gratuite !"
              : `Plus que ${4 - customer.currentCount} avant une coupe gratuite`
          }
          icon={Gift}
          tone="accent"
        />
        <KpiCard
          label="Dernière visite"
          value={
            customer.lastVisitAt
              ? formatDate(customer.lastVisitAt)
              : "Jamais"
          }
          icon={Calendar}
          tone="neutral"
        />
      </section>

      <Card>
        <CardTitle>Historique des coupes</CardTitle>
        <CardDescription>
          {cuts === null
            ? "Chargement…"
            : cuts.length === 0
              ? "Aucune coupe enregistrée"
              : `${cuts.length} dernière${cuts.length > 1 ? "s" : ""} coupe${cuts.length > 1 ? "s" : ""}`}
        </CardDescription>

        {cuts && cuts.length > 0 ? (
          <div className="mt-4 divide-y divide-border">
            {cuts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-3"
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
                      {c.wasReward ? "Coupe offerte (récompense)" : "Coupe payante"}
                    </div>
                    <div className="text-xs text-text-dim">
                      {formatDateTime(c.createdAt)}
                      {c.barberName ? ` · ${c.barberName}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-text">
                  {c.wasReward ? "—" : formatPrice(c.price ?? 0)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
