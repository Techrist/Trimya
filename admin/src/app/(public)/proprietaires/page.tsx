import type { Metadata } from "next";
import {
  LayoutDashboard,
  Link2,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import {
  Hero,
  Section,
  FeatureCard,
  CTABand,
  CheckList,
} from "@/components/public/primitives";

export const metadata: Metadata = {
  title: "Pour les chaînes",
  description:
    "Trimya Entreprise : pilote plusieurs salons depuis un compte unique. Dashboard consolidé, fidélité partagée, transferts coiffeurs. À partir de 25 000 FCFA/mois.",
};

export default function ProprietairesPage() {
  return (
    <>
      <Hero
        spotlight
        eyebrow="Pour les chaînes"
        title={
          <>
            Pilote ta chaîne
            <br />
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              comme une vraie entreprise
            </span>
          </>
        }
        description="Multi-salons, dashboard consolidé, fidélité partagée, transferts de coiffeurs en 1 clic. Jusqu'à 5 établissements sous un même compte. À partir de 25 000 FCFA/mois."
        primaryCta={{ label: "Demander une démo", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />

      <Section
        eyebrow="Pouvoirs uniques"
        title="Des features que personne d'autre n'a"
        description="Conçues spécifiquement pour les propriétaires de chaînes de salons."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            icon={LayoutDashboard}
            tone="primary"
            title="Dashboard consolidé"
            description="KPIs agrégés sur tous tes salons : clients totaux, coupes 30j, CA cumulé, top salon. Drill-down par établissement pour analyser en détail."
          />
          <FeatureCard
            icon={Link2}
            tone="accent"
            title="Fidélité partagée"
            description="Activable en 1 clic. Un client compte ses coupes sur TOUS tes salons. Ta marque devient sa carte de fidélité, peu importe l'établissement visité."
          />
          <FeatureCard
            icon={ArrowRightLeft}
            tone="primary"
            title="Transferts coiffeurs"
            description="Déplace un coiffeur d'un salon à l'autre en 1 clic. L'historique de coupes reste rattaché au salon source ; sa réputation (notes) le suit."
          />
          <FeatureCard
            icon={AlertTriangle}
            tone="success"
            title="Détection points chauds"
            description="Coiffeurs flaggés (note < 3), abonnements à expiration, salons en sous-activité — tout est visible avant que ça devienne un problème."
          />
        </div>
      </Section>

      <Section
        eyebrow="Deux plans Entreprise"
        title="Choisis ton tier"
        description="Selon que tu veux les fonctionnalités essentielles ou la puissance complète Pro."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <PlanBox
            name="Entreprise Standard"
            price="25 000"
            description="Pour les chaînes qui veulent l'essentiel : fidélité, messagerie, équipe."
            features={[
              "Jusqu'à 5 salons inclus",
              "Tous les salons passent en Standard",
              "Dashboard consolidé multi-salons",
              "Fidélité partagée + transferts coiffeurs",
              "Messagerie, horaires, file d'attente",
              "Facturation unifiée",
            ]}
            tone="primary"
          />
          <PlanBox
            name="Entreprise Pro"
            price="40 000"
            description="Pour les chaînes ambitieuses : toute la puissance Pro sur 5 salons."
            features={[
              "Jusqu'à 5 salons inclus",
              "Tous les salons passent en Pro",
              "Réservations + abonnements + stats avancées",
              "Stats par coiffeur sur chaque salon",
              "Transferts coiffeurs + fidélité partagée",
              "Support prioritaire WhatsApp",
            ]}
            tone="accent"
            featured
          />
        </div>
      </Section>

      <Section
        eyebrow="Essai accordé par l'admin"
        title="Trimya peut t'accorder un essai Pro de 14 jours"
        eyebrowColor="accent"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Hourglass className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">
                  Essai propagé sur tous tes salons
                </h3>
                <p className="mt-2 text-sm text-text-muted">
                  Quand notre équipe t&apos;accorde un essai Pro de 14 jours,
                  il est <strong>automatiquement propagé sur tous tes
                  salons</strong> via le mécanisme de plan hérité. Aucun
                  salon n&apos;a besoin de l&apos;activer manuellement.
                </p>
                <p className="mt-3 text-sm text-text-muted">
                  À l&apos;expiration, tes salons retombent sur leur plan
                  brut individuel. Aucun risque de coupure brutale du
                  service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <CTABand
        title="Tu gères 2 salons ou plus ?"
        description="Contacte-nous pour un onboarding personnalisé et 14 jours d'essai Pro pour toute la chaîne."
        primaryCta={{ label: "Démarrer la démo", href: "/contact" }}
      />
    </>
  );
}

function PlanBox({
  name,
  price,
  description,
  features,
  tone,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  tone: "primary" | "accent";
  featured?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-8 ${
        featured ? "border-primary bg-primary/5" : "border-border bg-surface"
      }`}
    >
      {featured ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-black">
          Recommandé
        </div>
      ) : null}
      <h3 className="text-xl font-bold text-text">{name}</h3>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
      <div className="mt-6">
        <span className="text-4xl font-bold text-text">{price}</span>
        <span className="ml-1 text-sm text-text-muted">FCFA / mois</span>
      </div>
      <div className="mt-6">
        <CheckList items={features} tone={tone} />
      </div>
    </div>
  );
}
