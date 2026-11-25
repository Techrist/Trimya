import { PLANS, formatPrice } from "./site-plans";

/**
 * Questions fréquentes : source unique pour la page /faq ET pour les
 * données structurées FAQPage (schema.org). Google et les assistants IA
 * exigent que le texte balisé soit identique au texte visible, donc les
 * deux sont générés à partir de cette liste.
 *
 * Chaque réponse ne contient que des faits vrais aujourd'hui. Les prix
 * viennent de `site-plans.ts`.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

const plan = (id: string) => PLANS.find((p) => p.id === id)!;

export const FAQ: FaqItem[] = [
  {
    question: "Qu'est-ce que Trimya ?",
    answer:
      "Trimya est une application de carte de fidélité digitale et un logiciel de gestion pour les salons de coiffure et les barbiers en Afrique. Le client garde sa carte de fidélité sous forme de QR code dans son téléphone, le salon la scanne avec une tablette ou un téléphone, et la coupe offerte se déclenche automatiquement. Il y a deux applications : Trimya pour les clients (gratuite) et Trimya Pro pour les salons et les chaînes de salons.",
  },
  {
    question: "Comment fonctionne la carte de fidélité d'un salon de coiffure sur Trimya ?",
    answer:
      "Le client présente son QR code, le salon le scanne en moins de 3 secondes et le compteur de coupes augmente. Par défaut, 4 coupes sont payées et la 5ᵉ est offerte. Le salon peut choisir son propre seuil, de 1 à 20 coupes. Le client reçoit une notification quand sa coupe offerte est disponible.",
  },
  {
    question: "L'application est-elle gratuite pour les clients ?",
    answer:
      "Oui. Trimya est gratuite pour les clients, sans abonnement ni achat dans l'application. Trimya ne facture jamais directement le client.",
  },
  {
    question: "Faut-il télécharger une application ?",
    answer:
      "Non. Trimya (app.trimya.app) et Trimya Pro (pro.trimya.app) fonctionnent directement dans le navigateur du téléphone ou de la tablette et peuvent être installées sur l'écran d'accueil. Des versions pour l'App Store et Google Play sont prévues mais ne sont pas encore disponibles.",
  },
  {
    question: "Comment un client crée-t-il son compte ?",
    answer:
      "Le client saisit son adresse email, reçoit un code à 6 chiffres dans sa boîte email, puis indique son prénom. Il n'y a pas de mot de passe à retenir. L'inscription prend environ 30 secondes.",
  },
  {
    question: "Combien coûte Trimya pour un salon de coiffure ?",
    answer: `Un salon individuel peut démarrer gratuitement avec le plan ${plan("free").name} (${plan("free").features[1].toLowerCase()}, ${plan("free").features[2]}). Les plans payants sont ${plan("standard").name} à ${formatPrice(plan("standard").price)} par mois et ${plan("pro").name} à ${formatPrice(plan("pro").price)} par mois. Pour les chaînes jusqu'à 5 salons : ${plan("enterprise_standard").name} à ${formatPrice(plan("enterprise_standard").price)} par mois et ${plan("enterprise").name} à ${formatPrice(plan("enterprise").price)} par mois. Sans engagement, le renouvellement n'est pas automatique.`,
  },
  {
    question: "Existe-t-il un essai gratuit pour les salons ?",
    answer:
      "Oui. À l'activation, un nouveau salon démarre directement en plan Pro pendant 14 jours, avec toutes les fonctionnalités. Sans abonnement payant à la fin de l'essai, le compte passe automatiquement sur le plan gratuit Découverte.",
  },
  {
    question: "Comment activer mon salon sur Trimya Pro ?",
    answer:
      "Contacte Trimya par WhatsApp, par email ou via le formulaire de contact. Tu reçois un code d'activation unique. Il suffit ensuite d'ouvrir pro.trimya.app sur une tablette ou un téléphone, d'entrer le code, et de scanner le premier client. L'activation est faite sous 24 heures.",
  },
  {
    question: "Comment payer l'abonnement Trimya Pro ?",
    answer:
      "Le paiement se fait en dehors de l'application, en FCFA : virement bancaire, mobile money (Orange Money, MTN Mobile Money, Wave) ou espèces auprès d'un représentant Trimya. Le plan est activé sous 24 heures ouvrées.",
  },
  {
    question: "Peut-on gérer plusieurs salons de coiffure avec Trimya ?",
    answer:
      "Oui, avec les plans Entreprise : jusqu'à 5 salons sous un même compte, un tableau de bord consolidé, une carte de fidélité partagée entre les salons de la chaîne (le client cumule ses coupes dans tous les salons) et le transfert de coiffeurs d'un salon à l'autre.",
  },
  {
    question: "Quelles fonctionnalités Trimya propose-t-il en plus de la carte de fidélité ?",
    answer:
      "Pour les clients : réservation de créneaux en ligne, file d'attente « Je suis en route », messagerie avec le salon, notation des coiffeurs, coupe à domicile et abonnement coupes illimitées selon le plan du salon. Pour les salons : fiches clients, gestion de l'équipe et statistiques par coiffeur, notifications ciblées, horaires d'ouverture et statistiques de revenus.",
  },
  {
    question: "Dans quels pays Trimya est-il disponible ?",
    answer:
      "Trimya est basé à Yaoundé, au Cameroun, et conçu pour les salons africains : tarifs en FCFA, support par WhatsApp. Contacte l'équipe pour activer ton salon depuis un autre pays.",
  },
  {
    question: "Les données des clients sont-elles protégées ?",
    answer:
      "Oui. Les échanges sont chiffrés (HTTPS), chaque salon n'accède qu'aux données de ses propres clients, et l'hébergement est en Europe. Les données ne sont ni revendues ni utilisées pour de la publicité. Le détail est dans la politique de confidentialité.",
  },
  {
    question: "Comment supprimer mon compte Trimya ?",
    answer:
      "Un client peut supprimer son compte depuis son profil dans l'application, ou en écrivant à contact@trimya.app. Les données personnelles identifiantes sont supprimées sous 30 jours.",
  },
];
