/**
 * Configuration Expo dynamique — pilote le packaging des DEUX apps Trimya
 * depuis un seul codebase via la variable d'environnement `TRIMYA_APP`.
 *
 *   TRIMYA_APP=client  → Trimya       (B2C — carte de fidélité)
 *   TRIMYA_APP=pro     → Trimya Pro   (B2B — kiosque salon + dashboard owner)
 *
 * Par défaut (variable absente) → `client` (l'app la plus testée, défaut sûr).
 *
 * Ce qui change selon la cible :
 *   - name                  (« Trimya » vs « Trimya Pro »)
 *   - slug                  (`trimya` vs `trimya-pro`)
 *   - scheme deep-link      (`trimya://` vs `trimya-pro://`)
 *   - iOS bundle identifier (`app.trimya.client` vs `app.trimya.pro`)
 *   - Android package       (`app.trimya.client` vs `app.trimya.pro`)
 *   - googleServicesFile    (`google-services.json` vs `google-services-pro.json`)
 *   - iOS GoogleService-Info.plist (idem)
 *   - icon, adaptive-icon, splash, notification-icon
 *   - extra.appTarget       → relu par `src/lib/appTarget.ts` à l'exécution
 *
 * Ce qui reste partagé :
 *   - Tous les services Firebase (Auth, Firestore, Storage, Cloud Functions)
 *   - Toutes les Cloud Functions et règles Firestore
 *   - La base de code TypeScript (la branche prise se fait au runtime)
 *
 * Pour lancer en dev :
 *   npm start                       → Trimya (client) — par défaut
 *   TRIMYA_APP=pro npm start        → Trimya Pro
 *
 * Pour builder en production :
 *   eas build --profile production-client --platform all
 *   eas build --profile production-pro    --platform all
 */

const TARGET = process.env.TRIMYA_APP === 'pro' ? 'pro' : 'client';
const isPro = TARGET === 'pro';

// ── Tables de correspondance ─────────────────────────────────
const NAMES = {
  client: 'Trimya',
  pro: 'Trimya Pro',
};

const SLUGS = {
  client: 'trimya',
  pro: 'trimya-pro',
};

const SCHEMES = {
  client: 'trimya',
  pro: 'trimya-pro',
};

const BUNDLE_IDS = {
  client: 'app.trimya.client',
  pro: 'app.trimya.pro',
};

// ── EAS project IDs (un par cible) ───────────────────────────
// Chaque app est un projet EAS distinct (slug différent → projectId
// différent). Le projectId Client est celui hérité de l'app unifiée
// (le bundle ID change mais le projet EAS reste tant qu'on ne le
// recrée pas explicitement). Le projectId Pro est à créer au premier
// `eas build --profile production-pro` qui prompt automatiquement.
//
// Au premier build Pro, EAS demandera de créer un nouveau projet. Une
// fois créé, copie le projectId ici. Le fallback `EAS_PROJECT_ID_PRO`
// permet d'override en CI ou via env si nécessaire.
const EAS_PROJECT_IDS = {
  client: '419d4de4-7ecc-4a64-9724-56a92041fecc',
  // Projet @techrist2000/trimya-pro créé sur EAS le 8 juin 2026.
  // Override via env var possible pour CI/multi-comptes.
  pro:
    process.env.EAS_PROJECT_ID_PRO ??
    'b1c22869-7cf2-49a0-b6e2-c0a757a76b42',
};

