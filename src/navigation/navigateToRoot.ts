/**
 * Helper centralisé pour ramener un utilisateur à la « racine » de l'app
 * (typiquement après un sign-out, un changement de rôle, ou un retour
 * explicite vers le début du flow).
 *
 * Pourquoi un helper : la route racine **diffère selon la cible de build** :
 *  - Trimya Client (B2C) : la racine est `EmailSignup` (auth OTP email via
 *    Brevo depuis novembre 2026 — l'ancien `PhoneSignup` est déprécié,
 *    bloqué par les opérateurs africains et nécessitait le plan Blaze).
 *  - Trimya Pro (B2B)    : la racine est `ProRoleSelection` (salon vs owner)
 *
 * Utiliser ce helper systématiquement pour les sign-out, reset de mode,
 * PIN oublié, suppression de compte, etc.
 */

import { CommonActions } from '@react-navigation/native';
import { isProApp } from '@/lib/appTarget';
import type { RootStackParamList } from './types';

/**
 * Reset la pile de navigation et envoie l'utilisateur sur l'écran racine
 * de l'app courante.
 *
 * Le type d'entrée est volontairement large (`{ dispatch: ... }`) pour
 * accepter aussi bien `NavigationProp<ParamListBase>` que les types
 * strict-typés comme `NativeStackNavigationProp<RootStackParamList, X>`.
 *
 * @param nav  N'importe quel objet de navigation exposant `dispatch`.
 */
// On accepte `any` ici plutôt qu'un type strict : les écrans appellent ce
// helper avec des `NativeStackNavigationProp<RootStackParamList, X>` dont la
// signature `dispatch` change selon X. Une signature stricte ferait planter
// chaque caller avec un type error différent. `any` est le bon trade-off
// car l'API consommée (`dispatch(CommonActions.reset(...))`) est elle-même
// typée par CommonActions, donc on ne perd pas de safety utile.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function navigateToRoot(nav: any): void {
  const rootRoute: keyof RootStackParamList = isProApp()
    ? 'ProRoleSelection'
    : 'EmailSignup';
  nav.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: rootRoute as string }],
    }),
  );
}
