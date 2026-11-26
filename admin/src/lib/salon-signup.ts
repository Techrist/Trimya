import "server-only";
import { createHash, randomInt } from "node:crypto";

/**
 * Helpers de l'inscription libre des salons (/api/salon-signup/*).
 */

/** Interrupteur d'urgence : SALON_SIGNUP_ENABLED=false coupe l'inscription. */
export function signupEnabled(): boolean {
  return process.env.SALON_SIGNUP_ENABLED !== "false";
}

/** Plafond global de créations par jour (SALON_SIGNUP_DAILY_CAP, défaut 50). */
export function dailyCap(): number {
  const n = Number(process.env.SALON_SIGNUP_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : 50;
}

// Domaines d'emails jetables les plus courants (liste volontairement courte :
// la vraie barrière reste le code reçu + les limites par IP / email / téléphone).
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "temp-mail.io", "throwawaymail.com", "yopmail.com", "yopmail.fr",
  "trashmail.com", "trashmail.net", "getnada.com", "nada.email", "sharklasers.com",
  "grr.la", "dispostable.com", "maildrop.cc", "fakeinbox.com", "mailnesia.com",
  "mintemail.com", "mohmal.com", "emailondeck.com", "tempail.com", "burnermail.io",
  "spamgourmet.com", "moakt.com", "mail.tm", "tmpmail.org", "discard.email",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return DISPOSABLE.has(domain);
}

/**
 * Forme canonique d'un email pour détecter les doublons : minuscules, sans
 * `+alias`, et sans points pour Gmail (a.b@gmail.com == ab@gmail.com).
 */
export function canonicalEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const [localRaw = "", domainRaw = ""] = email.split("@");
  let domain = domainRaw;
  let local = localRaw.split("+")[0] ?? "";
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Clé de dédoublonnage (id de doc) : jamais l'email en clair. */
export function emailKey(raw: string): string {
  return createHash("sha256").update(`email:${canonicalEmail(raw)}`).digest("hex");
}

/** Numéro canonique : chiffres seuls, sans l'indicatif 237. */
export function canonicalPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("237") && digits.length > 9) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  return digits.length >= 8 && digits.length <= 12 ? digits : null;
}

export function phoneKey(canonical: string): string {
  return createHash("sha256").update(`phone:${canonical}`).digest("hex");
}

/** Code OTP à 6 chiffres (CSPRNG). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash salé du code (le sel = clé email, donc non rejouable d'un email à l'autre). */
export function otpHash(key: string, code: string): string {
  return createHash("sha256").update(`${key}:${code}`).digest("hex");
}

/** Nettoie un texte libre : espaces normalisés, caractères de contrôle et chevrons retirés. */
export function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Date du jour (UTC) pour les compteurs journaliers. */
export function dayStamp(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
