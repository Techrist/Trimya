import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import { clearPin } from '@/services/clientPin';

/**
 * Réinitialisation globale de l'app sur chaque appareil.
 *
 * Quand on change `APP_RESET_VERSION`, chaque appareil, à sa prochaine
 * ouverture :
 *   1. déconnecte la session Firebase ;
 *   2. efface l'état local (mode, salon / client / propriétaire, onboarding) ;
 *   3. efface le code PIN local ;
 * puis mémorise la version, pour ne le faire qu'UNE fois.
 *
 * La langue choisie est conservée. À utiliser après un nettoyage de la base
 * (comptes supprimés), ou pour forcer la reconnexion de tout le monde :
 * il suffit de mettre une nouvelle valeur (par exemple la date du jour) et
 * de republier l'app.
 */
export const APP_RESET_VERSION = '2026-11-27';

const VERSION_KEY = '@trimya/resetVersion';

/** Applique la réinitialisation si cet appareil ne l'a pas encore faite. */
export async function applyAppResetIfNeeded(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(VERSION_KEY);
    if (seen === APP_RESET_VERSION) return false;

    await signOut().catch(() => undefined);
    await storage.resetAll();
    await clearPin().catch(() => undefined);
    await AsyncStorage.setItem(VERSION_KEY, APP_RESET_VERSION);
    return true;
  } catch {
    // Ne jamais bloquer le démarrage de l'app à cause de la réinitialisation.
    return false;
  }
}
