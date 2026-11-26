import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-server";
import { logServerError } from "@/lib/api-errors";
import { AccountError, approveAccount } from "@/lib/accounts";
import { cleanPhone, cleanText, emailKey } from "@/lib/account-utils";

/**
 * POST /api/requests — l'admin CONVERTIT un compte existant (typiquement un
 * compte client) en compte salon ou propriétaire, à la demande de la personne
 * (email au support). Le compte Firebase, son email et son mot de passe ne
 * changent pas : la personne se connecte à l'app Pro comme d'habitude.
 *
 * La demande est créée puis validée dans la foulée (essai de 14 jours inclus).
 * Après conversion, ce compte n'ouvre plus l'app Client (1 email = 1 rôle) ;
 * sa fiche client reste conservée.
 */
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("salon"),
    email: z.string().email().max(254),
    name: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    ownerName: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
  }),
  z.object({
    type: z.literal("owner"),
    email: z.string().email().max(254),
    name: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
    companyName: z.string().max(80).optional(),
    salonCount: z.number().int().min(1).max(50).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("res" in guard) return guard.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const b = parsed.data;

  const email = b.email.trim().toLowerCase();
  const phone = cleanPhone(b.phone);
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  try {
    let uid: string;
    try {
      const user = await adminAuth.getUserByEmail(email);
      if (user.disabled) return NextResponse.json({ error: "account_disabled" }, { status: 409 });
      uid = user.uid;
    } catch (e) {
      if ((e as { code?: string })?.code === "auth/user-not-found") {
        return NextResponse.json({ error: "user_not_found" }, { status: 404 });
      }
      throw e;
    }

    const [acc, owner, dup] = await Promise.all([
      adminDb.collection("accounts").doc(uid).get(),
      adminDb.collection("owners").doc(uid).get(),
      adminDb.collection("accounts").where("emailKey", "==", emailKey(email)).limit(1).get(),
    ]);
    if (acc.exists || owner.exists || !dup.empty) {
      return NextResponse.json({ error: "already_has_pro_account" }, { status: 409 });
    }

    const now = Date.now();
    const profile =
      b.type === "salon"
        ? {
            name: cleanText(b.name),
            city: cleanText(b.city),
            ownerName: cleanText(b.ownerName),
            phone,
          }
        : {
            name: cleanText(b.name),
            phone,
            ...(b.companyName ? { companyName: cleanText(b.companyName) } : {}),
            ...(b.salonCount ? { salonCount: b.salonCount } : {}),
          };

    await adminDb.collection("accounts").doc(uid).set({
      type: b.type,
      status: "pending",
      email,
      emailKey: emailKey(email),
      profile,
      convertedFromClient: true,
      convertedBy: guard.ctx.uid,
      createdAt: now,
      updatedAt: now,
    });

    const r = await approveAccount(uid, guard.ctx.uid);
    return NextResponse.json({ ok: true, uid, ...r });
  } catch (e) {
    if (e instanceof AccountError) {
      return NextResponse.json({ error: e.code }, { status: e.httpStatus });
    }
    logServerError("requests.convert", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
