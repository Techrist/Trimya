/**
 * Plans tarifaires publics de Trimya : source unique pour la page /tarifs,
 * les données structurées schema.org, la FAQ et /llms.txt. Les prix doivent
 * rester alignés avec `lib/plans.ts` (plans réels) et les CGU Pro.
 */

export interface Plan {
  id: string;
  name: string;
  audience: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Découverte",
    audience: "Salon individuel",
    price: 0,
    description: "Pour démarrer et tester Trimya",
    features: [
      "Carte de fidélité 4/4 avec QR",
      "Jusqu'à 50 clients",
      "1 coiffeur",
      "Profil salon basique",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    audience: "Salon individuel",
    price: 10000,
    description: "Pour faire grandir ton fichier client",
    features: [
      "Clients illimités",
      "Jusqu'à 2 coiffeurs",
      "Messagerie client ↔ salon",
      "Horaires d'ouverture configurables",
      "File d'attente « Je suis en route »",
      "Notes privées + clients VIP",
      "Support par email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Salon individuel",
    price: 15000,
    description: "Toute la puissance Trimya pour un salon ambitieux",
    highlight: true,
    features: [
      "Tout Standard, plus :",
      "Réservations en ligne",
      "Abonnement coupes illimitées",
      "Coupe à domicile (avec contre-proposition)",
      "Coiffeurs illimités + stats par coiffeur",
      "Stats avancées (revenus, périodes)",
      "Templates de messages",
      "Support prioritaire WhatsApp",
    ],
  },
  {
    id: "enterprise_standard",
    name: "Entreprise Standard",
    audience: "Chaîne (jusqu'à 5 salons)",
    price: 25000,
    description: "Plusieurs salons, features essentielles",
    features: [
      "Jusqu'à 5 salons sous un même compte",
      "Tous les salons inclus passent en Standard",
      "Tableau de bord consolidé multi-salons",
      "Fidélité partagée entre salons",
      "Transferts de coiffeurs entre salons",
      "Facturation et support unifiés",
    ],
  },
  {
    id: "enterprise",
    name: "Entreprise Pro",
    audience: "Chaîne (salons illimités)",
    price: 40000,
    description: "Plusieurs salons, toute la puissance Pro",
    features: [
      "Salons illimités sous un même compte",
      "Tous les salons inclus passent en Pro",
      "Réservations + abonnements + stats avancées",
      "Coupe à domicile sur tous les salons",
      "Transferts de coiffeurs + fidélité partagée",
      "Facturation et support prioritaires",
    ],
  },
];


/** « 10 000 FCFA » (ou « Gratuit »). */
export function formatPrice(price: number): string {
  if (price === 0) return "Gratuit";
  return `${new Intl.NumberFormat("fr-FR").format(price).replace(/ | /g, " ")} FCFA`;
}
