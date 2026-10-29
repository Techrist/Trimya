/**
 * Wake Lock — empêche l'écran de se mettre en veille.
 *
 * Utilisé par le kiosque salon pour que la tablette reste allumée pendant
 * le service. L'API Wake Lock (Screen Wake Lock) existe en web depuis
 * Chrome 84 ; iOS Safari l'a implémentée en 16.4.
 *
 * Si l'API n'existe pas, on documente dans le guide d'installation que
 * l'utilisateur doit régler « Verrouillage auto → Jamais » sur l'appareil
 * (cf. encart kiosque section 8 du PDF).
 */
import { Platform } from 'react-native';

export interface WakeLockHandle {
  release: () => Promise<void>;
}

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockApi {
  request: (type: 'screen') => Promise<WakeLockSentinel>;
}

/**
 * True si l'API Wake Lock est accessible sur cette plateforme/navigateur.
 * Permet à l'UI de montrer un message « verrouillage auto manuel » quand
 * ce n'est pas supporté.
 */
export function isWakeLockSupported(): boolean {
  if (Platform.OS !== 'web') {
    // Natif : expo-keep-awake fait le job (dépendance transitive d'Expo).
    return true;
  }
  const nav = (globalThis as { navigator?: { wakeLock?: WakeLockApi } }).navigator;
  return typeof nav?.wakeLock?.request === 'function';
}

/**
 * Demande un verrou d'écran. Retourne null si non supporté ou refusé.
 * Le caller DOIT appeler `.release()` pour libérer le lock.
 *
 * Note : le lock est automatiquement libéré par le navigateur quand la
 * page passe en arrière-plan. Il faut donc le re-demander sur
 * visibilitychange — c'est fait dans le hook useKioskWakeLock.
 */
export async function requestWakeLock(): Promise<WakeLockHandle | null> {
  try {
    if (Platform.OS === 'web') {
      const nav = (globalThis as { navigator?: { wakeLock?: WakeLockApi } }).navigator;
      if (!nav?.wakeLock) return null;
      const sentinel = await nav.wakeLock.request('screen');
      return {
        release: async () => {
          if (!sentinel.released) {
            await sentinel.release();
          }
        },
      };
    }
    // Natif : expo-keep-awake. Lazy require pour ne pas charger côté web.
    const KeepAwake = require('expo-keep-awake') as typeof import('expo-keep-awake');
    const tag = `trimya-${Date.now()}`;
    await KeepAwake.activateKeepAwakeAsync(tag);
    return {
      release: async () => {
        await KeepAwake.deactivateKeepAwake(tag);
      },
    };
  } catch {
    return null;
  }
}
