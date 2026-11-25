import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export const metadata: Metadata = {
  title: {
    default: "Trimya | Carte de fidélité pour salons de coiffure",
    template: "%s · Trimya",
  },
  description:
    "Application de fidélité pour salons de coiffure et barbiers en Afrique : carte de fidélité digitale par QR code, coupe offerte, réservations et gestion des clients.",
  keywords: [
    "carte de fidélité coiffeur",
    "carte de fidélité digitale",
    "application salon de coiffure",
    "logiciel de gestion salon de coiffure",
    "fidélisation client coiffeur",
    "coupe offerte",
    "barbier",
    "QR code fidélité",
    "réservation coiffeur en ligne",
    "file d'attente salon de coiffure",
    "salon de coiffure Cameroun",
    "salon de coiffure Afrique",
  ],
  authors: [{ name: "Trimya" }],
  metadataBase: new URL("https://www.trimya.app"),
  // Vérification de propriété Google Search Console (balise meta
  // `google-site-verification`, rendue dans le <head> de chaque page).
  verification: {
    google: "LvJk0ARI485BTT6pDCswmGACB1rfQPIx5vyGo75OfxQ",
  },
  // Canonique relative à metadataBase : chaque page déclare son équivalent
  // sur https://www.trimya.app. Évite que les mêmes pages, servies aussi
  // sur admin.trimya.app et trimya-admin.vercel.app, soient indexées en
  // doublon.
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "Trimya | Carte de fidélité pour salons de coiffure",
    description:
      "Carte de fidélité digitale pour les salons de coiffure et barbiers africains : QR code, coupe offerte, réservations.",
    url: "https://www.trimya.app",
    siteName: "Trimya",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/logo-mark.png",
        width: 512,
        height: 512,
        alt: "Trimya",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trimya | Carte de fidélité pour salons de coiffure",
    description:
      "Carte de fidélité digitale pour les salons de coiffure et barbiers africains : QR code, coupe offerte, réservations.",
    images: ["/logo-mark.png"],
  },
};

/**
 * Layout du route group (public) — pages marketing accessibles à tous.
 * Inclut le header global + footer + structure de page.
 *
 * L'admin (sous /dashboard et /login) n'utilise PAS ce layout — il a sa
 * propre structure (sidebar + AuthGate).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
