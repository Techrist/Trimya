import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fulfillPayment } from "@/lib/billing";
import { logServerError } from "@/lib/api-errors";
import { sendPaymentReceipt } from "@/lib/billing-notify";
import { verifyPayment, verifyWebhookSignature } from "@/lib/saspay";

/**
 * POST /api/webhooks/saspay — notifications SasPay.
 *
 * Sécurité :
 *  - signature HMAC-SHA256 vérifiée sur le CORPS BRUT + horodatage ≤ 300 s ;
 *  - on ne fait JAMAIS confiance au contenu : `transaction.success` déclenche
 *    un `verify` auprès de SasPay avant d'activer quoi que ce soit ;
 *  - activation idempotente (SasPay peut livrer un événement plusieurs fois).
 *
 * Codes de réponse : 200 = traité/ignoré, 403 = signature invalide,
 * 503 = paiement pas encore enregistré (SasPay réessaie : 30 s, 5 min, …).
 * Pas de CORS : appelé serveur à serveur uniquement.
 */
export const dynamic = "force-dynamic";

interface WebhookBody {
  event?: string;
  data?: { id?: string; status?: string };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const ok = verifyWebhookSignature(
    rawBody,
    req.headers.get("x-webhook-signature"),
    req.headers.get("x-webhook-timestamp"),
  );
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 403 });

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = body.event ?? req.headers.get("x-webhook-event") ?? "";
  const saspayId = typeof body.data?.id === "string" ? body.data.id : "";

  // Événements sans effet sur la facturation (test, settlement, wallet…).
  if (event !== "transaction.success" && event !== "transaction.failed" && event !== "transaction.cancelled") {
    return NextResponse.json({ ok: true, ignored: event || "unknown" });
  }
  if (!saspayId) return NextResponse.json({ ok: true, ignored: "no_id" });

  try {
    const found = await adminDb
      .collection("payments")
      .where("saspayPaymentId", "==", saspayId)
      .limit(1)
      .get();

    if (found.empty) {
      // Course possible : le webhook arrive avant l'écriture de l'id SasPay.
      // Pour un succès on demande une nouvelle livraison ; sinon on classe.
      if (event === "transaction.success") {
        return NextResponse.json({ error: "payment_not_found" }, { status: 503 });
      }
      return NextResponse.json({ ok: true, ignored: "unknown_payment" });
    }

    const doc = found.docs[0]!;
    const pay = doc.data();

    if (event === "transaction.success") {
      if (typeof pay.fulfilledAt === "number" && pay.fulfilledAt > 0) {
        return NextResponse.json({ ok: true, alreadyFulfilled: true });
      }
      // Revérification auprès de SasPay : seul SUCCESS autorise l'activation.
      const v = await verifyPayment(saspayId);
      if (v.status !== "SUCCESS") {
        return NextResponse.json({ ok: true, status: v.status });
      }
      if (v.amount !== null && Math.round(v.amount) < (pay.amount as number)) {
        logServerError("webhook.saspay", new Error(`amount_mismatch payment=${doc.id}`));
        await doc.ref.update({
          status: "REVIEW",
          failureCode: "amount_mismatch",
          updatedAt: Date.now(),
        });
        return NextResponse.json({ ok: true, review: true });
      }
      const r = await fulfillPayment(doc.id, { charged: v.charged });
      if (r.applied) {
        // Reçu : best-effort, n'échoue jamais le webhook.
        void sendPaymentReceipt(doc.id).catch((e) =>
          logServerError("webhook.receipt", e),
        );
      }
      return NextResponse.json({ ok: true, applied: r.applied });
    }

    // transaction.failed / cancelled : on ne dégrade jamais un paiement déjà activé.
    if (!(typeof pay.fulfilledAt === "number" && pay.fulfilledAt > 0)) {
      await doc.ref.update({
        status: "FAILED",
        failureCode: event === "transaction.cancelled" ? "cancelled" : "payment_failed",
        updatedAt: Date.now(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    logServerError("webhook.saspay", e);
    // 5xx → SasPay réessaie (jusqu'à 5 fois).
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
