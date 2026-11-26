import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { renderInfoEmail, sendBrevoEmail } from "./brevo";
import { cleanText } from "./account-utils";
import { TRIAL_PRO_DAYS, TRIAL_PRO_MS } from "./plans";
import { buildActivationCode, slugify } from "./slug";

/**
 * Comptes Trimya Pro : `accounts/{uid}` (uid = Firebase Auth).
 *
 *   type    : "salon" | "owner"
 *   status  : "pending" (en attente de validation) | "active" | "rejected"
 *   salonId : renseigné quand un compte salon est actif
 *   profile : infos saisies à l'inscription
 *
 * Serveur uniquement en écriture. Lecture : l'intéressé (son propre doc)
 * et l'admin (règles Firestore).
 */

export class AccountError extends Error {
  constructor(
    public readonly code: "account_not_found" | "already_active" | "invalid_state" | "id_taken",
    public readonly httpStatus: number,
  ) {
    super(code);
    this.name = "AccountError";
  }
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Valide une demande : crée le salon (essai Pro de 14 jours) ou le compte
 * propriétaire (essai Entreprise Pro de 14 jours), appaire le compte, puis
 * prévient la personne par email.
 */
export async function approveAccount(uid: string, adminUid: string): Promise<{
  type: "salon" | "owner";
  salonId?: string;
  /** False si l'email de bienvenue n'a pas pu partir (à renvoyer depuis l'admin). */
  emailSent: boolean;
}> {
  const accRef = adminDb.collection("accounts").doc(uid);
  const pre = await accRef.get();
  if (!pre.exists) throw new AccountError("account_not_found", 404);
  const acc = pre.data() ?? {};
  if (acc.status === "active") throw new AccountError("already_active", 409);
  const type = acc.type === "owner" ? "owner" : "salon";
  const profile = (acc.profile ?? {}) as Record<string, unknown>;
  const email = str(acc.email, 254);
  const now = Date.now();

  let salonId: string | undefined;

  if (type === "owner") {
    await adminDb.runTransaction(async (tx) => {
      const ownerRef = adminDb.collection("owners").doc(uid);
      const [accSnap, ownerSnap] = await Promise.all([tx.get(accRef), tx.get(ownerRef)]);
      if (accSnap.data()?.status === "active") throw new AccountError("already_active", 409);
      if (!ownerSnap.exists) {
        tx.set(ownerRef, {
          email,
          name: str(profile.name, 80),
          phone: str(profile.phone, 25) || null,
          salonIds: [],
          createdAt: now,
          // Essai Entreprise Pro : de quoi créer ses salons et tout tester.
          trialEndsAt: now + TRIAL_PRO_MS,
        });
      }
      tx.update(accRef, {
        status: "active",
        ownerId: uid,
        approvedAt: now,
        approvedBy: adminUid,
        rejectionReason: "",
        updatedAt: now,
      });
    });
  } else {
    const baseId = slugify(str(profile.name, 80)) || "salon";
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const id = attempt === 0 ? baseId : `${baseId}-${randomBytes(2).toString("hex")}`;
      const code = buildActivationCode();
      try {
        await adminDb.runTransaction(async (tx) => {
          const salonRef = adminDb.collection("salons").doc(id);
          const codeRef = adminDb.collection("activationCodes").doc(code);
          const [accSnap, salonSnap, codeSnap] = await Promise.all([
            tx.get(accRef),
            tx.get(salonRef),
            tx.get(codeRef),
          ]);
          if (accSnap.data()?.status === "active") throw new AccountError("already_active", 409);
          if (salonSnap.exists || codeSnap.exists) throw new AccountError("id_taken", 409);

          tx.set(salonRef, {
            name: str(profile.name, 80),
            city: str(profile.city, 80),
            ownerName: str(profile.ownerName, 80),
            phone: str(profile.phone, 25),
            activationCode: code,
            // Le compte (email + mot de passe) EST le kiosque du salon.
            activatedAt: now,
            createdAt: now,
            kioskUserIds: [uid],
            plan: "free",
            planActivatedAt: 0,
            planExpiresAt: 0,
            trialEndsAt: now + TRIAL_PRO_MS,
          });
          // Code d'activation conservé (dépannage admin), non utilisé.
          tx.set(codeRef, { salonId: id, createdAt: now, usedAt: 0, usedByUid: "", oneShot: true });
          tx.set(
            salonRef.collection("private").doc("data"),
            {
              signupEmail: email,
              consentAt: acc.consentAt ?? now,
              consentVersion: acc.consentVersion ?? "",
              updatedAt: now,
            },
            { merge: true },
          );
          tx.update(accRef, {
            status: "active",
            salonId: id,
            approvedAt: now,
            approvedBy: adminUid,
            rejectionReason: "",
            updatedAt: now,
          });
          salonId = id;
        });
        done = true;
      } catch (e) {
        if (!(e instanceof AccountError && e.code === "id_taken")) throw e;
      }
    }
    if (!done) throw new Error("id_collisions");
  }

