/**
 * Abstraction haptics multi-plateformes.
 *
 * Natif : utilise expo-haptics (vibration moteur taptic).
 * Web : utilise navigator.vibrate quand dispo (Chrome Android), sinon no-op.
 *       Sur iOS Safari web il n'y a aucune API haptique, on retombe en silence.
 *
 * Toutes les fonctions sont `fire-and-forget` : si la plateforme ne supporte
 * pas l'haptique, l'app continue normalement sans jamais planter. Les écrans
 * doivent prévoir un feedback VISUEL en plus de l'haptique (cf. section 6 du
 * PDF : « remplacer le retour haptique par un feedback visuel fort »).
 */
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Déclenche un retour haptique de type `kind`. Jamais throw. */
export async function haptic(kind: HapticKind): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web : navigator.vibrate(ms) existe sur Chrome Android/Edge, pas sur
      // iOS Safari. On encode la "force" via la durée de vibration.
      const vib = (globalThis as { navigator?: Navigator }).navigator?.vibrate?.bind(
        globalThis.navigator,
      );
      if (!vib) return;
      const durations: Record<HapticKind, number | number[]> = {
        light: 10,
        medium: 25,
        heavy: 50,
        success: [10, 40, 20],
        warning: [15, 60, 15],
        error: [30, 60, 30, 60, 30],
      };
      vib(durations[kind]);
      return;
    }

    // Natif : lazy-require pour ne pas charger expo-haptics côté web
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    switch (kind) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Haptique optionnel : on ne fait jamais échouer l'appelant.
  }
}

/**
 * True si la plateforme supporte un retour haptique (vrai ou simulé).
 * Permet aux écrans de décider s'ils doivent prévoir un feedback visuel
 * compensatoire.
 */
export function isHapticSupported(): boolean {
  if (Platform.OS !== 'web') return true;
  const vib = (globalThis as { navigator?: Navigator }).navigator?.vibrate;
  return typeof vib === 'function';
}
