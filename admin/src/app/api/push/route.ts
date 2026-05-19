import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { sendPushBatch } from "@/lib/expo-push";

const PushSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(300),
  audience: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("salon-customers"),
      salonId: z.string().min(1),
    }),
    z.object({ kind: z.literal("all-kiosks") }),
    z.object({ kind: z.literal("all-customers") }),
  ]),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PushSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { title, body, audience } = parsed.data;

  // 1) Resolve audience → list of tokens (+ pretty audience name for logs)
  let tokens: string[] = [];
  let audienceLog:
    | { kind: "salon-customers"; salonId: string; salonName: string }
    | { kind: "all-kiosks" }
    | { kind: "all-customers" } = audience as never;

  if (audience.kind === "salon-customers") {
    // Tokens des clients du salon
    const customers = await adminDb
      .collection("customers")
      .where("salonId", "==", audience.salonId)
      .get();
    tokens = customers.docs
      .map((d) => d.get("pushToken") as string | undefined)
      .filter((t): t is string => !!t);

    const salonSnap = await adminDb
      .collection("salons")
      .doc(audience.salonId)
      .get();
    audienceLog = {
      kind: "salon-customers",
      salonId: audience.salonId,
      salonName: (salonSnap.get("name") as string) ?? audience.salonId,
    };
  } else if (audience.kind === "all-kiosks") {
    const salons = await adminDb.collection("salons").get();
    tokens = salons.docs
      .map((d) => d.get("kioskPushToken") as string | undefined)
      .filter((t): t is string => !!t);
  } else if (audience.kind === "all-customers") {
    const customers = await adminDb.collection("customers").get();
    tokens = customers.docs
      .map((d) => d.get("pushToken") as string | undefined)
      .filter((t): t is string => !!t);
  }

  const totalTargets = tokens.length;

  // 2) Send (Expo Push)
  const sendResult = await sendPushBatch(tokens, title, body, {
    source: "trimya-admin",
  });

  // 3) Log the campaign
  await adminDb.collection("adminPushLogs").add({
    sentBy: guard.ctx.uid,
    sentAt: Date.now(),
    audience: audienceLog,
    title,
    body,
    deliveredCount: sendResult.delivered,
    failedCount: sendResult.failed,
    totalTargets,
    errors: sendResult.errors,
  });

  return NextResponse.json({
    ok: true,
    totalTargets,
    delivered: sendResult.delivered,
    failed: sendResult.failed,
    errors: sendResult.errors,
  });
}
