"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Crown,
  Sparkles,
  Leaf,
  Wallet,
  AlertTriangle,
  Hourglass,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { PlanBadge } from "@/components/PlanBadge";
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import {
  PLANS,
  effectivePlan,
  isTrialActive,
  planExpiresInDays,
  trialDaysLeft,
} from "@/lib/plans";
import type { Salon } from "@/lib/types";

const SOON_DAYS = 14;

export default function PlansOverviewPage() {
  const [salons, setSalons] = useState<Salon[] | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "salons"), (snap) => {
      setSalons(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Salon));
    });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    if (!salons) return null;
    const byPlan = { free: 0, standard: 0, pro: 0 };
    let onTrial = 0;
    let monthlyRevenue = 0;
    const expiringSoon: Salon[] = [];
    const expired: Salon[] = [];

    for (const s of salons) {
      const eff = effectivePlan(s);
      byPlan[eff] += 1;
      if (isTrialActive(s)) onTrial += 1;

      // Revenu mensuel récurrent : plans non-free et non-trial
      const raw = s.plan ?? "free";
      if (raw !== "free" && !isTrialActive(s)) {
        // Inclure même les expirés négatifs ? Non — on prend seulement
        // ceux qui sont actifs (expiry future ou 0)
        if (!s.planExpiresAt || s.planExpiresAt === 0 || s.planExpiresAt > Date.now()) {
          monthlyRevenue += PLANS[raw].monthlyPriceFcfa;
        }
      }

      // Bientôt expirés
      const d = planExpiresInDays(s);
      if (d !== null) {
        if (d > 0 && d <= SOON_DAYS) expiringSoon.push(s);
        else if (d <= 0) expired.push(s);
      }
    }
    expiringSoon.sort(
      (a, b) => (a.planExpiresAt ?? 0) - (b.planExpiresAt ?? 0),
    );
    expired.sort(
      (a, b) => (b.planExpiresAt ?? 0) - (a.planExpiresAt ?? 0),
    );
    return { byPlan, onTrial, monthlyRevenue, expiringSoon, expired };
  }, [salons]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold">Plans &amp; Facturation</h1>
        <p className="mt-1 text-sm text-text-muted">
          Vue globale des abonnements, renouvellements et trials
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Plan Free"
          value={stats ? formatNumber(stats.byPlan.free) : "—"}
          icon={Leaf}
          tone="neutral"
        />
        <KpiCard
          label="Plan Standard"
          value={stats ? formatNumber(stats.byPlan.standard) : "—"}
          hint={`${formatPrice(PLANS.standard.monthlyPriceFcfa)} / mois`}
          icon={Sparkles}
          tone="primary"
        />
        <KpiCard
          label="Plan Pro"
          value={stats ? formatNumber(stats.byPlan.pro) : "—"}
          hint={`${formatPrice(PLANS.pro.monthlyPriceFcfa)} / mois`}
          icon={Crown}
          tone="accent"
        />
        <KpiCard
          label="MRR (Monthly Revenue)"
          value={stats ? formatPrice(stats.monthlyRevenue) : "—"}
          hint={
            stats
              ? `${stats.onTrial} salon${stats.onTrial > 1 ? "s" : ""} en essai`
              : "—"
          }
          icon={Wallet}
          tone="success"
        />
      </section>

      <Card>
        <CardTitle>Comparatif des plans</CardTitle>
        <CardDescription>
          Source de vérité : limites appliquées dans toute la plateforme
        </CardDescription>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["free", "standard", "pro"] as const).map((id) => {
            const p = PLANS[id];
            const Icon = id === "pro" ? Crown : id === "standard" ? Sparkles : Leaf;
            return (
              <div
                key={id}
                className="rounded-xl border border-border bg-surface-elevated/30 p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-5 w-5"
                    style={{ color: p.accent }}
                    strokeWidth={2.2}
                  />
                  <span className="text-base font-bold">{p.label}</span>
                </div>
                <div className="mt-1 text-sm text-text-muted">{p.tagline}</div>
                <div className="mt-2 text-lg font-bold text-primary">
                  {p.monthlyPriceFcfa === 0
                    ? "Gratuit"
                    : `${formatPrice(p.monthlyPriceFcfa)} / mois`}
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-text-muted">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-primary">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <CardTitle>Renouvellements imminents</CardTitle>
            <CardDescription>
              Expire dans les {SOON_DAYS} prochains jours
            </CardDescription>
          </div>
          {!stats ? (
            <div className="h-12 animate-pulse rounded bg-surface-elevated" />
          ) : stats.expiringSoon.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Rien à l&apos;horizon, parfait.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {stats.expiringSoon.map((s) => {
                const days = planExpiresInDays(s) ?? 0;
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/salons/${s.id}`}
                    className="flex items-center justify-between py-3 hover:text-primary"
                  >
                    <div>
                      <div className="text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-text-dim">
                        {s.city} · {s.ownerName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          days <= 3
                            ? "bg-danger/15 text-danger"
                            : "bg-accent/15 text-accent"
                        }`}
                      >
                        {days} j
                      </span>
                      <div className="mt-0.5 text-xs text-text-dim">
                        {formatDate(s.planExpiresAt ?? 0)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <CardTitle>Plans expirés</CardTitle>
            <CardDescription>
              Salons retombés en Free, à relancer
            </CardDescription>
          </div>
          {!stats ? (
            <div className="h-12 animate-pulse rounded bg-surface-elevated" />
          ) : stats.expired.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Aucun salon en expiration.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {stats.expired.slice(0, 10).map((s) => {
                const days = planExpiresInDays(s) ?? 0;
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/salons/${s.id}`}
                    className="flex items-center justify-between py-3 hover:text-primary"
                  >
                    <div>
                      <div className="text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-text-dim">
                        Expiré il y a {Math.abs(days)} jour
                        {Math.abs(days) > 1 ? "s" : ""}
                      </div>
                    </div>
                    <AlertTriangle
                      className="h-4 w-4 text-danger"
                      strokeWidth={2.2}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Essais en cours</CardTitle>
          <CardDescription>
            <Hourglass className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Salons sur essai Pro gratuit
          </CardDescription>
        </div>
        {!salons ? (
          <div className="h-12 animate-pulse rounded bg-surface-elevated" />
        ) : (
          (() => {
            const trials = salons
              .filter((s) => isTrialActive(s))
              .sort((a, b) => (a.trialEndsAt ?? 0) - (b.trialEndsAt ?? 0));
            if (trials.length === 0)
              return (
                <p className="py-4 text-sm text-text-muted">
                  Personne en essai actuellement.
                </p>
              );
            return (
              <div className="divide-y divide-border">
                {trials.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/salons/${s.id}`}
                    className="flex items-center justify-between py-3 hover:text-primary"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {s.name}
                        <PlanBadge salon={s} />
                      </div>
                      <div className="text-xs text-text-dim">
                        {s.city} · {s.ownerName}
                      </div>
                    </div>
                    <div className="text-right text-xs text-accent">
                      {trialDaysLeft(s)} j restants
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <TrendingUp
            className="mt-0.5 h-5 w-5 shrink-0 text-text-muted"
            strokeWidth={2.2}
          />
          <div className="text-xs text-text-muted">
            <strong className="text-text-muted">À noter :</strong> le MRR
            affiché est la somme des plans payants actifs (hors essai). Quand
            tu intégreras un paiement auto (Stripe / PayDunya), cette page
            deviendra ton tableau de bord financier principal.
          </div>
        </div>
      </Card>
    </div>
  );
}
