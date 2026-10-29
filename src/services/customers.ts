import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Customer } from '@/types';

export async function findCustomerByPhone(
  phone: string,
  salonId: string,
): Promise<Customer | null> {
  const q = query(
    collection(db, 'customers'),
    where('phone', '==', phone),
    where('salonId', '==', salonId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Customer, 'id'>) };
}

export async function createCustomer(input: {
  id: string;
  phone: string;
  /** Prénom (affiché dans les greetings, listings, etc.) */
  name?: string;
  /** Nom de famille (optionnel à l'inscription) */
  lastName?: string;
  /** Email (optionnel à l'inscription, utile pour reçus / récupération) */
  email?: string;
  salonId: string;
}): Promise<Customer> {
  // On ne pose que les champs avec valeur non-vide pour ne pas écraser
  // avec des `undefined` côté Firestore.
  const customer: Customer = {
    id: input.id,
    phone: input.phone,
    salonId: input.salonId,
    currentCount: 0,
    totalCuts: 0,
    totalRewards: 0,
    createdAt: Date.now(),
    vip: false,
    notes: '',
    ...(input.name ? { name: input.name } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
    ...(input.email ? { email: input.email } : {}),
  };
  await setDoc(doc(db, 'customers', input.id), customer);
  return customer;
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const ref = doc(db, 'customers', customerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Customer, 'id'>) };
}

export function subscribeCustomer(
  customerId: string,
  cb: (customer: Customer | null) => void,
): () => void {
  const ref = doc(db, 'customers', customerId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb({ id: snap.id, ...(snap.data() as Omit<Customer, 'id'>) });
    },
    (err) => {
      console.warn('[customers] subscribeCustomer error:', err.message);
      cb(null);
    },
  );
}

/**
 * Real-time list of all customers belonging to a given salon.
 */
export function subscribeSalonCustomers(
  salonId: string,
  cb: (customers: Customer[]) => void,
): () => void {
  const q = query(collection(db, 'customers'), where('salonId', '==', salonId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Customer, 'id'>),
      }));
      cb(list);
    },
    (err) => {
      console.warn('[customers] subscribeSalonCustomers error:', err.message);
      cb([]);
    },
  );
}

export async function setCustomerVip(customerId: string, vip: boolean): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { vip });
}

export async function setCustomerNotes(customerId: string, notes: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { notes });
}

export async function setCustomerName(customerId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { name: name.trim() });
}

export async function setCustomerPushEnabled(
  customerId: string,
  enabled: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { pushEnabled: enabled });
}

export async function setCustomerPhoto(
  customerId: string,
  photo: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { photo: photo ?? null });
}

/**
 * Met à jour le numéro de téléphone du client après une vérification
 * SMS réussie (cf. confirmPhoneChange dans services/auth.ts).
 * À appeler UNIQUEMENT après que Firebase Auth a accepté le changement,
 * sinon le doc Firestore devient incohérent avec auth.currentUser.phoneNumber.
 */
export async function setCustomerPhone(
  customerId: string,
  newPhoneE164: string,
): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), { phone: newPhoneE164 });
}

/**
 * Met à jour les informations personnelles : email, date de naissance,
 * préférences capillaires. Tous les champs sont optionnels et `null` efface
 * explicitement la valeur côté Firestore.
 */
export async function updateCustomerPersonalInfo(
  customerId: string,
  updates: {
    /** Nom de famille — distinct du prénom stocké dans `name`. */
    lastName?: string | null;
    email?: string | null;
    birthdate?: string | null; // ISO YYYY-MM-DD
    preferences?: {
      cutNote?: string | null;
      beardNote?: string | null;
      allergies?: string | null;
      favoriteBarberId?: string | null;
    };
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.lastName !== undefined) patch.lastName = updates.lastName ?? null;
  if (updates.email !== undefined) patch.email = updates.email ?? null;
  if (updates.birthdate !== undefined) patch.birthdate = updates.birthdate ?? null;
  if (updates.preferences) {
    patch.preferences = updates.preferences;
  }
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, 'customers', customerId), patch);
}

/**
 * Marque le compte comme « demande de suppression » (soft-delete).
 * Une Cloud Function planifiée fera le hard-delete + anonymisation des
 * cuts liés après 30 jours de grâce (RGPD : période de réflexion).
 */
export async function requestAccountDeletion(customerId: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), {
    deletionRequestedAt: Date.now(),
  });
}

export async function cancelAccountDeletion(customerId: string): Promise<void> {
  await updateDoc(doc(db, 'customers', customerId), {
    deletionRequestedAt: null,
  });
}
