import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { renderInfoEmail, sendBrevoEmail } from "@/lib/brevo";
import { consumeProof } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { LEGAL_VERSION } from "@/lib/legal";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import {
  adminNotifyEmail,
  cleanPhone,
  cleanText,
  dailyCap,
  dayStamp,
  emailKey,
  isDisposableEmail,
  passwordSchema,
  signupEnabled,
} from "@/lib/account-utils";

/**
 * POST /api/auth/signup/create — étape finale : exige la preuve d'email (voir
 * /signup/verify), crée le compte
 * Firebase (email + mot de passe, email vérifié) et enregistre une DEMANDE
 * `accounts/{uid}` au statut "pending".
 *
 * Aucun salon / propriétaire n'est créé ici et le compte n'a accès à rien :
 * c'est l'admin qui valide (PATCH /api/requests/{uid}).
 *
 * Protections : consentement CGU Pro obligatoire, 3 demandes / 24 h / IP,
 * plafond global quotidien, code à 5 essais et usage unique, mot de passe
 * robuste, textes nettoyés. Le mot de passe n'est jamais stocké ni loggé
 * par nos soins (transmis à Firebase Auth uniquement).
 */
const Profile = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("salon"),
    name: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    ownerName: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
  }),
  z.object({
    type: z.literal("owner"),
    name: z.string().min(2).max(80),
    phone: z.string().min(8).max(25),
    /** Nombre de salons de la chaîne (indicatif, aide à la validation). */
    salonCount: z.number().int().min(1).max(50).optional(),
    companyName: z.string().max(80).optional(),
  }),
]);

const Body = z.object({
  email: z.string().email().max(254),
  /** Preuve délivrée par /signup/verify après un code valide. */
  proof: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema,
  consent: z.literal(true),
  profile: Profile,
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (!signupEnabled()) return json(origin, { error: "signup_disabled" }, 503);

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
  if (isDisposableEmail(email)) return json(origin, { error: "email_not_allowed" }, 422);
  const phone = cleanPhone(b.profile.phone);
  if (!phone) return json(origin, { error: "invalid_phone" }, 400);

  const ipH = ipHash(clientIp(req));

  try {
    await consumeLimit(`signup-create:ip:${ipH}`, 3, 24 * 60 * 60 * 1000);
    await consumeLimit(`signup-create:global:${dayStamp()}`, dailyCap(), 24 * 60 * 60 * 1000);

    // Doublon (alias) : un autre compte / demande avec le même email canonique.
    const key = emailKey(email);
    const dup = await adminDb.collection("accounts").where("emailKey", "==", key).limit(1).get();
    if (!dup.empty) return json(origin, { error: "email_already_registered" }, 409);

    // Email vérifié ? La preuve est consommée ici (usage unique), après toutes
    // les validations qui ne dépendent pas d'elle.
    if (!(await consumeProof(email, b.proof))) {
      return json(origin, { error: "verification_required" }, 400);
    }

    // Compte Firebase : création, ou ajout d'un mot de passe à un compte
    // « client » existant (le code vient de prouver que l'email est le sien).
    const displayName = cleanText(b.profile.type === "salon" ? b.profile.ownerName : b.profile.name);
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      if (existing.disabled) return json(origin, { error: "email_already_registered" }, 409);
      const owner = await adminDb.collection("owners").doc(existing.uid).get();
      const hasPassword = existing.providerData.some((p) => p.providerId === "password");
      if (owner.exists || hasPassword) {
        return json(origin, { error: "email_already_registered" }, 409);
      }
      await adminAuth.updateUser(existing.uid, {
        password: b.password,
        emailVerified: true,
        displayName,
      });
      uid = existing.uid;
    } catch (e) {
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
      const created = await adminAuth.createUser({
        email,
        password: b.password,
        emailVerified: true,
        displayName,
      });
      uid = created.uid;
    }

    const now = Date.now();
    const profile =
      b.profile.type === "salon"
        ? {
            name: cleanText(b.profile.name),
            city: cleanText(b.profile.city),
            ownerName: cleanText(b.profile.ownerName),
            phone,
          }
        : {
            name: cleanText(b.profile.name),
            phone,
            ...(b.profile.salonCount ? { salonCount: b.profile.salonCount } : {}),
            ...(b.profile.companyName ? { companyName: cleanText(b.profile.companyName) } : {}),
          };

    await adminDb.collection("accounts").doc(uid).set({
      type: b.profile.type,
      status: "pending",
      email,
      emailKey: key,
      profile,
      consentAt: now,
      consentVersion: LEGAL_VERSION,
      ipHash: ipH,
      createdAt: now,
      updatedAt: now,
    });

    // Alerte admin (best-effort) : une demande attend ta validation.
    const label = b.profile.type === "salon" ? "Salon" : "Propriétaire";
    const mail = renderInfoEmail({
      title: `Nouvelle demande de compte — ${label}`,
      paragraphs: [
        `${profile.name} (${email}, ${phone}) demande un compte ${label.toLowerCase()}.`,
        "Ouvre l'admin Trimya, page « Demandes », pour la valider ou la refuser.",
      ],
    });
    void sendBrevoEmail({
      to: adminNotifyEmail(),
      subject: `Trimya — demande de compte ${label.toLowerCase()} à valider`,
      htmlContent: mail.html,
      textContent: mail.text,
      tags: ["account-request"],
    }).catch((e) => logServerError("auth/signup/create/notify", e));

    return json(origin, { ok: true, status: "pending" });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/signup/create", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}

