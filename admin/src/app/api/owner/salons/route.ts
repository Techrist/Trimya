import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { renderInfoEmail, sendBrevoEmail } from "@/lib/brevo";
import { json, requireUid } from "@/lib/http";
import { consumeLimit, RateLimitError } from "@/lib/rate-limit";
import {
  cleanPhone,
  cleanText,
  emailKey,
  passwordSchema,
} from "@/lib/account-utils";
import { PLANS, getInheritedSalonPlan, type OwnerPlanId } from "@/lib/plans";
import { buildActivationCode, slugify } from "@/lib/slug";

/**
 * POST /api/owner/salons — un propriétaire (validé) crée un salon de sa
 * chaîne ET les identifiants avec lesquels ce salon se connectera
 * (email + mot de passe choisis par le propriétaire).
 *
 * Conditions : compte propriétaire actif, plan Entreprise actif ou essai en
 * cours, moins de 5 salons. Le salon hérite aussitôt du plan de la chaîne
 * (ou de l'essai). Le mot de passe n'est jamais stocké ni envoyé par email :
 * le propriétaire le communique lui-même, et peut le réinitialiser ensuite.
 */
const Body = z.object({
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  phone: z.string().max(25).optional(),
  email: z.string().email().max(254),
  password: passwordSchema,
});

