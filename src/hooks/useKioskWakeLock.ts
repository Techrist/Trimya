import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { requestWakeLock, type WakeLockHandle } from '@/platform/wakeLock';

/**
 * Hook qui maintient l'écran éveillé tant que le composant qui l'appelle
 * est monté — pensé pour l'écran de scan du kiosque salon.
 *
 * Comportement :
 *  - Au mount : demande un wake lock écran (ou expo-keep-awake sur natif).
 *  - Sur `visibilitychange` → visible : relance le wake lock (le navigateur
 *    libère automatiquement le lock quand la page passe en arrière-plan).
 *  - Au unmount : relâche le lock proprement.
 *
 * Si l'API n'existe pas (iOS < 16.4 Safari, Firefox mobile), le hook est
 * un no-op silencieux. Le guide d'installation (phase 3) prévient l'utilisateur
 * qu'il devra régler « Verrouillage auto → Jamais » manuellement.
 */
export function useKioskWakeLock(enabled: boolean = true): void {
  const lockRef = useRef<WakeLockHandle | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let mounted = true;

    const acquire = async () => {
      if (lockRef.current) return; // déjà actif
      const handle = await requestWakeLock();
      if (!mounted || !handle) {
        void handle?.release();
        return;
      }
      lockRef.current = handle;
    };

    const release = async () => {
      const h = lockRef.current;
      lockRef.current = null;
      if (h) await h.release();
    };

    acquire();

    // Sur web, un passage en arrière-plan libère le lock côté navigateur.
    // On ré-acquiert au retour. Natif : expo-keep-awake persiste tout seul.
    let onVisibility: (() => void) | undefined;
    if (Platform.OS === 'web') {
      onVisibility = () => {
        if (document.visibilityState === 'visible') {
          void acquire();
        } else {
          // On ne release pas explicitement, le navigateur le fait pour
          // nous — release() ici provoquerait un double release harmless
          // mais inutile.
          lockRef.current = null;
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      mounted = false;
      if (onVisibility) {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      void release();
    };
  }, [enabled]);
}
