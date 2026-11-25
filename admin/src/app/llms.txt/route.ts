import { PLANS, formatPrice } from "@/lib/site-plans";
import { FAQ } from "@/lib/faq";

/**
 * /llms.txt : résumé de Trimya à l'intention des assistants IA (ChatGPT,
 * Gemini, Perplexity, Claude…), au format proposé par llmstxt.org.
 *
 * Généré depuis les mêmes sources que la page /tarifs et la FAQ (plans et
 * questions), pour que les prix et les faits ne divergent jamais du site.
 */
const SITE = "https://www.trimya.app";

export function GET() {
  const plans = PLANS.map(
    (p) =>
      `- ${p.name} (${p.audience}) : ${formatPrice(p.price)}${p.price === 0 ? "" : " par mois"}. ${p.description}.`,
  ).join("\n");

  const faq = FAQ.map((f) => `### ${f.question}\n${f.answer}`).join("\n\n");

  const body = `# Trimya

> Trimya est une application de carte de fidélité digitale et un logiciel de gestion pour les salons de coiffure et les barbiers en Afrique. Le client garde sa carte (QR code) dans son téléphone, le salon la scanne, et la coupe offerte se déclenche automatiquement (par défaut : 4 coupes payées, la 5ᵉ offerte).

## L'essentiel

- Éditeur : Trimya, Yaoundé, Cameroun. Contact : contact@trimya.app, WhatsApp +237 692 979 345.
- Deux applications web, sans téléchargement obligatoire : Trimya pour les clients (gratuite) sur https://app.trimya.app, et Trimya Pro pour les salons et les chaînes sur https://pro.trimya.app. Les versions App Store et Google Play ne sont pas encore disponibles.
- Les clients se connectent avec leur adresse email et un code à 6 chiffres reçu par email, sans mot de passe.
- Un salon est activé avec un code unique fourni par Trimya, avec 14 jours d'essai du plan Pro.
- Tarifs en FCFA, sans engagement, paiement hors application (virement, mobile money, espèces).

## Tarifs des salons

${plans}

## Pages du site

- [Accueil](${SITE}/) : présentation de Trimya.
- [Pour les clients](${SITE}/clients) : la carte de fidélité coiffeur gratuite, réservation, file d'attente, coupe à domicile.
- [Pour les salons](${SITE}/salons) : logiciel de gestion de salon de coiffure, fonctionnalités et activation.
- [Pour les chaînes](${SITE}/proprietaires) : gestion multi-salons, fidélité partagée, transferts de coiffeurs.
- [Tarifs](${SITE}/tarifs) : détail des 5 plans.
- [Questions fréquentes](${SITE}/faq) : réponses détaillées.
- [Contact](${SITE}/contact) : demande de démo ou d'activation.

## Légal

- [Politique de confidentialité](${SITE}/privacy)
- [Conditions d'utilisation clients](${SITE}/cgu)
- [Conditions d'utilisation Pro](${SITE}/cgu-pro)

## Questions fréquentes

${faq}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
