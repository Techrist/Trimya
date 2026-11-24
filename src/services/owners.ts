import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
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

/**
 * Récupère l'owner associé à un utilisateur fraîchement connecté via magic
 * link email. Deux stratégies en cascade :
 *  1. Lookup direct par uid — cas nominal pour un owner déjà existant dont
 *     le doc owners/{uid} a été créé par l'admin avec le uid du compte Auth.
 *  2. Lookup par email — fallback si l'owner existe mais que son doc Firestore
 *     a été créé avec un id custom différent du uid Auth. Dans ce cas on NE
 *     remonte PAS automatiquement l'owner — on exige un lien explicite pour
 *     éviter les hijacks (un attaquant qui créerait un compte avec l'email
 *     d'un owner existant prendrait sinon le contrôle).
 *
 * Si rien n'est trouvé : l'utilisateur est bien authentifié Firebase, mais
 * n'est pas (encore) un owner enregistré. Le caller doit afficher un message
 * clair : "Ton compte n'est pas encore activé comme propriétaire".
 */
export async function findOwnerForAuthUser(
  user: User,
): Promise<Owner | null> {
  // 1) Lookup par uid (cas nominal)
  const byUid = await getOwner(user.uid);
  if (byUid) {
    // SÉCURITÉ — un owner désactivé par l'admin doit perdre l'accès
    // immédiatement, même via OTP email. Sans ce check, le flag
    // `disabledAt` posé dans Firestore par /api/owners/:id disable restait
    // purement cosmétique côté PWA.
    if (byUid.disabledAt && byUid.disabledAt > 0) {
      throw new Error('Ce compte a été désactivé. Contacte Trimya.');
    }
    return byUid;
  }

  // 2) Si l'owner existe par email mais avec un id différent, on log mais on
  //    ne retourne pas — l'admin doit relier manuellement (ou prévoir une
  //    Cloud Function qui le fasse après MFA/preuve additionnelle).
  if (user.email) {
    const q = query(
      collection(db, 'owners'),
      where('email', '==', user.email.toLowerCase()),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.warn(
        '[owners] Owner trouvé par email mais uid différent — contactez l\'admin pour relier.',
      );
    }
  }
  return null;
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

/**
 * Configure la fidélité partagée sur la chaîne du propriétaire :
 *  1. Met à jour le doc owner (loyaltyMode + chainRewardThreshold)
 *  2. Propage la dénormalisation sur chaque salon de la chaîne :
 *     - loyaltySharedWithOwner = (mode === 'shared')
 *     - effectiveRewardThreshold = chainRewardThreshold si shared, sinon
 *       salon.rewardThreshold ?? 4
 *
 * Le tout dans une writeBatch atomique pour garantir la cohérence
 * (soit tous les écrits passent, soit aucun).
 */
export async function setOwnerLoyalty(
  ownerId: string,
  options: {
    mode: 'shared' | 'blocked';
    chainRewardThreshold?: number;
  },
): Promise<void> {
  const shared = options.mode === 'shared';
  const chainThreshold = Math.max(
    1,
    Math.min(20, Math.round(options.chainRewardThreshold ?? 4)),
  );

  const batch = writeBatch(db);

  // 1) Owner doc
  batch.update(doc(db, 'owners', ownerId), {
    loyaltyMode: options.mode,
    chainRewardThreshold: chainThreshold,
  });

  // 2) Tous les salons de l'owner
  const salonsSnap = await getDocs(
    query(collection(db, 'salons'), where('ownerId', '==', ownerId)),
  );
  for (const s of salonsSnap.docs) {
    const data = s.data() as Partial<Salon>;
    const salonOwnThreshold = data.rewardThreshold ?? 4;
    batch.update(doc(db, 'salons', s.id), {
      loyaltySharedWithOwner: shared,
      effectiveRewardThreshold: shared ? chainThreshold : salonOwnThreshold,
    });
  }

  await batch.commit();
}
