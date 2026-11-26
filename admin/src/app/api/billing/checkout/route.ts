import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { assertCanPay, computeQuote } from "@/lib/billing";
import { billingErrorResponse, json, requireUid } from "@/lib/billing-http";
import { handleOptions } from "@/lib/cors";
import { logServerError } from "@/lib/api-errors";
import { PLANS } from "@/lib/plans";
import { createSoftpay, SasPayError, SASPAY_NETWORKS } from "@/lib/saspay";

/**
 * POST /api/billing/checkout — démarre un paiement SasPay (softpay).
 *
 *  1. Authentifie l'appelant (kiosque du salon ou owner).
 *  2. Recalcule le prix CÔTÉ SERVEUR (le client n'envoie jamais de montant).
 *  3. Crée `payments/{id}` puis appelle SasPay avec `Idempotency-Key = id`.
 *  4. Renvoie `paymentId` : l'app suit ensuite GET /api/billing/status/{id}.
 *
 * Aucun plan n'est activé ici : seul `SUCCESS` (verify) déclenche l'activation.
 */
const Body = z.object({
  targetType: z.enum(["salon", "owner"]),
  targetId: z.string().min(1).max(128),
  planId: z.enum(["standard", "pro", "enterprise_standard", "enterprise"]),
  period: z.enum(["monthly", "yearly"]),
  network: z.enum(SASPAY_NETWORKS as [string, ...string[]]),
  phone: z.string().min(8).max(20),
});

/** Réutilise une tentative encore fraîche (évite les doubles débits sur retry). */
const REUSE_WINDOW_MS = 5 * 60 * 1000;

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Client", last: "Trimya" };
  if (parts.length === 1) return { first: parts[0]!.slice(0, 60), last: "Trimya" };
  return {
    first: parts[0]!.slice(0, 60),
    last: parts.slice(1).join(" ").slice(0, 60),
  };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const auth = await requireUid(req, origin);
  if ("res" in auth) return auth.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);
  const b = parsed.data;
  const phone = normalizePhone(b.phone);
  if (!phone) return json(origin, { error: "invalid_phone" }, 400);

  try {
    const target = await assertCanPay(auth.uid, b.targetType, b.targetId);
    const quote = computeQuote(b.targetType, b.targetId, target, b.planId, b.period);

    const targetKey = `${b.targetType}:${b.targetId}`;
    const payments = adminDb.collection("payments");

    // Retry rapide de la même intention → on rejoue le MÊME appel SasPay
    // (même Idempotency-Key) au lieu de créer un second paiement.
    const existing = await payments.where("targetKey", "==", targetKey).get();
    const now = Date.now();
    const reusable = existing.docs.find((d) => {
      const p = d.data();
      return (
        (p.status === "INITIATING" || p.status === "PENDING") &&
        !p.fulfilledAt &&
        p.planId === b.planId &&
        p.period === b.period &&
        p.phone === phone &&
        p.network === b.network &&
        p.amount === quote.amount &&
        typeof p.createdAt === "number" &&
        now - p.createdAt < REUSE_WINDOW_MS
      );
    });

    const paymentId = reusable?.id ?? randomUUID();
    const payRef = payments.doc(paymentId);
    if (!reusable) {
      await payRef.set({
        targetKey,
        targetType: b.targetType,
        targetId: b.targetId,
        uid: auth.uid,
        planId: b.planId,
        period: b.period,
        kind: quote.kind,
        listPrice: quote.listPrice,
        credit: quote.credit,
        amount: quote.amount,
        currency: quote.currency,
        network: b.network,
        phone,
        status: "INITIATING",
        saspayPaymentId: "",
        fulfilledAt: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Identité du payeur exigée par SasPay.
    const ownerName =
      typeof target.ownerName === "string" && target.ownerName
        ? target.ownerName
        : typeof target.name === "string"
          ? target.name
          : "";
    const { first, last } = splitName(ownerName);
    const email =
      typeof target.email === "string" && target.email.includes("@")
        ? target.email
        : "billing@trimya.app";

    let result;
    try {
      result = await createSoftpay({
        amount: quote.amount,
        network: b.network as "mtn_cm" | "orange_cm",
        description: `Trimya ${PLANS[b.planId].label} (${b.period === "yearly" ? "1 an" : "1 mois"})`,
        customer: { email, first_name: first, last_name: last, phone },
        metadata: {
          trimyaPaymentId: paymentId,
          targetType: b.targetType,
          targetId: b.targetId,
          planId: b.planId,
        },
        idempotencyKey: paymentId,
      });
    } catch (e) {
      // Rejet franc (4xx) : tentative terminée. Erreur réseau/5xx : on laisse
      // INITIATING, un retry dans la fenêtre réutilisera la même clé.
      if (e instanceof SasPayError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        await payRef.update({
          status: "FAILED",
          failureCode: e.code,
          updatedAt: Date.now(),
        });
      }
      throw e;
    }

    await payRef.update({
      saspayPaymentId: result.id,
      status: result.status === "SUCCESS" ? "PENDING" : result.status,
      checkoutUrl: result.checkoutUrl,
      updatedAt: Date.now(),
    });

    return json(origin, {
      ok: true,
      paymentId,
      status: "PENDING",
      // Non vide → l'app DOIT ouvrir cette URL, sinon aucun paiement n'a lieu.
      checkoutUrl: result.checkoutUrl,
      quote,
    });
  } catch (e) {
    logServerError("billing.checkout", e);
    return billingErrorResponse(origin, e);
  }
}
