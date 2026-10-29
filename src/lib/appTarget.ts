/**
 * Détection de l'app cible à l'exécution.
 *
 * Trimya est packagée en DEUX apps distinctes à partir du même codebase :
 *  - `client` : Trimya — app B2C grand public (carte de fidélité)
 *  - `pro`    : Trimya Pro — app B2B (kiosque salon + dashboard propriétaire)
 *
 * Le choix se fait au moment du build via la variable d'environnement
 * `TRIMYA_APP` lue par `app.config.js` qui la propage dans `extra.appTarget`.
 *
 * À l'exécution, on relit cette valeur depuis `expo-constants` pour
 * conditionner la navigation, les écrans et les copies marketing.
 *
 * Par défaut (dev local sans variable explicite), on tombe sur `client` —
 * choix volontaire : c'est l'app la plus testée et l'expérience la plus
 * commune. Pour développer Pro, lance avec : `TRIMYA_APP=pro npm start`.
 */

import Constants from 'expo-constants';

export type AppTarget = 'client' | 'pro';

/**
 * Lit la cible de build courante. Mémoïsée — l'appel à Constants est
 * synchrone mais ce helper est appelé partout dans la navigation, autant
 * éviter les re-évaluations.
 */
let cachedTarget: AppTarget | null = null;

export function getAppTarget(): AppTarget {
  if (cachedTarget) return cachedTarget;
  const raw = (Constants.expoConfig?.extra as { appTarget?: string })?.appTarget;
  cachedTarget = raw === 'pro' ? 'pro' : 'client';
  return cachedTarget;
}

/** Sucre syntactique pour les conditions `isClientApp() && ...` */
export function isClientApp(): boolean {
  return getAppTarget() === 'client';
}

export function isProApp(): boolean {
  return getAppTarget() === 'pro';
}

/**
 * Nom marketing de l'app courante, utilisé pour l'affichage in-app
 * (titre, header de partage, etc.) — distinct du nom système.
 */
export function getAppDisplayName(): string {
  return isProApp() ? 'Trimya Pro' : 'Trimya';
}
