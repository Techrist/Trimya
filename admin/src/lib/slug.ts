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
 */
export function randomCodeSuffix(): string {
  // Avoid ambiguous chars (0/O, 1/I, L) — easier to read aloud
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function buildActivationCode(): string {
  return `TRIMYA-${randomCodeSuffix()}`;
}
