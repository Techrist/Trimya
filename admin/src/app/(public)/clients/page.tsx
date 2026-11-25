import type { Metadata } from "next";
import {
  QrCode,
  Calendar,
  Star,
  MessageSquare,
  Footprints,
  Home,
  Bell,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  Hero,
  Section,
  FeatureCard,
  CTABand,
} from "@/components/public/primitives";
import { JsonLd, breadcrumbList } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Carte de fidélité coiffeur gratuite sur ton téléphone",
  description:
    "Ta carte de fidélité coiffeur dans ton téléphone : 4 coupes payées, la 5ᵉ offerte. Réserve ta coupe, rejoins la file d'attente ou commande un coiffeur à domicile.",
};

export default function ClientsPage() {
  return (
    <>
      <JsonLd data={breadcrumbList([{ name: "Pour les clients", path: "/clients" }])} />

      <Hero
        spotlight
        eyebrow="Pour les clients"
        title={
          <>
            Ta carte fidélité
            <br />
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              dans ton téléphone
            </span>
          </>
        }
        description="Plus de carte de fidélité papier qui se perd. Ton coiffeur ou ton barbier scanne ton QR code, le compteur monte, et au bout de quelques coupes, la suivante est offerte. Réserve ton créneau en ligne, rejoins la file d'attente ou commande une coupe à domicile. Gratuit pour toujours."
        primaryCta={{ label: "Ouvrir Trimya", href: "https://app.trimya.app" }}
        secondaryCta={{ label: "Découvrir les fonctionnalités", href: "#features" }}
      />

      {/* FEATURES PRINCIPALES */}
      <Section
        eyebrow="Ce que tu peux faire"
        title="Tout dans une seule app"
        eyebrowColor="accent"
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={QrCode}
            tone="accent"
            title="QR code personnel"
            description="Affiche ton QR en 1 tap. Ton coiffeur le scanne, ton compteur monte automatiquement. Aucune saisie, aucune triche possible."
          />
          <FeatureCard
            icon={Bell}
            tone="primary"
            title="Notifications de récompense"
            description="Dès que ta coupe gratuite est débloquée, tu reçois une notif. Plus jamais d'oubli."
          />
          <FeatureCard
            icon={Calendar}
            tone="accent"
            title="Réservations en ligne"
            description="Réserve ton créneau quand ton salon le propose. Coupe, barbe, coloration — choisis ton service en 3 taps."
          />
          <FeatureCard
            icon={Star}
            tone="accent"
            title="Note tes coiffeurs"
            description="Après chaque coupe, donne 1 à 5 étoiles et un commentaire. Aide la communauté à choisir les meilleurs."
          />
          <FeatureCard
            icon={MessageSquare}
            tone="primary"
            title="Messagerie directe"
            description="Discute avec ton salon : confirme un horaire, signale un retard, demande un produit."
          />
          <FeatureCard
            icon={Footprints}
            tone="success"
            title="« Je suis en route »"
            description="Signale ton arrivée prochaine, ton salon prépare ton poste. Plus de file d'attente."
          />
          <FeatureCard
            icon={Home}
            tone="primary"
            title="Coupe à domicile"
            description="Commande ton coiffeur préféré pour qu'il vienne chez toi. Idéal pour les jours chargés."
          />
          <FeatureCard
            icon={InfinityIcon}
            tone="accent"
            title="Abonnement illimité"
            description="Quand ton salon le propose, paie une fois par mois pour des coupes illimitées."
          />
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section
        eyebrow="En pratique"
        title="Trois étapes, une seule fois"
        description="L'inscription est instantanée, l'usage est immédiat."
      >
        <div className="grid gap-8 md:grid-cols-3">
          <Step
            number="1"
            title="Ouvre Trimya sur ton téléphone"
            description="App gratuite, utilisable depuis ton navigateur et installable sur ton écran d'accueil. Bientôt sur App Store et Google Play. Pas d'abonnement, pas d'achat in-app."
          />
          <Step
            number="2"
            title="Connecte-toi avec ton email"
            description="Ton adresse email, un code à 6 chiffres reçu dans ta boîte, ton prénom. 30 secondes."
          />
          <Step
            number="3"
            title="Présente ton QR au salon"
            description="À chaque coupe. Le compteur monte tout seul. À la récompense, ta coupe est offerte."
          />
        </div>
      </Section>

      {/* PRIVACY REASSURANCE */}
      <Section
        eyebrow="Confiance"
        title="Tes données restent privées"
        eyebrowColor="accent"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base text-text-muted">
            On collecte ton adresse email et ton prénom : c&apos;est tout ce
            qu&apos;il nous faut pour t&apos;identifier auprès du salon.
            Aucune publicité, aucune revente, aucun tracking. Tes échanges
            sont chiffrés et tes données hébergées en Europe.
          </p>
          <p className="mt-4 text-sm text-text-dim">
            <a href="/privacy" className="text-primary hover:underline">
              Lire notre politique de confidentialité
            </a>
          </p>
        </div>
      </Section>

      <CTABand
        title="Demande à ton coiffeur si Trimya est là."
        description="Sinon, parle-lui-en — il pourra activer son salon en 24h."
        primaryCta={{ label: "Ouvrir Trimya", href: "https://app.trimya.app" }}
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
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-2xl font-bold text-black">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-bold text-text">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </div>
  );
}
