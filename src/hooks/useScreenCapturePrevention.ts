import { useEffect } from 'react';

/**
 * Bloque les captures d'écran et les enregistrements vidéo le temps que
 * l'écran qui appelle ce hook est monté. Utilisé sur les écrans qui
 * affichent des informations sensibles : saisie du PIN, OTP SMS, mot de
 * passe owner, code d'activation.
 *
 * Implémentation :
 *  - Android : pose le flag `FLAG_SECURE` sur la fenêtre. Les captures
 *    d'écran et les enregistreurs tiers (Talkback Screenshot, etc.)
 *    affichent un écran noir à la place du contenu.
 *  - iOS : iOS n'autorise pas l'app à bloquer une capture d'écran
 *    manuelle, mais expo-screen-capture émet un event qu'on peut écouter
 *    et ajoute un overlay sombre lors des enregistrements écran.
 *
 * Le module `expo-screen-capture` est optionnel : on l'importe via
 * `require` dynamique. S'il n'est pas installé (ex: certains forks EAS),
 * le hook devient un no-op silencieux. Pour l'installer :
 *
 *     npx expo install expo-screen-capture
 */
export function useScreenCapturePrevention(enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const mod: {
          preventScreenCaptureAsync: () => Promise<void>;
          allowScreenCaptureAsync: () => Promise<void>;
        } = require('expo-screen-capture');
        await mod.preventScreenCaptureAsync();
        if (!active) {
          await mod.allowScreenCaptureAsync();
          return;
        }
        cleanup = () => {
          mod.allowScreenCaptureAsync().catch(() => {
            // silencieux : l'app se ferme probablement
          });
        };
      } catch {
        // Module non installé → no-op. On laisse passer pour ne pas
        // bloquer le dev local. En production il SUFFIT d'installer
        // le module pour activer la protection sur tous les écrans.
      }
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [enabled]);
}
