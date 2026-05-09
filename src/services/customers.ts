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
  name?: string;
  salonId: string;
}): Promise<Customer> {
  const customer: Customer = {
    id: input.id,
    phone: input.phone,
    name: input.name,
    salonId: input.salonId,
    currentCount: 0,
    totalCuts: 0,
    totalRewards: 0,
    createdAt: Date.now(),
    vip: false,
    notes: '',
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
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb({ id: snap.id, ...(snap.data() as Omit<Customer, 'id'>) });
  });
}

/**
 * Real-time list of all customers belonging to a given salon.
 */
export function subscribeSalonCustomers(
  salonId: string,
  cb: (customers: Customer[]) => void,
): () => void {
  const q = query(collection(db, 'customers'), where('salonId', '==', salonId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Customer, 'id'>),
    }));
    cb(list);
  });
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
