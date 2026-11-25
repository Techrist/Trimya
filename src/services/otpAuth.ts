/**
 * Authentification par code OTP envoyé par email (via Brevo côté serveur).
 *
 * Flow :
 *   1. `requestOtp(email, role)` → POST /api/otp/send (admin Vercel) → email
 *      envoyé au client
 *   2. Client tape le code dans OtpCodeVerifyScreen
 *   3. `verifyOtp(email, code)` → POST /api/otp/verify → récupère Custom Token
 *   4. `signInWithCustomToken(token)` → session Firebase classique
 *
 * Pourquoi ça remplace le magic link :
 *  - UX plus familière (code à taper vs cliquer un lien)
 *  - Marche même si la boîte email strippe les liens sécurité
 *  - Pas besoin que l'user revienne sur l'exact même device/browser
 *  - Code expire en 5 min, consommé en one-shot → fenêtre d'attaque minimale
 */

import { signInWithCustomToken, User } from 'firebase/auth';
import { auth } from './firebase';

/**
 * URL du backend admin qui héberge /api/otp/*.
 *
 * - En prod : https://admin.trimya.app
 * - En dev local : http://localhost:3000 si tu lances `npm run dev` dans admin/
 *
 * Configurable via EXPO_PUBLIC_ADMIN_API_URL — si absent on tombe sur la prod.
 */
const ADMIN_API_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_URL || 'https://admin.trimya.app';

export interface OtpSendResult {
  ok: boolean;
  expiresInSeconds?: number;
  error?: OtpError;
  retryAfterSeconds?: number;
}

export interface OtpVerifyResult {
  ok: boolean;
  user?: User;
  role?: 'client' | 'owner';
  error?: OtpError;
}

export type OtpError =
  | 'invalid_email'
  | 'invalid_code'
  | 'code_expired'
  | 'too_many_attempts'
  | 'rate_limited'
  | 'network_error'
  | 'internal_error';

/**
 * Demande l'envoi d'un code OTP à l'adresse email donnée.
 *
 * On ne révèle PAS si l'email existe déjà — même si c'est un nouveau compte,
 * le code part et à la vérif on créera l'utilisateur Firebase si nécessaire.
 */
export async function requestOtp(
  email: string,
  role: 'client' | 'owner' = 'client',
): Promise<OtpSendResult> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'invalid_email' };
  }

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, role }),
    });

    // Rate-limit : body contient retryAfterSeconds
    if (res.status === 429) {
      const data = await safeJson(res);
      return {
        ok: false,
        error: 'rate_limited',
        retryAfterSeconds: data?.retryAfterSeconds,
      };
    }

    if (!res.ok) {
      const data = await safeJson(res);
      return { ok: false, error: mapError(data?.error) };
    }

    const data = (await res.json()) as {
      ok: boolean;
      expiresInSeconds: number;
    };
    return { ok: true, expiresInSeconds: data.expiresInSeconds };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

/**
 * Vérifie le code OTP et établit la session Firebase.
 *
 * En cas de succès : signInWithCustomToken() pose auth.currentUser et
 * déclenche onAuthStateChanged dans AppContext comme pour n'importe quelle
 * autre méthode de signin.
 */
export async function verifyOtp(
  email: string,
  code: string,
): Promise<OtpVerifyResult> {
  const normalized = email.trim().toLowerCase();
  const cleanCode = code.replace(/\s+/g, '');

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: 'invalid_code' };
  }

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, code: cleanCode }),
    });

    if (!res.ok) {
      const data = await safeJson(res);
      return { ok: false, error: mapError(data?.error) };
    }

    const data = (await res.json()) as {
      ok: boolean;
      token: string;
      role: 'client' | 'owner';
      uid: string;
    };

    const cred = await signInWithCustomToken(auth, data.token);
    return { ok: true, user: cred.user, role: data.role };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function mapError(code: unknown): OtpError {
  if (typeof code !== 'string') return 'internal_error';
  switch (code) {
    case 'invalid_code':
    case 'code_expired':
    case 'too_many_attempts':
    case 'rate_limited':
      return code;
    case 'invalid_payload':
    case 'invalid_json':
      return 'invalid_email';
    default:
      return 'internal_error';
  }
}

/**
 * Message user-friendly à afficher pour une erreur OTP.
 * Les erreurs sont volontairement vagues sur l'existence du compte
 * (anti-énumération) : on dit toujours "code incorrect", jamais
 * "email inconnu".
 */
export function otpErrorMessage(error: OtpError): string {
  switch (error) {
    case 'invalid_email':
      return 'Email invalide. Vérifie l\'orthographe.';
    case 'invalid_code':
      return 'Code incorrect. Vérifie le code reçu par email.';
    case 'code_expired':
      return 'Ce code a expiré. Demande un nouveau code.';
    case 'too_many_attempts':
      return 'Trop de tentatives. Demande un nouveau code.';
    case 'rate_limited':
      return 'Trop d\'envois. Patiente une minute avant de réessayer.';
    case 'network_error':
      return 'Connexion impossible. Vérifie ton réseau.';
    case 'internal_error':
    default:
      return 'Quelque chose ne s\'est pas passé comme prévu. Réessaie dans un instant.';
  }
}
