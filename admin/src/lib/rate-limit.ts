import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminDb } from "./firebase-admin";

/**
 * Limiteur de débit simple, partagé entre instances serverless (Firestore).
 *
 * Collection `rateLimits/{key}` : { count, resetAt }. Fenêtre FIXE : le
 * compteur repart à zéro quand `resetAt` est dépassé. Serveur uniquement
 * (règles Firestore : aucune lecture / écriture client).
 */

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}

/**
 * Consomme 1 unité sur `key`. Lève `RateLimitError` si `max` est dépassé
 * dans la fenêtre `windowMs`.
 */
export async function consumeLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  // L'id de doc ne doit pas contenir de "/" : on hash les clés composées.
  const id = createHash("sha256").update(key).digest("hex").slice(0, 40);
  const ref = adminDb.collection("rateLimits").doc(id);
  const now = Date.now();

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? (snap.data() ?? {}) : {};
    const resetAt = typeof d.resetAt === "number" ? d.resetAt : 0;
    const count = typeof d.count === "number" ? d.count : 0;

    if (resetAt > now) {
      if (count >= max) {
        throw new RateLimitError(Math.max(1, Math.ceil((resetAt - now) / 1000)));
      }
      tx.update(ref, { count: count + 1 });
    } else {
      tx.set(ref, { count: 1, resetAt: now + windowMs, key: key.slice(0, 80) });
    }
  });
}

/**
 * IP du client. Sur Vercel, `x-forwarded-for` est posé par la plateforme
 * (la première valeur est l'IP réelle, non falsifiable par le client).
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Empreinte de l'IP (on ne stocke jamais l'IP en clair). */
export function ipHash(ip: string): string {
  return createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 24);
}
