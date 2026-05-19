import "server-only";
import { adminAuth, adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Crée un owner : compte Firebase Auth (email/password) + doc Firestore.
 * Le mot de passe initial est généré aléatoirement et retourné une fois.
 * L'owner peut ensuite le changer depuis son profil mobile.
 */
export async function createOwner(input: {
  email: string;
  name: string;
  phone?: string;
}): Promise<{ uid: string; tempPassword: string }> {
  const tempPassword = generateTempPassword();

  // 1. Créer le compte Firebase Auth
  const userRecord = await adminAuth.createUser({
    email: input.email,
    password: tempPassword,
    displayName: input.name,
    emailVerified: false,
  });

  // 2. Créer le doc Firestore
  await adminDb.collection("owners").doc(userRecord.uid).set({
    email: input.email,
    name: input.name,
    phone: input.phone ?? null,
    salonIds: [],
    createdAt: Date.now(),
  });

  return { uid: userRecord.uid, tempPassword };
}

export async function assignSalonToOwner(
  ownerId: string,
  salonId: string,
): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const ownerRef = adminDb.collection("owners").doc(ownerId);
    const salonRef = adminDb.collection("salons").doc(salonId);
    const [ownerSnap, salonSnap] = await Promise.all([
      tx.get(ownerRef),
      tx.get(salonRef),
    ]);
    if (!ownerSnap.exists) throw new Error("owner_not_found");
    if (!salonSnap.exists) throw new Error("salon_not_found");

    const existingOwnerId = salonSnap.get("ownerId") as string | undefined;
    if (existingOwnerId && existingOwnerId !== ownerId) {
      throw new Error("salon_already_owned");
    }

    tx.update(salonRef, { ownerId });
    tx.update(ownerRef, { salonIds: FieldValue.arrayUnion(salonId) });
  });
}

export async function removeSalonFromOwner(
  ownerId: string,
  salonId: string,
): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const ownerRef = adminDb.collection("owners").doc(ownerId);
    const salonRef = adminDb.collection("salons").doc(salonId);
    const [ownerSnap, salonSnap] = await Promise.all([
      tx.get(ownerRef),
      tx.get(salonRef),
    ]);
    if (!ownerSnap.exists) throw new Error("owner_not_found");
    if (!salonSnap.exists) throw new Error("salon_not_found");

    // Le salon doit être retiré côté ownerId ET de la liste owner.salonIds
    tx.update(salonRef, { ownerId: FieldValue.delete() });
    tx.update(ownerRef, { salonIds: FieldValue.arrayRemove(salonId) });
  });
}

function generateTempPassword(): string {
  const alphabet =
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz!#$%";
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
