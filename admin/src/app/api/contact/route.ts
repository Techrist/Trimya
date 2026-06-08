import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/contact — Réception d'un formulaire de contact depuis le site
 * marketing trimya.com/contact.
 *
 * Pour ne pas dépendre d'un service email tiers en v1, on persiste les
 * leads dans Firestore (`contactRequests/{id}`) et l'équipe Trimya les
 * traite depuis Trimya Admin. Plus tard on pourra ajouter un envoi email
 * automatique vers contact@trimya.com via Resend ou SendGrid.
 */
const BodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().min(6).max(30),
  role: z.enum(["client", "salon", "owner"]),
  message: z.string().min(10).max(2000),
  salonName: z.string().max(100).optional(),
  city: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const now = Date.now();

  // Rate-limit basique par IP (1 message / 60s par IP). Pour MVP, on stocke
  // en mémoire — pas idéal multi-instance mais Vercel a une seule edge par
  // requête, suffisant pour les premiers mois. À déplacer dans Firestore
  // ou Upstash si volume.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Trop de tentatives, patiente 1 min." },
      { status: 429 },
    );
  }
  markRequest(ip);

  try {
    const ref = adminDb.collection("contactRequests").doc();
    await ref.set({
      id: ref.id,
      ...data,
      ip,
      userAgent: req.headers.get("user-agent") || "",
      status: "new",
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "internal_error";
    console.error("[contact] save failed:", message);
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}

// ─── Mini rate-limiter in-memory ──────────────────────────────
// Note: à remplacer par Upstash/Redis ou Firestore en multi-instance.
const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 1;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const history = requests.get(ip) ?? [];
  const recent = history.filter((t) => now - t < WINDOW_MS);
  return recent.length >= MAX_PER_WINDOW;
}

function markRequest(ip: string): void {
  const now = Date.now();
  const history = requests.get(ip) ?? [];
  const recent = history.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requests.set(ip, recent);
}
