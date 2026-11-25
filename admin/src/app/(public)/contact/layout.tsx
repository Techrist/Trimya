import type { Metadata } from "next";
import { JsonLd, breadcrumbList } from "@/lib/jsonld";

/**
 * La page contact est un composant client ("use client"), qui ne peut pas
 * exporter de métadonnées ni rendre de données structurées. Ce layout de
 * segment (composant serveur) les porte à sa place.
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
  return (
    <>
      <JsonLd data={breadcrumbList([{ name: "Contact", path: "/contact" }])} />
      {children}
    </>
  );
}
