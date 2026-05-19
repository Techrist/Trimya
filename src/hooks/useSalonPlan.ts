import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Salon } from '@/types';
import {
  PLANS,
  effectivePlan,
  getLimits,
  isTrialActive,
  trialDaysLeft,
  planExpiresInDays,
  type SalonPlanId,
  type PlanLimits,
} from '@/lib/plans';

export interface SalonPlanState {
  /** Document complet du salon (null en cours de chargement / introuvable). */
  salon: Salon | null;
  /** Plan effectif (Pro pendant le trial, Free si expiré). */
  plan: SalonPlanId;
  /** Limites/features appliquées par le plan effectif. */
  limits: PlanLimits;
  /** Vrai si on est dans la fenêtre d'essai Pro gratuit. */
  trial: boolean;
  /** Jours restants à l'essai (0 si pas d'essai en cours). */
  trialDays: number;
  /** Jours avant expiration du plan payant — null si plan Free ou sans expiration. */
  expiresIn: number | null;
  /** Vrai pendant le tout premier chargement. */
  loading: boolean;
}

const DEFAULT_LIMITS = PLANS.free.limits;

/**
 * Souscrit en temps réel au document du salon et expose son plan effectif
 * + les limites/features appliquées. Quand `salonId` est null (mode client),
 * renvoie un état "free" inerte sans déclencher de listener.
 */
export function useSalonPlan(salonId: string | null): SalonPlanState {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(!!salonId);

  useEffect(() => {
    if (!salonId) {
      setSalon(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'salons', salonId),
      (snap) => {
        setSalon(
          snap.exists()
            ? ({ id: snap.id, ...(snap.data() as Omit<Salon, 'id'>) })
            : null,
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [salonId]);

  if (!salon) {
    return {
      salon: null,
      plan: 'free',
      limits: DEFAULT_LIMITS,
      trial: false,
      trialDays: 0,
      expiresIn: null,
      loading,
    };
  }

  return {
    salon,
    plan: effectivePlan(salon),
    limits: getLimits(salon),
    trial: isTrialActive(salon),
    trialDays: trialDaysLeft(salon),
    expiresIn: planExpiresInDays(salon),
    loading,
  };
}
