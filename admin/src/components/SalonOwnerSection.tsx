"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { Building2, X, ExternalLink } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/firebase-client";
import { adminFetch } from "@/lib/auth-client";
import type { Owner, Salon } from "@/lib/types";
import { isOwnerEnterpriseActive } from "@/lib/plans";

/**
 * Section d'assignation/retrait d'un propriétaire sur la fiche salon.
 * Affichée sur SalonDetailPage côté admin.
 */
export function SalonOwnerSection({ salon }: { salon: Salon }) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Souscris au propriétaire actuel (si existe)
  useEffect(() => {
    if (!salon.ownerId) {
      setOwner(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "owners", salon.ownerId), (snap) => {
      setOwner(snap.exists() ? ({ id: snap.id, ...snap.data() } as Owner) : null);
    });
    return unsub;
  }, [salon.ownerId]);

  // Charge la liste des owners (pour le sélecteur)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "owners"), orderBy("name", "asc")),
      (snap) => {
        setOwners(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Owner));
      },
    );
    return unsub;
  }, []);

  async function assign() {
    if (!selectedOwnerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/owners/${selectedOwnerId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "assign-salon", salonId: salon.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Échec");
      } else {
        setSelectedOwnerId("");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!salon.ownerId) return;
    if (
      !window.confirm(
        "Retirer ce salon du propriétaire ? Le salon retrouvera son plan individuel.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/owners/${salon.ownerId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "remove-salon", salonId: salon.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Échec");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Propriétaire</CardTitle>
      <CardDescription>
        {owner
          ? "Ce salon est rattaché à un compte propriétaire (plan Entreprise potentiel)."
          : "Ce salon n'est rattaché à aucun propriétaire."}
      </CardDescription>

      {error ? (
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {owner ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated/40 p-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">{owner.name}</div>
              <div className="text-xs text-text-dim">{owner.email}</div>
              <div className="mt-0.5 text-xs">
                {isOwnerEnterpriseActive(owner) ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    Entreprise actif
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Plan non actif
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Link
              href={`/dashboard/owners/${owner.id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Fiche
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              loading={busy}
            >
              <X className="h-4 w-4" />
              Retirer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="h-11 flex-1 min-w-[200px] rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— Choisir un propriétaire —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.email})
              </option>
            ))}
          </select>
          <Button
            disabled={!selectedOwnerId}
            loading={busy}
            onClick={assign}
          >
            Assigner
          </Button>
        </div>
      )}
    </Card>
  );
}
