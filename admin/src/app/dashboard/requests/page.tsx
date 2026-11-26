"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Check, X } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { adminFetch } from "@/lib/auth-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Demandes de compte (salon / propriétaire) à valider.
 * Les docs `accounts/*` sont écrits uniquement par le serveur ; la
 * validation passe par PATCH /api/requests/{uid}.
 */
interface AccountRow {
  id: string;
  type: "salon" | "owner";
  status: "pending" | "active" | "rejected";
  email: string;
  profile?: {
    name?: string;
    city?: string;
    ownerName?: string;
    phone?: string;
    salonCount?: number;
    companyName?: string;
  };
  salonId?: string;
  createdByOwnerId?: string;
  rejectionReason?: string;
  convertedFromClient?: boolean;
  /** Résultat de l'envoi de l'email de bienvenue (absent = jamais tenté). */
  approvalEmailSent?: boolean;
  approvalEmailAt?: number;
  createdAt: number;
}

type Filter = "pending" | "active" | "rejected";

const FILTER_LABEL: Record<Filter, string> = {
  pending: "À valider",
  active: "Validées",
  rejected: "Refusées",
};

export default function RequestsPage() {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("createdAt", "desc"), limit(300));
    return onSnapshot(q, (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccountRow)),
    );
  }, []);

  // Les salons créés par un propriétaire ne sont pas des « demandes ».
  const requests = useMemo(
    () => (rows ?? []).filter((r) => !r.createdByOwnerId),
    [rows],
  );
  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "pending").length,
      active: requests.filter((r) => r.status === "active").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }),
    [requests],
  );
  const shown = requests.filter((r) => r.status === filter);

  async function act(
    id: string,
    body:
      | { action: "approve" }
      | { action: "resend-email" }
      | { action: "reject"; reason: string },
  ) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Action impossible (${data.error ?? res.status}).`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { emailSent?: boolean };
      if (body.action !== "reject") {
        setNotice(
          data.emailSent
            ? { ok: true, text: "Email envoyé à la personne." }
            : {
                ok: false,
                text: "Action faite, mais l'email n'a pas pu partir. Utilise « Renvoyer l'email » sur la ligne.",
              },
        );
      }
      setRejecting(null);
      setReason("");
    } catch {
      setError("Action impossible. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes de compte</h1>
        <p className="text-sm text-muted">
          Salons et propriétaires qui se sont inscrits. Valide pour créer leur
          espace (14 jours d&apos;essai démarrent à la validation).
        </p>
      </div>

      <ConvertPanel />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-text",
            )}
          >
            {FILTER_LABEL[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {notice ? (
        <p className={cn("text-sm", notice.ok ? "text-emerald-400" : "text-amber-400")}>
          {notice.text}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : shown.length === 0 ? (
        <Card>
          <CardDescription>Aucune demande dans cette catégorie.</CardDescription>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <CardTitle>
                    {r.profile?.name ?? "—"}{" "}
                    <span className="ml-2 rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-medium text-muted">
                      {r.type === "owner" ? "Propriétaire" : "Salon"}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted">
                    {r.email} · {r.profile?.phone ?? "—"}
                  </p>
                  {r.type === "salon" ? (
                    <p className="text-sm text-muted">
                      {r.profile?.city ?? "—"} · gérant : {r.profile?.ownerName ?? "—"}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      {r.profile?.companyName ? `${r.profile.companyName} · ` : ""}
                      {r.profile?.salonCount
                        ? `${r.profile.salonCount} salon(s) prévu(s)`
                        : "nombre de salons non précisé"}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    Demande du {formatDateTime(r.createdAt)}
                  </p>
                  {r.status === "active" ? (
                    <p
                      className={cn(
                        "text-xs",
                        r.approvalEmailSent === true ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {r.convertedFromClient ? "Compte converti · " : ""}
                      {r.approvalEmailSent === true
                        ? `Email envoyé${r.approvalEmailAt ? ` le ${formatDateTime(r.approvalEmailAt)}` : ""}`
                        : r.approvalEmailSent === false
                          ? "⚠ Email non envoyé"
                          : "Email : aucun envoi enregistré"}
                    </p>
                  ) : null}
                  {r.status === "rejected" && r.rejectionReason ? (
                    <p className="text-sm text-red-400">Motif : {r.rejectionReason}</p>
                  ) : null}
                </div>

                {r.status === "active" && r.approvalEmailSent !== true ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === r.id}
                    onClick={() => act(r.id, { action: "resend-email" })}
                  >
                    Renvoyer l'email
                  </Button>
                ) : null}

                {r.status !== "active" ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={busy === r.id}
                        onClick={() => act(r.id, { action: "approve" })}
                      >
                        <Check className="h-4 w-4" /> Valider
                      </Button>
                      {r.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === r.id}
                          onClick={() => setRejecting(rejecting === r.id ? null : r.id)}
                        >
                          <X className="h-4 w-4" /> Refuser
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {rejecting === r.id ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <label className="text-sm text-muted" htmlFor={`reason-${r.id}`}>
                    Motif (envoyé par email, facultatif)
                  </label>
                  <textarea
                    id={`reason-${r.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface-elevated p-2 text-sm text-text"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busy === r.id}
                      onClick={() => act(r.id, { action: "reject", reason })}
                    >
                      Confirmer le refus
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  user_not_found: "Aucun compte avec cet email. La personne doit d'abord créer son compte.",
  already_has_pro_account: "Cet email a déjà un compte ou une demande Pro.",
  account_disabled: "Ce compte est désactivé.",
  invalid_phone: "Numéro de téléphone invalide.",
  invalid_payload: "Vérifie les champs (2 caractères minimum).",
};

