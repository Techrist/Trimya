/**
 * Transforme n'importe quelle erreur (Firebase, réseau, runtime, etc.)
 * en message clair et rassurant pour l'utilisateur.
 *
 * Objectif : ne JAMAIS afficher un code technique brut à l'utilisateur
 * final (ex. « auth/invalid-credential », « FirebaseError: Missing or
 * insufficient permissions », « TypeError: undefined is not an object »).
 *
 * Stratégie :
 *  1. On essaie de matcher des codes/strings connus → message dédié i18n
 *  2. Sinon → message générique « Une erreur est survenue, réessaie. »
 *
 * Toutes les fonctions du code qui catchent une erreur et veulent
 * l'afficher doivent passer par `humanizeError(err, t)` au lieu de
 * `err.message`.
 */

type TFunction = (key: any, params?: Record<string, string | number>) => string;

/**
 * Extrait une chaîne signifiante d'une erreur de type `unknown`,
 * sans risquer de produire `[object Object]`.
 */
function extractRawMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message ?? '';
  if (typeof err === 'object') {
    const candidate =
      (err as { message?: unknown }).message ??
      (err as { code?: unknown }).code ??
      '';
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

export function humanizeError(err: unknown, t: TFunction): string {
  const raw = extractRawMessage(err).toLowerCase();

  // ── Codes Firebase Auth les plus fréquents ─────────────────
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return t('error.auth.invalidCredential');
  }
  if (raw.includes('auth/user-not-found')) {
    return t('error.auth.userNotFound');
  }
  if (raw.includes('auth/too-many-requests')) {
    return t('error.auth.tooManyRequests');
  }
  if (raw.includes('auth/invalid-phone-number') || raw.includes('invalid format')) {
    return t('error.auth.invalidPhone');
  }
  if (raw.includes('auth/invalid-verification-code') || raw.includes('invalid_code')) {
    return t('error.auth.invalidOtp');
  }
  if (raw.includes('auth/code-expired') || raw.includes('expired')) {
    return t('error.auth.otpExpired');
  }
  if (raw.includes('auth/credential-already-in-use')) {
    return t('error.auth.phoneAlreadyUsed');
  }
  if (raw.includes('auth/email-already-in-use')) {
    return t('error.auth.emailAlreadyUsed');
  }
  if (raw.includes('auth/weak-password')) {
    return t('error.auth.weakPassword');
  }
  if (raw.includes('auth/network-request-failed')) {
    return t('error.network.firebase');
  }
  if (raw.includes('auth/requires-recent-login')) {
    return t('error.auth.requiresRecentLogin');
  }
  if (raw.includes('auth/quota-exceeded')) {
    return t('error.auth.quotaExceeded');
  }

  // ── Erreurs Firestore ──────────────────────────────────────
  if (raw.includes('permission-denied') || raw.includes('missing or insufficient permissions')) {
    return t('error.firestore.permissionDenied');
  }
  if (raw.includes('unavailable') || raw.includes('deadline-exceeded')) {
    return t('error.network.serverUnavailable');
  }
  if (raw.includes('not-found')) {
    return t('error.firestore.notFound');
  }
  if (raw.includes('failed-precondition')) {
    return t('error.firestore.failedPrecondition');
  }
  if (raw.includes('aborted')) {
    return t('error.firestore.aborted');
  }
  if (raw.includes('already-exists')) {
    return t('error.firestore.alreadyExists');
  }

  // ── Erreurs réseau génériques ───────────────────────────────
  if (
    raw.includes('network') ||
    raw.includes('failed to fetch') ||
    raw.includes('econn') ||
    raw.includes('etimedout') ||
    raw.includes('enotfound')
  ) {
    return t('error.network.generic');
  }

  // ── Codes internes Trimya (services/*.ts) ──────────────────
  if (raw.includes('transfer_same_salon')) {
    return t('error.trimya.transferSameSalon');
  }
  if (raw.includes('review_edit_window_passed')) {
    return t('error.trimya.reviewEditWindowPassed');
  }
  if (raw.includes('rate_limited') || raw.includes('quota')) {
    return t('error.trimya.rateLimited');
  }
  if (raw.includes('plan') && raw.includes('require')) {
    return t('error.trimya.planRequired');
  }
  if (raw.includes('disabled')) {
    return t('error.trimya.accountDisabled');
  }
  if (raw.includes('cannot_open')) {
    return t('error.trimya.cannotOpenLink');
  }

  // ── Messages déjà en français (rédigés dans nos services) ──
  // Quelques erreurs lancées par notre code sont déjà rédigées en français
  // clair (ex. "Salon introuvable.", "Mot de passe trop court (8 caractères
  // minimum).", "Code invalide. Vérifie auprès de Trimya."). On les laisse
  // passer telles quelles si elles ressemblent à du français propre
  // (commencent par majuscule, longueur raisonnable, pas de code/symbole).
  const original = extractRawMessage(err);
  if (
    original &&
    original.length > 0 &&
    original.length < 200 &&
    /^[A-ZÀ-ÖØ-Þ]/.test(original) &&
    !original.includes('/') &&
    !original.includes('_') &&
    !original.includes(': ') &&
    !original.includes('undefined')
  ) {
    return original;
  }

  // ── Fallback générique ─────────────────────────────────────
  return t('error.generic');
}
