import { useEffect, useState } from 'react';
import { subscribeSalonQueue } from '@/services/queue';

/**
 * Compte le nombre de clients actuellement signalés "en route" pour ce salon.
 * Utilisé pour afficher un badge sur le bouton "File d'attente".
 */
export function useSalonQueueCount(salonId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!salonId) {
      setCount(0);
      return;
    }
    const unsub = subscribeSalonQueue(salonId, (list) => {
      setCount(list.filter((e) => e.status === 'signaled').length);
    });
    return unsub;
  }, [salonId]);

  return count;
}
