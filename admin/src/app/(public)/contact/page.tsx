"use client";

import { useState } from "react";
import { Mail, MessageCircle, MapPin, Send, CheckCircle2 } from "lucide-react";
import { Hero } from "@/components/public/primitives";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "salon" as "client" | "salon" | "owner",
    message: "",
    salonName: "",
    city: "",
  });
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const update = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Échec de l'envoi");
      }
      setState({ kind: "sent" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setState({ kind: "error", message: msg });
    }
  };

  return (
    <>
      <Hero
        eyebrow="Contact"
        title="Parlons de ton salon"
        description="Réponse sous 24h ouvrées. WhatsApp ou email selon ta préférence."
      />

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Coordonnées */}
          <div className="space-y-6 lg:col-span-1">
            <ContactCard
              icon={MessageCircle}
              label="WhatsApp"
              value="+237 692 979 345"
              href="https://wa.me/237692979345"
              hint="Réponse la plus rapide"
            />
            <ContactCard
              icon={Mail}
              label="Email"
              value="contact@trimya.com"
              href="mailto:contact@trimya.com"
              hint="Sous 24h ouvrées"
            />
            <ContactCard
              icon={MapPin}
              label="Adresse"
              value="Yaoundé, Cameroun"
              hint="Présence terrain sur demande"
            />
          </div>

          {/* Formulaire */}
          <div className="lg:col-span-2">
            {state.kind === "sent" ? (
              <SuccessMessage
                onReset={() => {
                  setForm({
                    name: "",
                    email: "",
                    phone: "",
                    role: "salon",
                    message: "",
                    salonName: "",
                    city: "",
                  });
                  setState({ kind: "idle" });
                }}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sélecteur de rôle */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
                    Tu es ?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["client", "salon", "owner"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => update("role", r)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          form.role === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface text-text-muted hover:border-text-dim"
                        }`}
                      >
                        {r === "client"
                          ? "Un client"
                          : r === "salon"
                            ? "Un salon"
                            : "Une chaîne"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identité */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Nom complet *"
                    name="name"
                    value={form.name}
                    onChange={(v) => update("name", v)}
                    required
                    placeholder="Kevin Nguimatsia"
                  />
                  <Field
                    label="Téléphone *"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(v) => update("phone", v)}
                    required
                    placeholder="+237 6 12 34 56 78"
                  />
                </div>

                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  placeholder="kevin@example.com"
                />

                {/* Champs pro */}
                {form.role !== "client" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={
                        form.role === "owner"
                          ? "Nom de la chaîne"
                          : "Nom du salon"
                      }
                      name="salonName"
                      value={form.salonName}
                      onChange={(v) => update("salonName", v)}
                      placeholder="Salon Kevin"
                    />
                    <Field
                      label="Ville"
                      name="city"
                      value={form.city}
                      onChange={(v) => update("city", v)}
                      placeholder="Yaoundé"
                    />
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
                    Ton message *
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    required
                    rows={5}
                    placeholder="Parle-nous de ton activité, tes besoins, tes questions…"
                    className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {state.kind === "error" ? (
                  <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                    {state.message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={state.kind === "submitting"}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-black transition-colors hover:bg-primary-dark disabled:opacity-60"
                >
                  {state.kind === "submitting" ? (
                    "Envoi en cours…"
                  ) : (
                    <>
                      <Send className="h-4 w-4" strokeWidth={2.4} />
                      Envoyer
                    </>
                  )}
                </button>

                <p className="text-xs text-text-dim">
                  En soumettant ce formulaire, tu acceptes notre{" "}
                  <a href="/privacy" className="text-primary hover:underline">
                    politique de confidentialité
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Composants locaux ────────────────────────────────────────

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  hint,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const Wrap: React.ElementType = href ? "a" : "div";
  const props: Record<string, unknown> = href
    ? { href, target: href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer" }
    : {};
  return (
    <Wrap
      {...props}
      className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-text-dim"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-text">{value}</p>
          {hint ? <p className="mt-1 text-xs text-text-dim">{hint}</p> : null}
        </div>
      </div>
    </Wrap>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function SuccessMessage({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-success/40 bg-success/10 p-10 text-center">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
        <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-text">
        Message bien reçu !
      </h2>
      <p className="mt-3 text-base text-text-muted">
        On revient vers toi sous 24h ouvrées. Si c&apos;est urgent, tu peux
        nous envoyer un WhatsApp directement.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href="https://wa.me/237692979345"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-black"
        >
          <MessageCircle className="h-4 w-4" />
          Envoyer un WhatsApp
        </a>
        <button
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-semibold text-text"
        >
          Envoyer un autre message
        </button>
      </div>
    </div>
  );
}
