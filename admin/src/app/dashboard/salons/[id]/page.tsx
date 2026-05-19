"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  ArrowLeft,
  RefreshCw,
  Ban,
  Power,
  Copy,
  Users,
  Scissors,
  Wallet,
  Smartphone,
  AlertTriangle,
  UserCircle2,
  Clock,
  Trophy,
  Star,
  MessageSquare,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/KpiCard";
import { PlanBadge } from "@/components/PlanBadge";
import { SalonPlanSection } from "@/components/SalonPlanSection";
import { SalonOwnerSection } from "@/components/SalonOwnerSection";
import { adminFetch } from "@/lib/auth-client";
import { formatDate, formatDateTime, formatPrice, formatNumber } from "@/lib/format";
import type { Salon, Cut, Barber, CutReview } from "@/lib/types";
import {
  getBarberRatingsForSalon,
  getRecentSalonReviews,
  isBarberFlagged,
  type BarberRatingAggregate,
} from "@/lib/reviews";
import { cn } from "@/lib/cn";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_THRESHOLD_DAYS = 14;

interface SalonStats {
  customers: number;
  cuts30d: number;
  revenue30d: number;
  lastCutAt: number | null;
  topBarbers: { barberId: string; name: string; cuts: number; revenue: number }[];
}

export default function SalonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [salon, setSalon] = useState<Salon | null>(null);
  const [missing, setMissing] = useState(false);
  const [stats, setStats] = useState<SalonStats | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reviews aggregation + recent reviews
  const [ratings, setRatings] = useState<BarberRatingAggregate[]>([]);
  const [recentReviews, setRecentReviews] = useState<CutReview[]>([]);
  // Toggle pour ne montrer que les coiffeurs flaggés (< 3 sur 5 avec ≥ 3 avis)
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Subscribe to salon doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "salons", id), (snap) => {
      if (!snap.exists()) {
        setMissing(true);
        return;
      }
      setSalon({ id: snap.id, ...snap.data() } as Salon);
    });
    return unsub;
  }, [id]);

  // Subscribe to barbers
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "barbers"), where("salonId", "==", id)),
      (snap) => {
        setBarbers(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Barber)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      },
    );
    return unsub;
  }, [id]);

  // Aggregate stats (customers count + cuts last 30d + last cut + top barbers)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const since = Date.now() - 30 * DAY_MS;
        const [customersAgg, cutsSnap, lastCutSnap] = await Promise.all([
          getCountFromServer(
            query(collection(db, "customers"), where("salonId", "==", id)),
          ),
          getDocs(
            query(
              collection(db, "cuts"),
              where("salonId", "==", id),
              where("createdAt", ">=", since),
            ),
          ),
          getDocs(
            query(
              collection(db, "cuts"),
              where("salonId", "==", id),
              orderBy("createdAt", "desc"),
              limit(1),
            ),
          ),
        ]);
        if (cancelled) return;
        const recent = cutsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Cut,
        );
        const revenue30d = recent
          .filter((c) => !c.wasReward)
          .reduce((sum, c) => sum + (c.price || 0), 0);
        const lastCutAt = lastCutSnap.empty
          ? null
          : (lastCutSnap.docs[0]!.data().createdAt as number);

        // Top barbers from recent cuts
        const byBarber = new Map<
          string,
          { name: string; cuts: number; revenue: number }
        >();
        for (const c of recent) {
          const key = c.barberId ?? "__none__";
          const name = c.barberName ?? "(Sans barbier)";
          const cur = byBarber.get(key) ?? { name, cuts: 0, revenue: 0 };
          cur.cuts += 1;
          if (!c.wasReward) cur.revenue += c.price ?? 0;
          byBarber.set(key, cur);
        }
        const topBarbers = Array.from(byBarber.entries())
          .map(([barberId, v]) => ({ barberId, ...v }))
          .sort((a, b) => b.cuts - a.cuts)
          .slice(0, 5);

        setStats({
          customers: customersAgg.data().count,
          cuts30d: recent.length,
          revenue30d,
          lastCutAt,
          topBarbers,
        });
      } catch (e: unknown) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Erreur de chargement des stats",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Charge les notes par coiffeur + les avis récents
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ratingMap, recent] = await Promise.all([
          getBarberRatingsForSalon(id),
          getRecentSalonReviews(id, 10),
        ]);
        if (cancelled) return;
        // Tri : signalés en premier, puis par note croissante
        const sorted = Array.from(ratingMap.values()).sort((a, b) => {
          const aFlag = isBarberFlagged(a) ? 1 : 0;
          const bFlag = isBarberFlagged(b) ? 1 : 0;
          if (aFlag !== bFlag) return bFlag - aFlag;
          return a.averageRating - b.averageRating;
        });
        setRatings(sorted);
        setRecentReviews(recent);
      } catch {
        /* ignore — la section reste vide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runAction(
    action: "regenerate-code" | "disable" | "enable" | "reset-kiosks",
    confirmMessage?: string,
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await adminFetch(`/api/salons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Échec de l'opération");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(null);
    }
  }

  async function copyCode() {
    if (!salon) return;
    await navigator.clipboard.writeText(salon.activationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
          <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h1 className="mt-4 text-xl font-bold">Salon introuvable</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ce salon a peut-être été supprimé.
        </p>
        <Link href="/dashboard/salons" className="mt-6 inline-block">
          <Button>Retour aux salons</Button>
        </Link>
      </div>
    );
  }

  if (!salon) {
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

  const disabled = !!salon.disabledAt;
  const activated = salon.activatedAt > 0;
  const kioskCount = salon.kioskUserIds?.length ?? 0;

  // Inactivity detection (only for activated, non-disabled salons)
  const daysSinceLastCut =
    stats?.lastCutAt && stats.lastCutAt > 0
      ? Math.floor((Date.now() - stats.lastCutAt) / DAY_MS)
      : null;
  const isInactive =
    activated &&
    !disabled &&
    stats !== null &&
    (daysSinceLastCut === null || daysSinceLastCut >= INACTIVE_THRESHOLD_DAYS);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/salons"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux salons
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{salon.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {salon.city} · {salon.ownerName} · {salon.phone}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            ID : <code className="text-text-muted">{salon.id}</code> · Créé le{" "}
            {formatDate(salon.createdAt)}
            {activated ? ` · Activé le ${formatDate(salon.activatedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlanBadge salon={salon} size="md" />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              disabled
                ? "bg-danger/15 text-danger"
                : activated
                  ? "bg-success/15 text-success"
                  : "bg-surface-elevated text-text-muted",
            )}
          >
            {disabled
              ? "Désactivé"
              : activated
                ? "Activé"
                : "En attente d'activation"}
          </span>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {isInactive ? (
        <div className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            strokeWidth={2.2}
          />
          <div>
            <div className="font-semibold text-accent">Salon inactif</div>
            <div className="mt-0.5 text-text-muted">
              {daysSinceLastCut === null
                ? "Aucune coupe enregistrée depuis l'activation."
                : `Aucune coupe depuis ${daysSinceLastCut} jours.`}{" "}
              Pense à contacter le propriétaire.
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Clients fidèles"
          value={stats ? formatNumber(stats.customers) : "—"}
          icon={Users}
          tone="accent"
        />
        <KpiCard
          label="Coupes (30 j)"
          value={stats ? formatNumber(stats.cuts30d) : "—"}
          icon={Scissors}
          tone="primary"
        />
        <KpiCard
          label="Revenu (30 j)"
          value={stats ? formatPrice(stats.revenue30d) : "—"}
          icon={Wallet}
          tone="success"
        />
        <KpiCard
          label="Dernière coupe"
          value={
            stats?.lastCutAt
              ? `il y a ${daysSinceLastCut ?? 0}j`
              : stats
                ? "jamais"
                : "—"
          }
          hint={stats?.lastCutAt ? formatDateTime(stats.lastCutAt) : undefined}
          icon={Clock}
          tone="neutral"
        />
      </section>

      <SalonOwnerSection salon={salon} />

      <SalonPlanSection salon={salon} />

      <Card>
        <CardTitle>Code d&apos;activation</CardTitle>
        <CardDescription>
          Le coiffeur saisit ce code dans l&apos;app Trimya en mode salon.
          Régénérer le code force une ré-activation.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-border bg-surface-elevated px-4 py-2 font-mono text-lg font-bold text-primary">
            {salon.activationCode}
          </code>
          <Button onClick={copyCode} variant="secondary" size="sm">
            <Copy className="h-4 w-4" />
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button
            onClick={() =>
              runAction(
                "regenerate-code",
                "Régénérer le code va déconnecter la tablette actuelle. Continuer ?",
              )
            }
            variant="secondary"
            size="sm"
            loading={busy === "regenerate-code"}
          >
            <RefreshCw className="h-4 w-4" />
            Régénérer
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Barbiers</CardTitle>
          <CardDescription>
            {barbers.length === 0
              ? "Aucun barbier déclaré"
              : `${barbers.length} au total · ${barbers.filter((b) => b.active).length} actifs`}
          </CardDescription>
        </div>
        {barbers.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">
            Les barbiers sont créés depuis l&apos;app salon (Paramètres &rsaquo;
            Barbiers).
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {barbers.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated/40 p-3"
              >
                {b.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photo}
                    alt={b.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="h-10 w-10 text-text-dim" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {b.name}
                  </div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    Ajouté le {formatDate(b.createdAt)}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    b.active
                      ? "bg-success/15 text-success"
                      : "bg-surface-elevated text-text-muted",
                  )}
                >
                  {b.active ? "Actif" : "Inactif"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Top barbiers (30 j)</CardTitle>
          <CardDescription>Par nombre de coupes</CardDescription>
        </div>
        {!stats ? (
          <div className="h-12 animate-pulse rounded bg-surface-elevated" />
        ) : stats.topBarbers.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">
            Aucune coupe sur les 30 derniers jours.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {stats.topBarbers.map((b, i) => (
              <div
                key={b.barberId}
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
                  <span className="text-sm font-medium">{b.name}</span>
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

      {/* ── Notes des coiffeurs (issu des avis clients) ── */}
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Notes des coiffeurs</CardTitle>
          <CardDescription>
            {ratings.length === 0
              ? "Aucun avis pour ce salon."
              : `${ratings.length} coiffeur${ratings.length > 1 ? "s" : ""} noté${ratings.length > 1 ? "s" : ""}`}
          </CardDescription>
        </div>

        {ratings.some(isBarberFlagged) ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">
              {ratings.filter(isBarberFlagged).length} coiffeur
              {ratings.filter(isBarberFlagged).length > 1 ? "s" : ""} à
              surveiller (moyenne &lt; 3⭐ sur ≥ 3 avis)
            </span>
            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              className="ml-auto rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-danger/30"
            >
              {flaggedOnly ? "Tout afficher" : "Voir uniquement"}
            </button>
          </div>
        ) : null}

        {ratings.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">
            Aucun avis reçu pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {(flaggedOnly ? ratings.filter(isBarberFlagged) : ratings).map(
              (r) => {
                const flagged = isBarberFlagged(r);
                return (
                  <div
                    key={r.barberId}
                    className={cn(
                      "flex items-center justify-between py-2.5",
                      flagged && "-mx-2 my-1 rounded-md bg-danger/5 px-2",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1">
                        <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                        <span className="text-xs font-bold text-accent">
                          {r.averageRating.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {r.barberName || "—"}
                          {flagged ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                          ) : null}
                        </div>
                        <div className="text-xs text-text-dim">
                          {r.reviewCount} avis · dernier le{" "}
                          {formatDate(r.latestReviewAt)}
                        </div>
                      </div>
                    </div>
                    {/* Mini distribution : 5⭐ 4⭐ 3⭐ 2⭐ 1⭐ */}
                    <div className="hidden gap-1.5 sm:flex">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const count = r.distribution[n - 1];
                        const pct =
                          r.reviewCount > 0
                            ? Math.round((count / r.reviewCount) * 100)
                            : 0;
                        return (
                          <div
                            key={n}
                            className="flex w-9 flex-col items-center"
                            title={`${count} avis ${n}⭐`}
                          >
                            <div className="h-8 w-full rounded bg-surface-elevated">
                              <div
                                className={cn(
                                  "h-full rounded transition-all",
                                  n >= 4
                                    ? "bg-success/50"
                                    : n === 3
                                      ? "bg-accent/50"
                                      : "bg-danger/50",
                                )}
                                style={{
                                  height: `${Math.max(8, pct)}%`,
                                  marginTop: `${100 - Math.max(8, pct)}%`,
                                }}
                              />
                            </div>
                            <span className="mt-0.5 text-[9px] text-text-dim">
                              {n}⭐
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </Card>

      {/* ── Derniers avis clients ── */}
      {recentReviews.length > 0 ? (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <CardTitle>Derniers avis</CardTitle>
            <CardDescription>{recentReviews.length} plus récents</CardDescription>
          </div>
          <div className="divide-y divide-border">
            {recentReviews.map((r) => (
              <div key={r.id} className="py-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "h-3.5 w-3.5",
                            n <= r.rating
                              ? "fill-accent text-accent"
                              : "text-border",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">
                      {r.barberName || "—"}
                    </span>
                  </div>
                  <span className="text-xs text-text-dim">
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                {r.comment ? (
                  <div className="ml-1 flex items-start gap-2 text-xs italic text-text-muted">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{r.comment}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Tablettes appairées</CardTitle>
            <CardDescription>
              {kioskCount === 0
                ? "Aucune tablette appairée. Le salon doit saisir le code dans l'app."
                : `${kioskCount} tablette${kioskCount > 1 ? "s" : ""} actuellement autorisée${kioskCount > 1 ? "s" : ""} à ajouter des coupes.`}
            </CardDescription>
          </div>
          <Smartphone className="h-5 w-5 text-text-muted" />
        </div>
        {kioskCount > 0 ? (
          <Button
            onClick={() =>
              runAction(
                "reset-kiosks",
                "Réinitialiser va déconnecter toutes les tablettes appairées. Le salon devra ressaisir son code. Continuer ?",
              )
            }
            variant="secondary"
            size="sm"
            className="mt-4"
            loading={busy === "reset-kiosks"}
          >
            Réinitialiser les tablettes
          </Button>
        ) : null}
      </Card>

      <Card
        className={cn(disabled ? "border-success/30" : "border-danger/30")}
      >
        <CardTitle>
          {disabled ? "Réactiver le salon" : "Désactiver le salon"}
        </CardTitle>
        <CardDescription>
          {disabled
            ? "Ce salon est actuellement désactivé. Réactive-le pour que les coupes redeviennent enregistrables."
            : "Désactiver bloque toutes les nouvelles coupes côté kiosque. Les clients existants conservent leur historique."}
        </CardDescription>
        <div className="mt-4">
          {disabled ? (
            <Button
              onClick={() => runAction("enable")}
              loading={busy === "enable"}
            >
              <Power className="h-4 w-4" />
              Réactiver
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() =>
                runAction(
                  "disable",
                  "Confirmer la désactivation du salon ? Plus aucune coupe ne pourra être ajoutée tant qu'il est désactivé.",
                )
              }
              loading={busy === "disable"}
            >
              <Ban className="h-4 w-4" />
              Désactiver
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
