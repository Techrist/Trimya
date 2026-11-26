import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions, withCors } from "@/lib/cors";
import { renderSalonWelcomeEmail, sendBrevoEmail } from "@/lib/brevo";
import { LEGAL_VERSION } from "@/lib/legal";
import { TRIAL_PRO_DAYS, TRIAL_PRO_MS } from "@/lib/plans";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import {
  canonicalPhone,
  cleanText,
  dailyCap,
  dayStamp,
  emailKey,
  isDisposableEmail,
  otpHash,
  phoneKey,
  signupEnabled,
} from "@/lib/salon-signup";
import { buildActivationCode, slugify } from "@/lib/slug";

/**
 * POST /api/salon-signup/create — étape 2 : vérifie le code reçu par email,
 * crée le salon et appaire l'appareil appelant comme kiosque, en une fois.
 *
 * Auth : Bearer ID token Firebase (session anonyme du kiosque).
 *
 * Protections (en plus de celles de /send) :
 *  - consentement CGU Pro obligatoire (date + version enregistrées)
 *  - 3 créations / 24 h / IP, 2 / 24 h / appareil, plafond global quotidien
 *  - code : 5 tentatives max, usage unique, comparaison en temps constant
 *  - 1 salon par email canonique ET par numéro de téléphone (transaction)
 *  - champs texte nettoyés ; données sensibles (email, IP hachée) dans
 *    `salons/{id}/private/data`, jamais sur le doc public du salon
 *  - l'essai Pro n'est accordé qu'une fois par email / téléphone
 */
const Body = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  ownerName: z.string().min(2).max(80),
  phone: z.string().min(8).max(25),
  consent: z.literal(true),
});

const MAX_ATTEMPTS = 5;

