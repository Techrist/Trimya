# Trimya PWA — guide d'utilisation

Ce document explique comment lancer la **version PWA** de Trimya en local, la
déployer en HTTPS, et la tester sur chaque plateforme. L'app native (Expo iOS /
Android) n'est pas affectée — elle continue de se builder comme avant.

## 1. Démarrage local

### Pré-requis

- Node 20+
- Un fichier `.env.local` avec les clés Firebase publiques (cf. `.env.example`).
- (Pour push) une clé **VAPID** récupérée dans Firebase Console → Project
  Settings → Cloud Messaging → "Web configuration" → "Generate key pair". Ajoute
  la clé dans `.env.local` :
  ```
  EXPO_PUBLIC_FIREBASE_VAPID_KEY=BPQxxxx...
  ```

### Lancer le dev server web

```bash
npm run web
# équivalent : npx expo start --web
```

Expo ouvre un navigateur sur `http://localhost:8081`. Note : `getUserMedia`
(caméra) et le service worker exigent un contexte sécurisé. **localhost est
considéré sécurisé** par les navigateurs, donc le scan QR et le SW fonctionnent
sans HTTPS en local.

### Lancer l'app native en parallèle

L'activation de la cible web **ne touche pas** le build Expo natif :

```bash
npm start           # choix Expo (QR, i / a / w)
npm run android     # Expo Go sur Android
npm run ios         # Simulateur iOS
```

## 2. Build production

```bash
# 1) Bundle web statique
npx expo export --platform web

# 2) Injecter la config Firebase publique dans le SW FCM
node scripts/inject-firebase-sw-config.js dist/

# 3) Déployer (choisir UNE option)

# Option A — Firebase Hosting
firebase deploy --only hosting

# Option B — Vercel
npx vercel --prod dist

# Option C — n'importe quel autre host statique HTTPS
```

Le dossier `dist/` contient :

- `index.html` (template custom depuis `public/index.html`)
- `manifest.webmanifest`
- `sw.js` (service worker app shell)
- `firebase-messaging-sw.js` (service worker push FCM)
- `icons/` (192, 512, maskable)
- `_expo/static/js/web/*.js` (bundle React, versionné pour cache long)

## 3. Tester par plateforme

### Android Chrome

1. Ouvre l'URL dans Chrome.
2. Un bandeau "Installer Trimya" apparaît (prompt natif capturé par
   `usePwaInstall`). Clic → l'app est installée depuis l'écran d'accueil.
3. Vérifie :
   - QR client s'affiche + se régénère toutes les 30 s.
   - Scan kiosque fonctionne (caméra arrière).
   - Push : accepte la permission → une notification de test arrive.
   - Mode offline : coupe le Wi-Fi, l'app shell reste chargée.

### iOS Safari

**Attention iOS impose plusieurs contraintes :**

1. **L'install prompt n'existe pas** — l'utilisateur doit suivre le guide
   intégré (Partager → Sur l'écran d'accueil → Ajouter).
2. **Les notifications push ne fonctionnent QUE SI** :
   - iOS ≥ 16.4
   - **ET** l'app est lancée depuis l'écran d'accueil (standalone)
   - `getWebPushPermission()` renvoie `'requires_install'` sinon et le
     guide affiche un message adapté.
3. **La session Firebase est effacée après ~7 jours** d'inactivité sans
   ouverture (purge IndexedDB iOS). Le hook `useKioskSessionGuard` détecte
   cet état et renvoie `'expired'`, ce qui doit router vers un écran de
   reconnexion propre.
4. **La caméra se coupe en arrière-plan**. Le composant `QrScanner.web.tsx`
   écoute `visibilitychange` et relance automatiquement `getUserMedia` au
   retour au premier plan.

### iOS Chrome (CriOS)

Le guide détecte Chrome iOS et affiche un message spécial : « Ouvrez ce lien
dans Safari pour installer Trimya ». C'est une limite iOS, pas une limite
de Trimya.

### Desktop

