import "server-only";

/**
 * Helpers de sanitisation d'erreurs pour les routes API admin.
 *
 * Problème adressé (H10 de l'audit sécu) : renvoyer le `e.message` brut au
 * client expose des codes Firebase internes (`auth/email-already-exists`,
 * `permission-denied`, `auth/user-not-found`...) qui permettent à un
 * attaquant d'énumérer les comptes existants, deviner les contraintes
 * back-end et planifier des attaques ciblées.
 *
 * Stratégie :
 *  - On loggue toujours le message brut côté serveur (Vercel logs).
 *  - On renvoie au client soit un code applicatif whitelisté, soit un
 *    `internal_error` opaque. Pas de message variable.
 */

/** Codes d'erreur applicatifs sûrs à exposer au client. */
export type SafeErrorCode =
  | "invalid_payload"
  | "invalid_json"
  | "missing_bearer_token"
  | "invalid_token"
  | "not_admin"
  | "not_found"
  | "already_exists"
  | "email_already_used"
  | "salon_already_owned"
  | "plan_required"
  | "quota_exceeded"
  | "rate_limited"
  | "forbidden"
  | "internal_error";

/**
 * Mappe une erreur Firebase / interne vers un code sûr à exposer.
 * Liste explicite et fermée : tout ce qui n'est pas reconnu retombe
 * sur `internal_error` pour ne rien fuiter.
 */
export function classifyError(err: unknown): SafeErrorCode {
  const raw = (() => {
    if (!err) return "";
    if (typeof err === "string") return err.toLowerCase();
    if (err instanceof Error) return err.message.toLowerCase();
    if (typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string") return m.toLowerCase();
      const c = (err as { code?: unknown }).code;
      if (typeof c === "string") return c.toLowerCase();
    }
    return "";
  })();

  if (raw.includes("auth/email-already-exists")) return "email_already_used";
  if (raw.includes("auth/user-not-found")) return "not_found";
  if (raw.includes("salon_already_owned")) return "salon_already_owned";
  if (raw.includes("not_found") || raw.includes("not-found")) return "not_found";
  if (raw.includes("already_exists") || raw.includes("already-exists"))
    return "already_exists";
  if (raw.includes("permission") || raw.includes("forbidden")) return "forbidden";
  if (raw.includes("plan_required") || raw.includes("planallows"))
    return "plan_required";
  if (raw.includes("quota") || raw.includes("limit_reached"))
    return "quota_exceeded";
  if (raw.includes("rate_limit")) return "rate_limited";
  return "internal_error";
}

/** Loggue le message brut côté serveur sans le renvoyer au client. */
export function logServerError(tag: string, err: unknown): void {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === "string"
        ? err
        : JSON.stringify(err);
  console.error(`[${tag}]`, raw);
}
