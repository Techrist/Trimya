"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminFetch } from "@/lib/auth-client";

interface CreatedSalon {
  salonId: string;
  activationCode: string;
}

export default function NewSalonPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    city: "",
    ownerName: "",
    phone: "",
    salonId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSalon | null>(null);
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
        name: form.name.trim(),
        city: form.city.trim(),
        ownerName: form.ownerName.trim(),
        phone: form.phone.trim(),
        ...(form.salonId.trim() ? { salonId: form.salonId.trim() } : {}),
      };
      const res = await adminFetch("/api/salons", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de création");
        return;
      }
      setCreated({ salonId: data.salonId, activationCode: data.activationCode });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!created) return;
    await navigator.clipboard.writeText(created.activationCode);
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
            <CardTitle className="mt-4">Salon créé</CardTitle>
            <CardDescription className="mt-1">
              Remets ce code d&apos;activation au coiffeur. Il le saisira dans
              l&apos;app Trimya (mode salon) pour appairer sa tablette.
            </CardDescription>

            <div className="mt-6 w-full rounded-lg border border-border bg-surface-elevated p-5">
              <div className="text-xs uppercase tracking-wider text-text-muted">
                Code d&apos;activation
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-primary">
                {created.activationCode}
              </div>
            </div>

            <div className="mt-4 flex w-full gap-3">
              <Button onClick={copyCode} variant="secondary" className="flex-1">
                <Copy className="h-4 w-4" />
                {copied ? "Copié !" : "Copier le code"}
              </Button>
              <Button
                onClick={() =>
                  router.push(`/dashboard/salons/${created.salonId}`)
                }
                className="flex-1"
              >
                Voir le salon
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
        href="/dashboard/salons"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <header>
        <h1 className="text-xl md:text-2xl font-bold">Nouveau salon</h1>
        <p className="mt-1 text-sm text-text-muted">
          Un code d&apos;activation unique sera généré automatiquement
        </p>
      </header>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Nom du salon"
            placeholder="Salon Le Style"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
          <Input
            id="city"
            label="Ville"
            placeholder="Paris"
            required
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
          />
          <Input
            id="ownerName"
            label="Propriétaire"
            placeholder="Ahmed Diallo"
            required
            value={form.ownerName}
            onChange={(e) => update("ownerName", e.target.value)}
          />
          <Input
            id="phone"
            label="Téléphone"
            type="tel"
            placeholder="+33 6 12 34 56 78"
            required
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
          <Input
            id="salonId"
            label="Identifiant (optionnel)"
            hint="Auto-généré depuis le nom si laissé vide. Lettres minuscules + tirets."
            placeholder="salon-le-style"
            value={form.salonId}
            onChange={(e) => update("salonId", e.target.value)}
          />

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/salons" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Annuler
              </Button>
            </Link>
            <Button type="submit" loading={loading} className="flex-1">
              Créer le salon
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
