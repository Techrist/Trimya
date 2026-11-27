"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { adminFetch } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";

interface Promo {
  active: boolean;
  percent: number;
  startedAt: number;
  endsAt: number;
  includeYearly: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function errorText(code: string): string {
  if (code === "invalid_payload") return "Valeurs invalides : remise de 5 à 90 %, durée de 1 à 12 mois.";
  if (code === "not_admin" || code === "invalid_token" || code === "missing_bearer_token")
    return "Session expirée ou droits insuffisants. Reconnecte-toi.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}

/**
 * Offre de lancement : -X % sur les abonnements des salons et propriétaires,
 * pendant N mois. S'arrête toute seule à la date de fin.
 */
export function LaunchPromoCard() {
  const [promo, setPromo] = useState<Promo | null | undefined>(undefined);
  const [percent, setPercent] = useState(50);
  const [months, setMonths] = useState(3);
  const [includeYearly, setIncludeYearly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/promo");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      setError(null);
      setPromo(data.promo ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "server_error");
      setPromo(undefined);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch("/api/promo", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "server_error");
      setPromo(data.promo ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "server_error");
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const running = !!promo && promo.active && promo.endsAt > now;
  const expired = !!promo && promo.active && promo.endsAt <= now;
  const daysLeft = running ? Math.ceil((promo!.endsAt - now) / DAY_MS) : 0;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <BadgePercent className="mt-1 h-5 w-5 text-primary" />
        <div className="flex-1">
          <CardTitle>Offre de lancement</CardTitle>
          <CardDescription>
            Remise sur tous les abonnements (salons et propriétaires), appliquée
            automatiquement au paiement et arrêtée à la date de fin.
          </CardDescription>

          {loadFailed && promo === undefined ? (
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLoadFailed(false);
                  void load();
                }}
              >
                Réessayer
              </Button>
            </div>
          ) : promo === undefined ? (
            <p role="status" className="mt-4 text-sm text-text-muted">Chargement…</p>
          ) : running ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                <span className="font-bold text-primary">-{promo!.percent} % actif</span>{" "}
                jusqu&apos;au {formatDate(promo!.endsAt)} ({daysLeft} jour
                {daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}).{" "}
                {promo!.includeYearly
                  ? "Mensuel et annuel remisés."
                  : "Formule mensuelle seulement."}
              </p>
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => send({ action: "deactivate" })}
              >
                Désactiver maintenant
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {expired ? (
                <p className="text-sm text-text-muted">
                  La dernière offre (-{promo!.percent} %) s&apos;est terminée le{" "}
                  {formatDate(promo!.endsAt)}.
                </p>
              ) : null}
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm">
                  <span className="mb-1 block text-text-muted">Remise (%) · 5 à 90</span>
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    className="h-11 w-24 rounded-lg border border-border bg-surface-elevated px-3 focus-visible:outline-2 focus-visible:outline-primary"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-text-muted">Durée (mois) · 1 à 12</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="h-11 w-24 rounded-lg border border-border bg-surface-elevated px-3 focus-visible:outline-2 focus-visible:outline-primary"
                  />
                </label>
                <label className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={includeYearly}
                    onChange={(e) => setIncludeYearly(e.target.checked)}
                  />
                  Inclure la formule annuelle
                </label>
              </div>
              <Button
                loading={busy}
                disabled={
                  !Number.isInteger(percent) ||
                  percent < 5 ||
                  percent > 90 ||
                  !Number.isInteger(months) ||
                  months < 1 ||
                  months > 12
                }
                onClick={() =>
                  send({ action: "activate", percent, months, includeYearly })
                }
              >
                Activer -{percent} % pour {months} mois
              </Button>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {errorText(error)}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
