import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Endpoint utilisé par l'app mobile lors de l'activation d'un kiosque.
 *
 * Sécurité :
 *  - Demande un Firebase ID token (anonyme ou non) → on identifie l'appareil
 *  - Vérifie que le code existe dans `activationCodes/{code}`
 *  - Vérifie que le code n'a pas déjà été consommé (one-shot)
 *  - Inscrit l'UID dans `kioskUserIds` du salon
 *  - Marque le code comme `usedAt + usedByUid` (invalidation)
 *
 * Le code reste dans `activationCodes` (pour audit) mais n'est plus utilisable.
 * Toutes ces opérations sont atomiques (transaction).
 */
const Body = z.object({
  code: z.string().min(4).max(60),
});

export async function POST(req: NextRequest) {
  // 1) Authentifier le device qui appelle (anonymous ou non)
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "missing_bearer_token" },
      { status: 401 },
    );
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]!);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const uid = decoded.uid;

  // 2) Parser le body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload" },
      { status: 400 },
    );
  }
  const code = parsed.data.code.trim().toUpperCase();

  // 3) Transaction : valider le code + appairer le kiosque
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const codeRef = adminDb.collection("activationCodes").doc(code);
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        throw new Error("invalid_code");
      }
      const codeData = codeSnap.data() as {
        salonId: string;
        usedAt: number;
        usedByUid: string;
        oneShot: boolean;
      };

      // Code one-shot déjà consommé ?
      if (codeData.oneShot && codeData.usedAt > 0) {
        throw new Error("code_already_used");
      }

      const salonRef = adminDb.collection("salons").doc(codeData.salonId);
      const salonSnap = await tx.get(salonRef);
      if (!salonSnap.exists) {
        throw new Error("salon_not_found");
      }
      const salonData = salonSnap.data() ?? {};
      if (salonData.disabledAt && salonData.disabledAt > 0) {
        throw new Error("salon_disabled");
      }

      // Marquer le code consommé + appairer
      tx.update(codeRef, {
        usedAt: Date.now(),
        usedByUid: uid,
      });
      tx.update(salonRef, {
        kioskUserIds: FieldValue.arrayUnion(uid),
        activatedAt:
          salonData.activatedAt && salonData.activatedAt > 0
            ? salonData.activatedAt
            : Date.now(),
      });

      return {
        salonId: codeData.salonId,
        salon: { id: codeData.salonId, ...salonData },
      };
    });

    return NextResponse.json({
      ok: true,
      salonId: result.salonId,
      salon: result.salon,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    const status =
      msg === "invalid_code" || msg === "code_already_used"
        ? 400
        : msg === "salon_not_found"
          ? 404
          : msg === "salon_disabled"
            ? 403
            : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
