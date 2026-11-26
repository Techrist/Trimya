import { auth } from './firebase';

/**
 * Gestion des salons d'une chaîne par leur propriétaire : création d'un salon
 * avec ses identifiants de connexion, changement de son mot de passe.
 * Tout passe par le serveur admin (Bearer = session du propriétaire).
 */

const ADMIN_API_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://admin.trimya.app';

/** Erreur applicative : `message` = code serveur (ex. `no_enterprise_plan`). */
async function call<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('forbidden');
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('network_error');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'internal_error');
  return data as T;
}

export interface CreateOwnerSalonInput {
  name: string;
  city: string;
  phone?: string;
  email: string;
  password: string;
}

export async function createOwnerSalon(
  input: CreateOwnerSalonInput,
): Promise<{ salonId: string }> {
  return call('/api/owner/salons', {
    name: input.name,
    city: input.city,
    email: input.email.trim(),
    password: input.password,
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  });
}

export async function setOwnerSalonPassword(
  salonId: string,
  password: string,
): Promise<void> {
  await call(`/api/owner/salons/${encodeURIComponent(salonId)}/password`, { password });
}
