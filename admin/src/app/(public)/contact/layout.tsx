import type { Metadata } from "next";

/**
 * La page contact est un composant client ("use client"), qui ne peut pas
 * exporter de métadonnées. Ce layout de segment les porte à sa place.
 */
export const metadata: Metadata = {
  title: "Contact et démo pour salons de coiffure",
  description:
    "Contacte l'équipe Trimya pour une démo du logiciel de gestion et de la carte de fidélité pour ton salon de coiffure ou ta chaîne de salons.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
