"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Crown,
  Sparkles,
  Leaf,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Hourglass,
  StickyNote,
  CheckCircle2,
} from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { db } from "@/lib/firebase-client";
import { adminFetch } from "@/lib/auth-client";
import {
  PLANS,
  SALON_PLAN_IDS,
  effectivePlan,
  isTrialActive,
  trialDaysLeft,
  planExpiresInDays,
  formatPlanPrice,
  type SalonPlanId,
} from "@/lib/plans";
import { formatDate } from "@/lib/format";
import type { Salon } from "@/lib/types";
import { cn } from "@/lib/cn";

interface SalonPrivateData {
  adminNotes?: string;
  lastPaymentRef?: string;
}

const ICONS = { free: Leaf, standard: Sparkles, pro: Crown } as const;

interface SalonPlanSectionProps {
  salon: Salon;
}

export function SalonPlanSection({ salon }: SalonPlanSectionProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upgrade form
  const [upgradePlan, setUpgradePlan] = useState<"standard" | "pro">("standard");
  const [months, setMonths] = useState(1);
  const [paymentRef, setPaymentRef] = useState("");

  // Données privées (notes admin + ref paiement) — sous-collection isolée
  const [privateData, setPrivateData] = useState<SalonPrivateData | null>(null);
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "salons", salon.id, "private", "data"),
      (snap) => {
        setPrivateData(snap.exists() ? (snap.data() as SalonPrivateData) : {});
      },
      () => setPrivateData({}),
    );
    return unsub;
  }, [salon.id]);

  // Notes form
  const [adminNotes, setAdminNotes] = useState("");
  useEffect(() => {
    if (privateData) setAdminNotes(privateData.adminNotes ?? "");
  }, [privateData]);
  const [editingNotes, setEditingNotes] = useState(false);

  // Trial form
  const [trialDays, setTrialDays] = useState(14);

  const effective = effectivePlan(salon);
  const onTrial = isTrialActive(salon);
  const trialLeft = trialDaysLeft(salon);
  const expiresInDays = planExpiresInDays(salon);
  const Icon = ICONS[effective];

  async function call(body: object) {
    setBusy(JSON.stringify(body).slice(0, 30));
    setError(null);
    try {
      const res = await adminFetch(`/api/salons/${salon.id}/plan`, {
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

  return (
    <div className="space-y-4">
      {/* En-tête : plan actuel + indicateurs */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                effective === "pro"
                  ? "bg-accent/15 text-accent"
                  : effective === "standard"
                    ? "bg-primary/15 text-primary"
                    : "bg-surface-elevated text-text-muted",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Plan effectif
              </div>
              <div className="flex items-center gap-2 text-xl font-bold text-text">
                {PLANS[effective].label}
                {onTrial ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    Essai
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-text-dim">
                {onTrial
                  ? `Essai Pro · expire dans ${trialLeft} jour${trialLeft > 1 ? "s" : ""}`
                  : salon.plan && salon.plan !== "free"
                    ? expiresInDays !== null && expiresInDays > 0
                      ? `Plan ${salon.plan} actif · expire dans ${expiresInDays} jour${expiresInDays > 1 ? "s" : ""} (${formatDate(salon.planExpiresAt ?? 0)})`
                      : "Plan actif sans expiration"
                    : "Plan gratuit, sans engagement"}
              </div>
            </div>
          </div>
          {expiresInDays !== null && expiresInDays <= 7 && expiresInDays > 0 ? (
            <span className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
              Renouvellement urgent
            </span>
          ) : null}
        </div>

        {privateData?.lastPaymentRef ? (
          <div className="mt-3 text-xs text-text-dim">
            Dernier paiement :{" "}
            <code className="text-text-muted">{privateData.lastPaymentRef}</code>
          </div>
        ) : null}
      </Card>

      {error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Upgrade form */}
      <Card>
        <CardTitle>Passer à un plan payant</CardTitle>
        <CardDescription>
          Sélectionne le plan, le nombre de mois et la référence du paiement
          reçu. Le plan démarre immédiatement.
        </CardDescription>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {SALON_PLAN_IDS.filter((p) => p !== "free").map((p) => {
            const def = PLANS[p];
            const selected = upgradePlan === p;
            const PIcon = ICONS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setUpgradePlan(p as "standard" | "pro")}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-elevated/40 hover:border-text-dim",
                )}
              >
                <div className="flex items-center gap-2">
                  <PIcon
                    className={cn(
                      "h-5 w-5",
                      selected ? "text-primary" : "text-text-muted",
                    )}
                    strokeWidth={2.2}
                  />
                  <span className="text-sm font-bold">{def.label}</span>
                </div>
                <div className="text-xs text-text-muted">{def.tagline}</div>
                <div className="text-sm font-semibold text-primary">
                  {formatPlanPrice(def)}
                </div>
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
                  {m} mois ({(PLANS[upgradePlan].monthlyPriceFcfa * m).toLocaleString("fr-FR")} FCFA)
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Référence de paiement (optionnel)"
            placeholder="Virement n° / Wave / Orange Money"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <Button
            loading={busy?.startsWith('{"action":"upgrade"')}
            onClick={async () => {
              const ok = await call({
                action: "upgrade",
                plan: upgradePlan,
                months,
                paymentRef: paymentRef.trim() || undefined,
              });
              if (ok) setPaymentRef("");
            }}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Activer {PLANS[upgradePlan].label} pour {months} mois
          </Button>
        </div>
      </Card>

      {/* Extend / Downgrade */}
      <Card>
        <CardTitle>Prolonger ou rétrograder</CardTitle>
        <CardDescription>
          Prolonger ajoute du temps au plan actuel sans le changer. Rétrograder
          repasse immédiatement le salon en Free.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Prolonger de
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} mois
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            disabled={!salon.plan || salon.plan === "free"}
            loading={busy?.startsWith('{"action":"extend"')}
            onClick={() =>
              call({
                action: "extend",
                months,
              })
            }
          >
            <Calendar className="h-4 w-4" />
            Prolonger
          </Button>
          <Button
            variant="danger"
            disabled={!salon.plan || salon.plan === "free"}
            loading={busy?.startsWith('{"action":"downgrade"')}
            onClick={() => {
              if (
                window.confirm(
                  `Repasser ${salon.name} en plan Free maintenant ? Les modules payants seront désactivés immédiatement.`,
                )
              ) {
                call({ action: "downgrade" });
              }
            }}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Rétrograder en Free
          </Button>
        </div>
      </Card>

      {/* Trial */}
      <Card>
        <CardTitle>Essai Pro</CardTitle>
        <CardDescription>
          Accorde un accès Pro temporaire à ce salon (offre commerciale,
          dédommagement, etc.). Pendant l&apos;essai, le plan Pro l&apos;emporte
          sur le plan brut.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Durée (jours)
            </label>
            <Input
              type="number"
              min={0}
              max={120}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button
            variant="secondary"
            loading={busy?.startsWith('{"action":"set-trial"')}
            onClick={() => call({ action: "set-trial", days: trialDays })}
          >
            <Hourglass className="h-4 w-4" />
            Définir l&apos;essai
          </Button>
          {onTrial ? (
            <Button
              variant="ghost"
              loading={busy?.startsWith('{"action":"set-trial"')}
              onClick={() => call({ action: "set-trial", days: 0 })}
            >
              Annuler l&apos;essai
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Admin notes */}
      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <CardTitle>Notes internes</CardTitle>
            <CardDescription>
              Privé — uniquement visible dans Trimya Admin
            </CardDescription>
          </div>
          {!editingNotes ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingNotes(true)}
            >
              <StickyNote className="h-4 w-4" />
              Éditer
            </Button>
          ) : null}
        </div>

        {!editingNotes ? (
          privateData?.adminNotes ? (
            <p className="mt-3 whitespace-pre-line text-sm text-text-muted">
              {privateData.adminNotes}
            </p>
          ) : (
            <p className="mt-3 text-sm text-text-dim">
              Aucune note pour l&apos;instant.
            </p>
          )
        ) : (
          <div className="mt-3 space-y-3">
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Ex. : préfère payer en cash le 5 du mois…"
              maxLength={500}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy?.startsWith('{"action":"notes"')}
                onClick={async () => {
                  const ok = await call({
                    action: "notes",
                    adminNotes,
                  });
                  if (ok) setEditingNotes(false);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdminNotes(privateData?.adminNotes ?? "");
                  setEditingNotes(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
