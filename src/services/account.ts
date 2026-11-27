import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, type User } from 'firebase/auth';
import { auth, db } from './firebase';
import { getOwner } from './owners';
import { getCustomer } from './customers';

/**
 * Comptes Trimya Pro (salon / propriétaire) : inscription par email vérifié,
 * validation par l'admin, connexion par mot de passe, mot de passe oublié.
 *
 * Tout ce qui touche à la création / au mot de passe passe par le serveur
 * admin (`/api/auth/*`). L'état de la demande est lu dans `accounts/{uid}`
 * (lecture autorisée pour son propre uid uniquement).
 */

const ADMIN_API_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://admin.trimya.app';

export type AccountType = 'salon' | 'owner';
export type AccountStatus = 'pending' | 'active' | 'rejected';

export interface Account {
  id: string;
  type: AccountType;
  status: AccountStatus;
  email: string;
  salonId?: string;
  ownerId?: string;
  rejectionReason?: string;
}

/** Erreur applicative : `message` = code serveur (ex. `email_already_registered`). */
async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('network_error');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'internal_error');
  return data as T;
}

// ─── Inscription ─────────────────────────────────────────────

export async function requestSignupCode(
  email: string,
  audience: 'client' | 'pro' = 'pro',
): Promise<void> {
  await call('/api/auth/signup/send', { email: email.trim(), audience });
}

/** Vérifie le code ; renvoie la preuve (15 min) exigée à la création. */
export async function verifySignupCode(email: string, code: string): Promise<string> {
  const r = await call<{ proof: string }>('/api/auth/signup/verify', {
    email: email.trim(),
    code: code.trim(),
  });
  return r.proof;
}

export type SignupProfile =
  | { type: 'salon'; name: string; city: string; ownerName: string; phone: string }
  | {
      type: 'owner';
      name: string;
      phone: string;
      companyName?: string;
      salonCount?: number;
    };

export async function submitSignup(input: {
  email: string;
  proof: string;
  password: string;
  profile: SignupProfile;
}): Promise<void> {
  await call('/api/auth/signup/create', {
    email: input.email.trim(),
    proof: input.proof,
    password: input.password,
    consent: true,
    profile: input.profile,
  });
}

// ─── Mot de passe oublié ─────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  await call('/api/auth/password-reset/send', { email: email.trim() });
}

export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  password: string;
}): Promise<void> {
  await call('/api/auth/password-reset/confirm', {
    email: input.email.trim(),
    code: input.code.trim(),
    password: input.password,
  });
}

// ─── Connexion & état du compte ──────────────────────────────

export async function signInWithPassword(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function getAccount(uid: string): Promise<Account | null> {
  const snap = await getDoc(doc(db, 'accounts', uid));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Account, 'id'>) }) : null;
}

export function subscribeAccount(
  uid: string,
  cb: (account: Account | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'accounts', uid),
    (snap) =>
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Account, 'id'>) }) : null),
    () => cb(null),
  );
}

export type AccountDestination =
  | { kind: 'salon'; salonId: string }
  | { kind: 'owner'; ownerId: string }
  | { kind: 'pending' }
  | { kind: 'rejected'; reason: string };

/**
 * Détermine où envoyer un utilisateur connecté :
 *  - compte salon actif   → son salon (si non désactivé)
 *  - compte propriétaire  → son espace propriétaire (si non désactivé)
 *  - demande en attente / refusée → écran d'état
 *  - ancien propriétaire créé par l'admin (sans doc `accounts`) → owners/{uid}
 * Lève `no_account` / `account_disabled` sinon.
 */
export async function resolveDestination(user: User): Promise<AccountDestination> {
  const acc = await getAccount(user.uid);

  if (acc) {
    if (acc.status === 'pending') return { kind: 'pending' };
    if (acc.status === 'rejected') {
      return { kind: 'rejected', reason: acc.rejectionReason ?? '' };
    }
    if (acc.type === 'salon' && acc.salonId) {
      const salonSnap = await getDoc(doc(db, 'salons', acc.salonId));
      const disabledAt = salonSnap.exists() ? Number(salonSnap.data().disabledAt ?? 0) : 0;
      if (!salonSnap.exists() || disabledAt > 0) throw new Error('account_disabled');
      return { kind: 'salon', salonId: acc.salonId };
    }
    if (acc.type === 'owner') {
      const owner = await getOwner(user.uid);
      if (!owner || (owner.disabledAt && owner.disabledAt > 0)) {
        throw new Error('account_disabled');
      }
      return { kind: 'owner', ownerId: user.uid };
    }
  }

  // Compat : propriétaire créé par l'admin avant ce parcours.
  const legacy = await getOwner(user.uid);
  if (legacy) {
    if (legacy.disabledAt && legacy.disabledAt > 0) throw new Error('account_disabled');
    return { kind: 'owner', ownerId: user.uid };
  }
  throw new Error('no_account');
}

// ─── Compte client (app Trimya) ──────────────────────────────

/** Crée le compte client (email vérifié + mot de passe), sans validation admin. */
export async function submitClientSignup(input: {
  email: string;
  proof: string;
  password: string;
}): Promise<void> {
  await call('/api/auth/signup/client', {
    email: input.email.trim(),
    proof: input.proof,
    password: input.password,
  });
}

/**
 * Où envoyer un client connecté :
 *  - fiche client existante → ClientTabs
 *  - pas encore de fiche (inscription inachevée, ancien compte) → ClientName
 * Refuse les comptes Pro (salon / propriétaire) : ils ont leur propre app.
 */
export async function resolveClientDestination(
  user: User,
): Promise<'ClientTabs' | 'ClientName'> {
  const [acc, owner] = await Promise.all([
    getAccount(user.uid).catch(() => null),
    getOwner(user.uid).catch(() => null),
  ]);
  if (acc || owner) throw new Error('wrong_app');

  // getCustomer peut lever « permission denied » quand le doc n'existe pas.
  const customer = await getCustomer(user.uid).catch(() => null);
  return customer ? 'ClientTabs' : 'ClientName';
}

// ─── Demande de compte Pro après connexion Google / Apple ────

/**
 * Crée la demande de compte Pro d'un utilisateur déjà connecté via Google /
 * Apple (email vérifié par le fournisseur : ni code ni mot de passe).
 */
export async function submitSocialSignup(profile: SignupProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('invalid_token');
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}/api/auth/signup/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ consent: true, profile }),
    });
  } catch {
    throw new Error('network_error');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'internal_error');
}
