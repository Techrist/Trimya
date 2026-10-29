import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { detectPlatform, type PlatformInfo } from '@/platform/detectPlatform';

/**
 * État et actions pour l'écran d'installation PWA.
 *
 * - `info` : plateforme détectée (OS, navigateur, installé ou non)
 * - `canPromptNative` : true si on peut déclencher le prompt natif
 *   (`beforeinstallprompt` reçu). Chromium Android/Desktop uniquement.
 * - `installNative()` : déclenche le prompt natif Chrome et retourne le
 *   choix de l'utilisateur. No-op si pas supporté.
 * - `shouldShowGuide` : true si on doit proposer le guide
 *   (web + pas installé + pas déjà dismiss).
 * - `dismissGuide()` : masque le guide pour cet appareil (localStorage).
 *
 * Jamais throw : tout échec silencieux côté API, on retombe sur la version
 * manuelle du guide (instructions pas-à-pas).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'trimya.pwa.installGuide.dismissed';

export interface UsePwaInstallResult {
  info: PlatformInfo;
  canPromptNative: boolean;
  shouldShowGuide: boolean;
  installNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismissGuide: () => void;
}

export function usePwaInstall(): UsePwaInstallResult {
  const [info] = useState<PlatformInfo>(() => detectPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (Platform.OS !== 'web') return true;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Capte beforeinstallprompt (Chromium only). On préviendra l'affichage
  // du prompt natif pour l'ancrer à notre bouton « Installer Trimya ».
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      // L'utilisateur a installé l'app → on peut masquer le guide
      setDeferredPrompt(null);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // best-effort
      }
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installNative = async (): Promise<
    'accepted' | 'dismissed' | 'unavailable'
  > => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  };

  const dismissGuide = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // best-effort
    }
    setDismissed(true);
  };

  // On n'affiche pas le guide si :
  //  - on est sur l'app native (déjà « installé »)
  //  - la PWA est déjà en standalone
  //  - l'utilisateur a dismiss
  const shouldShowGuide =
    Platform.OS === 'web' && !info.standalone && !dismissed;

  return {
    info,
    canPromptNative: deferredPrompt !== null,
    shouldShowGuide,
    installNative,
    dismissGuide,
  };
}
