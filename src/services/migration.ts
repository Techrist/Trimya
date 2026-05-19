import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Customer } from '@/types';
import { getSalon } from './salons';

const MIGRATION_REQUEST_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface MigrationResult {
  previousSalonId: string;
  newSalonId: string;
  migratedAt: number;
}

/**
 * Ask the customer for permission to migrate them to a new salon.
 * Writes a pending request on the customer doc that the client app
 * will detect in real time and surface as a confirmation modal.
 */
export async function requestMigration(params: {
  customerId: string;
  targetSalonId: string;
}): Promise<void> {
  const { customerId, targetSalonId } = params;
  const salon = await getSalon(targetSalonId);
  if (!salon) throw new Error('Salon introuvable.');

  const now = Date.now();
  await updateDoc(doc(db, 'customers', customerId), {
    pendingMigrationTo: {
      salonId: targetSalonId,
      salonName: salon.name,
      requestedAt: now,
      expiresAt: now + MIGRATION_REQUEST_TTL_MS,
    },
  });
}

/**
 * Clear a pending migration request without acting on it
 * (used both for cancel by salon and refuse by customer).
 */
export async function clearMigrationRequest(customerId: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), {
    pendingMigrationTo: null,
  });
}

/**
 * Customer accepts the pending migration request.
 * Performs the actual migration in a transaction and clears the request.
 */
export async function acceptMigrationRequest(
  customerId: string,
): Promise<MigrationResult> {
  const customerRef = doc(db, 'customers', customerId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) throw new Error('Client introuvable.');
    const data = snap.data() as Customer;
    const pending = data.pendingMigrationTo;
    if (!pending) throw new Error('Aucune demande de migration en cours.');
    if (pending.expiresAt < Date.now()) {
      tx.update(customerRef, { pendingMigrationTo: null });
      throw new Error('La demande a expiré.');
    }

    const now = Date.now();
    tx.update(customerRef, {
      salonId: pending.salonId,
      previousSalonId: data.salonId,
      migratedAt: now,
      currentCount: 0,
      totalCuts: 0,
      totalRewards: 0,
      lastVisitAt: null,
      vip: false,
      notes: '',
      pendingMigrationTo: null,
    });

    return {
      previousSalonId: data.salonId,
      newSalonId: pending.salonId,
      migratedAt: now,
    };
  });
}

/**
 * Migrate a customer from their current salon to a new one.
 *
 * Resets loyalty progression for the new salon (counter, totals, VIP, notes),
 * keeps personal info (name, phone, photo, push tokens) and stores audit
 * fields (previousSalonId, migratedAt) for traceability.
 *
 * Past `cuts` documents remain in the collection so the old salon keeps
 * its historical stats.
 */
export async function migrateCustomerToSalon(params: {
  customerId: string;
  newSalonId: string;
}): Promise<MigrationResult> {
  const { customerId, newSalonId } = params;
  const customerRef = doc(db, 'customers', customerId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) throw new Error('Client introuvable.');
    const data = snap.data() as Customer;

    if (data.salonId === newSalonId) {
      // Already at the target salon — no-op
      return {
        previousSalonId: data.salonId,
        newSalonId,
        migratedAt: data.migratedAt || Date.now(),
      };
    }

    const now = Date.now();
    tx.update(customerRef, {
      salonId: newSalonId,
      previousSalonId: data.salonId,
      migratedAt: now,
      // Reset loyalty fields for the new relationship
      currentCount: 0,
      totalCuts: 0,
      totalRewards: 0,
      lastVisitAt: null,
      // Reset salon-specific personalization (private to the old salon)
      vip: false,
      notes: '',
    });

    return {
      previousSalonId: data.salonId,
      newSalonId,
      migratedAt: now,
    };
  });
}