class OwnerSalonError extends Error {
  constructor(
    public readonly code:
      | "not_an_owner"
      | "owner_disabled"
      | "no_enterprise_plan"
      | "salon_limit_reached"
      | "email_already_registered"
      | "id_taken",
    public readonly httpStatus: number,
  ) {
    super(code);
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const auth = await requireUid(req, origin);
  if ("res" in auth) return auth.res;
  const ownerUid = auth.uid;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(origin, { error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return json(origin, { error: weak ? "weak_password" : "invalid_payload" }, 400);
  }
  const b = parsed.data;
  const email = b.email.trim().toLowerCase();
  const name = cleanText(b.name);
  const city = cleanText(b.city);
  if (name.length < 2 || city.length < 2) return json(origin, { error: "invalid_payload" }, 400);
  const phone = b.phone ? cleanPhone(b.phone) : "";
  if (b.phone && !phone) return json(origin, { error: "invalid_phone" }, 400);

  let createdUid: string | null = null;
  try {
    await consumeLimit(`owner-salon:${ownerUid}`, 10, 24 * 60 * 60 * 1000);

    // Pré-contrôles lisibles (la transaction re-vérifie l'essentiel).
    const ownerRef = adminDb.collection("owners").doc(ownerUid);
    const pre = await ownerRef.get();
    if (!pre.exists) throw new OwnerSalonError("not_an_owner", 403);

    const dup = await adminDb
      .collection("accounts")
      .where("emailKey", "==", emailKey(email))
      .limit(1)
      .get();
    if (!dup.empty) throw new OwnerSalonError("email_already_registered", 409);
    try {
      await adminAuth.getUserByEmail(email);
      throw new OwnerSalonError("email_already_registered", 409);
    } catch (e) {
      if (e instanceof OwnerSalonError) throw e;
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
    }

    // Compte de connexion du salon (email non vérifié : l'email est fourni
    // par le propriétaire, la réinitialisation par code le confirmera).
    const user = await adminAuth.createUser({
      email,
      password: b.password,
      emailVerified: false,
      displayName: name,
    });
    createdUid = user.uid;
    const salonUid = user.uid;

    const baseId = slugify(name) || "salon";
    let result: { salonId: string } | null = null;

    for (let attempt = 0; attempt < 4 && !result; attempt++) {
      const salonId = attempt === 0 ? baseId : `${baseId}-${randomBytes(2).toString("hex")}`;
      const code = buildActivationCode();
      try {
        result = await adminDb.runTransaction(async (tx) => {
          const salonRef = adminDb.collection("salons").doc(salonId);
          const codeRef = adminDb.collection("activationCodes").doc(code);
          const [ownerSnap, salonSnap, codeSnap] = await Promise.all([
            tx.get(ownerRef),
            tx.get(salonRef),
            tx.get(codeRef),
          ]);
          if (!ownerSnap.exists) throw new OwnerSalonError("not_an_owner", 403);
          const o = ownerSnap.data() ?? {};
          if (typeof o.disabledAt === "number" && o.disabledAt > 0) {
            throw new OwnerSalonError("owner_disabled", 403);
          }
          const now = Date.now();
          const planActive =
            (o.plan === "enterprise" || o.plan === "enterprise_standard") &&
            (!o.planExpiresAt || o.planExpiresAt === 0 || o.planExpiresAt > now);
          const trialEndsAt = typeof o.trialEndsAt === "number" ? o.trialEndsAt : 0;
          const trialActive = trialEndsAt > now;
          if (!planActive && !trialActive) throw new OwnerSalonError("no_enterprise_plan", 422);

          const salonIds = Array.isArray(o.salonIds) ? (o.salonIds as string[]) : [];
          const max = PLANS.enterprise.limits.maxSalons ?? 5;
          if (salonIds.length >= max) throw new OwnerSalonError("salon_limit_reached", 422);
          if (salonSnap.exists || codeSnap.exists) throw new OwnerSalonError("id_taken", 409);

          tx.set(salonRef, {
            name,
            city,
            ownerName: typeof o.name === "string" ? o.name : "",
            phone: phone ?? "",
            activationCode: code,
            activatedAt: now,
            createdAt: now,
            kioskUserIds: [salonUid],
            ownerId: ownerUid,
            plan: "free",
            planActivatedAt: 0,
            planExpiresAt: 0,
            // Plan de la chaîne si actif, sinon l'essai de l'owner.
            trialEndsAt: planActive ? 0 : trialEndsAt,
            ...(planActive
              ? { inheritedPlan: getInheritedSalonPlan(o.plan as OwnerPlanId) }
              : {}),
          });
          tx.set(codeRef, { salonId, createdAt: now, usedAt: 0, usedByUid: "", oneShot: true });
          tx.set(adminDb.collection("accounts").doc(salonUid), {
            type: "salon",
            status: "active",
            email,
            emailKey: emailKey(email),
            salonId,
            createdByOwnerId: ownerUid,
            profile: { name, city, phone: phone ?? "" },
            createdAt: now,
            approvedAt: now,
            updatedAt: now,
          });
          tx.update(ownerRef, { salonIds: FieldValue.arrayUnion(salonId) });
          return { salonId };
        });
      } catch (e) {
        if (!(e instanceof OwnerSalonError && e.code === "id_taken")) throw e;
      }
    }
    if (!result) throw new Error("id_collisions");

    const ownerName = (pre.data()?.name as string | undefined) ?? "Ton responsable";
    const mail = renderInfoEmail({
      title: `Ton accès Trimya Pro — ${name}`,
      paragraphs: [
        `${ownerName} a créé l'accès Trimya Pro de ton salon « ${name} ».`,
        "Connecte-toi à l'app avec cet email et le mot de passe qu'il t'a communiqué. Tu peux le changer à tout moment avec « Mot de passe oublié ».",
      ],
    });
    void sendBrevoEmail({
      to: email,
      subject: `Trimya — accès de ${name}`,
      htmlContent: mail.html,
      textContent: mail.text,
      tags: ["owner-salon-access"],
    }).catch((e) => logServerError("owner/salons/mail", e));

    return json(origin, { ok: true, salonId: result.salonId });
  } catch (e) {
    // Rollback : pas de compte de connexion orphelin.
    if (createdUid) await adminAuth.deleteUser(createdUid).catch(() => undefined);
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    if (e instanceof OwnerSalonError) return json(origin, { error: e.code }, e.httpStatus);
    logServerError("owner/salons", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
