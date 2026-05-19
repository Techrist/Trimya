"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, CheckCircle2, KeyRound } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminFetch } from "@/lib/auth-client";

interface Created {
  uid: string;
  tempPassword: string;
}

export default function NewOwnerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        email: form.email.trim(),
        name: form.name.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      };
      const res = await adminFetch("/api/owners", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "email_already_used") {
          setError("Cet email est déjà utilisé par un autre compte Firebase Auth.");
        } else {
          setError(data.error || "Erreur de création");
        }
        return;
      }
      setCreated({ uid: data.uid, tempPassword: data.tempPassword });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <CardTitle className="mt-4">Propriétaire créé</CardTitle>
            <CardDescription className="mt-1">
              Communique ces identifiants au propriétaire. Il les utilisera
              pour se connecter dans l&apos;app mobile en choisissant
              « Je suis propriétaire ». Il pourra changer son mot de passe
              ensuite depuis son profil.
            </CardDescription>

            <div className="mt-6 w-full rounded-lg border border-border bg-surface-elevated p-5 text-left">
              <div className="text-xs uppercase tracking-wider text-text-muted">
                Email
              </div>
              <div className="mt-1 font-mono text-sm text-text">
                {form.email}
              </div>
              <div className="mt-4 text-xs uppercase tracking-wider text-text-muted">
                Mot de passe temporaire
              </div>
              <div className="mt-1 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <code className="font-mono text-base font-bold text-primary">
                  {created.tempPassword}
                </code>
              </div>
            </div>

            <div className="mt-4 flex w-full gap-3">
              <Button onClick={copyPassword} variant="secondary" className="flex-1">
                <Copy className="h-4 w-4" />
                {copied ? "Copié !" : "Copier le mot de passe"}
              </Button>
              <Button
                onClick={() => router.push(`/dashboard/owners/${created.uid}`)}
                className="flex-1"
              >
                Voir le propriétaire
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/dashboard/owners"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Nouveau propriétaire</h1>
        <p className="mt-1 text-sm text-text-muted">
          Un compte Firebase Auth sera créé avec un mot de passe temporaire à
          communiquer au propriétaire.
        </p>
      </header>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Nom complet"
            placeholder="Ahmed Diallo"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="ahmed@example.com"
            required
            autoCapitalize="none"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            hint="Sert d'identifiant de connexion. Doit être unique."
          />
          <Input
            id="phone"
            label="Téléphone (optionnel)"
            type="tel"
            placeholder="+237 6 12 34 56 78"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/owners" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Annuler
              </Button>
            </Link>
            <Button type="submit" loading={loading} className="flex-1">
              Créer le propriétaire
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
