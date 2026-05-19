import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Migration one-shot : pour chaque salon existant, crée l'entrée
 * `activationCodes/{code}` correspondante si elle n'existe pas déjà.
 *
 * À appeler UNE FOIS après déploiement des nouvelles règles Firestore.
 * Sécurisé par requireAdmin (token Bearer + doc admins/).
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  const salonsSnap = await adminDb.collection("salons").get();
  const stats = { total: salonsSnap.size, created: 0, skipped: 0, errors: 0 };

  for (const salonDoc of salonsSnap.docs) {
    const salonId = salonDoc.id;
    const code = salonDoc.get("activationCode") as string | undefined;
    if (!code) {
      stats.errors += 1;
      continue;
    }
    try {
      const codeRef = adminDb.collection("activationCodes").doc(code);
      const codeSnap = await codeRef.get();
      if (codeSnap.exists) {
        stats.skipped += 1;
        continue;
      }
      await codeRef.set({
        salonId,
        createdAt:
          (salonDoc.get("createdAt") as number | undefined) ?? Date.now(),
        usedAt: 0,
        usedByUid: "",
        oneShot: true,
      });
      stats.created += 1;
    } catch {
      stats.errors += 1;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
