import { useCallback } from 'react';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { registerSalonKioskPushToken } from '@/services/push';
import type { AccountDestination } from '@/services/account';
import { useApp } from '@/contexts/AppContext';

/**
 * Applique une destination de compte : enregistre le rôle (salon /
 * propriétaire) puis ouvre le bon espace, ou l'écran d'état de la demande.
 */
export function useAccountNavigation() {
  const nav = useNavigation();
  const { setMode, setSalonId, setOwnerId } = useApp();

  return useCallback(
    async (dest: AccountDestination) => {
      if (dest.kind === 'salon') {
        await setMode('salon');
        await setSalonId(dest.salonId);
        registerSalonKioskPushToken(dest.salonId, { askPermission: true });
        nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'SalonTabs' }] }));
        return;
      }
      if (dest.kind === 'owner') {
        await setMode('owner');
        await setOwnerId(dest.ownerId);
        nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'OwnerTabs' }] }));
        return;
      }
      nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'AccountPending' }] }));
    },
    [nav, setMode, setSalonId, setOwnerId],
  );
}
