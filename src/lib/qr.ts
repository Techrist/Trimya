/**
 * Construction et validation des QR clients Trimya.
 *
 * Version 3 du payload : ajoute un champ `exp` (expiration en ms) pour
 * que le QR cesse d'être valide après quelques minutes. Empêche le
 * replay basique par capture d'écran/photo.
 *
 * ⚠️ Cette protection est SOUS LE NIVEAU "tamper-proof" :
 *  - Un utilisateur sophistiqué peut décompiler l'app et générer un QR
 *    avec un `exp` arbitraire
 *  - Pour une vraie résistance, la signature HMAC + nonce stockés
 *    serveur seront ajoutés dans la Cloud Function `addCutSecure`
 *    (voir SECURITY.md → Étape Cloud Function)
 *
 * Toute la logique métier (réessais, tolérance horaire) est centralisée
 * ici pour rester cohérente entre le générateur (ClientQrScreen) et le
 * vérificateur (SalonScannerScreen).
 */

/** Durée de validité d'un QR généré, en millisecondes. */
export const QR_VALIDITY_MS = 60_000; // 60 s

/** Tolérance horloge entre device client et device salon, en ms. */
export const QR_CLOCK_SKEW_MS = 30_000; // ±30 s

export interface QrPayloadV3 {
  /** Marqueur d'identification du QR Trimya. */
  t: 'trimya';
  /** Version du format. */
  v: 3;
  /** customer id. */
  id: string;
  /** salonId actuel du client. */
  s: string;
  /** Timestamp d'expiration (ms epoch). */
  exp: number;
}

export interface QrPayloadV2 {
  t: 'trimya';
  v: 2;
  id: string;
  s: string;
}

export type ParsedQr =
  | { kind: 'v3'; data: QrPayloadV3 }
  | { kind: 'v2'; data: QrPayloadV2 }
  | { kind: 'unknown' };

export function buildQrPayload(customerId: string, salonId: string): string {
  const payload: QrPayloadV3 = {
    t: 'trimya',
    v: 3,
    id: customerId,
    s: salonId,
    exp: Date.now() + QR_VALIDITY_MS,
  };
  return JSON.stringify(payload);
}

export function parseQr(raw: string): ParsedQr {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { kind: 'unknown' };
  }
  if (!obj || typeof obj !== 'object') return { kind: 'unknown' };
  const d = obj as Record<string, unknown>;
  if (d.t !== 'trimya') return { kind: 'unknown' };

  if (
    d.v === 3 &&
    typeof d.id === 'string' &&
    typeof d.s === 'string' &&
    typeof d.exp === 'number'
  ) {
    return {
      kind: 'v3',
      data: { t: 'trimya', v: 3, id: d.id, s: d.s, exp: d.exp },
    };
  }
  if (d.v === 2 && typeof d.id === 'string' && typeof d.s === 'string') {
    return { kind: 'v2', data: { t: 'trimya', v: 2, id: d.id, s: d.s } };
  }
  return { kind: 'unknown' };
}

/**
 * Vérifie qu'un QR n'est ni expiré ni "encore dans le futur" au-delà du skew.
 * Retourne null si valide, ou un message d'erreur sinon.
 */
export function validateQrFreshness(qr: ParsedQr): string | null {
  if (qr.kind === 'unknown') return 'qr_invalid';
  if (qr.kind === 'v2') {
    // Anciennes apps : on accepte mais on incite à mettre à jour.
    return null;
  }
  const now = Date.now();
  if (qr.data.exp + QR_CLOCK_SKEW_MS < now) {
    return 'qr_expired';
  }
  if (qr.data.exp - QR_VALIDITY_MS - QR_CLOCK_SKEW_MS > now) {
    return 'qr_from_future';
  }
  return null;
}
