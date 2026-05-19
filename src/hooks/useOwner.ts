import { useEffect, useState } from 'react';
import { Owner, Salon } from '@/types';
import { subscribeOwner, subscribeOwnerSalons } from '@/services/owners';

export interface OwnerState {
  owner: Owner | null;
  salons: Salon[];
  loading: boolean;
}

/**
 * Souscris au doc owner + ses salons en temps réel.
 * Renvoie `null` tant que `ownerId` est null (pas connecté).
 */
export function useOwner(ownerId: string | null): OwnerState {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(!!ownerId);

  useEffect(() => {
    if (!ownerId) {
      setOwner(null);
      setSalons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubOwner = subscribeOwner(ownerId, (o) => {
      setOwner(o);
      setLoading(false);
    });
    const unsubSalons = subscribeOwnerSalons(ownerId, setSalons);
    return () => {
      unsubOwner();
      unsubSalons();
    };
  }, [ownerId]);

  return { owner, salons, loading };
}
