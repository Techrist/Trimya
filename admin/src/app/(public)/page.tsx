import Link from "next/link";
import Image from "next/image";
import {
  Zap,
  Smartphone,
  Bell,
  Crown,
  Scissors,
  User,
  Home,
  Calendar,
  Star,
  Shield,
  Globe,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  Hero,
  Section,
  FeatureCard,
  CTABand,
  CheckList,
} from "@/components/public/primitives";

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <Hero
        spotlight
        eyebrow="La fidélité, à la vitesse d'une coupe"
        title={
          <>
            Plus jamais de
            <br />
            <span className="bg-gradient-to-r from-accent via-primary to-primary bg-clip-text text-transparent">
              carte papier perdue
            </span>
          </>
        }
        description="Trimya transforme la carte de fidélité coiffeur en une expérience digitale fluide. 4 coupes payées, la 5ᵉ offerte — automatiquement, sans triche, sans paperasse."
        primaryCta={{ label: "Démarrer gratuitement", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />

      {/* APP DOWNLOAD BANDS */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface p-8 sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Téléchargement gratuit
              </p>
              <h2 className="mt-2 text-2xl font-bold text-text sm:text-3xl">
                Deux apps, un seul écosystème
              </h2>
              <p className="mt-3 text-base text-text-muted">
                <strong className="text-text">Trimya</strong> pour les clients,{" "}
                <strong className="text-text">Trimya Pro</strong> pour les
                salons et les chaînes. Le compteur de fidélité circule entre
                les deux en temps réel.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:gap-2">
              <StoreButton store="ios" />
              <StoreButton store="android" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 FEATURES KEY */}
      <Section
        eyebrow="Comment ça marche"
        title="Trois secondes, trois étapes"
        description="Tout est conçu pour ne PAS interrompre la vraie vie du salon."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={Smartphone}
            tone="primary"
            title="1. Le client présente son QR"
            description="Inscription par SMS en 30 secondes. Son code QR est dans sa poche, jamais perdu, jamais mouillé."
          />
          <FeatureCard
            icon={Zap}
            tone="accent"
            title="2. Le salon scanne"
            description="Un tap sur la tablette du salon. Le compteur monte automatiquement, sans saisie manuelle."
          />
          <FeatureCard
            icon={Bell}
            tone="success"
            title="3. La récompense tombe"
            description="Au seuil défini par le salon (4, 5 ou plus), la prochaine coupe est offerte. Notification automatique au client."
          />
        </div>
      </Section>

      {/* PERSONA SECTIONS */}
      <Section
        eyebrow="Pour qui"
        title="Une plateforme, trois utilisateurs"
        description="Chacun a son app et son expérience taillée sur mesure."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <PersonaCard
            icon={User}
            title="Le Client"
            subtitle="App gratuite"
            color="accent"
            features={[
              "Carte de fidélité QR personnelle",
              "Réservation de créneaux en ligne",
              "Notations de coiffeurs avec étoiles",
              "Notifications de récompense",
              "Coupe à domicile (Pro)",
            ]}
            href="/clients"
          />
          <PersonaCard
            icon={Scissors}
            title="Le Salon"
            subtitle="Kiosque tablette · à partir de 10 000 FCFA/mois"
            color="primary"
            features={[
              "Scanner QR ultra-rapide",
              "Fiche client + historique",
              "Gestion équipe + stats coiffeurs",
              "Messagerie + notifications push",
              "Abonnement coupes illimitées",
            ]}
            href="/salons"
          />
          <PersonaCard
            icon={Crown}
            title="Le Propriétaire"
            subtitle="Multi-salons · 25 000 FCFA/mois"
            color="accent"
            features={[
              "Dashboard consolidé multi-salons",
              "Fidélité partagée entre établissements",
              "Transferts de coiffeurs en 1 clic",
              "Comparaisons et benchmarks",
              "Essai Pro gratuit pour toute la chaîne",
            ]}
            href="/proprietaires"
          />
        </div>
      </Section>

      {/* STATS / PROOF */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-10 sm:p-14">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <Stat number="< 3s" label="par scan" />
            <Stat number="0" label="carte papier perdue" />
            <Stat number="100%" label="traçabilité côté salon" />
          </div>
        </div>
      </section>

      {/* WHY TRIMYA */}
      <Section
        eyebrow="Pourquoi Trimya"
        title="Pensé pour le marché africain"
        description="On a regardé les salons du quartier avant de coder une seule ligne."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={Globe}
            tone="primary"
            title="Local par construction"
            description="Tarifs en FCFA, paiement par Mobile Money ou virement, support WhatsApp, interface adaptée aux usages camerounais."
          />
          <FeatureCard
            icon={Shield}
            tone="success"
            title="Sécurité d'abord"
            description="Données chiffrées, sauvegardes quotidiennes, cloisonnement total entre salons. Hébergement Europe."
          />
          <FeatureCard
            icon={InfinityIcon}
            tone="accent"
            title="Évolutif"
            description="Du salon individuel à la chaîne de 5 établissements, la plateforme grandit avec ton activité."
          />
          <FeatureCard
            icon={Star}
            tone="primary"
            title="Sans engagement"
            description="Aucun contrat d'engagement, aucun frais caché. Tu paies au mois, tu arrêtes quand tu veux."
          />
        </div>
      </Section>

      {/* FINAL CTA */}
      <CTABand
        title="Prêt à remplacer ta carte papier ?"
        description="Démo gratuite de 14 jours · Activation sous 24h · Aucun engagement."
        primaryCta={{ label: "Démarrer la démo", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />
    </>
  );
}

// ─── Composants locaux à la homepage ──────────────────────────

function StoreButton({ store }: { store: "ios" | "android" }) {
  // Pour l'instant on mocke les liens vers les stores — à remplacer par les
  // vraies URLs App Store Connect / Play Console une fois les apps publiées.
  const href = store === "ios" ? "#app-store-coming-soon" : "#play-store-coming-soon";
  const label = store === "ios" ? "App Store" : "Google Play";
  const sub = store === "ios" ? "Bientôt disponible" : "Bientôt disponible";
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 transition-colors hover:border-text-dim"
    >
      <Smartphone className="h-6 w-6 text-text-muted" strokeWidth={2} />
      <div className="flex-1 text-left">
        <p className="text-xs text-text-dim">Télécharger sur</p>
        <p className="text-sm font-bold text-text">{label}</p>
      </div>
      <p className="text-xs text-text-dim">{sub}</p>
    </a>
  );
}

function PersonaCard({
  icon: Icon,
  title,
  subtitle,
  color,
  features,
  href,
}: {
  icon: typeof User;
  title: string;
  subtitle: string;
  color: "primary" | "accent";
  features: string[];
  href: string;
}) {
  const iconClasses =
    color === "primary"
      ? "bg-primary/15 text-primary"
      : "bg-accent/15 text-accent";
  const linkClasses =
    color === "primary"
      ? "text-primary hover:text-primary-dark"
      : "text-accent hover:text-accent/80";
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
      <div
        className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${iconClasses}`}
      >
        <Icon className="h-7 w-7" strokeWidth={2.2} />
      </div>
      <h3 className="text-xl font-bold text-text">{title}</h3>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {subtitle}
      </p>
      <div className="mt-5 flex-1">
        <CheckList items={features} tone={color} />
      </div>
      <Link
        href={href}
        className={`mt-6 inline-flex items-center gap-1 text-sm font-bold ${linkClasses}`}
      >
        En savoir plus
        <span>→</span>
      </Link>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="text-5xl font-bold tracking-tight text-primary sm:text-6xl">
        {number}
      </p>
      <p className="mt-2 text-sm font-medium text-text-muted">{label}</p>
    </div>
  );
}
