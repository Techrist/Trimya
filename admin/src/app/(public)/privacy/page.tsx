import type { Metadata } from "next";
import { LegalLayout } from "@/components/public/LegalLayout";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Trimya collecte, utilise et protège vos données personnelles.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="6 juin 2026">
      <p>
        La présente politique explique comment Trimya (« nous », « notre »,
        « nos ») collecte, utilise et protège vos données personnelles
        lorsque vous utilisez les applications mobiles{" "}
        <strong>Trimya</strong> (B2C, carte de fidélité) et{" "}
        <strong>Trimya Pro</strong> (B2B, kiosque salon et dashboard
        propriétaire).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        L&apos;éditeur des applications et responsable du traitement des
        données est :
      </p>
      <p>
        <strong>Trimya</strong>
        <br />
        Yaoundé, Cameroun
        <br />
        Email : <a href="mailto:contact@trimya.com">contact@trimya.com</a>
        <br />
        WhatsApp :{" "}
        <a
          href="https://wa.me/237692979345"
          target="_blank"
          rel="noopener noreferrer"
        >
          +237 692 979 345
        </a>
      </p>

      <h2>2. Données que nous collectons</h2>

      <h3>Dans l&apos;App Client (Trimya)</h3>
      <ul>
        <li>
          <strong>Numéro de téléphone</strong> (obligatoire) — pour créer votre
          compte et vous identifier auprès des salons partenaires
        </li>
        <li>
          <strong>Prénom</strong> (obligatoire) — pour personnaliser votre
          expérience
        </li>
        <li>
          <strong>Nom de famille, email, date de naissance, photo de profil</strong>{" "}
          (facultatifs)
        </li>
        <li>
          <strong>Historique de coupes</strong> — date, salon, coiffeur, statut
          (payante / offerte)
        </li>
        <li>
          <strong>Avis et notes</strong> — étoiles et commentaires laissés sur
          vos coupes
        </li>
        <li>
          <strong>Token de notification push</strong> — pour vous envoyer les
          alertes
        </li>
        <li>
          <strong>Messages</strong> — échanges avec votre salon via la
          messagerie intégrée
        </li>
      </ul>

      <h3>Dans l&apos;App Pro (Trimya Pro)</h3>
      <ul>
        <li>
          <strong>Email professionnel et mot de passe</strong> (propriétaires
          uniquement)
        </li>
        <li>
          <strong>Nom du salon, ville, téléphone, logo</strong>
        </li>
        <li>
          <strong>Plan d&apos;abonnement et historique de paiement</strong>
        </li>
        <li>
          <strong>Données opérationnelles</strong> : coiffeurs, clients
          enregistrés, statistiques
        </li>
      </ul>

      <h3>Données collectées automatiquement</h3>
      <ul>
        <li>Identifiant technique de l&apos;appareil (pour les notifications push)</li>
        <li>Logs de session anonymisés (pour la stabilité de l&apos;app)</li>
      </ul>

      <p>
        <strong>Nous ne collectons pas</strong> : votre géolocalisation
        précise, votre carnet d&apos;adresses, vos contacts, ni aucune donnée
        publicitaire.
      </p>

      <h2>3. Pourquoi nous collectons ces données</h2>
      <ul>
        <li>
          <strong>Faire fonctionner le service</strong> : identifier votre
          compte, compter vos coupes, déclencher la récompense, synchroniser
          vos visites
        </li>
        <li>
          <strong>Vous notifier</strong> : alertes de récompense disponible,
          messages reçus, rappels de rendez-vous
        </li>
        <li>
          <strong>Améliorer le service</strong> : statistiques agrégées et
          anonymisées sur l&apos;usage
        </li>
        <li>
          <strong>Respecter nos obligations légales</strong> : conservation des
          justificatifs de transaction si applicable
        </li>
      </ul>
      <p>
        Nous <strong>n&apos;utilisons jamais</strong> vos données à des fins
        publicitaires et ne les revendons à aucun tiers.
      </p>

      <h2>4. Qui a accès à vos données</h2>
      <p>Vos données sont accessibles uniquement :</p>
      <ul>
        <li>
          <strong>À vous-même</strong> dans votre espace personnel
        </li>
        <li>
          <strong>Au salon</strong> dans lequel vous êtes enregistré
          (uniquement les données vous concernant)
        </li>
        <li>
          <strong>Au propriétaire de la chaîne</strong> si votre salon
          appartient à un compte Entreprise et si la fidélité partagée est
          activée
        </li>
        <li>
          <strong>À notre équipe technique Trimya</strong> uniquement pour
          résoudre un problème, sous obligation de confidentialité
        </li>
      </ul>

      <h2>5. Sous-traitants et hébergement</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Rôle</th>
            <th>Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google Firebase</td>
            <td>Authentification, base de données, stockage, notifications</td>
            <td>Europe (Belgique — europe-west1)</td>
          </tr>
          <tr>
            <td>Expo Push</td>
            <td>Acheminement des notifications push</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hébergement du tableau d&apos;administration et du site web</td>
            <td>Europe</td>
          </tr>
        </tbody>
      </table>

      <h2>6. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Tant que votre compte est actif</strong> : vos données restent
          disponibles dans l&apos;application
        </li>
        <li>
          <strong>À la suppression de votre compte</strong> : vos données
          personnelles identifiantes sont supprimées sous 30 jours
        </li>
        <li>
          <strong>Données anonymisées</strong> : conservées indéfiniment à des
          fins statistiques
        </li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>
        Conformément à la Loi camerounaise N°2010/012 et aux principes du
        RGPD :
      </p>
      <ul>
        <li>Droit d&apos;accès, de rectification, d&apos;effacement</li>
        <li>Droit d&apos;opposition et de portabilité</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à{" "}
        <a href="mailto:contact@trimya.com">contact@trimya.com</a>. Réponse
        sous 30 jours maximum.
      </p>

      <h2>8. Sécurité</h2>
      <ul>
        <li>Authentification par SMS (App Client) ou email/mot de passe fort (App Pro)</li>
        <li>Chiffrement TLS en transit pour toutes les communications</li>
        <li>
          Règles de sécurité serveur strictes (cloisonnement total entre
          comptes)
        </li>
        <li>Sauvegardes quotidiennes automatisées</li>
      </ul>

      <h2>9. Mineurs</h2>
      <p>
        L&apos;App Client est accessible dès 13 ans. L&apos;App Pro est
        strictement réservée aux professionnels majeurs (18 ans et plus).
      </p>

      <h2>10. Modifications</h2>
      <p>
        Toute modification substantielle vous sera notifiée dans
        l&apos;application concernée avec un préavis raisonnable.
      </p>

      <h2>11. Contact</h2>
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
