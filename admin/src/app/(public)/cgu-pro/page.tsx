import type { Metadata } from "next";
import { LegalLayout } from "@/components/public/LegalLayout";

export const metadata: Metadata = {
  title: "CGU Pro",
  description:
    "Conditions Générales d'Utilisation de Trimya Pro pour les salons et les chaînes.",
};

export default function CGUProPage() {
  return (
    <LegalLayout title="CGU — Trimya Pro" updatedAt="6 juin 2026">
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (« CGU Pro »)
        régissent l&apos;usage de l&apos;application <strong>Trimya Pro</strong>,
        service professionnel de gestion de fidélité pour salons de coiffure et
        chaînes de salons, édité par Trimya, basé à Yaoundé, Cameroun.
      </p>
      <p>
        L&apos;Application Pro est strictement réservée aux établissements
        professionnels de coiffure et à leurs gérants ou propriétaires.
      </p>

      <h2>1. Objet</h2>
      <p>Trimya Pro permet à un établissement professionnel :</p>
      <ul>
        <li>
          <strong>Aux Salons</strong> : scanner les cartes de fidélité, gérer
          leur fichier client, équipe, rendez-vous, messagerie et statistiques
        </li>
        <li>
          <strong>Aux Propriétaires de chaîne</strong> : superviser plusieurs
          salons depuis un compte unique, avec dashboard consolidé, fidélité
          partagée et transferts de coiffeurs
        </li>
      </ul>

      <h2>2. Création de compte</h2>
      <h3>Compte Salon</h3>
      <p>
        Création par activation d&apos;un <strong>code unique</strong> fourni
        par Trimya après contact commercial préalable. Code à usage unique.
      </p>
      <h3>Compte Propriétaire</h3>
      <p>
        Création exclusivement par l&apos;équipe Trimya à partir d&apos;une
        demande écrite, après vérification d&apos;identité et signature des
        présentes CGU Pro.
      </p>

      <h2>3. Plans et tarifs</h2>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Cible</th>
            <th>Prix mensuel (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Découverte</td>
            <td>Salon individuel, essai gratuit limité</td>
            <td>0</td>
          </tr>
          <tr>
            <td>Standard</td>
            <td>Salon individuel, croissance</td>
            <td>10 000</td>
          </tr>
          <tr>
            <td>Pro</td>
            <td>Salon individuel, toutes features</td>
            <td>15 000</td>
          </tr>
          <tr>
            <td>Entreprise Standard</td>
            <td>Chaîne jusqu&apos;à 5 salons</td>
            <td>25 000</td>
          </tr>
          <tr>
            <td>Entreprise Pro</td>
            <td>Chaîne jusqu&apos;à 5 salons, features Pro</td>
            <td>40 000</td>
          </tr>
        </tbody>
      </table>
      <p>
        Trimya se réserve le droit de modifier les tarifs avec un préavis
        minimum de 30 jours.
      </p>

      <h2>4. Essai gratuit</h2>
      <p>
        Tout nouveau Compte Salon bénéficie automatiquement d&apos;un{" "}
        <strong>essai Pro de 14 jours</strong> à l&apos;activation. À
        l&apos;issue, en l&apos;absence de souscription payante, le compte
        bascule sur Découverte (gratuit, limité).
      </p>

      <h2>5. Paiement</h2>
      <p>
        Les paiements s&apos;effectuent <strong>en dehors de
        l&apos;Application</strong> :
      </p>
      <ul>
        <li>Virement bancaire</li>
        <li>Mobile money (Orange Money, MTN Mobile Money, Wave)</li>
        <li>Espèces auprès d&apos;un représentant Trimya</li>
      </ul>
      <p>
        Délai d&apos;activation : <strong>24 heures ouvrées maximum</strong>.
        Aucun paiement n&apos;est effectué via App Store ou Play Store.
      </p>

      <h2>6. Durée et renouvellement</h2>
      <p>
        Les plans sont souscrits pour une durée définie (1, 3, 6 ou 12 mois).
        Le renouvellement n&apos;est <strong>pas automatique</strong>.
      </p>

      <h2>7. Résiliation et rétrogradation</h2>
      <p>
        Vous pouvez résilier à tout moment par email à{" "}
        <a href="mailto:contact@trimya.com">contact@trimya.com</a>. Aucun
        remboursement n&apos;est dû pour la période restante, mais le compte
        garde l&apos;accès jusqu&apos;à l&apos;échéance prépayée.
      </p>
      <p>
        Trimya peut rétrograder un compte en cas de non-paiement à
        l&apos;échéance, violation des CGU, ou fraude.
      </p>

      <h2>8. Propriété et confidentialité des données clients</h2>
      <p>
        Les données des clients enregistrés via votre Compte Salon sont la{" "}
        <strong>propriété du Client final</strong>, le Salon en est dépositaire.
        Le Salon s&apos;engage à :
      </p>
      <ul>
        <li>Ne pas extraire, exporter, partager ou commercialiser ces données</li>
        <li>Respecter le droit à l&apos;oubli</li>
        <li>
          Ne pas utiliser ces données pour démarcher en dehors de
          l&apos;application
        </li>
      </ul>
      <p>
        Tout manquement constitue une <strong>violation grave</strong>{" "}
        entraînant résiliation immédiate sans remboursement.
      </p>

      <h2>9. Fonctionnalités spécifiques</h2>
      <h3>Transfert de coiffeurs (plans Entreprise)</h3>
      <p>
        Le propriétaire peut déplacer un coiffeur entre ses salons.
        L&apos;historique reste rattaché au salon d&apos;origine, la
        réputation suit le coiffeur.
      </p>
      <h3>Fidélité partagée (plans Entreprise)</h3>
      <p>
        Un client compte ses coupes sur toute la chaîne, avec seuil unifié.
      </p>
      <h3>Stats par coiffeur (plans Pro et Entreprise Pro)</h3>
      <p>
        Le salon s&apos;engage à ne pas utiliser ces statistiques de manière
        discriminatoire.
      </p>

      <h2>10. Niveau de service</h2>
      <p>
        Trimya s&apos;engage à fournir un service avec une disponibilité
        raisonnable mais ne souscrit pas à un SLA contractuel formel. En cas
        d&apos;incident technique majeur (&gt;24h d&apos;indisponibilité),
        Trimya peut offrir un crédit ou une extension.
      </p>

      <h2>11. Support</h2>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Support</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Découverte</td>
            <td>Email à effort raisonnable</td>
          </tr>
          <tr>
            <td>Standard</td>
            <td>Email garanti (sous 48h ouvrées)</td>
          </tr>
          <tr>
            <td>Pro / Entreprise</td>
            <td>WhatsApp prioritaire (sous 24h ouvrées)</td>
          </tr>
        </tbody>
      </table>

      <h2>12. Responsabilité</h2>
      <p>
        La responsabilité totale de Trimya, tous chefs de préjudice confondus,
        est limitée au montant des abonnements payés sur les 12 derniers mois.
      </p>

      <h2>13. Confidentialité commerciale</h2>
      <p>
        Toute information échangée lors d&apos;un démarchage commercial (tarifs
        négociés, accords spécifiques) est{" "}
        <strong>strictement confidentielle</strong>.
      </p>

      <h2>14. Droit applicable</h2>
      <p>
        Droit camerounais. Tribunaux de Yaoundé compétents. Recherche de
        solution amiable préalable.
      </p>

      <h2>15. Modifications</h2>
      <p>
        Toute modification substantielle est notifiée par email avec un
        préavis de <strong>30 jours</strong>.
      </p>

      <h2>16. Contact commercial et support</h2>
      <p>
        📧 <a href="mailto:contact@trimya.com">contact@trimya.com</a>
        <br />
        💬{" "}
        <a
          href="https://wa.me/237692979345"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp : +237 692 979 345
        </a>
        <br />
        📍 Yaoundé, Cameroun
      </p>
    </LegalLayout>
  );
}
