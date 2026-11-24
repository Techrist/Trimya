/**
 * Slugify utilities used to derive salonId and activation codes.
 */

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Strip diacritics
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Generates a short random alphanumeric suffix (uppercase, 5 chars).
 * Used for activation codes: TRIMYA-XXXXX
 *
 * SÉCURITÉ — utilise `crypto.getRandomValues` (CSPRNG) et NON `Math.random()`.
 * Math.random est dérivable de l'état interne du worker Vercel : un
 * attaquant qui obtient un code peut prédire les suivants et deviner tous
 * les codes d'activation futurs (24M possibilités à brute-forcer sinon).
 */
export function randomCodeSuffix(): string {
  // Avoid ambiguous chars (0/O, 1/I, L) — easier to read aloud
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function buildActivationCode(): string {
  return `TRIMYA-${randomCodeSuffix()}`;
}