  const emailSent = await sendApprovalEmail(uid);

  return { type, salonId, emailSent };
}

/** Adresse de l'app Trimya Pro (lien des emails). */
function proAppUrl(): string {
  return process.env.PRO_APP_URL || "https://pro.trimya.app";
}

/**
 * Envoie l'email de bienvenue d'un compte ACTIF et enregistre le résultat
 * (`approvalEmailSent`) pour que l'admin voie si l'email est bien parti.
 * Message dédié quand le compte vient d'un compte client converti.
 * Renvoie vrai si l'email est parti.
 */
export async function sendApprovalEmail(uid: string): Promise<boolean> {
  const ref = adminDb.collection("accounts").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new AccountError("account_not_found", 404);
  const acc = snap.data() ?? {};
  if (acc.status !== "active") throw new AccountError("invalid_state", 409);

  const type = acc.type === "owner" ? "owner" : "salon";
  const converted = acc.convertedFromClient === true;
  const profile = (acc.profile ?? {}) as Record<string, unknown>;
  const name = str(profile.name, 80);
  const email = str(acc.email, 254);

  const record = (sent: boolean, error = "") =>
    ref.update({
      approvalEmailSent: sent,
      approvalEmailAt: Date.now(),
      approvalEmailError: error.slice(0, 60),
    });

  if (!email) {
    await record(false, "no_email");
    return false;
  }

  const cta = { label: "Ouvrir Trimya Pro", url: proAppUrl() };
  const mail = converted
    ? renderInfoEmail({
        title:
          type === "owner"
            ? "Ton compte est maintenant un compte propriétaire Trimya Pro"
            : "Ton compte est maintenant un compte salon Trimya Pro",
        paragraphs: [
          type === "owner"
            ? `Bonne nouvelle : ton compte Trimya a été converti en compte propriétaire${name ? ` (${name})` : ""}. Tu profites de ${TRIAL_PRO_DAYS} jours d'essai Entreprise Pro, et tu peux créer les salons de ta chaîne avec leurs identifiants.`
            : `Bonne nouvelle : ton compte Trimya a été converti en compte salon${name ? ` (« ${name} »)` : ""}. Tu profites de ${TRIAL_PRO_DAYS} jours d'essai du plan Pro.`,
          "Pour te connecter, utilise l'application Trimya Pro (lien ci-dessous) avec le même email et le même mot de passe qu'avant.",
          "À partir de maintenant, cet email n'ouvre plus l'application Trimya Client. Ton historique de client est conservé.",
        ],
        cta,
      })
    : renderInfoEmail({
        title: "Ton compte Trimya Pro est validé",
        paragraphs: [
          type === "owner"
            ? `Bienvenue ! Ton compte propriétaire est actif, avec ${TRIAL_PRO_DAYS} jours d'essai Entreprise Pro. Connecte-toi à l'app, puis crée les salons de ta chaîne avec leurs identifiants.`
            : `Bienvenue ! Ton salon est actif, avec ${TRIAL_PRO_DAYS} jours d'essai du plan Pro. Connecte-toi à l'app avec ton email et ton mot de passe.`,
        ],
        cta,
      });

  const result = await sendBrevoEmail({
    to: email,
    subject: converted ? "Trimya — ton compte est converti" : "Trimya — ton compte est validé",
    htmlContent: mail.html,
    textContent: mail.text,
    tags: [converted ? "account-converted" : "account-approved"],
  });
  await record(result.ok, result.ok ? "" : (result.error ?? "unknown"));
  return result.ok;
}

/** Refuse une demande, avec un motif transmis par email. */
export async function rejectAccount(
  uid: string,
  adminUid: string,
  reason: string,
): Promise<void> {
  const accRef = adminDb.collection("accounts").doc(uid);
  const snap = await accRef.get();
  if (!snap.exists) throw new AccountError("account_not_found", 404);
  const acc = snap.data() ?? {};
  // Un compte déjà actif ne se « refuse » pas (désactive-le depuis sa fiche).
  if (acc.status === "active") throw new AccountError("invalid_state", 409);

  const cleanReason = cleanText(reason).slice(0, 300);
  await accRef.update({
    status: "rejected",
    rejectionReason: cleanReason,
    rejectedAt: Date.now(),
    rejectedBy: adminUid,
    updatedAt: Date.now(),
  });

  const email = str(acc.email, 254);
  if (email) {
    const mail = renderInfoEmail({
      title: "Ta demande de compte Trimya Pro",
      paragraphs: [
        "Nous ne pouvons pas valider ta demande pour le moment.",
        ...(cleanReason ? [`Motif : ${cleanReason}`] : []),
        "Tu peux nous écrire à contact@trimya.app pour en discuter.",
      ],
    });
    void sendBrevoEmail({
      to: email,
      subject: "Trimya — ta demande de compte",
      htmlContent: mail.html,
      textContent: mail.text,
      tags: ["account-rejected"],
    }).catch(() => undefined);
  }
}
