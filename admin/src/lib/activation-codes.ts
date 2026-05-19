import "server-only";
import { adminDb } from "./firebase-admin";

/**
 * Maintient la collection `activationCodes/{code}` qui mappe un code
 * à un `salonId`. Cette collection est :
 *   - lisible UNIQUEMENT par doc id (pas de list), via les règles Firestore
 *   - écrite uniquement côté serveur (Admin SDK)
 *
 * Ça évite que n'importe qui sur Internet puisse énumérer les codes
 * d'activation via la collection `salons`.
 */

interface CodeDoc {
  salonId: string;
  createdAt: number;
  /** Date à laquelle le code a été consommé par un kiosque (0 si pas encore). */
  usedAt: number;
  /** UID du kiosque qui a consommé le code (vide si pas encore). */
  usedByUid: string;
  /** Code "one-shot" : si true, le code est invalidé dès la 1ère activation. */
  oneShot: boolean;
}

export async function createActivationCode(
  code: string,
  salonId: string,
  options: { oneShot?: boolean } = {},
): Promise<void> {
  const doc: CodeDoc = {
    salonId,
    createdAt: Date.now(),
    usedAt: 0,
    usedByUid: "",
    oneShot: options.oneShot ?? true,
  };
  await adminDb.collection("activationCodes").doc(code).set(doc);
}

export async function deleteActivationCode(code: string): Promise<void> {
  await adminDb.collection("activationCodes").doc(code).delete();
}

/**
 * Remplace un code existant par un nouveau, atomiquement.
 * Renvoie le nouveau code.
 */
export async function rotateActivationCode(
  salonId: string,
  oldCode: string | null,
  newCode: string,
): Promise<void> {
  const batch = adminDb.batch();
  if (oldCode) {
    batch.delete(adminDb.collection("activationCodes").doc(oldCode));
  }
  const newDocRef = adminDb.collection("activationCodes").doc(newCode);
  const doc: CodeDoc = {
    salonId,
    createdAt: Date.now(),
    usedAt: 0,
    usedByUid: "",
    oneShot: true,
  };
  batch.set(newDocRef, doc);
  await batch.commit();
}
