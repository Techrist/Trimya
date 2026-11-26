import { humanizeError } from '@/lib/humanizeError';

type TFunction = (key: any, params?: Record<string, string | number>) => string;

/**
 * Message lisible pour une erreur du parcours de compte : erreurs Firebase
 * Auth (mauvais mot de passe…) → `humanizeError`, codes du serveur
 * (`email_already_registered`, `invalid_code`…) → `account.error.<code>`.
 */
export function accountErrorText(e: unknown, t: TFunction): string {
  const raw = e instanceof Error ? e.message : '';
  if (raw.includes('auth/')) return humanizeError(e, t);
  const key = `account.error.${raw}`;
  const msg = t(key);
  return msg === key ? t('account.error.generic') : msg;
}

/** 8 à 128 caractères, au moins une lettre et un chiffre (miroir du serveur). */
export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 128 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}
