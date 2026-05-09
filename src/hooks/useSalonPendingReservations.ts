import { useEffect, useState } from 'react';
import { subscribeSalonReservations } from '@/services/reservations';

export function useSalonPendingReservations(salonId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!salonId) {
      setCount(0);
      return;
    }
    const unsub = subscribeSalonReservations(salonId, (list) => {
      setCount(list.filter((r) => r.status === 'pending').length);
    });
    return unsub;
  }, [salonId]);

  return count;
}
