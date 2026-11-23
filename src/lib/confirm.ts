import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

/**
 * Confirmation cross-platform avec bouton d'action destructive.
 *
 * Problème que ça adresse : sur web, `Alert.alert(title, body, buttons)`
 * de react-native-web ignore le paramètre `buttons` et fait fallback sur
 * `window.alert()` — qui n'a qu'un bouton OK. Résultat : le callback
 * `onPress` du bouton destructive n'est jamais exécuté → la déconnexion
 * (et toute autre action gatée derrière une confirmation) ne marche pas.
 *
 * Fix : sur web on utilise `window.confirm()` natif. Sur natif, on garde
 * `Alert.alert` qui a le vrai bouton typé "destructive" rouge.
 *
 * Retourne true si l'utilisateur confirme, false sinon.
 */
export function confirmDestructive(options: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    // window.confirm est synchrone mais on normalise en promise pour
    // garder la même signature cross-platform.
    const ok = typeof window !== 'undefined' && window.confirm
      ? window.confirm(`${options.title}\n\n${options.message}`)
      : false;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