/**
 * Convertit un compte existant (souvent un client qui a écrit au support)
 * en salon ou propriétaire. Email et mot de passe restent ceux de la
 * personne ; la demande est validée aussitôt.
 */
function ConvertPanel() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"salon" | "owner">("salon");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const input =
    "w-full rounded-lg border border-border bg-surface-elevated p-2 text-sm text-text";

  async function submit() {
    setBusy(true);
    setMsg(null);
    const body =
      type === "salon"
        ? { type, email, name, city, ownerName, phone }
        : { type, email, name, phone, ...(company.trim() ? { companyName: company } : {}) };
    try {
      const res = await adminFetch("/api/requests", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        emailSent?: boolean;
      };
      if (!res.ok) {
        setMsg({ ok: false, text: ERRORS[data.error ?? ""] ?? `Échec (${data.error ?? res.status}).` });
        return;
      }
      setMsg({
        ok: data.emailSent === true,
        text:
          data.emailSent === true
            ? "Compte converti et email envoyé (avec le lien vers l'app Pro)."
            : "Compte converti, mais l'email n'a pas pu partir : renvoie-le depuis la liste « Validées ».",
      });
      setEmail("");
      setName("");
      setCity("");
      setOwnerName("");
      setPhone("");
      setCompany("");
    } catch {
      setMsg({ ok: false, text: "Action impossible. Réessaie." });
    } finally {
      setBusy(false);
    }
  }

  const valid =
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 8 &&
    (type === "owner" || (city.trim().length >= 2 && ownerName.trim().length >= 2));

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>Convertir un compte existant</CardTitle>
          <CardDescription>
            Pour un client qui écrit au support et veut un compte salon ou
            propriétaire avec le même email.
          </CardDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : "Convertir"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 flex gap-2">
            {(["salon", "owner"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  type === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-text",
                )}
              >
                {t === "salon" ? "Salon" : "Propriétaire"}
              </button>
            ))}
          </div>
          <input className={input} placeholder="Email du compte existant" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} placeholder={type === "salon" ? "Nom du salon" : "Nom du propriétaire"} value={name} onChange={(e) => setName(e.target.value)} />
          {type === "salon" ? (
            <>
              <input className={input} placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className={input} placeholder="Nom du gérant" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </>
          ) : (
            <input className={input} placeholder="Enseigne (facultatif)" value={company} onChange={(e) => setCompany(e.target.value)} />
          )}
          <input className={input} placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button size="sm" loading={busy} disabled={!valid} onClick={submit}>
              Convertir et valider
            </Button>
            {msg ? (
              <span className={cn("text-sm", msg.ok ? "text-emerald-400" : "text-red-400")}>
                {msg.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