- Chrome / Edge / Brave : prompt natif disponible, bouton "Installer".
- Firefox : pas d'install PWA automatique, le guide manuel reste accessible.
- Safari macOS 17+ : installable via Fichier → Ajouter au Dock.

## 4. Ce qui marche / ce qui ne marche pas

| Capacité | Android | iOS Safari (installé) | iOS Safari (non installé) | iOS Chrome | Desktop |
|---|---|---|---|---|---|
| **UI / Firestore / Auth SMS** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Scan QR caméra** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PIN SecureStore (IndexedDB)** | ✅ | ✅ | ✅ (7j max) | ✅ (7j max) | ✅ |
| **Install prompt natif** | ✅ | — | — | — | ✅ |
| **Guide installation manuel** | ✅ | ✅ | ✅ | ✅ (via Safari) | ✅ |
| **Push notifications (FCM Web)** | ✅ | ✅ (iOS ≥ 16.4) | ❌ | ❌ | ✅ |
| **Mode offline (app shell)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Wake Lock écran** | ✅ | ✅ (iOS ≥ 16.4) | ❌ | ❌ | ✅ |
| **Session persistante > 7j** | ✅ | ✅ | ⚠️ purge auto | ⚠️ purge auto | ✅ |

Toute capacité manquante est **détectée** (feature detection) et **expliquée
dans l'UI** — jamais un faux succès.

## 5. Architecture — points clés

- **`src/platform/`** — abstractions multi-plateformes (`haptics`,
  `secureStore`, `wakeLock`, `detectPlatform`). Toujours importer depuis
  `@/platform/*`, pas directement depuis `expo-haptics` / `expo-secure-store`.
- **`src/components/QrScanner.{native,web}.tsx`** — scanner routé par
  Metro selon la plateforme. Même interface (`QrScannerProps`).
- **`src/services/push.web.ts`** — FCM Web, séparé de `push.ts` natif.
  Les Cloud Functions doivent envoyer vers `webPushToken` sur FCM et
  `pushToken` sur Expo Push, selon le canal disponible.
- **`src/hooks/usePwaInstall.ts`** — capture `beforeinstallprompt`, détecte
  si installée (`display-mode: standalone`), gère le dismiss.
- **`src/hooks/useKioskWakeLock.ts`** / **`useKioskSessionGuard.ts`** —
  utilitaires kiosque (écran éveillé + détection purge iOS).
- **`public/`** — fichiers statiques servis par Expo + copiés tels quels
  dans `dist/` (manifest, sw, icônes).

## 6. Limites connues (à surveiller pendant les pilotes)

- **iOS Safari ne prévient pas l'utilisateur** quand il va bientôt purger
  les données (7 jours). Prévoir un flow « rouvre Trimya au moins une fois
  par semaine » dans le pack d'onboarding salon.
- **Les notifications web sur iOS** sont nouvelles (16.4, mars 2023) et
  moins fiables que les notifications natives. Pour un pilote salon
  critique, prévoir Android.
- **Le bundle web actuel pèse ~5 MB** (Firebase + i18n + screens). Si le
  TTI mobile devient un problème, c'est le premier levier à optimiser
  (code splitting React Native Web, lazy routes).
- **La caméra sur navigateurs anciens Android** (WebView intégrée dans
  WhatsApp, Instagram, etc.) peut ne pas supporter `facingMode:
  environment`. Toujours ouvrir le lien dans Chrome / Samsung Internet.

## 7. Ce qui reste à faire

- Intégrer le composant `<PwaInstallGuideScreen>` au RootNavigator avec
  un trigger au premier launch web (ex: `shouldShowGuide` du hook).
- Adapter `SalonScannerScreen` pour utiliser `<QrScanner />` + `useKioskWakeLock()`
  + `useKioskSessionGuard()`.
- Côté Cloud Functions, router l'envoi push selon la plateforme cible
  (web FCM vs Expo Push) dans `functions/src/index.ts`.
- Déployer un domaine HTTPS stable (`app.trimya.com` par exemple) et
  ajouter les meta Open Graph pour le partage WhatsApp.