/**
 * Valide qu'un projectId EAS est un UUID v4 standard.
 * Tant qu'on retombe sur le placeholder Pro (avant le tout premier build),
 * cette fonction retourne false → on omet la clé du config → EAS demande
 * gracieusement à créer un nouveau projet.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidEasProjectId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

// ── Assets dédiés par cible ──────────────────────────────────
// Pour le client on garde les assets existants. Pour Pro on a des variantes
// dédiées (générées dans `assets/`). En l'absence d'une variante Pro, on
// retombe sur l'asset client pour ne jamais bloquer un build.
const ICON = {
  client: './assets/icon.png',
  pro: './assets/icon-pro.png',
};

const ADAPTIVE_ICON = {
  client: './assets/adaptive-icon.png',
  pro: './assets/adaptive-icon-pro.png',
};

const NOTIFICATION_ICON = {
  client: './assets/notification-icon.png',
  pro: './assets/notification-icon-pro.png',
};

// Image affichée au splash screen (écran de lancement Android/iOS).
// Trimya Pro utilise une variante avec une pill « PRO » sous le T pour
// renforcer l'identité visuelle dès la première seconde de l'app.
const SPLASH_IMAGE = {
  client: './assets/logo-mark.png',
  pro: './assets/logo-mark-pro.png',
};

// ── Firebase configs (un fichier par cible côté Android + iOS) ──
// En EAS, ces chemins sont surchargés par les secrets uploadés via
// `eas secret:create --type file`.
const ANDROID_FIREBASE = {
  client: process.env.GOOGLE_SERVICES_JSON_CLIENT ?? './google-services.json',
  pro: process.env.GOOGLE_SERVICES_JSON_PRO ?? './google-services-pro.json',
};

const IOS_FIREBASE = {
  client:
    process.env.GOOGLE_SERVICE_INFO_PLIST_CLIENT ??
    './GoogleService-Info.plist',
  pro:
    process.env.GOOGLE_SERVICE_INFO_PLIST_PRO ??
    './GoogleService-Info-pro.plist',
};

// ── Descriptions adaptées par audience ────────────────────────
const DESCRIPTIONS = {
  client:
    'Ta carte de fidélité coiffeur dans ton téléphone. 4 coupes payées, la 5ᵉ offerte.',
  pro: 'Le logiciel de gestion des salons de coiffure africains. Fidélisation, équipe, réservations, stats.',
};

// ── Permissions usage descriptions ────────────────────────────
const CAMERA_REASON = {
  client: 'Trimya utilise la caméra uniquement pour afficher ton QR code de fidélité.',
  pro: 'Trimya Pro utilise la caméra pour scanner les QR codes des clients fidèles.',
};

const PHOTOS_REASON = {
  client: 'Trimya a besoin d\'accéder à tes photos pour ajouter une photo de profil.',
  pro: 'Trimya Pro a besoin d\'accéder à tes photos pour ajouter les photos des coiffeurs et le logo du salon.',
};

// ── Export de la config dynamique ─────────────────────────────
module.exports = ({ config }) => {
  // ─── Permissions Android selon la cible ─────────────────────
  // CAMERA n'est utilisée que par le SalonScannerScreen (Trimya Pro).
  // L'inclure dans Trimya Client = permission non utilisée → rejet store.
  const androidPermissions = isPro
    ? [
        'android.permission.CAMERA',
        'android.permission.VIBRATE',
        'android.permission.RECORD_AUDIO',
      ]
    : ['android.permission.VIBRATE'];

  // ─── Plugins selon la cible ──────────────────────────────────
  // Le plugin `expo-camera` injecte les entitlements iOS (NSCameraUsage...)
  // et la permission Android CAMERA. À garder uniquement pour Pro.
  const filteredPlugins = (config.plugins ?? [])
    .map((p) => {
      // expo-camera : conditionner à Pro
      if (Array.isArray(p) && p[0] === 'expo-camera') {
        return isPro
          ? ['expo-camera', { cameraPermission: CAMERA_REASON[TARGET] }]
          : null; // retiré pour client
      }
      // expo-notifications : icône adaptée à la cible
      if (Array.isArray(p) && p[0] === 'expo-notifications') {
        return [
          'expo-notifications',
          {
            ...p[1],
            icon: NOTIFICATION_ICON[TARGET],
          },
        ];
      }
      // expo-image-picker : description adaptée
      if (Array.isArray(p) && p[0] === 'expo-image-picker') {
        return ['expo-image-picker', { photosPermission: PHOTOS_REASON[TARGET] }];
      }
      // expo-splash-screen : image différente Client vs Pro (badge PRO)
      // On override `image` et `dark.image` pour pointer vers le logo
      // de la cible, tout en préservant les autres paramètres (taille,
      // resizeMode, backgroundColor) hérités de app.json.
      if (Array.isArray(p) && p[0] === 'expo-splash-screen') {
        const cfg = p[1] ?? {};
        return [
          'expo-splash-screen',
          {
            ...cfg,
            image: SPLASH_IMAGE[TARGET],
            ...(cfg.dark
              ? { dark: { ...cfg.dark, image: SPLASH_IMAGE[TARGET] } }
              : {}),
          },
        ];
      }
      return p;
    })
    .filter(Boolean);

  // ─── iOS Info.plist : on n'expose `NSCameraUsageDescription` qu'en Pro ──
  // Sinon, Apple détecte « code lié à la caméra non utilisé » → rejet.
  const iosInfoPlist = {
    ...config.ios?.infoPlist,
    NSPhotoLibraryUsageDescription: PHOTOS_REASON[TARGET],
    ...(isPro ? { NSCameraUsageDescription: CAMERA_REASON[TARGET] } : {}),
  };

  return {
    ...config,
    name: NAMES[TARGET],
    slug: SLUGS[TARGET],
    scheme: SCHEMES[TARGET],
    description: DESCRIPTIONS[TARGET],
    icon: ICON[TARGET],

    ios: {
      ...config.ios,
      bundleIdentifier: BUNDLE_IDS[TARGET],
      googleServicesFile: IOS_FIREBASE[TARGET],
      // Trimya Client : pas de support iPad (les screenshots iPad
      // dédiés ne sont pas requis et l'usage tablette du client est
      // marginal). Trimya Pro : support iPad obligatoire (kiosque).
      supportsTablet: isPro,
      infoPlist: iosInfoPlist,
    },

    android: {
      ...config.android,
      package: BUNDLE_IDS[TARGET],
      googleServicesFile: ANDROID_FIREBASE[TARGET],
      permissions: androidPermissions,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: ADAPTIVE_ICON[TARGET],
      },
      // SÉCURITÉ — Désactive Android Auto Backup pour éviter que les tokens
      // Firebase (persistés en AsyncStorage), le PIN (SecureStore) et les
      // identifiants utilisateur ne soient exfiltrés via une sauvegarde
      // Google Drive restaurée sur un autre appareil. Sans ce flag, un
      // attaquant qui prend brièvement le téléphone d'une victime peut
      // déclencher une sauvegarde puis la restaurer ailleurs pour avoir
      // les sessions actives.
      allowBackup: false,
    },

    plugins: filteredPlugins,

    extra: {
      ...config.extra,
      appTarget: TARGET, // ← relu par src/lib/appTarget.ts à l'exécution
      // EAS projectId par cible : indispensable pour que push tokens
      // (Constants.expoConfig.extra.eas.projectId, cf. services/push.ts)
      // soient corrects ET pour que le versionCode Android soit tracké
      // séparément par EAS Cloud (`appVersionSource: "remote"` dans eas.json).
      //
      // Si le projectId Pro vaut encore le placeholder, on l'OMET
      // complètement : EAS détectera l'absence et proposera de créer un
      // nouveau projet au premier `eas build --profile production-pro`.
      // Sinon, EAS rejette la requête avec "Invalid UUID appId".
      eas: isValidEasProjectId(EAS_PROJECT_IDS[TARGET])
        ? {
            ...config.extra?.eas,
            projectId: EAS_PROJECT_IDS[TARGET],
          }
        : (() => {
            // Pour Pro avant la création : on évite l'héritage du projectId
            // Client (qui ferait que EAS tenterait d'écrire dans le projet
            // Client avec le bundleIdentifier Pro → erreur).
            const { projectId: _ignored, ...rest } = config.extra?.eas ?? {};
            void _ignored;
            return rest;
          })(),
    },
  };
};
