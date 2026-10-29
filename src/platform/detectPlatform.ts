/**
 * Détection fine de la plateforme pour adapter le guide d'installation
 * et la stratégie push.
 *
 * On distingue :
 *  - os : android / ios / desktop / unknown
 *  - browser : chrome / safari / firefox / edge / samsung / other
 *  - standalone : true si l'app est lancée depuis l'écran d'accueil (PWA installée)
 *  - installPromptSupported : true si on peut capter `beforeinstallprompt`
 *                             (Chromium only — Android Chrome, Edge, Samsung Internet)
 *  - webPushSupported : true si FCM Web est utilisable sur cette plateforme
 *                        (Android oui ; iOS seulement si standalone + iOS ≥ 16.4)
 */
import { Platform } from 'react-native';

export interface PlatformInfo {
  os: 'android' | 'ios' | 'desktop' | 'unknown';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'other';
  standalone: boolean;
  isNativeApp: boolean;
  installPromptSupported: boolean;
  webPushSupported: boolean;
  iosVersion: number | null;
}

/**
 * Détecte la plateforme courante. Appelé une seule fois au boot et mémorisé.
 * Côté natif on retourne un objet trivial — toutes les APIs natives sont
 * disponibles via les plugins Expo.
 */
export function detectPlatform(): PlatformInfo {
  if (Platform.OS !== 'web') {
    return {
      os: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'unknown',
      browser: 'other',
      standalone: true,
      isNativeApp: true,
      installPromptSupported: false,
      webPushSupported: true,
      iosVersion: null,
    };
  }

  const nav = (globalThis as { navigator?: Navigator }).navigator;
  const ua = nav?.userAgent ?? '';
  const uaLower = ua.toLowerCase();

  // ─── OS detection ─────────────────────────────────────────
  // iPad modernes se présentent en Mac → on vérifie aussi maxTouchPoints
  const isIpad =
    /ipad/.test(uaLower) ||
    (/macintosh/.test(uaLower) && (nav?.maxTouchPoints ?? 0) > 1);
  const isIphone = /iphone|ipod/.test(uaLower);
  const isAndroid = /android/.test(uaLower);
  const os: PlatformInfo['os'] = isAndroid
    ? 'android'
    : isIphone || isIpad
      ? 'ios'
      : 'desktop';

  // ─── Browser detection ────────────────────────────────────
  const isSamsung = /samsungbrowser/.test(uaLower);
  const isEdge = /edg\//.test(uaLower);
  const isFirefox = /firefox|fxios/.test(uaLower);
  // Chrome iOS = CriOS (c'est un wrap WebKit) → distinct de Safari
  const isChromeIos = /crios/.test(uaLower);
  const isChrome = /chrome/.test(uaLower) && !isEdge && !isSamsung;
  const isSafari =
    /safari/.test(uaLower) && !isChrome && !isEdge && !isFirefox && !isChromeIos;

  const browser: PlatformInfo['browser'] = isSamsung
    ? 'samsung'
    : isEdge
      ? 'edge'
      : isFirefox
        ? 'firefox'
        : isChrome || isChromeIos
          ? 'chrome'
          : isSafari
            ? 'safari'
            : 'other';

  // ─── Standalone (PWA installée) ───────────────────────────
  // Deux API : media-query standard (Android/desktop/iOS 16.4+) et
  // navigator.standalone (ancienne API Safari iOS)
  const matchStandalone =
    (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
      '(display-mode: standalone)',
    )?.matches ?? false;
  const navStandalone = (nav as { standalone?: boolean } | undefined)?.standalone ?? false;
  const standalone = matchStandalone || navStandalone;

  // ─── iOS version (pour push FCM Web qui requiert 16.4+) ──
  let iosVersion: number | null = null;
  if (os === 'ios') {
    const match = ua.match(/OS (\d+)[_.](\d+)/);
    if (match) {
      iosVersion = parseFloat(`${match[1]}.${match[2]}`);
    }
  }

  // ─── Capacités ────────────────────────────────────────────
  // beforeinstallprompt : Chromium-based uniquement
  const installPromptSupported =
    (browser === 'chrome' || browser === 'edge' || browser === 'samsung') &&
    os !== 'ios'; // Chrome iOS reste du WebKit → pas de prompt

  // Web Push FCM : Android oui ; iOS seulement si PWA installée + 16.4+
  const webPushSupported =
    os === 'android' ||
    os === 'desktop' ||
    (os === 'ios' && standalone && (iosVersion ?? 0) >= 16.4);

  return {
    os,
    browser,
    standalone,
    isNativeApp: false,
    installPromptSupported,
    webPushSupported,
    iosVersion,
  };
}
