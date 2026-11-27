import { humanizeError } from '@/lib/humanizeError';

type TFunction = (key: any, params?: Record<string, string | number>) => string;

/**
 * Message lisible pour une erreur du parcours de compte : erreurs Firebase
 * Auth (mauvais mot de passe…) → `humanizeError`, codes du serveur
 * (`email_already_registered`, `invalid_code`…) → `account.error.<code>`.
 */
export function accountErrorText(e: unknown, t: TFunction): string {
  const raw = e instanceof Error ? e.message : '';
  // Fenêtre Google fermée par l'utilisateur : ce n'est pas une erreur à afficher.
  if (
    raw.includes('auth/popup-closed-by-user') ||
    raw.includes('auth/cancelled-popup-request') ||
    raw.includes('auth/user-cancelled')
  ) {
    return '';
  }
  if (raw.includes('auth/account-exists-with-different-credential')) {
    return t('account.error.exists_other_provider');
  }
  if (raw.includes('auth/popup-blocked')) return t('account.error.popup_blocked');
  if (raw.includes('auth/')) return humanizeError(e, t);
  const key = `account.error.${raw}`;
  const msg = t(key);
  return msg === key ? t('account.error.generic') : msg;
}

/** 8 à 128 caractères, au moins une lettre et un chiffre (miroir du serveur). */
export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 128 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/**
 * Message pour une erreur de CONNEXION SOCIALE (Google / Apple). Contrairement
 * à `accountErrorText`, on ne masque pas la cause derrière un texte générique :
 * les causes de configuration (domaine non autorisé, fournisseur désactivé…)
 * sont nommées, et tout code inconnu est affiché entre parenthèses pour
 * pouvoir diagnostiquer. Renvoie '' si la personne a simplement fermé la fenêtre.
 */
export function socialErrorText(e: unknown, t: TFunction): string {
  const raw = e instanceof Error ? e.message : '';
  const code = raw.match(/auth\/[a-z0-9-]+/)?.[0] ?? '';
  // Aide au diagnostic : la cause exacte reste visible dans la console du navigateur.
  if (code) console.warn('[social-auth]', code, raw);

  switch (code) {
    case 'auth/unauthorized-domain':
      return t('account.error.social.unauthorized_domain');
    case 'auth/operation-not-allowed':
      return t('account.error.social.operation_not_allowed');
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return t('account.error.social.environment');
    case 'auth/network-request-failed':
      return t('account.error.network_error');
    default:
      break;
  }
  const base = accountErrorText(e, t);
  // Erreur Firebase inconnue : on joint le code au message générique.
  return code && base === t('account.error.generic') ? `${base} (${code})` : base;
}
