import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  assertCanPay,
  BillingError,
  fulfillPayment,
  type TargetType,
} from "@/lib/billing";
import { billingErrorResponse, json, requireUid } from "@/lib/billing-http";
import { handleOptions } from "@/lib/cors";
import { logServerError } from "@/lib/api-errors";
import { verifyPayment } from "@/lib/saspay";
import { sendPaymentReceipt } from "@/lib/billing-notify";

/**
 * GET /api/billing/status/{id} — suivi d'un paiement par l'app (polling).
 *
 * Le statut vient TOUJOURS de SasPay (`verify`), jamais du client. Si SasPay
 * répond SUCCESS, on active le plan (idempotent) : le webhook sert de filet
 * principal, ce chemin garantit l'activation même s'il est en retard.
 */
export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get("origin");
  const auth = await requireUid(req, origin);
  if ("res" in auth) return auth.res;
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return json(origin, { error: "not_found" }, 404);
  }

  try {
    const ref = adminDb.collection("payments").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new BillingError("not_found", 404);
    const pay = snap.data() ?? {};

    // Même contrôle d'accès qu'au paiement : on ne lit que SES paiements.
    await assertCanPay(auth.uid, pay.targetType as TargetType, pay.targetId as string);

    const view = (status: string, fulfilled: boolean, expiresAt: number) =>
      json(origin, {
        ok: true,
        paymentId: id,
        status,
        fulfilled,
        planId: pay.planId,
        expiresAt,
        checkoutUrl: typeof pay.checkoutUrl === "string" ? pay.checkoutUrl : "",
        failureCode: typeof pay.failureCode === "string" ? pay.failureCode : null,
      });

    if (typeof pay.fulfilledAt === "number" && pay.fulfilledAt > 0) {
      return view("SUCCESS", true, Number(pay.resultingExpiresAt) || 0);
    }
    if (pay.status === "FAILED") return view("FAILED", false, 0);
    if (!pay.saspayPaymentId) return view("PENDING", false, 0);

    const v = await verifyPayment(pay.saspayPaymentId as string);

    if (v.status === "SUCCESS") {
      // Garde-fou : jamais d'activation si le montant payé est INFÉRIEUR au
      // devis serveur (les frais ADD_ON peuvent le rendre supérieur).
      if (v.amount !== null && Math.round(v.amount) < (pay.amount as number)) {
        logServerError("billing.status", new Error(`amount_mismatch payment=${id}`));
        await ref.update({ status: "REVIEW", failureCode: "amount_mismatch", updatedAt: Date.now() });
        return view("REVIEW", false, 0);
      }
      const r = await fulfillPayment(id, { charged: v.charged });
      if (r.applied) {
        void sendPaymentReceipt(id).catch((e) => logServerError("billing.receipt", e));
      }
      return view("SUCCESS", true, r.expiresAt);
    }
    if (v.status === "FAILED") {
      await ref.update({ status: "FAILED", failureCode: "payment_failed", updatedAt: Date.now() });
      return view("FAILED", false, 0);
    }
    return view("PENDING", false, 0);
  } catch (e) {
    logServerError("billing.status", e);
    return billingErrorResponse(origin, e);
  }
}
