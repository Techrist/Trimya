import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";

/**
 * Primitives partagées des pages marketing : Hero, FeatureCard, CTABand,
 * Section, etc. Volontairement légères en logique, beaucoup en composition.
 */

// ─── Hero d'introduction de page ─────────────────────────────

interface HeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Mode "dark spotlight" : halo orange en arrière-plan. */
  spotlight?: boolean;
}

export function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  spotlight = false,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {spotlight ? (
        <>
          {/* Halo orange à droite */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
          />
        </>
      ) : null}

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <p className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-text sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-6 max-w-2xl text-base text-text-muted sm:text-lg">
              {description}
            </p>
          ) : null}

          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-base font-semibold text-black transition-colors hover:bg-primary-dark"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="inline-flex h-12 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-6 text-base font-semibold text-text transition-colors hover:border-text-dim hover:bg-surface-elevated"
                >
                  {secondaryCta.label}
                  <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section générique (avec optional title) ────────────────

interface SectionProps {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Couleur du bandeau eyebrow ; primary par défaut. */
  eyebrowColor?: "primary" | "accent";
  children: React.ReactNode;
  className?: string;
}

export function Section({
  eyebrow,
  title,
  description,
  eyebrowColor = "primary",
  children,
  className = "",
}: SectionProps) {
  const eyebrowClass =
    eyebrowColor === "primary"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-accent/30 bg-accent/10 text-accent";
  return (
    <section className={`mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24 lg:px-8 ${className}`}>
      {(eyebrow || title || description) && (
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <p
              className={`mb-4 inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${eyebrowClass}`}
            >
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
              {description}
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-12">{children}</div>
    </section>
  );
}

// ─── Carte de feature (icône colorée + titre + texte) ───────

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Couleur de l'accent icône. */
  tone?: "primary" | "accent" | "success";
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: FeatureCardProps) {
  const toneClasses = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-text-dim">
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${toneClasses}`}
      >
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <h3 className="text-lg font-bold text-text">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

// ─── Bande de CTA (fond gradient) ────────────────────────────

interface CTABandProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function CTABand({
  title,
  description,
  primaryCta,
  secondaryCta,
}: CTABandProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent via-primary to-primary-dark p-10 sm:p-14">
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mx-auto mt-4 max-w-2xl text-base text-black/85 sm:text-lg">
              {description}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex h-12 items-center justify-center gap-1 rounded-lg border border-black/30 bg-black/10 px-6 text-base font-semibold text-black transition-colors hover:bg-black/20"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Liste cochée (bullets avec ✓) ────────────────────────

interface CheckListProps {
  items: string[];
  tone?: "primary" | "accent" | "white";
}

export function CheckList({ items, tone = "primary" }: CheckListProps) {
  const dotClass = {
    primary: "bg-primary text-black",
    accent: "bg-accent text-black",
    white: "bg-white text-black",
  }[tone];
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${dotClass} text-xs font-bold`}
          >
            ✓
          </span>
          <span className="text-sm text-text-muted">{item}</span>
        </li>
      ))}
    </ul>
  );
}
