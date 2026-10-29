import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuth, currentUser } from '@/services/auth';

/**
 * Détecte la perte de session du kiosque salon et déclenche une
 * reconnexion propre (cf. risque n°1 du PDF : purge iOS après ~7 jours).
 *
 * Problème : iOS Safari (et dans une moindre mesure Android Chrome)
 * efface IndexedDB après 7 jours d'inactivité d'une PWA. Le token
 * Firebase Auth stocké dedans disparaît et l'app se retrouve
 * « déconnectée » du salon alors que l'utilisateur n'a rien fait.
 *
 * On n'affiche JAMAIS une erreur brute du type « auth/no-current-user ».
 * À la place on remonte un état qui permet au screen de router vers
 * SalonActivationScreen avec un message clair : « Reconnectez le kiosque ».
 *
 * Le hook renvoie :
 *   - `status: 'authed'`   → session Firebase valide, kiosque OK
 *   - `status: 'guest'`    → pas d'auth, flow normal d'activation à prévoir
 *   - `status: 'expired'`  → l'app avait un salonId local MAIS le user Firebase
 *                            a disparu → cas « purge » à présenter spécialement
 */
export type KioskSessionStatus = 'authed' | 'guest' | 'expired' | 'loading';

export function useKioskSessionGuard(hasLocalSalonId: boolean): KioskSessionStatus {
  const [status, setStatus] = useState<KioskSessionStatus>('loading');

  useEffect(() => {
    const unsub = onAuth((user) => {
      if (user) {
        setStatus('authed');
      } else if (hasLocalSalonId) {
        // Cas détection purge iOS : l'utilisateur avait activé un kiosque
        // (salonId présent en localStorage) mais Firebase a perdu la session.
        setStatus('expired');
      } else {
        setStatus('guest');
      }
    });
    // Premier check synchrone en complément — l'event onAuth peut tarder
    const now = currentUser();
    if (now) setStatus('authed');
    return unsub;
  }, [hasLocalSalonId]);

  // Sur natif, la session est en SecureStore + AsyncStorage — pas de risque
  // de purge 7 jours. On force 'authed' si l'auth est OK, sinon on laisse
  // le flow normal. Pas de besoin de distinguer 'expired' pour la PWA
  // sur natif puisque les tokens persistent.
  if (Platform.OS !== 'web') {
    return status === 'expired' ? 'guest' : status;
  }

  return status;
}