function fail(origin: string | null, error: string, status: number, extra = {}) {
  return withCors(NextResponse.json({ error, ...extra }, { status }), origin);
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

class SignupError extends Error {
  constructor(
    public readonly code:
      | "invalid_code"
      | "code_expired"
      | "too_many_attempts"
      | "email_already_registered"
      | "phone_already_registered"
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

  if (!signupEnabled()) return fail(origin, "signup_disabled", 503);

  // ─── 1) Auth (session anonyme du kiosque) ───────────────────
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  if (!match) return fail(origin, "missing_bearer_token", 401);
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1]!)).uid;
  } catch {
    return fail(origin, "invalid_token", 401);
  }

  // ─── 2) Validation ──────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(origin, "invalid_json", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(origin, "invalid_payload", 400);
  const b = parsed.data;

  const email = b.email.trim().toLowerCase();
  if (isDisposableEmail(email)) return fail(origin, "email_not_allowed", 422);

  const name = cleanText(b.name);
  const city = cleanText(b.city);
  const ownerName = cleanText(b.ownerName);
  if (name.length < 2 || city.length < 2 || ownerName.length < 2) {
    return fail(origin, "invalid_payload", 400);
  }
  const phone = canonicalPhone(b.phone);
  if (!phone) return fail(origin, "invalid_phone", 400);

  const eKey = emailKey(email);
  const pKey = phoneKey(phone);
  const ipH = ipHash(clientIp(req));

  try {
    // ─── 3) Limites (avant toute lecture coûteuse) ────────────
    await consumeLimit(`signup-create:ip:${ipH}`, 3, 24 * 60 * 60 * 1000);
    await consumeLimit(`signup-create:uid:${uid}`, 2, 24 * 60 * 60 * 1000);
    await consumeLimit(`signup-create:global:${dayStamp()}`, dailyCap(), 24 * 60 * 60 * 1000);

    // ─── 4) Vérification du code (consomme les tentatives) ────
    const otpRef = adminDb.collection("salonSignupOtps").doc(eKey);
    // Le verdict est RETOURNÉ (pas levé) pour que les écritures de la
    // transaction (compteur de tentatives, suppression) soient bien commitées.
    const verdict = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(otpRef);
      if (!snap.exists) return "invalid_code" as const;
      const d = snap.data() ?? {};
      const attempts = typeof d.attempts === "number" ? d.attempts : 0;

      if (typeof d.expiresAt !== "number" || d.expiresAt < Date.now()) {
        tx.delete(otpRef);
        return "code_expired" as const;
      }
      if (attempts >= MAX_ATTEMPTS) {
        tx.delete(otpRef);
        return "too_many_attempts" as const;
      }
      if (
        typeof d.codeHash !== "string" ||
        !safeEqualHex(d.codeHash, otpHash(eKey, b.code))
      ) {
        tx.update(otpRef, { attempts: attempts + 1 });
        return "invalid_code" as const;
      }
      tx.delete(otpRef); // usage unique
      return "ok" as const;
    });
    if (verdict === "too_many_attempts") throw new SignupError("too_many_attempts", 429);
    if (verdict !== "ok") throw new SignupError(verdict, 400);

    // ─── 5) Création atomique du salon ────────────────────────
    const now = Date.now();
    const baseId = slugify(name) || "salon";
    let created: {
      salonId: string;
      activationCode: string;
      salon: Record<string, unknown>;
    } | null = null;

    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const salonId =
        attempt === 0 ? baseId : `${baseId}-${randomBytes(2).toString("hex")}`;
      const activationCode = buildActivationCode();
      try {
        created = await adminDb.runTransaction(async (tx) => {
          const salonRef = adminDb.collection("salons").doc(salonId);
          const codeRef = adminDb.collection("activationCodes").doc(activationCode);
          const emailRef = adminDb.collection("salonSignups").doc(eKey);
          const phoneRef = adminDb.collection("salonPhones").doc(pKey);
          const [salonSnap, codeSnap, emailSnap, phoneSnap] = await Promise.all([
            tx.get(salonRef),
            tx.get(codeRef),
            tx.get(emailRef),
            tx.get(phoneRef),
          ]);
          if (emailSnap.exists) throw new SignupError("email_already_registered", 409);
          if (phoneSnap.exists) throw new SignupError("phone_already_registered", 409);
          if (salonSnap.exists || codeSnap.exists) throw new SignupError("id_taken", 409);

          const salon = {
            name,
            city,
            ownerName,
            phone: b.phone.trim(),
            activationCode,
            // Appareil appairé d'office : l'inscription remplace la saisie du code.
            activatedAt: now,
            createdAt: now,
            kioskUserIds: [uid],
            plan: "free",
            planActivatedAt: 0,
            planExpiresAt: 0,
            trialEndsAt: now + TRIAL_PRO_MS,
            selfSignup: true,
          };
          tx.set(salonRef, salon);
          // Code de secours : reste utilisable UNE fois (autre appareil).
          tx.set(codeRef, {
            salonId,
            createdAt: now,
            usedAt: 0,
            usedByUid: "",
            oneShot: true,
          });
          tx.set(emailRef, { salonId, createdAt: now });
          tx.set(phoneRef, { salonId, createdAt: now });
          tx.set(salonRef.collection("private").doc("data"), {
            signupEmail: email,
            signupIpHash: ipH,
            consentAt: now,
            consentVersion: LEGAL_VERSION,
            updatedAt: now,
          });
          return { salonId, activationCode, salon };
        });
      } catch (e) {
        if (!(e instanceof SignupError && e.code === "id_taken")) throw e;
      }
    }
    if (!created) throw new Error("id_collisions");

    // Email de bienvenue + code de secours (best-effort).
    const welcome = renderSalonWelcomeEmail({
      salonName: name,
      activationCode: created.activationCode,
      trialDays: TRIAL_PRO_DAYS,
    });
    void sendBrevoEmail({
      to: email,
      subject: "Bienvenue sur Trimya — ton code de secours",
      htmlContent: welcome.html,
      textContent: welcome.text,
      tags: ["salon-welcome"],
    }).catch((e) => logServerError("salon-signup/welcome", e));

    return withCors(
      NextResponse.json({
        ok: true,
        salonId: created.salonId,
        activationCode: created.activationCode,
        salon: { id: created.salonId, ...created.salon },
      }),
      origin,
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return fail(origin, "rate_limited", 429, { retryAfterSeconds: e.retryAfterSeconds });
    }
    if (e instanceof SignupError) return fail(origin, e.code, e.httpStatus);
    logServerError("salon-signup/create", e);
    return fail(origin, "internal_error", 500);
  }
}
