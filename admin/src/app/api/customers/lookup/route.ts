import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { json, requireUid } from "@/lib/http";
import { consumeLimit, RateLimitError } from "@/lib/rate-limit";

/**
 * POST /api/customers/lookup — un kiosque lit la fiche d'un client qu'il
 * vient de scanner, quand ce client n'est encore rattaché à AUCUN salon.
 *
 * Pourquoi : les règles Firestore ne laissent un kiosque lire un client que
 * s'il appartient déjà à son salon. Un nouveau client (salonId vide) n'est
 * donc pas lisible au premier scan. Il sera rattaché définitivement à ce
 * salon à la première coupe enregistrée (POST /api/cuts/add).
 *
 * Sécurité : Bearer = kiosque appairé au salon demandé ; seuls les clients
 * sans salon, ou déjà rattachés à CE salon, sont renvoyés ; champs limités au
 * nécessaire (pas d'email) ; 120 lectures / 10 min / kiosque.
 */
const Body = z.object({
  customerId: z.string().min(1).max(128),
  salonId: z.string().min(1).max(128),
});

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
  const { customerId, salonId } = parsed.data;

  try {
    await consumeLimit(`customer-lookup:${auth.uid}`, 120, 10 * 60 * 1000);

    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    const kiosks = Array.isArray(salonSnap.data()?.kioskUserIds)
      ? (salonSnap.data()!.kioskUserIds as string[])
      : [];
    if (!salonSnap.exists || !kiosks.includes(auth.uid)) {
      return json(origin, { error: "forbidden" }, 403);
    }
    if (Number(salonSnap.data()?.disabledAt ?? 0) > 0) {
      return json(origin, { error: "salon_disabled" }, 403);
    }

    const snap = await adminDb.collection("customers").doc(customerId).get();
    if (!snap.exists) return json(origin, { error: "customer_not_found" }, 404);
    const c = snap.data() ?? {};

    const home = typeof c.salonId === "string" ? c.salonId : "";
    if (home && home !== salonId) return json(origin, { error: "wrong_salon" }, 403);

    return json(origin, {
      ok: true,
      customer: {
        id: snap.id,
        salonId: home,
        name: c.name ?? "",
        lastName: c.lastName ?? "",
        phone: c.phone ?? "",
        photo: c.photo ?? "",
        currentCount: Number(c.currentCount ?? 0),
        totalCuts: Number(c.totalCuts ?? 0),
        totalRewards: Number(c.totalRewards ?? 0),
        vip: c.vip === true,
        createdAt: Number(c.createdAt ?? 0),
        lastVisitAt: Number(c.lastVisitAt ?? 0),
        subscriptionExpiresAt: Number(c.subscriptionExpiresAt ?? 0),
      },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("customers/lookup", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
