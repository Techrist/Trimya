import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  updatePassword,
  type User,
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Owner, Salon } from '@/types';

/**
 * Auth email/password pour les propriétaires.
 *
 * À la connexion :
 *  1. signInWithEmailAndPassword via Firebase Auth
 *  2. Vérifie qu'un doc `owners/{uid}` existe
 *  3. Retourne le User + le doc Owner
 */
export async function signInAsOwner(
  email: string,
  password: string,
): Promise<{ user: User; owner: Owner }> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const owner = await getOwner(cred.user.uid);
  if (!owner) {
    throw new Error(
      "Aucun compte propriétaire associé à cet email. Contacte Trimya.",
    );
  }
  if (owner.disabledAt && owner.disabledAt > 0) {
    throw new Error('Ce compte a été désactivé. Contacte Trimya.');
  }
  return { user: cred.user, owner };
}

export async function getOwner(ownerId: string): Promise<Owner | null> {
  // Note : la lecture passe par onSnapshot dans le hook pour avoir le live.
  // Cette version "one-shot" est utilisée juste après le login.
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'owners', ownerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Owner, 'id'>) };
}

export function subscribeOwner(
  ownerId: string,
  cb: (owner: Owner | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'owners', ownerId),
    (snap) => {
      cb(
        snap.exists()
          ? { id: snap.id, ...(snap.data() as Omit<Owner, 'id'>) }
          : null,
      );
    },
    (err) => {
      console.warn('[owners] subscribeOwner error:', err.message);
      cb(null);
    },
  );
}

/**
 * Souscris à la liste des salons possédés par l'owner.
 * Query : where('ownerId', '==', ownerId)
 */
export function subscribeOwnerSalons(
  ownerId: string,
  cb: (salons: Salon[]) => void,
): () => void {
  const q = query(collection(db, 'salons'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Salon, 'id'>) })));
    },
    (err) => {
      console.warn('[owners] subscribeOwnerSalons error:', err.message);
      cb([]);
    },
  );
}

/** Permet à l'owner de mettre à jour son nom / téléphone. */
export async function updateOwnerProfile(
  ownerId: string,
  updates: { name?: string; phone?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phone !== undefined) patch.phone = updates.phone ?? null;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, 'owners', ownerId), patch);
}

/** Change le mot de passe Firebase Auth de l'owner connecté. */
export async function changeOwnerPassword(newPassword: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Pas de session active.');
  if (newPassword.length < 8) {
    throw new Error('Mot de passe trop court (8 caractères minimum).');
  }
  await updatePassword(auth.currentUser, newPassword);
}
