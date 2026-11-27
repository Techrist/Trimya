import "server-only";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";

/**
 * Helpers des comptes Trimya Pro (inscription, réinitialisation du mot de
 * passe, création de salons par un propriétaire).
 */

/** Interrupteur d'urgence : SIGNUP_ENABLED=false coupe les inscriptions. */
export function signupEnabled(): boolean {
  return process.env.SIGNUP_ENABLED !== "false";
}

/** Plafond global de demandes de compte par jour (SIGNUP_DAILY_CAP, défaut 50). */
export function dailyCap(): number {
  const n = Number(process.env.SIGNUP_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : 50;
}

/** Adresse qui reçoit les nouvelles demandes à valider. */
export function adminNotifyEmail(): string {
  return process.env.ADMIN_NOTIFY_EMAIL || "contact@trimya.app";
}

// Domaines d'emails jetables les plus courants (liste volontairement courte :
// la vraie barrière reste le code reçu + les limites par IP / email + ta validation).
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

/** Clé de dédoublonnage / d'OTP : jamais l'email en clair. */
export function emailKey(raw: string): string {
  return createHash("sha256").update(`email:${canonicalEmail(raw)}`).digest("hex");
}

/** Numéro validé : chiffres seuls, 8 à 15. Renvoie null si invalide. */
export function cleanPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const count = digits.replace(/\D/g, "").length;
  return count >= 8 && count <= 15 ? digits : null;
}

/** Code OTP à 6 chiffres (CSPRNG). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash salé du code (le sel = clé email + finalité). */
export function otpHash(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
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

/** Politique de mot de passe : 8 à 128 caractères, au moins une lettre et un chiffre. */
export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/)
  .regex(/\d/);

/** Profil saisi pour une demande de compte Pro (salon ou propriétaire). */
export const proProfileSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("salon"),
    name: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    ownerName: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
  }),
  z.object({
    type: z.literal("owner"),
    name: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
    /** Nombre de salons de la chaîne (indicatif, aide à la validation). */
    salonCount: z.number().int().min(1).max(50).optional(),
    companyName: z.string().max(80).optional(),
  }),
]);
