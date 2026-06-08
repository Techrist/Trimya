import type { Metadata } from "next";
import {
  ScanLine,
  Users,
  BarChart3,
  Calendar,
  MessageSquare,
  Bell,
  Footprints,
  Infinity as InfinityIcon,
  Crown,
} from "lucide-react";
import {
  Hero,
  Section,
  FeatureCard,
  CTABand,
  CheckList,
} from "@/components/public/primitives";

export const metadata: Metadata = {
  title: "Pour les salons",
  description:
    "Trimya Pro : le logiciel de gestion conçu pour les salons de coiffure africains. Scanner QR, fiche client, équipe, stats, à partir de 10 000 FCFA/mois.",
};

export default function SalonsPage() {
  return (
    <>
      <Hero
        spotlight
        eyebrow="Pour les salons"
        title={
          <>
            Le logiciel de gestion
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              fait pour ton salon
            </span>
          </>
        }
        description="Scanner QR, fiche client, équipe, statistiques, abonnement coupes illimitées. Une tablette à l'accueil et tout est sous contrôle. À partir de 10 000 FCFA par mois."
        primaryCta={{ label: "Démarrer la démo", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />

      {/* SECTION FEATURES */}
      <Section
        eyebrow="Tout ce qu'il te faut"
        title="Fonctionnalités clés"
        description="Conçu avec et pour des salons camerounais. Pas de Excel, pas de cahier."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={ScanLine}
            tone="primary"
            title="Scanner QR ultra-rapide"
            description="Le client présente son QR, ton coiffeur tap. Compteur de fidélité automatique, déclenchement de la récompense au seuil."
          />
          <FeatureCard
            icon={Users}
            tone="accent"
            title="Fiche client complète"
            description="Historique de toutes les visites, badge VIP, notes privées, recherche instantanée par nom ou téléphone."
          />
          <FeatureCard
            icon={BarChart3}
            tone="success"
            title="Stats temps réel"
            description="Chiffre d'affaires, nombre de coupes, taux de récompense, par période. Stats par coiffeur en plan Pro."
          />
          <FeatureCard
            icon={Calendar}
            tone="primary"
            title="Réservations en ligne"
            description="Tes clients réservent depuis leur app. Tu acceptes, refuses ou contre-proposes en 1 tap. (Plan Pro)"
          />
          <FeatureCard
            icon={MessageSquare}
            tone="accent"
            title="Messagerie + templates"
            description="Chat 1-to-1 avec chaque client, templates de messages réutilisables, push automatiques. (Standard+)"
          />
          <FeatureCard
            icon={Bell}
            tone="primary"
            title="Notifications ciblées"
            description="Promo de fin de mois ? Envoie une notif à tous tes clients VIP en 1 clic. (Plan Pro)"
          />
          <FeatureCard
            icon={Footprints}
            tone="success"
            title="File d'attente intelligente"
            description="Tes clients signalent leur arrivée, tu prépares leur poste. Stats du taux d'arrivée vs no-show."
          />
          <FeatureCard
            icon={InfinityIcon}
            tone="accent"
            title="Abonnement illimité"
            description="Active un client en illimité contre paiement mensuel. Source de revenus récurrents. (Plan Pro)"
          />
          <FeatureCard
            icon={Crown}
            tone="primary"
            title="Plan Entreprise"
            description="Plusieurs salons sous un même compte ? Passe en Entreprise pour un dashboard consolidé et la fidélité partagée."
          />
        </div>
      </Section>

      {/* WHY TRIMYA PRO */}
      <Section
        eyebrow="Pourquoi Trimya Pro"
        title="Du temps gagné, des clients fidélisés"
        description="Les bénéfices concrets pour ton activité."
      >
        <div className="mx-auto max-w-3xl">
          <CheckList
            tone="primary"
            items={[
              "Fini les cartes papier perdues, les compteurs faux, les discussions avec les clients sur leur progression",
              "Stats temps réel pour piloter ton équipe au chiffre près — qui ramène le plus de CA, qui a les meilleures notes",
              "Notifications automatiques aux clients qui n'ont pas mis les pieds depuis 2 mois — sans intervention manuelle",
              "Abonnement coupes illimitées = revenus récurrents prévisibles chaque mois",
              "Mise en service en 24h, formation comprise. Si tu sais utiliser WhatsApp, tu sais utiliser Trimya Pro",
              "Sans engagement. Tu paies au mois, tu arrêtes quand tu veux",
            ]}
          />
        </div>
      </Section>

      {/* ACTIVATION */}
      <Section
        eyebrow="Démarrer"
        title="3 étapes pour activer ton salon"
        eyebrowColor="accent"
      >
        <div className="grid gap-8 md:grid-cols-3">
          <Step
            number="1"
            title="Contacte-nous"
            description="WhatsApp, email, ou via le formulaire. On t'envoie un code d'activation unique."
          />
          <Step
            number="2"
            title="Active la tablette"
            description="Sur n'importe quelle tablette ou téléphone Android/iPhone : télécharge Trimya Pro, entre ton code, c'est fini."
          />
          <Step
            number="3"
            title="Scan ton premier client"
            description="Le compteur tourne tout seul. Les récompenses se déclenchent automatiquement. Tu t'occupes des coupes, on s'occupe du reste."
          />
        </div>
      </Section>

      <CTABand
        title="14 jours d'essai Pro gratuit"
        description="À l'activation, ton salon démarre directement en Pro pendant 14 jours. Toutes les features débloquées. Sans engagement."
        primaryCta={{ label: "Activer mon salon", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />
    </>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-black">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-bold text-text">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </div>
  );
}
