import type { Metadata } from "next";
import { LegalLayout } from "@/components/public/LegalLayout";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Trimya collecte, utilise et protège vos données personnelles.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="25 novembre 2026">
      <p>
        La présente politique explique comment Trimya (« nous », « notre »,
        « nos ») collecte, utilise et protège vos données personnelles
        lorsque vous utilisez les applications web{" "}
        <strong>Trimya</strong> (B2C, carte de fidélité, accessible sur
        app.trimya.app) et <strong>Trimya Pro</strong> (B2B, kiosque salon et
        tableau de bord propriétaire, accessible sur pro.trimya.app), ainsi
        que le site <strong>www.trimya.app</strong>.
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
        Email : <a href="mailto:contact@trimya.app">contact@trimya.app</a>
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
          <strong>Adresse email</strong> (obligatoire) : pour créer votre
          compte, vous connecter avec un code à usage unique et vous
          identifier auprès des salons partenaires
        </li>
        <li>
          <strong>Prénom</strong> (obligatoire) : pour personnaliser votre
          expérience
        </li>
        <li>
          <strong>Nom de famille, date de naissance, photo de profil</strong>{" "}
          (facultatifs)
        </li>
        <li>
          <strong>Numéro de téléphone</strong> : uniquement pour les comptes
          créés à l&apos;époque où l&apos;inscription se faisait par SMS. Il
          n&apos;est plus demandé aux nouveaux comptes.
        </li>
        <li>
          <strong>Historique de coupes</strong> : date, salon, coiffeur, statut
          (payante ou offerte)
        </li>
        <li>
          <strong>Avis et notes</strong> : étoiles et commentaires laissés sur
          vos coupes
        </li>
        <li>
          <strong>Jeton de notification push</strong> : pour vous envoyer les
          alertes, si vous les autorisez
        </li>
        <li>
          <strong>Messages</strong> : échanges avec votre salon via la
          messagerie intégrée
        </li>
      </ul>

      <h3>Dans l&apos;App Pro (Trimya Pro)</h3>
      <ul>
        <li>
          <strong>Email professionnel</strong> (propriétaires) : pour la
          connexion par code à usage unique. Un mot de passe peut aussi être
          associé au compte.
        </li>
        <li>
          <strong>Identifiant technique du kiosque</strong> (salons) : un
          identifiant anonyme créé lors de l&apos;activation par code unique,
          sans nom ni email
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

      <h3>Sur le site www.trimya.app (formulaire de contact)</h3>
      <ul>
        <li>
          <strong>Nom, numéro de téléphone, message</strong> (obligatoires) et{" "}
          <strong>email</strong> (facultatif) que vous saisissez pour nous
          contacter
        </li>
        <li>
          Une <strong>empreinte irréversible</strong> (hash) de votre adresse
          IP, utilisée uniquement pour limiter le spam. Votre adresse IP
          elle-même n&apos;est pas enregistrée.
        </li>
      </ul>

      <h3>Données collectées automatiquement</h3>
      <ul>
        <li>Identifiant technique de l&apos;appareil (pour les notifications push)</li>
        <li>
          Code de connexion à usage unique : conservé uniquement sous forme
          d&apos;empreinte non réversible, valable 5 minutes et supprimé dès
          qu&apos;il est utilisé
        </li>
        <li>
          Stockage local du navigateur : votre session de connexion et vos
          préférences, sans cookie publicitaire ni traceur
        </li>
        <li>
          Journaux techniques (dont l&apos;adresse IP) traités par nos
          hébergeurs pour la sécurité et la stabilité du service
        </li>
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
          compte, vous envoyer votre code de connexion par email, compter vos
          coupes, déclencher la récompense, synchroniser vos visites
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

      <h2>4. Base légale et consentement</h2>
      <ul>
        <li>
          <strong>Exécution du service</strong> : créer et gérer votre compte,
          vous envoyer votre code de connexion, compter vos visites. Ces
          traitements sont nécessaires pour vous fournir Trimya.
        </li>
        <li>
          <strong>Votre consentement</strong> : acceptation des conditions
          d&apos;utilisation et de cette politique à la création du compte
          (case à cocher, date et version enregistrées), notifications push
          (le navigateur ou le téléphone vous demande l&apos;autorisation
          seulement quand vous choisissez de les activer), données facultatives
          (nom, date de naissance, photo) et formulaire de contact (case à
          cocher, date et version enregistrées).
        </li>
        <li>
          <strong>Intérêt légitime</strong> : sécurité du service et lutte
          contre les abus et le spam.
        </li>
      </ul>
      <p>
        <strong>Retirer votre consentement</strong> : à tout moment, sans
        justification. Les notifications se désactivent depuis votre profil ou
        les réglages de votre navigateur ; pour le reste, écrivez à{" "}
        <a href="mailto:contact@trimya.app">contact@trimya.app</a> ou
        supprimez votre compte depuis l&apos;application. Le retrait n&apos;affecte
        pas la légalité des traitements passés.
      </p>
      <p>
        <strong>Cookies</strong> : Trimya n&apos;utilise aucun cookie
        publicitaire, ni outil de mesure d&apos;audience ou traceur tiers. Aucun
        bandeau de consentement aux cookies n&apos;est donc nécessaire.
      </p>

      <h2>5. Qui a accès à vos données</h2>
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

      <h2>6. Sous-traitants et hébergement</h2>
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
            <td>
              Authentification, base de données, stockage, hébergement des
              applications web, notifications push web
            </td>
            <td>Europe (Belgique, europe-west1)</td>
          </tr>
          <tr>
            <td>Expo Push</td>
            <td>Acheminement des notifications push des applications mobiles</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>
              Hébergement du site web, du tableau d&apos;administration et des
              services serveur (envoi des codes de connexion, activation des
              salons)
            </td>
            <td>Europe</td>
          </tr>
          <tr>
            <td>Brevo</td>
            <td>
              Envoi des emails de code de connexion (votre adresse email est
              transmise pour l&apos;envoi)
            </td>
            <td>Union européenne</td>
          </tr>
          <tr>
            <td>Cloudflare</td>
            <td>
              Gestion du nom de domaine trimya.app et réception des emails
              adressés à contact@trimya.app
            </td>
            <td>Réseau mondial</td>
          </tr>
        </tbody>
      </table>

      <h2>7. Durée de conservation</h2>
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

      <h2>8. Vos droits</h2>
      <p>
        Conformément à la Loi camerounaise N°2010/012 et aux principes du
        RGPD :
      </p>
      <ul>
        <li>Droit d&apos;accès, de rectification, d&apos;effacement</li>
        <li>Droit d&apos;opposition et de portabilité</li>
        <li>Droit de retirer votre consentement à tout moment</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à{" "}
        <a href="mailto:contact@trimya.app">contact@trimya.app</a>. Réponse
        sous 30 jours maximum.
      </p>

      <h2>9. Sécurité</h2>
      <ul>
        <li>
          Connexion par code à usage unique envoyé par email, valable 5
          minutes, avec un nombre d&apos;essais limité (App Client et
          propriétaires de l&apos;App Pro) ; code d&apos;activation unique pour
          les kiosques salon
        </li>
        <li>Chiffrement TLS en transit pour toutes les communications</li>
        <li>
          Règles de sécurité serveur strictes (cloisonnement total entre
          comptes)
        </li>
        <li>Sauvegardes quotidiennes automatisées</li>
      </ul>

      <h2>10. Mineurs</h2>
      <p>
        L&apos;App Client est accessible dès 13 ans. L&apos;App Pro est
        strictement réservée aux professionnels majeurs (18 ans et plus).
      </p>

      <h2>11. Modifications</h2>
      <p>
        Toute modification substantielle vous sera notifiée dans
        l&apos;application concernée avec un préavis raisonnable.
      </p>

      <h2>12. Contact</h2>
      <p>
        📧 <a href="mailto:contact@trimya.app">contact@trimya.app</a>
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
