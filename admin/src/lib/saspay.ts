import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Client SasPay (encaissement mobile money) — serveur uniquement.
 *
 * Spécification : https://api.saspay.me/api/v1 (OpenAPI) — on n'utilise QUE
 * les routes présentes dans la spec :
 *   - POST /payments/softpay/            (push mobile money)
 *   - GET  /payments/{id}/verify/        (statut réel)
 *   - POST /payments/{id}/confirm-otp/   (réseaux qui demandent un OTP)
 *
 * Variables d'environnement (jamais dans le dépôt) :
 *   SASPAY_API_KEY         sk_test_... (sandbox) ou sk_live_... (prod)
 *   SASPAY_WEBHOOK_SECRET  signing_secret du webhook (affiché une seule fois)
 *   SASPAY_API_BASE        optionnel. Sandbox : https://sandbox-api.saspay.me/api/v1
 *                          Défaut (prod)     : https://api.saspay.me/api/v1
 *
 * ⚠️ Une clé sk_test_ envoyée sur l'URL de production traite de l'argent réel :
 * c'est l'URL de base qui décide sandbox vs prod, pas le préfixe de la clé.
 */

const DEFAULT_BASE = "https://api.saspay.me/api/v1";

export type SasPayNetwork = "mtn_cm" | "orange_cm";
export const SASPAY_NETWORKS: SasPayNetwork[] = ["mtn_cm", "orange_cm"];

export type SasPayStatus = "PENDING" | "SUCCESS" | "FAILED" | string;

export class SasPayError extends Error {
  constructor(
    /** Statut HTTP renvoyé par SasPay (0 = réseau / config). */
    public readonly status: number,
    /** Code métier SasPay (ex. `insufficient_balance`) ou code interne. */
    public readonly code: string,
  ) {
    super(`saspay_${status}_${code}`);
    this.name = "SasPayError";
  }
}

function baseUrl(): string {
  return (process.env.SASPAY_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
}

function apiKey(): string {
  const key = process.env.SASPAY_API_KEY;
  if (!key) throw new SasPayError(0, "saspay_not_configured");
  return key;
}

/** Les réponses sont soit enveloppées `{success, data}`, soit directes. */
function unwrap(json: unknown): Record<string, unknown> {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (o.data && typeof o.data === "object") {
      return o.data as Record<string, unknown>;
    }
    return o;
  }
  return {};
}

/** Extrait un code d'erreur sûr (enveloppe d'erreur ou erreur de validation). */
function extractErrorCode(json: unknown): string {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === "object") {
      const code = (err as { code?: unknown }).code;
      if (typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)) return code;
    }
    if (typeof o.code === "string" && /^[a-z0-9_]{1,64}$/.test(o.code)) {
      return o.code;
    }
  }
  return "saspay_error";
}

async function request(
  method: "GET" | "POST",
  path: string,
  opts: { body?: unknown; idempotencyKey?: string } = {},
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SasPayError(0, "network_error");
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new SasPayError(res.status, extractErrorCode(json));
  }
  return unwrap(json);
}

// ─── Montants ────────────────────────────────────────────────

/** Montant entier (FCFA) → chaîne décimale exigée par l'API : 10000 → "10000.00". */
export function toDecimalString(amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }
  return `${amount}.00`;
}

// ─── Encaissement ────────────────────────────────────────────

export interface SoftpayInput {
  amount: number;
  network: SasPayNetwork;
  description: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  metadata?: Record<string, string>;
  /** UNE clé par intention, réutilisée à l'identique pour chaque retry. */
  idempotencyKey: string;
}

export interface SoftpayResult {
  id: string;
  status: SasPayStatus;
  /** Non vide → il faut rediriger le client vers cette URL. */
  checkoutUrl: string;
}

export async function createSoftpay(input: SoftpayInput): Promise<SoftpayResult> {
  const d = await request("POST", "/payments/softpay/", {
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: toDecimalString(input.amount),
      currency: "XAF",
      country: "CM",
      network: input.network,
      description: input.description,
      // Le CLIENT paie les frais en plus du prix du plan (décision produit).
      fee_charge_mode: "ADD_ON",
      customer: input.customer,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
  const id = typeof d.id === "string" ? d.id : "";
  if (!id) throw new SasPayError(0, "invalid_response");
  return {
    id,
    status: typeof d.status === "string" ? d.status : "PENDING",
    checkoutUrl: typeof d.checkout_url === "string" ? d.checkout_url : "",
  };
}

export interface VerifyResult {
  status: SasPayStatus;
  /** Montant du prix (hors frais) si renvoyé par SasPay. */
  amount: number | null;
  currency: string | null;
  /** Ce que le payeur a réellement débité (frais inclus). */
  charged: number | null;
  netAmount: number | null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Source de vérité du statut — jamais le retour de redirection ni un délai. */
export async function verifyPayment(paymentId: string): Promise<VerifyResult> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(paymentId)) {
    throw new SasPayError(0, "invalid_payment_id");
  }
  const d = await request(
    "GET",
    `/payments/${encodeURIComponent(paymentId)}/verify/`,
  );
  return {
    status: typeof d.status === "string" ? d.status : "PENDING",
    amount: toNumber(d.amount),
    currency: typeof d.currency === "string" ? d.currency : null,
    charged: toNumber(d.charged),
    netAmount: toNumber(d.net_amount),
  };
}

export async function confirmOtp(paymentId: string, otp: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(paymentId)) {
    throw new SasPayError(0, "invalid_payment_id");
  }
  await request("POST", `/payments/${encodeURIComponent(paymentId)}/confirm-otp/`, {
    body: { otp },
  });
}

// ─── Webhooks ────────────────────────────────────────────────

const WEBHOOK_MAX_AGE_S = 300;

/**
 * Vérifie un webhook SasPay :
 *  1. horodatage à moins de 300 s de l'horloge serveur ;
 *  2. HMAC-SHA256 hex de `${timestamp}.${corps brut}` avec le signing_secret,
 *     comparé en temps constant.
 * `rawBody` DOIT être le corps brut reçu (jamais re-sérialisé).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  if (!/^\d{9,13}$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  if (Math.abs(Date.now() / 1000 - ts) > WEBHOOK_MAX_AGE_S) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
