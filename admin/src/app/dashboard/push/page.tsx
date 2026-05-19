"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { Send, Users, Store, Megaphone, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { adminFetch } from "@/lib/auth-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Salon, AdminPushLog } from "@/lib/types";
import { cn } from "@/lib/cn";

type AudienceKind = "salon-customers" | "all-kiosks" | "all-customers";

const AUDIENCES: {
  kind: AudienceKind;
  label: string;
  description: string;
  Icon: typeof Users;
}[] = [
  {
    kind: "salon-customers",
    label: "Clients d'un salon",
    description: "Cible les clients d'un seul salon (annonce, promo, horaires)",
    Icon: Users,
  },
  {
    kind: "all-customers",
    label: "Tous les clients",
    description: "Broadcast à tous les clients de la plateforme",
    Icon: Megaphone,
  },
  {
    kind: "all-kiosks",
    label: "Toutes les tablettes salon",
    description: "Annonce technique aux salons (maintenance, mise à jour…)",
    Icon: Store,
  },
];

export default function PushPage() {
  const [audience, setAudience] = useState<AudienceKind>("salon-customers");
  const [salonId, setSalonId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    delivered: number;
    failed: number;
    totalTargets: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Salons for the dropdown when audience = salon-customers
  const [salons, setSalons] = useState<Salon[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "salons"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Salon)
        .filter((s) => !s.disabledAt)
        .sort((a, b) => a.name.localeCompare(b.name));
      setSalons(list);
    });
    return unsub;
  }, []);

  // Recent push history
  const [history, setHistory] = useState<AdminPushLog[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "adminPushLogs"),
        orderBy("sentAt", "desc"),
        limit(20),
      ),
      (snap) => {
        setHistory(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminPushLog),
        );
      },
    );
    return unsub;
  }, []);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !body.trim()) return false;
    if (audience === "salon-customers" && !salonId) return false;
    return true;
  }, [title, body, audience, salonId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience:
          audience === "salon-customers"
            ? { kind: "salon-customers" as const, salonId }
            : audience === "all-customers"
              ? { kind: "all-customers" as const }
              : { kind: "all-kiosks" as const },
      };
      const res = await adminFetch("/api/push", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l'envoi");
        return;
      }
      setResult({
        delivered: data.delivered,
        failed: data.failed,
        totalTargets: data.totalTargets,
      });
      setTitle("");
      setBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Notifications push</h1>
        <p className="mt-1 text-sm text-text-muted">
          Diffuse un message en quelques secondes
        </p>
      </header>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Audience
            </label>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              {AUDIENCES.map((a) => {
                const selected = audience === a.kind;
                return (
                  <button
                    type="button"
                    key={a.kind}
                    onClick={() => setAudience(a.kind)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:border-text-dim",
                    )}
                  >
                    <a.Icon
                      className={cn(
                        "h-5 w-5",
                        selected ? "text-primary" : "text-text-muted",
                      )}
                      strokeWidth={2.2}
                    />
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        selected ? "text-text" : "text-text",
                      )}
                    >
                      {a.label}
                    </div>
                    <div className="text-xs text-text-muted">
                      {a.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {audience === "salon-customers" ? (
            <div>
              <label
                htmlFor="salon-select"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Salon ciblé
              </label>
              <select
                id="salon-select"
                value={salonId}
                onChange={(e) => setSalonId(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Choisir un salon —</option>
                {salons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.city}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Input
            id="push-title"
            label="Titre"
            placeholder="Nouveau service disponible"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint={`${title.length}/80 caractères`}
          />

          <Textarea
            id="push-body"
            label="Message"
            placeholder="Découvre notre nouveau service de coloration, à partir de 5000 FCFA !"
            maxLength={300}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            hint={`${body.length}/300 caractères`}
          />

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Envoyé : <strong>{formatNumber(result.delivered)}</strong>{" "}
                livré{result.delivered > 1 ? "s" : ""} sur{" "}
                {formatNumber(result.totalTargets)} ciblé
                {result.totalTargets > 1 ? "s" : ""}
                {result.failed > 0
                  ? ` · ${formatNumber(result.failed)} échec${result.failed > 1 ? "s" : ""}`
                  : ""}
                .
              </div>
            </div>
          ) : null}

          <Button type="submit" loading={sending} disabled={!canSubmit}>
            <Send className="h-4 w-4" />
            Envoyer la notification
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Historique récent</CardTitle>
        <CardDescription>20 dernières campagnes</CardDescription>

        <div className="mt-4 divide-y divide-border">
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Aucun envoi pour l&apos;instant.
            </p>
          ) : null}
          {history.map((log) => (
            <div key={log.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{log.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-text-muted">
                    {log.body}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-text-dim">
                  {formatDateTime(log.sentAt)}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-text-dim">
                <span>
                  Cible :{" "}
                  {log.audience.kind === "salon-customers"
                    ? `Clients de ${log.audience.salonName}`
                    : log.audience.kind === "all-customers"
                      ? "Tous les clients"
                      : "Tous les kiosques"}
                </span>
                <span>
                  {formatNumber(log.deliveredCount)} / {formatNumber(log.totalTargets)} livrés
                </span>
                {log.failedCount > 0 ? (
                  <span className="text-danger">
                    {formatNumber(log.failedCount)} échecs
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
