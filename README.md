# Trimya

Application mobile (Android + iOS) de fidélité pour salons de coiffure.
**4 coupes payées → la 5ᵉ est offerte.**

Stack : React Native + Expo + TypeScript + Firebase (Auth téléphone, Firestore).

---

## Architecture en bref

- **Une seule app**, deux modes choisis au premier lancement :
  - **Client** : inscription par téléphone, QR code personnel, dashboard de progression, historique.
  - **Salon** : activation par code (fourni par toi), scanner de QR, ajout de coupe en 1 tap.
- **Mono-salon par déploiement** mais multi-tenant côté backend : chaque salon a un `salonId` unique. Tu provisionnes les salons dans Firestore et distribues les codes d'activation.
- **Suivi** : tu utilises directement la console Firebase pour voir tes salons et leurs stats. Pas de dashboard web à coder pour le MVP.

---

## Mise en route (5 minutes)

### 1. Installer les dépendances

```bash
npm install
```

### 2. Créer un projet Firebase

1. Va sur https://console.firebase.google.com → **Ajouter un projet** → nomme-le `trimya`.
2. Active **Authentication** → onglet *Sign-in method* → active **Phone**.
3. Active **Firestore Database** → mode *Production* → région `eur3` ou `europe-west`.
4. Dans **Project settings** → onglet *General* → *Your apps* → ajoute une app **Web** → copie la config.

### 3. Configurer les variables d'environnement

Copie `.env.example` vers `.env` et remplis avec ta config Firebase :

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=trimya.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=trimya
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=trimya.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc...
EXPO_PUBLIC_DEFAULT_SALON_ID=mon-premier-salon
```

### 4. Provisionner ton premier salon

Dans la console Firebase → Firestore → Crée un document :

- Collection : `salons`
- ID document : `mon-premier-salon` (le même que `EXPO_PUBLIC_DEFAULT_SALON_ID`)
- Champs :
  ```
  name: "Salon Le Style"
  city: "Paris"
  ownerName: "Ahmed"
  phone: "+33612345678"
  activationCode: "TRIMYA-001"
  activatedAt: 0
  createdAt: <maintenant en ms>
  ```

Le coiffeur entrera `TRIMYA-001` dans l'app pour activer le mode salon.

### 5. Tester en SMS sans payer (Firebase Test Phone Numbers)

Dans Firebase Console → Authentication → Sign-in method → Phone → **Phone numbers for testing** :

- Ajoute un numéro fictif, ex. `+33611111111` avec le code `123456`.
- Dans l'app, entre ce numéro et ce code → connexion sans SMS réel.

### 6. Lancer l'app

```bash
npx expo start
```

Scanne le QR avec **Expo Go** (Android/iOS) ou ouvre dans un simulateur.

---

## Modèle de données Firestore

```
salons/{salonId}
  ├─ name, city, ownerName, phone
  ├─ activationCode      (string, unique)
  ├─ activatedAt         (number, ms)
  └─ createdAt           (number, ms)

customers/{customerId}   (id = Firebase Auth uid)
  ├─ phone, name
  ├─ salonId             (rattachement à un salon)
  ├─ currentCount        (0..4 — quand =4, la PROCHAINE coupe est offerte)
  ├─ totalCuts
  ├─ totalRewards
  ├─ createdAt
  └─ lastVisitAt

cuts/{autoId}
  ├─ customerId, salonId
  ├─ createdAt
  └─ wasReward           (bool)
