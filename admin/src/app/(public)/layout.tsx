import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export const metadata: Metadata = {
  title: {
    default: "Trimya — La fidélité, à la vitesse d'une coupe.",
    template: "%s · Trimya",
  },
  description:
    "Trimya remplace la carte papier de fidélité par une expérience digitale fluide. Pour les clients : 4 coupes payées, la 5ᵉ offerte. Pour les salons : gestion clients, équipe, stats temps réel.",
  keywords: [
    "fidélité coiffeur",
    "carte fidélité",
    "coupe gratuite",
    "salon coiffure",
    "barbier",
    "QR code",
    "Cameroun",
    "Afrique",
    "gestion salon",
  ],
  authors: [{ name: "Trimya" }],
  metadataBase: new URL("https://trimya.com"),
  openGraph: {
    title: "Trimya — La fidélité, à la vitesse d'une coupe.",
    description:
      "Carte de fidélité numérique pour les salons de coiffure africains.",
    url: "https://trimya.com",
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
    title: "Trimya — La fidélité, à la vitesse d'une coupe.",
    description:
      "Carte de fidélité numérique pour les salons de coiffure africains.",
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
