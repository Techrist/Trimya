import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Hero, CTABand } from "@/components/public/primitives";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "5 plans Trimya, du gratuit au chaîne premium. Salon individuel à partir de 0 FCFA/mois. Chaînes à partir de 25 000 FCFA/mois.",
};

interface Plan {
  id: string;
  name: string;
  audience: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Découverte",
    audience: "Salon individuel",
    price: 0,
    description: "Pour démarrer et tester Trimya",
    features: [
      "Carte de fidélité 4/4 avec QR",
      "Jusqu'à 50 clients",
      "1 coiffeur",
      "Profil salon basique",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    audience: "Salon individuel",
    price: 10000,
    description: "Pour faire grandir ton fichier client",
    features: [
      "Clients illimités",
      "Jusqu'à 2 coiffeurs",
      "Messagerie client ↔ salon",
      "Horaires d'ouverture configurables",
      "File d'attente « Je suis en route »",
      "Notes privées + clients VIP",
      "Support par email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Salon individuel",
    price: 15000,
    description: "Toute la puissance Trimya pour un salon ambitieux",
    highlight: true,
    features: [
      "Tout Standard, plus :",
      "Réservations en ligne",
      "Abonnement coupes illimitées",
      "Coupe à domicile (avec contre-proposition)",
      "Coiffeurs illimités + stats par coiffeur",
      "Stats avancées (revenus, périodes)",
      "Templates de messages",
      "Support prioritaire WhatsApp",
    ],
  },
  {
    id: "enterprise_standard",
    name: "Entreprise Standard",
    audience: "Chaîne (jusqu'à 5 salons)",
    price: 25000,
    description: "Plusieurs salons, features essentielles",
    features: [
      "Jusqu'à 5 salons sous un même compte",
      "Tous les salons inclus passent en Standard",
      "Tableau de bord consolidé multi-salons",
      "Fidélité partagée entre salons",
      "Transferts de coiffeurs entre salons",
      "Facturation et support unifiés",
    ],
  },
  {
    id: "enterprise",
    name: "Entreprise Pro",
    audience: "Chaîne (jusqu'à 5 salons)",
    price: 40000,
    description: "Plusieurs salons, toute la puissance Pro",
    features: [
      "Jusqu'à 5 salons sous un même compte",
      "Tous les salons inclus passent en Pro",
      "Réservations + abonnements + stats avancées",
      "Coupe à domicile sur tous les salons",
      "Transferts de coiffeurs + fidélité partagée",
      "Facturation et support prioritaires",
    ],
  },
];

export default function TarifsPage() {
  return (
    <>
      <Hero
        eyebrow="Tarifs"
        title="Choisis le plan adapté à ton salon"
        description="Du salon individuel à la chaîne de 5 établissements. Sans engagement, sans frais cachés, paiement en FCFA par Mobile Money ou virement."
      />

      {/* GRILLE DE PLANS */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.slice(0, 3).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* Plans entreprise séparés */}
        <div className="mt-12">
          <div className="mb-6 text-center">
            <p className="inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
              Pour les chaînes
            </p>
            <h2 className="mt-3 text-2xl font-bold text-text sm:text-3xl">
              Plusieurs salons sous un seul compte
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {PLANS.slice(3).map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ TARIFS */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-text sm:text-3xl">
          Questions fréquentes
        </h2>
        <div className="mt-8 space-y-6">
          <FAQItem
            question="Comment se passe le paiement ?"
            answer="En dehors de l'app. Virement bancaire, Mobile Money (Orange Money, MTN MoMo, Wave) ou espèces auprès d'un représentant Trimya. À réception, on active manuellement ton plan dans Trimya Admin sous 24h ouvrées."
          />
          <FAQItem
            question="Y a-t-il un engagement ?"
            answer="Aucun. Tu paies au mois, au trimestre ou à l'année (selon ce qui t'arrange). Tu peux arrêter quand tu veux — aucun remboursement n'est dû pour le temps restant, mais tu gardes l'accès jusqu'à l'échéance prépayée."
          />
          <FAQItem
            question="Y a-t-il une période d'essai ?"
            answer="Oui. Tout nouveau salon démarre avec 14 jours d'essai Pro gratuit à l'activation. Toutes les fonctionnalités Pro débloquées. À l'expiration, tu bascules sur Découverte (gratuit) sauf si tu as souscrit."
          />
          <FAQItem
            question="Que se passe-t-il si je ne paie pas à temps ?"
            answer="Ton salon retombe automatiquement sur le plan Découverte (gratuit). Les abonnements coupes illimitées actifs de tes clients restent valides jusqu'à leur expiration, mais tu ne peux pas en créer de nouveaux tant que tu n'es pas remonté en Pro."
          />
          <FAQItem
            question="L'app coûte quelque chose pour mes clients ?"
            answer="Non. L'app Trimya côté client est 100% gratuite, sans abonnement, sans achat in-app. Les seuls frais facturés au client sont les services réels du salon (coupes, abonnements coupes illimitées), payés directement au salon comme aujourd'hui."
          />
          <FAQItem
            question="Et si j'ai plus de 5 salons ?"
            answer="Contacte-nous pour un tarif sur mesure. À partir de 6 salons, on monte un contrat spécifique adapté à ta chaîne."
          />
        </div>
      </section>

      <CTABand
        title="Une question, un cas particulier ?"
        description="Discutons-en — chaque salon a ses spécificités."
        primaryCta={{ label: "Nous contacter", href: "/contact" }}
      />
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        plan.highlight ? "border-primary bg-primary/5" : "border-border bg-surface"
      }`}
    >
      {plan.highlight ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-black">
          ★ Populaire
        </div>
      ) : null}
      <div>
        <h3 className="text-xl font-bold text-text">{plan.name}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {plan.audience}
        </p>
        <p className="mt-3 text-sm text-text-muted">{plan.description}</p>
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-text">
          {plan.price === 0 ? "Gratuit" : plan.price.toLocaleString("fr-FR")}
        </span>
        {plan.price > 0 && (
          <span className="text-sm text-text-muted">FCFA / mois</span>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                plan.highlight ? "text-primary" : "text-success"
              }`}
              strokeWidth={2.5}
            />
            <span className="text-sm text-text">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/contact"
        className={`mt-8 inline-flex h-11 items-center justify-center rounded-lg font-semibold transition-colors ${
          plan.highlight
            ? "bg-primary text-black hover:bg-primary-dark"
            : "border border-border bg-surface-elevated text-text hover:border-text-dim"
        }`}
      >
        {plan.price === 0 ? "Commencer gratuitement" : "Souscrire"}
      </Link>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface p-5">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-base font-bold text-text">
        {question}
        <span className="text-primary transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="mt-3 text-sm text-text-muted">{answer}</p>
    </details>
  );
}