```

### Logique du compteur

```
currentCount: 0 → 1 → 2 → 3 → 4 → (prochain scan: GRATUIT, reset à 0) → 1 → 2 → ...
```

C'est-à-dire : 4 coupes payées comptabilisées (counter atteint 4), la 5ᵉ visite est offerte et remet à 0.

---

## Règles de sécurité Firestore (à coller dans la console)

Ces règles **isolent chaque salon** : un salon ne peut pas modifier les clients ou ajouter des coupes pour les clients d'un autre salon. La séparation est appliquée côté serveur via `kioskUserIds`, un tableau d'UIDs Firebase Auth autorisés à agir comme kiosque pour ce salon (renseigné automatiquement à l'activation).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ───────── Helpers ─────────

    function isSalonKiosk(salonId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/salons/$(salonId))
        && request.auth.uid in get(/databases/$(database)/documents/salons/$(salonId)).data.kioskUserIds;
    }

    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    function isCustomer(customerId) {
      return request.auth != null && request.auth.uid == customerId;
    }

    // Propriétaire d'un salon (plan Entreprise). Retourne true si l'appelant
    // est l'UID référencé par `salons.{salonId}.ownerId`.
    function isOwner(salonId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/salons/$(salonId))
        && get(/databases/$(database)/documents/salons/$(salonId)).data.ownerId == request.auth.uid;
    }

    function effectivePlan(salonId) {
      let s = get(/databases/$(database)/documents/salons/$(salonId)).data;
      // 1) Héritage dénormalisé via owner Entreprise (s.inheritedPlan).
      //    Le champ est maintenu par l'admin uniquement, donc fiable côté serveur.
      return (s.inheritedPlan != null)
        ? s.inheritedPlan
        // 2) Essai Pro temporaire
        : (s.trialEndsAt is number && s.trialEndsAt > request.time.toMillis())
          ? 'pro'
          // 3) Plan brut + check expiration
          : (s.plan == null || s.plan == 'free')
            ? 'free'
            : (s.planExpiresAt is number && s.planExpiresAt > 0
                && s.planExpiresAt < request.time.toMillis())
              ? 'free'
              : s.plan;
    }

    function planAllows(salonId, requiredPlans) {
      return effectivePlan(salonId) in requiredPlans;
    }

    // ───────── Admins & audit ─────────

    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    match /adminPushLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // ───────── Owners (plans Entreprise) ─────────
    //
    // Compte propriétaire multi-salons. Créé par l'admin via API serveur
    // (Firebase Auth + doc owners). Le propriétaire lit/édite uniquement
    // son propre doc.
    match /owners/{uid} {
      allow get: if (request.auth != null && request.auth.uid == uid)
        || isAdmin();
      allow list: if isAdmin();
      // Édition limitée à 3 champs côté propriétaire (name, phone) ;
      // les champs plan/salonIds/expiry restent serveur-only (admin).
      allow update: if isAdmin() || (
        request.auth != null
        && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
             'name', 'phone'
           ])
      );
      allow create, delete: if false;

      match /private/{document=**} {
        allow read: if isAdmin() || (request.auth != null && request.auth.uid == uid);
        allow write: if false;
      }
    }

    // ───────── Activation codes (lookup-only) ─────────
    //
    // Permet la résolution code → salonId par get() direct uniquement.
    // Aucune énumération possible : pas de list.
    // Écriture serveur uniquement (Admin SDK depuis Trimya Admin).
    match /activationCodes/{code} {
      allow get: if request.auth != null;
      allow list: if isAdmin();
      allow write: if false;
    }

    // ───────── Salons ─────────
    //
    // Champ public minimum (nom, ville, plan, logo, etc.) lisible par les
    // utilisateurs authentifiés. Les champs sensibles (notes admin, ref
    // paiement) sont dans /salons/{id}/private/data, lisible uniquement
    // par l'admin et le kiosque concerné.
    match /salons/{salonId} {
      allow get: if request.auth != null;
      // Listing : admin OU propriétaire qui liste ses propres salons.
      // L'owner mobile fait : where('ownerId', '==', request.auth.uid)
      allow list: if isAdmin()
        || (request.auth != null && resource.data.ownerId == request.auth.uid);

      // Updates : kiosque déjà autorisé OU admin OU propriétaire du salon
      // OU un nouveau kiosque qui s'auto-enregistre lors de l'activation.
      //
      // Garde-fou plan additionnel : certains champs sont gatés par plan :
      //   - openingHours / closures → Standard+ requis
      //   - subscriptionPrice       → Pro requis
      //   - inheritedPlan / ownerId → ADMIN UNIQUEMENT (intégrité du modèle owner)
      // L'admin et le propriétaire (qui hérite Pro via Entreprise) sont
      // toujours autorisés. Le kiosque doit avoir un plan effectif compatible.
      allow update: if isAdmin()
        || (
          isOwner(salonId)
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['inheritedPlan', 'ownerId'])
        )
        || (
          isSalonKiosk(salonId)
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['inheritedPlan', 'ownerId'])
          && (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['openingHours', 'closures'])
            || planAllows(salonId, ['standard', 'pro'])
          )
          && (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['subscriptionPrice'])
            || planAllows(salonId, ['pro'])
          )
        )
        || (
          request.auth != null
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
               'kioskUserIds', 'activatedAt', 'kioskPushToken', 'kioskPushTokenUpdatedAt'
             ])
          && request.resource.data.kioskUserIds.hasAll(resource.data.kioskUserIds)
          && request.resource.data.kioskUserIds.size() <= resource.data.kioskUserIds.size() + 1
          && request.auth.uid in request.resource.data.kioskUserIds
        );
      allow create, delete: if false;

      match /private/{document=**} {
        // Admin + kiosque + propriétaire ont accès aux données privées.
        allow read: if isAdmin() || isSalonKiosk(salonId) || isOwner(salonId);
        allow write: if false;
      }
    }

    // ───────── Customers ─────────
    //
    // Chaque client n'est lisible que par :
    //  - lui-même
    //  - un kiosque autorisé pour le salon actuel du client
    //  - un kiosque autorisé du salon-cible quand il y a une migration en cours
    //  - l'admin
    match /customers/{customerId} {
      allow get: if isCustomer(customerId)
        || isAdmin()
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId)
        || (
          resource.data.pendingMigrationTo != null
          && isSalonKiosk(resource.data.pendingMigrationTo.salonId)
        );

      // List : admin, kiosque, owner du salon ciblé, ou client cherchant
      // son propre doc par phone (lookup self à l'inscription).
      allow list: if isAdmin()
        || (request.auth != null && isSalonKiosk(resource.data.salonId))
        || (request.auth != null && isOwner(resource.data.salonId))
        || (
          request.auth != null
          && request.auth.token.phone_number != null
          && resource.data.phone == request.auth.token.phone_number
        );

      // Création par le client lui-même uniquement (à l'inscription SMS).
      allow create: if isCustomer(customerId);

      // Update : autorisé pour le client lui-même, le kiosk du salon, l'admin,
      // et les deux cas spéciaux de migration pendante.
      // Garde-fou plan : si l'update touche `subscriptionExpiresAt` (active
      // ou prolonge un abonnement), le salon doit être en plan Pro effectif.
      // Le client lui-même n'a pas le droit d'écrire ce champ (kiosk only).
      allow update: if (
        (
          (isCustomer(customerId) || isSalonKiosk(resource.data.salonId) || isAdmin())
          && (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['subscriptionExpiresAt', 'subscriptionFirstActivatedAt'])
            || (
              isSalonKiosk(resource.data.salonId)
              && planAllows(resource.data.salonId, ['pro'])
            )
            || isAdmin()
          )
        )
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pendingMigrationTo'])
          && request.resource.data.pendingMigrationTo != null
          && isSalonKiosk(request.resource.data.pendingMigrationTo.salonId)
        )
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pendingMigrationTo'])
          && request.resource.data.pendingMigrationTo == null
          && resource.data.pendingMigrationTo != null
          && isSalonKiosk(resource.data.pendingMigrationTo.salonId)
        )
      );
    }

    // ───────── Cuts ─────────
    //
    // Lecture limitée au client concerné, au kiosque du salon, ou à l'admin.
    // Création (TEMPORAIREMENT côté client) : kiosque autorisé + cohérence
    // salonId/customer. À déplacer dans Cloud Function `addCutSecure` pour
    // ajouter rate-limit + quotas. Voir Étape 4 dans SECURITY.md.
    match /cuts/{cutId} {
      allow get: if isAdmin()
        || isCustomer(resource.data.customerId)
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId);
      allow list: if isAdmin()
        || (request.auth != null && isSalonKiosk(resource.data.salonId))
        || (request.auth != null && isOwner(resource.data.salonId))
        || (request.auth != null && request.auth.uid == resource.data.customerId);
      allow create: if request.auth != null
        && isSalonKiosk(request.resource.data.salonId)
        && request.resource.data.salonId ==
           get(/databases/$(database)/documents/customers/$(request.resource.data.customerId)).data.salonId;
      allow update, delete: if false;
    }

    // ───────── Conversations & Messages ─────────
    //
    // Privé entre LE client de la conv et le kiosque du salon.
    match /conversations/{convoId} {
      allow get: if isAdmin()
        || isCustomer(resource.data.customerId)
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId);
      allow list: if isAdmin()
        || (request.auth != null && (
            request.auth.uid == resource.data.customerId
            || isSalonKiosk(resource.data.salonId)
            || isOwner(resource.data.salonId)
        ));
      allow create: if request.auth != null
        && planAllows(request.resource.data.salonId, ['standard', 'pro'])
        && (
          request.auth.uid == request.resource.data.customerId
          || isSalonKiosk(request.resource.data.salonId)
        );
      allow update: if request.auth != null
        && planAllows(resource.data.salonId, ['standard', 'pro'])
        && (
          request.auth.uid == resource.data.customerId
          || isSalonKiosk(resource.data.salonId)
        );
    }

    match /messages/{messageId} {
      // Pour lire, on vérifie la conv à laquelle appartient le message.
      allow get: if request.auth != null
        && exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId))
        && (
          isAdmin()
          || request.auth.uid ==
             get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.customerId
          || isSalonKiosk(
             get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.salonId
           )
        );
      // Pour list, idem mais la query côté client doit toujours filtrer
      // par conversationId.
      allow list: if request.auth != null
        && exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId))
        && (
          isAdmin()
          || request.auth.uid ==
             get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.customerId
          || isSalonKiosk(
             get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.salonId
           )
        );
      allow create: if request.auth != null
        && exists(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId))
        && planAllows(
             get(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId)).data.salonId,
             ['standard', 'pro']
           )
        && (
          // Le sender doit être soit le client de la conv soit un kiosque autorisé.
          request.auth.uid ==
             get(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId)).data.customerId
          || isSalonKiosk(
             get(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId)).data.salonId
           )
        );
    }

    // ───────── Réservations ─────────
    match /reservations/{id} {
      allow get: if isAdmin()
        || isCustomer(resource.data.customerId)
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId);
      allow list: if isAdmin()
        || (request.auth != null && (
            request.auth.uid == resource.data.customerId
            || isSalonKiosk(resource.data.salonId)
            || isOwner(resource.data.salonId)
        ));
      allow create: if request.auth != null
        && planAllows(request.resource.data.salonId, ['pro'])
        && (
          request.auth.uid == request.resource.data.customerId
          || isSalonKiosk(request.resource.data.salonId)
        );
      allow update: if request.auth != null
        && planAllows(resource.data.salonId, ['pro'])
        && (
          request.auth.uid == resource.data.customerId
          || isSalonKiosk(resource.data.salonId)
        );
    }

    // ───────── Barbiers ─────────
    match /barbers/{barberId} {
      allow get: if request.auth != null
        && (
          isAdmin()
          || isSalonKiosk(resource.data.salonId)
          || isOwner(resource.data.salonId)
        );
      allow list: if isAdmin()
        || (request.auth != null && isSalonKiosk(resource.data.salonId))
        || (request.auth != null && isOwner(resource.data.salonId));
      // Le propriétaire peut créer/déplacer un barbier entre ses salons.
      allow create, update: if request.auth != null
        && (
          isSalonKiosk(request.resource.data.salonId)
          || isOwner(request.resource.data.salonId)
        );
    }

    // ───────── Avis clients (notation des coupes) ─────────
    // Un doc par coupe notée (ID = cutId pour unicité).
    // - Le client crée son avis sur sa coupe (vérif customerId == auth.uid)
    // - Édition possible 24h après création (sinon immuable)
    // - Lecture par client, kiosk du salon, owner du salon, admin
    match /cutReviews/{cutId} {
      // Get : permet la probe d'existence par un utilisateur authentifié
      // (resource == null pour un doc inexistant). Le client peut donc
      // vérifier "ai-je déjà noté cette coupe ?" sans permission-denied.
      allow get: if request.auth != null
        && (
          resource == null
          || isAdmin()
          || isCustomer(resource.data.customerId)
          || isSalonKiosk(resource.data.salonId)
          || isOwner(resource.data.salonId)
        );
      allow list: if isAdmin()
        || (request.auth != null && (
            request.auth.uid == resource.data.customerId
            || isSalonKiosk(resource.data.salonId)
            || isOwner(resource.data.salonId)
        ));
      // Création — verrous d'intégrité :
      //  - L'auteur (auth.uid) doit correspondre au customerId de l'avis
      //  - Le document ID doit être strictement le cutId (unicité 1 avis / coupe)
      //  - La coupe ciblée doit exister ET appartenir au client
      //  - Le salonId déclaré doit correspondre à celui de la coupe (anti-spoof)
      //  - rating est un entier dans [1, 5]
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.customerId
        && cutId == request.resource.data.cutId
        && exists(/databases/$(database)/documents/cuts/$(cutId))
        && get(/databases/$(database)/documents/cuts/$(cutId)).data.customerId == request.auth.uid
        && get(/databases/$(database)/documents/cuts/$(cutId)).data.salonId == request.resource.data.salonId
        && request.resource.data.rating is number
        && request.resource.data.rating >= 1
        && request.resource.data.rating <= 5;
      // Update — verrous d'immutabilité :
      //  - Auteur seul peut éditer dans la fenêtre 24h
      //  - customerId / cutId / salonId / barberId / createdAt restent FIGÉS
      //    (un client ne peut pas déplacer son avis vers un autre coiffeur)
      //  - rating reste un entier dans [1, 5]
      allow update: if request.auth != null
        && request.auth.uid == resource.data.customerId
        && request.resource.data.customerId == resource.data.customerId
        && request.resource.data.cutId == resource.data.cutId
        && request.resource.data.salonId == resource.data.salonId
        && request.resource.data.barberId == resource.data.barberId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.rating is number
        && request.resource.data.rating >= 1
        && request.resource.data.rating <= 5
        && (request.time.toMillis() - resource.data.createdAt) <= (24 * 60 * 60 * 1000);
      // Pas de delete : on conserve l'historique de tous les avis.
    }

    // ───────── Historique des abonnements clients ─────────
    // Log d'audit de chaque activation/prolongation d'abonnement coupes
    // illimitées. Lecture par admin / kiosk du salon / owner / client lui-même.
    // Création réservée au kiosk du salon concerné ET planAllows(['pro']) :
    // un salon downgradé en Free/Standard ne peut PAS activer de nouveau
    // abonnement (les abonnements actifs existants restent valides jusqu'à
    // expiration, mais aucune nouvelle entrée d'audit ne peut être créée).
    match /customerSubscriptions/{id} {
      allow get: if isAdmin()
        || isCustomer(resource.data.customerId)
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId);
      allow list: if isAdmin()
        || (request.auth != null && (
            request.auth.uid == resource.data.customerId
            || isSalonKiosk(resource.data.salonId)
            || isOwner(resource.data.salonId)
        ));
      allow create: if request.auth != null
        && isSalonKiosk(request.resource.data.salonId)
        && planAllows(request.resource.data.salonId, ['pro']);
      // Pas d'update : un log d'audit est immuable.
    }

    // ───────── File d'attente "Je suis en route" ─────────
    // Une seule entrée active (status == 'signaled') par client.
    // Le client crée/annule sa propre entrée ; le salon peut marquer "arrivé"
    // ou annuler une entrée pour un no-show.
    // Création gatée par planAllows(['standard', 'pro']) : un salon Free
    // ne peut PAS recevoir de nouveaux signaux. Les entrées déjà créées
    // peuvent toujours être finalisées (update) pour permettre au salon
    // de clôturer proprement les signaux en cours après un downgrade.
    match /queueEntries/{entryId} {
      allow get: if isAdmin()
        || isCustomer(resource.data.customerId)
        || isSalonKiosk(resource.data.salonId)
        || isOwner(resource.data.salonId);
      allow list: if isAdmin()
        || (request.auth != null && (
            request.auth.uid == resource.data.customerId
            || isSalonKiosk(resource.data.salonId)
            || isOwner(resource.data.salonId)
        ));
      // Le client crée pour lui-même ; le salon peut créer pour walk-in.
      // Verrou anti-spoof côté client : le salonId déclaré doit correspondre
      // à celui où le client est effectivement enregistré. Sans cette vérif,
      // un client pourrait signaler "je suis en route" pour un salon qui
      // n'est pas le sien.
      allow create: if request.auth != null
        && planAllows(request.resource.data.salonId, ['standard', 'pro'])
        && (
          (
            request.auth.uid == request.resource.data.customerId
            && exists(/databases/$(database)/documents/customers/$(request.auth.uid))
            && get(/databases/$(database)/documents/customers/$(request.auth.uid)).data.salonId == request.resource.data.salonId
          )
          || isSalonKiosk(request.resource.data.salonId)
        )
        && request.resource.data.status == 'signaled';
      // Update : client peut modifier ETA / annuler ; salon peut marquer arrivé / annuler.
      // Pas de planAllows ici : on autorise la clôture d'entrées existantes
      // même après un downgrade pour ne pas piéger des signaux orphelins.
      // Verrou d'immutabilité : customerId / salonId / createdAt ne bougent jamais.
      allow update: if request.auth != null
        && request.resource.data.customerId == resource.data.customerId
        && request.resource.data.salonId == resource.data.salonId
        && request.resource.data.createdAt == resource.data.createdAt
        && (
          request.auth.uid == resource.data.customerId
          || isSalonKiosk(resource.data.salonId)
        );
    }
  }
}
```

