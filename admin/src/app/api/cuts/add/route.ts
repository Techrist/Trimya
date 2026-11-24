import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerError } from "@/lib/api-errors";
import { handleOptions, withCors } from "@/lib/cors";

/**
 * POST /api/cuts/add
 *
 * Remplace la Cloud Function `addCutSecure` (plan Blaze non activé). Est
 * appelée par les kiosques après un scan QR pour enregistrer une coupe.
 *
 * Sécurité :
 *  - Bearer Firebase ID token obligatoire (le kiosque est authentifié anonyme)
 *  - Le UID doit être présent dans `salons.{salonId}.kioskUserIds`
 *  - Transaction atomique : verrouille customer + crée cut
 *  - Cross-salon shared : autorisé uniquement si même owner + loyaltySharedWithOwner
 *  - Rate-limit léger par salon (60 coupes/min) pour contenir un abus
 */

const Body = z.object({
  customerId: z.string().min(1).max(128),
  salonId: z.string().min(1).max(128),
  barberId: z.string().min(1).max(128).optional(),
  barberName: z.string().min(1).max(200).optional(),
  price: z.number().finite().min(0).max(1_000_000).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function isSubscriptionActive(customer: {
  subscriptionExpiresAt?: number;
}): boolean {
  return (
    typeof customer.subscriptionExpiresAt === "number" &&
    customer.subscriptionExpiresAt > Date.now()
  );
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  // ─── 1) Auth ────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return withCors(
      NextResponse.json({ error: "missing_bearer_token" }, { status: 401 }),
      origin,
    );
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]!);
  } catch {
    return withCors(
      NextResponse.json({ error: "invalid_token" }, { status: 401 }),
      origin,
    );
  }
  const kioskUid = decoded.uid;

  // ─── 2) Parse body ──────────────────────────────────────────
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
  const { customerId, salonId, barberId, barberName, price } = parsed.data;

  // ─── 3) Rate-limit par salon (anti-abus kiosque compromis) ──
  // Compteur in-memory par instance Vercel. Pas parfait (reset au cold
  // start, plusieurs instances → multiplié par N), mais suffisant pour
  // bloquer un bot qui spammerait 10 scans/s.
  try {
    const limiterRef = adminDb.collection("salonRateLimits").doc(salonId);
    const limiterNow = Date.now();
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(limiterRef);
      const prev = snap.exists ? snap.data() ?? {} : {};
      const windowStart = (prev.windowStart as number) ?? 0;
      const count = (prev.count as number) ?? 0;
      if (limiterNow - windowStart < RATE_LIMIT_WINDOW_MS) {
        if (count >= RATE_LIMIT_MAX) {
          throw new Error("rate_limited");
        }
        tx.set(limiterRef, { windowStart, count: count + 1 }, { merge: true });
      } else {
        tx.set(limiterRef, { windowStart: limiterNow, count: 1 });
      }
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "rate_limited") {
      return withCors(
        NextResponse.json(
          { error: "rate_limited", retryAfterSeconds: 60 },
          { status: 429 },
        ),
        origin,
      );
    }
    // Pas critique si le rate-limiter lui-même échoue : on continue.
  }

  // ─── 4) Transaction coupe ───────────────────────────────────
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      // 4a) Kiosque autorisé pour ce salon ?
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonSnap = await tx.get(salonRef);
      if (!salonSnap.exists) throw new Error("salon_not_found");
      const salonData = salonSnap.data() ?? {};
      const kioskUserIds = Array.isArray(salonData.kioskUserIds)
        ? (salonData.kioskUserIds as string[])
        : [];
      if (!kioskUserIds.includes(kioskUid)) {
        throw new Error("forbidden");
      }
      if (salonData.disabledAt && salonData.disabledAt > 0) {
        throw new Error("salon_disabled");
      }

      const customerRef = adminDb.collection("customers").doc(customerId);
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) throw new Error("customer_not_found");
      const customer = customerSnap.data() as {
        currentCount: number;
        totalCuts: number;
        totalRewards: number;
        salonId: string;
        phone: string;
        name?: string;
        subscriptionExpiresAt?: number;
      };

      // 4b) Cross-salon shared ?
      let effectiveSalonId = customer.salonId;
      if (customer.salonId !== salonId) {
        // Autorisé uniquement si même owner + loyaltySharedWithOwner
        const homeSalonSnap = await tx.get(
          adminDb.collection("salons").doc(customer.salonId),
        );
        const homeOwner = homeSalonSnap.exists
          ? (homeSalonSnap.data()?.ownerId as string | undefined)
          : undefined;
        const sharedOk =
          !!salonData.loyaltySharedWithOwner &&
          !!salonData.ownerId &&
          salonData.ownerId === homeOwner;
        if (!sharedOk) throw new Error("wrong_salon");
        // On enregistre la coupe au salon scanneur mais on ne migre pas le
        // customer (contrairement à la migration explicite).
        effectiveSalonId = salonId;
      }

      const salonRewardThreshold =
        (salonData.effectiveRewardThreshold as number | undefined) ??
        (salonData.rewardThreshold as number | undefined) ??
        4;

      const cutRef = adminDb.collection("cuts").doc();
      const now = Date.now();

      // 4c) Abonné illimité → pas de progression fidélité
      if (isSubscriptionActive(customer)) {
        tx.update(customerRef, {
          totalCuts: customer.totalCuts + 1,
          lastVisitAt: now,
        });
        tx.set(cutRef, {
          id: cutRef.id,
          customerId,
          salonId: effectiveSalonId,
          createdAt: now,
          wasReward: false,
          isSubscription: true,
          ...(barberId ? { barberId } : {}),
          ...(barberName ? { barberName } : {}),
          price: 0,
        });
        return {
          ok: true,
          cutId: cutRef.id,
          newCount: customer.currentCount,
          wasReward: false,
          rewardUnlocked: false,
        };
      }

      // 4d) Cas standard fidélité
      const isReward = customer.currentCount >= salonRewardThreshold;
      const newCount = isReward ? 0 : customer.currentCount + 1;
      const rewardUnlocked = !isReward && newCount === salonRewardThreshold;

      tx.update(customerRef, {
        currentCount: newCount,
        totalCuts: customer.totalCuts + 1,
        totalRewards: customer.totalRewards + (isReward ? 1 : 0),
        lastVisitAt: now,
      });
      tx.set(cutRef, {
        id: cutRef.id,
        customerId,
        salonId: effectiveSalonId,
        createdAt: now,
        wasReward: isReward,
        ...(barberId ? { barberId } : {}),
        ...(barberName ? { barberName } : {}),
        price: isReward ? 0 : price ?? 0,
      });

      return {
        ok: true,
        cutId: cutRef.id,
        newCount,
        wasReward: isReward,
        rewardUnlocked,
      };
    });

    return withCors(NextResponse.json(result), origin);
  } catch (e: unknown) {
    logServerError("cuts/add", e);
    const msg = e instanceof Error ? e.message : "";
    const known = [
      "salon_not_found",
      "salon_disabled",
      "forbidden",
      "customer_not_found",
      "wrong_salon",
    ];
    const out = known.includes(msg) ? msg : "internal_error";
    const status =
      out === "forbidden"
        ? 403
        : out === "salon_disabled"
          ? 403
          : out === "salon_not_found" || out === "customer_not_found"
            ? 404
            : out === "wrong_salon"
              ? 400
              : 500;
    return withCors(
      NextResponse.json({ error: out }, { status }),
      origin,
    );
  }
}

// Silence `FieldValue` unused warning from the linter (kept for future
// atomic counter operations if we switch to FieldValue.increment).
void FieldValue;
void DAY_MS;
