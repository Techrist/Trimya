import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Hero, CTABand } from "@/components/public/primitives";
import { FAQ } from "@/lib/faq";
import { JsonLd, breadcrumbList, faqPage } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Questions fréquentes sur la carte de fidélité coiffeur",
  description:
    "Réponses aux questions sur Trimya : comment fonctionne la carte de fidélité pour salon de coiffure, tarifs, essai gratuit, activation du salon, paiement et protection des données.",
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqPage(FAQ)} />
      <JsonLd
        data={breadcrumbList([{ name: "Questions fréquentes", path: "/faq" }])}
      />

      <Hero
        eyebrow="Questions fréquentes"
        title="Tout savoir sur Trimya"
        description="La carte de fidélité pour salons de coiffure et barbiers : fonctionnement, tarifs, activation de ton salon et protection des données."
      />

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {FAQ.map((item) => (
            <details key={item.question} className="group p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-base font-bold text-text">
                <h2 className="text-base font-bold text-text">
                  {item.question}
                </h2>
                <ChevronDown
                  className="mt-1 h-5 w-5 shrink-0 text-text-muted transition-transform group-open:rotate-180"
                  strokeWidth={2}
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-text-dim">
          Autre question ?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Écris-nous
          </Link>{" "}
          ou consulte nos{" "}
          <Link href="/tarifs" className="text-primary hover:underline">
            tarifs
          </Link>
          .
        </p>
      </section>

      <CTABand
        title="Prêt à remplacer ta carte papier ?"
        description="Essai Pro gratuit de 14 jours, activation sous 24h, sans engagement."
        primaryCta={{ label: "Démarrer la démo", href: "/contact" }}
        secondaryCta={{ label: "Voir les tarifs", href: "/tarifs" }}
      />
    </>
  );
}