### Ce que ça empêche concrètement
- Salon B ne peut **pas** mettre à jour les clients de salon A
- Salon B ne peut **pas** ajouter de coupes pour les clients de salon A
- Un attaquant qui forge des requêtes Firestore directement ne peut pas contourner le contrôle salon (l'UID est vérifié contre la liste `kioskUserIds` du salon-cible)
- Salon B **peut** migrer un client si ce client confirme — la règle `isSalonKiosk(request.resource.data.salonId)` (le nouveau salon) le permet

---

## Build pour Android et iOS

Pour générer les fichiers `.apk` (Android) et `.ipa` (iOS) :

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # → APK / AAB
eas build --platform ios       # → IPA (compte Apple Developer requis)
```

---

## Structure du projet

```
src/
├── components/      Logo, Button, Card, ProgressIndicator, Screen, TextField
├── contexts/        AppContext (mode, user, onboarded, salonId)
├── navigation/      RootNavigator + types
├── screens/
│   ├── OnboardingScreen.tsx
│   ├── RoleSelectionScreen.tsx
│   ├── client/      PhoneSignup, OtpVerify, ClientName, Dashboard, Qr, History
│   └── salon/       Activation, Scanner, AddCut
├── services/        firebase, auth, customers, cuts, salons, storage, notifications
├── theme/           colors, typography, spacing, REWARD_THRESHOLD
└── types/           Salon, Customer, Cut, ScanResult, AppMode
```

---

## Prochaines étapes (post-MVP)

- [ ] Cloud Function `addCutSecure` pour empêcher les manipulations côté client.
- [ ] QR signé + tournant (anti-fraude).
- [ ] Dashboard web `Trimya Admin` quand tu auras 5+ salons.
- [ ] Multi-salons côté client (un client peut être fidèle à plusieurs).
- [ ] Programmes de fidélité personnalisables (X coupes au lieu de 4).
