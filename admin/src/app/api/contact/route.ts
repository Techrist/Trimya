import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { classifyError, logServerError } from "@/lib/api-errors";

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
      { error: "rate_limited" },
      { status: 429 },
    );
  }
  markRequest(ip);

  // RGPD — On ne stocke PAS l'IP brute (donnée personnelle au sens
  // RGPD art. 4.1) ni le user-agent complet (peut contenir des
  // identifiants device). On garde uniquement un hash salé de l'IP
  // pour le rate-limit anti-spam / la détection d'abus. Le hash est
  // irréversible côté admin et n'est conservé que 30 jours via une
  // purge programmée (à brancher si volume).
  const ipHash = hashIp(ip);

  try {
    const ref = adminDb.collection("contactRequests").doc();
    await ref.set({
      id: ref.id,
      ...data,
      ipHash,
      status: "new",
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    logServerError("contact.save", e);
    return NextResponse.json(
      { error: classifyError(e) },
      { status: 500 },
    );
  }
}

/**
 * Hash SHA-256 salé de l'IP. Le salt est l'identifiant projet (constant
 * mais imprévisible pour un attaquant externe), ce qui rend impossible
 * une rainbow table générique sur les IPs IPv4 publiques. L'IP brute
 * elle-même n'est jamais persistée.
 */
function hashIp(ip: string): string {
  const salt = process.env.CONTACT_IP_SALT ?? "trimya-default-salt-change-me";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
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
