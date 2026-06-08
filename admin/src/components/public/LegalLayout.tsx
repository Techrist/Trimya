import { Hero } from "./primitives";

/**
 * Layout commun aux pages légales (Privacy, CGU, CGU Pro).
 * Style sobre, typographie lisible, sections numérotées.
 */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Hero
        eyebrow="Documents légaux"
        title={title}
        description={`Dernière mise à jour : ${updatedAt}`}
      />
      <article className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8 prose-legal">
        {children}
      </article>
    </>
  );
}
