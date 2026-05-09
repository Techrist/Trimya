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

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /salons/{salonId} {
      allow read: if true;
      allow write: if false;  // uniquement via console / cloud functions
    }

    match /customers/{customerId} {
      allow create: if request.auth != null && request.auth.uid == customerId;
      allow read: if request.auth != null;
      allow update: if request.auth != null;
    }

    match /cuts/{cutId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

⚠️ Pour un MVP en test salon réel, ces règles sont volontairement permissives. Avant ouverture publique, durcir avec des **Cloud Functions** qui font l'incrément côté serveur.

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
