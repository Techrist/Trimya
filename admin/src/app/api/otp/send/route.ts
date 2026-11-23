import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions, withCors } from "@/lib/cors";
import { sendBrevoEmail, renderOtpEmail } from "@/lib/brevo";

/**
 * POST /api/otp/send
 *
 * Génère un code OTP 6 chiffres et l'envoie à `email` via Brevo.
 *
 * Firestore `emailOtps/{emailNormalized}` :
 *   {
 *     codeHash: string           // SHA-256 du code (on ne stocke JAMAIS le code en clair)
 *     expiresAt: number          // Date.now() + 5min
 *     createdAt: number
 *     attempts: number           // incrémenté à chaque /verify échoué
 *     role: 'client' | 'owner'   // utilisé par /verify pour router
 *     sends24h: number           // compteur anti-abus
 *     firstSendAt: number        // fenêtre glissante pour sends24h
 *   }
 *
 * Rate-limits appliqués ici :
 *   - max 5 envois toutes les 15 min par email
 *   - cooldown 60s entre deux envois consécutifs
 *
 * On ne révèle JAMAIS au client si l'email existe déjà (anti-énumération).
 * Réponse générique "ok: true" quoi qu'il arrive, sauf rate limit explicite.
 */

const Body = z.object({
  email: z.string().email().max(254),
  role: z.enum(["client", "owner"]).optional().default("client"),
});

const EXPIRY_MS = 5 * 60 * 1000; // 5 min
const COOLDOWN_MS = 60 * 1000; // 60s entre 2 envois
const MAX_SENDS_15MIN = 5;
const WINDOW_15MIN_MS = 15 * 60 * 1000;

function generateCode(): string {
  // Code 6 chiffres cryptographiquement aléatoire — pas Math.random
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n =
    (buf[0]! << 24) | (buf[1]! << 16) | (buf[2]! << 8) | buf[3]!;
  const positive = n >>> 0; // force unsigned
  return (positive % 1_000_000).toString().padStart(6, "0");
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  // ─── 1) Parse & validate ──────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return withCors(
      NextResponse.json({ error: "invalid_json" }, { status: 400 }),
      origin,
    );
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: "invalid_payload" }, { status: 400 }),
      origin,
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;

  // ─── 2) Rate-limit check (transaction) ────────────────────
  const docRef = adminDb.collection("emailOtps").doc(email);

  try {
    const code = generateCode();
    const codeHash = await hashCode(code);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const now = Date.now();
      const prev = snap.exists ? (snap.data() ?? {}) : {};
      const sends24h = (prev.sends24h as number | undefined) ?? 0;
      const firstSendAt =
        (prev.firstSendAt as number | undefined) ?? now;
      const lastSendAt = (prev.createdAt as number | undefined) ?? 0;

      // Cooldown 60s
      if (lastSendAt && now - lastSendAt < COOLDOWN_MS) {
        throw new Error("rate_limited_cooldown");
      }

      // Fenêtre 15 min glissante
      const inWindow = now - firstSendAt < WINDOW_15MIN_MS;
      const nextCount = inWindow ? sends24h + 1 : 1;
      if (inWindow && nextCount > MAX_SENDS_15MIN) {
        throw new Error("rate_limited_window");
      }

      tx.set(docRef, {
        codeHash,
        expiresAt: now + EXPIRY_MS,
        createdAt: now,
        attempts: 0,
        role,
        sends24h: nextCount,
        firstSendAt: inWindow ? firstSendAt : now,
      });
    });

    // ─── 3) Envoi email Brevo (après commit transaction) ───
    // Si l'envoi échoue, on log mais on répond quand même "ok" au client
    // pour ne pas révéler l'état de Brevo (anti-énumération). L'utilisateur
    // demandera un renvoi s'il ne reçoit rien.
    const { html, text } = renderOtpEmail({ code, expiresInMinutes: 5 });
    const result = await sendBrevoEmail({
      to: email,
      subject: "Ton code de connexion Trimya",
      htmlContent: html,
      textContent: text,
      tags: ["otp", role],
    });
    if (!result.ok) {
      logServerError("otp/send/brevo", result.error ?? "unknown");
    }

    return withCors(
      NextResponse.json({ ok: true, expiresInSeconds: EXPIRY_MS / 1000 }),
      origin,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "rate_limited_cooldown") {
      return withCors(
        NextResponse.json(
          { error: "rate_limited", retryAfterSeconds: 60 },
          { status: 429 },
        ),
        origin,
      );
    }
    if (msg === "rate_limited_window") {
      return withCors(
        NextResponse.json(
          { error: "rate_limited", retryAfterSeconds: 900 },
          { status: 429 },
        ),
        origin,
      );
    }
    logServerError("otp/send", e);
    return withCors(
      NextResponse.json({ error: "internal_error" }, { status: 500 }),
      origin,
    );
  }
}
