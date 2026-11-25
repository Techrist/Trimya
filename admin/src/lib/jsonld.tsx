import { PLANS } from "./site-plans";
import type { FaqItem } from "./faq";

/**
 * Données structurées schema.org (JSON-LD) du site public.
 *
 * Elles servent à deux publics : Google (résultats enrichis) et les
 * assistants IA (ChatGPT, Gemini, Perplexity, Claude), qui s'appuient sur ces
 * faits explicites pour répondre sans deviner. N'y figure donc que ce qui
 * est vrai aujourd'hui, et tous les prix viennent de `site-plans.ts`.
 */

export const SITE_URL = "https://www.trimya.app";
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const CLIENT_APP_ID = `${SITE_URL}/#trimya`;
const PRO_APP_ID = `${SITE_URL}/#trimya-pro`;

/** Balise <script type="application/ld+json"> (le « < » est échappé). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Fil d'Ariane : la page courante est le dernier élément. */
export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Accueil", path: "/" },
      ...items,
    ].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

/** FAQPage : même contenu que la page /faq visible. */
export function faqPage(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Un « Offer » par plan tarifaire, en FCFA (code ISO XAF). */
function planOffers() {
  return PLANS.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    description: `${plan.description}. ${plan.audience}.`,
    category: plan.audience,
    price: String(plan.price),
    priceCurrency: "XAF",
    url: `${SITE_URL}/tarifs`,
  }));
}

/** Graphe de la page d'accueil : organisation, site et les deux apps. */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Trimya",
        url: SITE_URL,
        logo: `${SITE_URL}/logo-mark.png`,
        email: "contact@trimya.app",
        telephone: "+237692979345",
        description:
          "Trimya édite une application de carte de fidélité digitale et un logiciel de gestion pour les salons de coiffure et les barbiers en Afrique.",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Yaoundé",
          addressCountry: "CM",
        },
        areaServed: [
          { "@type": "Country", name: "Cameroun" },
          { "@type": "Continent", name: "Afrique" },
        ],
        knowsAbout: [
          "carte de fidélité pour salon de coiffure",
          "gestion de salon de coiffure",
          "fidélisation des clients de coiffeurs et barbiers",
          "réservation en ligne pour salon de coiffure",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "contact@trimya.app",
          telephone: "+237692979345",
          availableLanguage: ["French"],
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: "Trimya",
        inLanguage: "fr",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": CLIENT_APP_ID,
        name: "Trimya",
        alternateName: "Trimya carte de fidélité coiffeur",
        url: "https://app.trimya.app",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: ["fr", "en"],
        description:
          "Application de carte de fidélité digitale pour les clients de salons de coiffure et de barbiers : carte par QR code, coupe offerte automatique, réservation en ligne, file d'attente, messagerie avec le salon.",
        audience: {
          "@type": "Audience",
          audienceType: "Clients de salons de coiffure et de barbiers",
        },
        featureList: [
          "Carte de fidélité par QR code",
          "Coupe offerte automatique (4 coupes payées, la 5ᵉ offerte par défaut)",
          "Notification quand la coupe offerte est disponible",
          "Réservation de créneaux en ligne",
          "File d'attente « Je suis en route »",
          "Messagerie avec le salon",
          "Notation des coiffeurs",
          "Coupe à domicile",
          "Abonnement coupes illimitées selon le plan du salon",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "XAF",
          description: "Gratuit pour les clients",
        },
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": PRO_APP_ID,
        name: "Trimya Pro",
        alternateName: "Logiciel de gestion de salon de coiffure Trimya Pro",
        url: "https://pro.trimya.app",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: ["fr", "en"],
        description:
          "Logiciel de gestion pour salons de coiffure, barbiers et chaînes de salons : scan de cartes de fidélité par QR code, fiches clients, équipe, réservations, statistiques et gestion multi-salons.",
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Salons de coiffure, barbiers et chaînes de salons",
        },
        featureList: [
          "Scanner QR de cartes de fidélité",
          "Fiches clients avec historique, notes privées et clients VIP",
          "Gestion de l'équipe et statistiques par coiffeur",
          "Réservations en ligne",
          "Messagerie client et modèles de messages",
          "Notifications ciblées aux clients",
          "File d'attente « Je suis en route »",
          "Horaires d'ouverture et statistiques de revenus",
          "Abonnement coupes illimitées pour les clients",
          "Gestion multi-salons avec tableau de bord consolidé",
          "Carte de fidélité partagée entre les salons d'une chaîne",
          "Transfert de coiffeurs entre salons",
        ],
        offers: planOffers(),
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}
