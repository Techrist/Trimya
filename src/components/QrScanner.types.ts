/**
 * Contrat partagé entre QrScanner.native.tsx et QrScanner.web.tsx.
 *
 * Les deux implémentations respectent la même interface pour que le
 * SalonScannerScreen puisse les utiliser sans connaître la plateforme.
 *
 * Le composant émet un `onScan(payload: string)` avec le texte brut du QR
 * et laisse le screen décider quoi en faire (parsing, validation, dispatch).
 */

export interface QrScannerProps {
  /** Appelé une seule fois dès qu'un QR est détecté avec succès. */
  onScan: (payload: string) => void;
  /**
   * Appelé si une erreur bloquante survient (permission caméra refusée,
   * caméra non disponible). Le screen peut afficher un message clair.
   * Jamais appelé plusieurs fois pour la même erreur.
   */
  onError?: (error: QrScannerError) => void;
  /** Pause/reprise du scanner (ex: pour laisser l'alerte s'afficher). */
  paused?: boolean;
  /**
   * Style du conteneur. Les deux implémentations occupent par défaut
   * tout l'espace parent. Les screens peuvent surcharger pour imposer
   * une taille précise.
   */
  style?: unknown;
}

export type QrScannerError =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'secure_context_required'
  | 'unknown';
