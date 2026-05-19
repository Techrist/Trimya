"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import {
  ArrowLeft,
  Crown,
  Building2,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Plus,
  X,
  Mail,
  Phone,
  AlertTriangle,
  Ban,
  Power,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KpiCard } from "@/components/KpiCard";
import { adminFetch } from "@/lib/auth-client";
import {
  PLANS,
  isOwnerEnterpriseActive,
  planExpiresInDays,
  formatPlanPrice,
} from "@/lib/plans";
import { formatDate, formatNumber } from "@/lib/format";
import type { Owner, Salon } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function OwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [owner, setOwner] = useState<Owner | null>(null);
  const [missing, setMissing] = useState(false);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const [paymentRef, setPaymentRef] = useState("");
  const [assignSalonId, setAssignSalonId] = useState("");
  // Tier choisi pour l'activation (Standard 25k vs Pro 40k).
  // Pré-sélection : si owner déjà sur un plan, on reste sur le sien.
  const [selectedTier, setSelectedTier] = useState<
    "enterprise_standard" | "enterprise"
  >("enterprise_standard");

  // Resync le tier sélectionné quand l'owner change (re-charge / changement live)
  useEffect(() => {
    if (owner?.plan === "enterprise" || owner?.plan === "enterprise_standard") {
      setSelectedTier(owner.plan);
    }
  }, [owner?.plan]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "owners", id), (snap) => {
      if (!snap.exists()) {
        setMissing(true);
        return;
      }
      setOwner({ id: snap.id, ...snap.data() } as Owner);
    });
    return unsub;
  }, [id]);

  // Charge les salons de cet owner
  useEffect(() => {
    if (!owner) return;
    const unsub = onSnapshot(
      query(collection(db, "salons"), where("ownerId", "==", owner.id)),
      (snap) => {
        setSalons(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Salon));
      },
    );
    return unsub;
  }, [owner]);

  // Charge tous les salons sans owner (pour le sélecteur "Assigner")
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await getDocs(collection(db, "salons"));
      if (cancelled) return;
      setAllSalons(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Salon));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unassignedSalons = useMemo(
    () => allSalons.filter((s) => !s.ownerId),
    [allSalons],
  );

  async function call(body: object) {
    setBusy(JSON.stringify(body).slice(0, 40));
    setError(null);
    try {
      const res = await adminFetch(`/api/owners/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Échec de l'opération");
        return false;
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
          <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h1 className="mt-4 text-xl font-bold">Propriétaire introuvable</h1>
        <Link href="/dashboard/owners" className="mt-6 inline-block">
          <Button>Retour</Button>
        </Link>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse rounded bg-surface-elevated" />
        <div className="h-10 w-64 animate-pulse rounded bg-surface-elevated" />
      </div>
    );
  }

  const enterprise = isOwnerEnterpriseActive(owner);
  const expiresInDays = planExpiresInDays(owner);
  const disabled = !!owner.disabledAt;
  const limit = PLANS.enterprise.limits.maxSalons ?? 5;
  const atLimit = salons.length >= limit;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/owners"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux propriétaires
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{owner.name}</h1>
          <p className="mt-1 flex items-center gap-3 text-sm text-text-muted">
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {owner.email}
            </span>
            {owner.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {owner.phone}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            Créé le {formatDate(owner.createdAt)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            disabled
              ? "bg-danger/15 text-danger"
              : enterprise
                ? "bg-accent/15 text-accent"
                : "bg-surface-elevated text-text-muted",
          )}
        >
          {disabled ? "Désactivé" : enterprise ? "Entreprise actif" : "Sans plan"}
        </span>
      </header>

      {error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Salons"
          value={`${salons.length} / ${limit}`}
          icon={Building2}
          tone="primary"
        />
        <KpiCard
          label="Plan"
          value={enterprise ? "Entreprise" : "—"}
          hint={
            enterprise
              ? expiresInDays !== null && expiresInDays > 0
                ? `Expire dans ${expiresInDays}j (${formatDate(owner.planExpiresAt ?? 0)})`
                : "Sans expiration"
              : "Aucun plan actif"
          }
          icon={Crown}
          tone="accent"
        />
        <KpiCard
          label="Tarif mensuel"
          value={enterprise ? formatPlanPrice(PLANS.enterprise) : "—"}
          icon={Calendar}
          tone="neutral"
        />
      </section>

      {/* Salons assignés */}
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Salons assignés</CardTitle>
          <CardDescription>
            {salons.length} / {limit}
          </CardDescription>
        </div>

        {/* Bouton de re-synchronisation : recalcule inheritedPlan sur chacun
            des salons selon l'état actuel du plan owner. Utile en cas
            d'incohérence (héritage non posé après assignation manuelle, etc.). */}
        {salons.length > 0 ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated/40 px-3 py-2">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Héritage du plan
              </p>
              <p className="mt-0.5 text-xs text-text-dim">
                {isOwnerEnterpriseActive(owner)
                  ? `Tous les salons doivent avoir inheritedPlan = 'pro'`
                  : `Tous les salons doivent avoir inheritedPlan vide`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              loading={busy === '{"action":"sync-salons"}'}
              onClick={async () => {
                const ok = await call({ action: "sync-salons" });
                if (ok) {
                  window.alert(
                    `Synchronisation OK — ${salons.length} salon${salons.length > 1 ? "s" : ""} mis à jour.`,
                  );
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Synchroniser
            </Button>
          </div>
        ) : null}
        {salons.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">
            Aucun salon assigné à ce propriétaire.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {salons.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <Link
                  href={`/dashboard/salons/${s.id}`}
                  className="text-sm font-semibold hover:text-primary"
                >
                  {s.name}
                  <span className="ml-2 text-xs font-normal text-text-dim">
                    {s.city}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy?.startsWith(`{"action":"remove-salon","salonId":"${s.id}`)}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Retirer "${s.name}" de ce propriétaire ? Le salon retrouvera son plan individuel.`,
                      )
                    ) {
                      call({ action: "remove-salon", salonId: s.id });
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                  Retirer
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Assigner un nouveau salon */}
        <div className="mt-4 border-t border-border pt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Assigner un salon existant
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={assignSalonId}
              onChange={(e) => setAssignSalonId(e.target.value)}
              disabled={atLimit}
              className="h-11 flex-1 min-w-[200px] rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">— Choisir un salon sans propriétaire —</option>
              {unassignedSalons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.city}
                </option>
              ))}
            </select>
            <Button
              disabled={!assignSalonId || atLimit}
              loading={busy?.startsWith('{"action":"assign-salon"')}
              onClick={async () => {
                const ok = await call({
                  action: "assign-salon",
                  salonId: assignSalonId,
                });
                if (ok) setAssignSalonId("");
              }}
            >
              <Plus className="h-4 w-4" />
              Assigner
            </Button>
          </div>
          {atLimit ? (
            <p className="mt-2 text-xs text-danger">
              Limite atteinte ({limit} salons). Retire-en un pour pouvoir en ajouter un autre.
            </p>
          ) : null}
        </div>
      </Card>

      {/* Plan Entreprise */}
      <Card>
        <CardTitle>Plan Entreprise</CardTitle>
        <CardDescription>
          {enterprise
            ? `Plan ${PLANS[owner.plan as keyof typeof PLANS]?.label ?? "Entreprise"} actif. Tu peux prolonger, changer de tier ou rétrograder.`
            : "Aucun plan. Choisis un tier puis active pour donner accès au dashboard consolidé."}
        </CardDescription>

        {/* Sélecteur de tier */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(["enterprise_standard", "enterprise"] as const).map((tierId) => {
            const def = PLANS[tierId];
            const active = selectedTier === tierId;
            const isCurrent = owner.plan === tierId;
            return (
              <button
                key={tierId}
                type="button"
                onClick={() => setSelectedTier(tierId)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-text-muted",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{def.label}</span>
                  {isCurrent ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                      Actuel
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-text-muted">{def.tagline}</p>
                <p className="mt-2 text-base font-bold text-primary">
                  {formatPlanPrice(def)}
                </p>
                <p className="mt-1 text-[11px] text-text-dim">
                  Salons inclus passent en <strong>{tierId === "enterprise" ? "Pro" : "Standard"}</strong>
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Durée
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} mois ({(PLANS[selectedTier].monthlyPriceFcfa * m).toLocaleString("fr-FR")} FCFA)
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Référence paiement (optionnel)"
            placeholder="Virement / Wave / etc."
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {!enterprise ? (
            <Button
              loading={busy?.startsWith('{"action":"upgrade"')}
              onClick={async () => {
                const ok = await call({
                  action: "upgrade",
                  plan: selectedTier,
                  months,
                  paymentRef: paymentRef.trim() || undefined,
                });
                if (ok) setPaymentRef("");
              }}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Activer {PLANS[selectedTier].label} pour {months} mois
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                loading={busy?.startsWith('{"action":"extend"')}
                onClick={() => call({ action: "extend", months })}
              >
                <Calendar className="h-4 w-4" />
                Prolonger de {months} mois
              </Button>
              {/* Changer de tier (upgrade vers l'autre variante) */}
              {selectedTier !== owner.plan ? (
                <Button
                  variant="secondary"
                  loading={busy?.startsWith('{"action":"upgrade"')}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Passer de "${PLANS[owner.plan as keyof typeof PLANS]?.label}" à "${PLANS[selectedTier].label}" ? Les salons seront mis à jour automatiquement.`,
                      )
                    )
                      return;
                    const ok = await call({
                      action: "upgrade",
                      plan: selectedTier,
                      months,
                      paymentRef: paymentRef.trim() || undefined,
                    });
                    if (ok) setPaymentRef("");
                  }}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Basculer vers {PLANS[selectedTier].label}
                </Button>
              ) : null}
              <Button
                variant="danger"
                loading={busy?.startsWith('{"action":"downgrade"')}
                onClick={() => {
                  if (
                    window.confirm(
                      "Rétrograder ce propriétaire ? Tous ses salons reviendront à leur plan individuel.",
                    )
                  ) {
                    call({ action: "downgrade" });
                  }
                }}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Rétrograder
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Activation / désactivation compte */}
      <Card className={cn(disabled ? "border-success/30" : "border-danger/30")}>
        <CardTitle>
          {disabled ? "Réactiver le compte" : "Désactiver le compte"}
        </CardTitle>
        <CardDescription>
          {disabled
            ? "Compte désactivé. Le propriétaire ne peut plus se connecter à l'app."
            : "Désactive le compte (le propriétaire ne pourra plus se connecter). Les salons restent assignés."}
        </CardDescription>
        <div className="mt-4">
          {disabled ? (
            <Button
              loading={busy?.startsWith('{"action":"enable"')}
              onClick={() => call({ action: "enable" })}
            >
              <Power className="h-4 w-4" />
              Réactiver
            </Button>
          ) : (
            <Button
              variant="danger"
              loading={busy?.startsWith('{"action":"disable"')}
              onClick={() => {
                if (window.confirm("Désactiver ce propriétaire ?")) {
                  call({ action: "disable" });
                }
              }}
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
