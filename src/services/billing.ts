import { auth } from './firebase';
import type { BillingPeriod, PlanId } from '@/lib/plans';

/**
 * Paiement des plans Trimya (SasPay, mobile money).
 *
 * TOUT passe par le serveur admin : l'app n'a jamais de clé SasPay et
 * n'envoie jamais de montant (le serveur recalcule le prix). Une fois le
 * paiement confirmé, le serveur écrit le plan dans Firestore et l'app le voit
 * en temps réel (`useSalonPlan` / `useOwner`), sans rien d'autre à faire.
 */

const ADMIN_API_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://admin.trimya.app';

export type BillingTargetType = 'salon' | 'owner';
export type BillingNetwork = 'mtn_cm' | 'orange_cm';

export interface BillingQuote {
  targetType: BillingTargetType;
  targetId: string;
  planId: PlanId;
  period: BillingPeriod;
  kind: 'new' | 'renew' | 'upgrade';
  listPrice: number;
  /** Offre de lancement : remise (FCFA), pourcentage et date de fin. 0 si aucune. */
  promoDiscount?: number;
  promoPercent?: number;
  promoEndsAt?: number;
  credit: number;
  amount: number;
  currency: 'XAF';
  days: number;
  newExpiresAt: number;
}

export interface BillingTarget {
  targetType: BillingTargetType;
  targetId: string;
  planId: Exclude<PlanId, 'free'>;
  period: BillingPeriod;
}

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVIEW';

export interface PaymentState {
  paymentId: string;
  status: PaymentStatus;
  fulfilled: boolean;
  planId: PlanId;
  expiresAt: number;
  checkoutUrl: string;
  failureCode: string | null;
}

/** Erreur applicative : `message` = code serveur (ex. `downgrade_not_allowed`). */
async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('forbidden');
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error('network_error');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'internal_error');
  return data as T;
}

export async function getQuote(target: BillingTarget): Promise<BillingQuote> {
  const r = await call<{ quote: BillingQuote }>('/api/billing/quote', {
    method: 'POST',
    body: target,
  });
  return r.quote;
}

export async function startPayment(
  target: BillingTarget,
  payer: { network: BillingNetwork; phone: string },
): Promise<{ paymentId: string; checkoutUrl: string; quote: BillingQuote }> {
  return call('/api/billing/checkout', {
    method: 'POST',
    body: { ...target, ...payer },
  });
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentState> {
  return call<PaymentState>(`/api/billing/status/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
  });
}
