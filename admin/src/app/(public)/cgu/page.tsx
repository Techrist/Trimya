import type { Metadata } from "next";
import { LegalLayout } from "@/components/public/LegalLayout";

export const metadata: Metadata = {
  title: "CGU Client",
  description: "Conditions Générales d'Utilisation de l'application Trimya.",
};

export default function CGUPage() {
  return (
    <LegalLayout title="CGU — Trimya (Client)" updatedAt="6 juin 2026">
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (« CGU »)
        régissent l&apos;usage de l&apos;application mobile{" "}
        <strong>Trimya</strong>, service grand public de carte de fidélité
        numérique pour salons de coiffure, éditée par Trimya, basé à Yaoundé,
        Cameroun.
      </p>
      <p>
        En téléchargeant, installant ou utilisant l&apos;Application, vous (le
        « Client ») acceptez ces CGU sans réserve.
      </p>

      <h2>1. Objet</h2>
      <p>Trimya est un service <strong>gratuit</strong> permettant :</p>
      <ul>
        <li>Cumuler des coupes pour obtenir une coupe offerte</li>
        <li>Présenter une carte de fidélité numérique sous forme de QR code</li>
        <li>Noter votre coiffeur après chaque coupe</li>
        <li>Prendre rendez-vous en ligne</li>
        <li>Communiquer avec le salon via la messagerie intégrée</li>
        <li>Commander un coiffeur à domicile</li>
      </ul>

      <h2>2. Création de compte</h2>
      <p>
        L&apos;inscription se fait via numéro de téléphone vérifié par SMS.
        <strong> Un numéro = un compte.</strong> Vous garantissez :
      </p>
      <ul>
        <li>L&apos;exactitude de votre prénom et de votre numéro</li>
        <li>N&apos;utiliser qu&apos;un seul compte personnel</li>
        <li>Ne pas créer de compte avec un numéro qui ne vous appartient pas</li>
      </ul>

      <h2>3. Gratuité</h2>
      <p>
        L&apos;usage de Trimya est <strong>entièrement gratuit</strong> pour le
        Client. Aucun frais ne pourra jamais vous être facturé directement par
        Trimya.
      </p>

      <h2>4. Système de fidélité</h2>
      <p>
        À chaque coupe enregistrée par le salon, votre compteur augmente. Au
        seuil défini par le salon (par défaut 4, configurable de 1 à 20), votre
        prochaine coupe est offerte.
      </p>
      <ul>
        <li>
          Une coupe offerte n&apos;a aucune valeur marchande et ne peut être
          convertie en argent
        </li>
        <li>
          Les coupes cumulées dans un salon ne sont valables que dans ce salon,
          sauf activation de la fidélité partagée par un propriétaire de chaîne
        </li>
        <li>
          En cas de litige, les enregistrements numériques de
          l&apos;Application font foi
        </li>
      </ul>

      <h2>5. Avis et notation</h2>
      <p>
        Vous pouvez attribuer une note de 1 à 5 étoiles + commentaire (280
        caractères max) au coiffeur.
      </p>
      <ul>
        <li>Modifiable pendant 24 heures, puis immuable</li>
        <li>Visible par le salon, le propriétaire et les autres clients</li>
        <li>
          Les contenus injurieux, racistes ou diffamatoires seront supprimés
        </li>
      </ul>

      <h2>6. Réservations</h2>
      <p>
        Trimya <strong>n&apos;est pas partie</strong> au contrat de prestation
        entre vous et le salon. En cas de litige sur la prestation, adressez-vous
        directement au salon.
      </p>

      <h2>7. Coupe à domicile</h2>
      <p>
        Le service à domicile permet de commander un coiffeur spécifique pour
        qu&apos;il vienne chez vous. Le paiement se fait directement avec le
        coiffeur sur place. Trimya ne perçoit aucune commission sur ces
        prestations.
      </p>

      <h2>8. Utilisation acceptable</h2>
      <p>Sont notamment interdits :</p>
      <ul>
        <li>Créer plusieurs comptes avec des numéros fictifs</li>
        <li>Tenter de falsifier le compteur de coupes</li>
        <li>Décompiler ou contourner la sécurité de l&apos;application</li>
        <li>Utiliser l&apos;application à des fins commerciales non autorisées</li>
      </ul>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est détaillé dans notre{" "}
        <a href="/privacy">Politique de confidentialité</a>.
      </p>

      <h2>10. Responsabilité</h2>
      <p>Trimya ne saurait être tenu responsable :</p>
      <ul>
        <li>Des interruptions techniques ou pannes externes (Firebase, Expo)</li>
        <li>De la qualité des prestations fournies par les salons partenaires</li>
        <li>Des litiges entre vous et un salon concernant les services rendus</li>
      </ul>

      <h2>11. Suspension et résiliation</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis
        l&apos;application ou par email à{" "}
        <a href="mailto:contact@trimya.com">contact@trimya.com</a>.
      </p>
      <p>
        Trimya peut suspendre un compte en cas de violation des CGU,
        d&apos;inactivité de plus de 24 mois ou sur réquisition d&apos;une
        autorité compétente.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Droit camerounais. Tribunaux de Yaoundé compétents. Recherche de
        solution amiable préalable à toute action judiciaire.
      </p>

      <h2>13. Modifications</h2>
      <p>
        Toute modification substantielle vous sera notifiée dans
        l&apos;application avec un préavis raisonnable.
      </p>

      <h2>14. Contact</h2>
      <p>
        📧 <a href="mailto:contact@trimya.com">contact@trimya.com</a>
        <br />
        💬{" "}
        <a
          href="https://wa.me/237692979345"
          target="_blank"
          rel="noopener noreferrer"
        >
          +237 692 979 345
        </a>
      </p>
    </LegalLayout>
  );
}
