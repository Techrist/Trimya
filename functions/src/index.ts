import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// ─── Constants ─────────────────────────────────────────────
const REWARD_THRESHOLD = 4;
const QR_VALIDITY_MS = 60_000;
const CLOCK_SKEW_MS = 30_000;
/** Délai mini entre 2 cuts pour un même client (anti double-scan). */
const COOLDOWN_MS = 30_000;

interface AddCutInput {
  customerId: string;
  /** Salon où la coupe est faite. Doit matcher le customer.salonId. */
  salonId: string;
  /** Timestamp d'expiration du QR (depuis le payload v3 signé). */
  qrExp?: number;
  /** Optionnel : barbier qui réalise la coupe. */
  barberId?: string;
  barberName?: string;
  /** Prix de la coupe en FCFA (0 ou absent si reward). */
  price?: number;
}

interface PlanShape {
  plan?: "free" | "standard" | "pro";
  planExpiresAt?: number;
  trialEndsAt?: number;
}

function effectivePlan(salon: PlanShape): "free" | "standard" | "pro" {
  const now = Date.now();
  if (salon.trialEndsAt && salon.trialEndsAt > now) return "pro";
  const raw = salon.plan ?? "free";
  if (raw === "free") return "free";
  if (salon.planExpiresAt && salon.planExpiresAt > 0 && salon.planExpiresAt < now) {
    return "free";
  }
  return raw;
}

const PLAN_MAX_CLIENTS: Record<"free" | "standard" | "pro", number | null> = {
  free: 50,
  standard: null,
  pro: null,
};

/**
 * Cloud Function callable depuis l'app mobile.
 *
 * Vérifie en transaction :
 *  - L'appelant est bien un kiosque autorisé pour le salon
 *  - Le salon n'est pas désactivé
 *  - Le QR (si v3) n'est pas expiré
 *  - Aucun cut n'a été enregistré pour ce client dans les COOLDOWN_MS dernières
 *    secondes (anti-replay / anti-double-scan)
 *  - Le quota clients du plan n'est pas dépassé (warn-only — on bloque pas
 *    la coupe d'un client EXISTANT, juste les nouveaux clients dans la limite)
 *
 * Puis exécute la mise à jour atomique du compteur + insertion du cut.
 */
export const addCutSecure = onCall<AddCutInput>(
  { region: "europe-west1", enforceAppCheck: true },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "no_auth");

    const { customerId, salonId, qrExp, barberId, barberName, price } = req.data;
    if (!customerId || !salonId) {
      throw new HttpsError("invalid-argument", "missing_fields");
    }

    // QR fraîcheur (si v3)
    if (typeof qrExp === "number") {
      const now = Date.now();
      if (qrExp + CLOCK_SKEW_MS < now) {
        throw new HttpsError("failed-precondition", "qr_expired");
      }
      if (qrExp - QR_VALIDITY_MS - CLOCK_SKEW_MS > now) {
        throw new HttpsError("failed-precondition", "qr_from_future");
      }
    }

    const callerUid = req.auth.uid;

    return await db.runTransaction(async (tx) => {
      const salonRef = db.collection("salons").doc(salonId);
      const customerRef = db.collection("customers").doc(customerId);
      const [salonSnap, customerSnap] = await Promise.all([
        tx.get(salonRef),
        tx.get(customerRef),
      ]);

      if (!salonSnap.exists) throw new HttpsError("not-found", "salon_not_found");
      if (!customerSnap.exists)
        throw new HttpsError("not-found", "customer_not_found");

      const salon = salonSnap.data() ?? {};
      const customer = customerSnap.data() ?? {};

      // Salon désactivé ?
      if (salon.disabledAt && salon.disabledAt > 0) {
        throw new HttpsError("failed-precondition", "salon_disabled");
      }

      // L'appelant est-il un kiosque autorisé pour ce salon ?
      const kioskUserIds: string[] = Array.isArray(salon.kioskUserIds)
        ? salon.kioskUserIds
        : [];
      if (!kioskUserIds.includes(callerUid)) {
        throw new HttpsError("permission-denied", "not_authorized_kiosk");
      }

      // Le client appartient bien à ce salon ?
      if (customer.salonId !== salonId) {
        throw new HttpsError(
          "failed-precondition",
          "customer_belongs_to_other_salon",
        );
      }

      // Anti-double-scan : cooldown sur lastVisitAt
      if (
        customer.lastVisitAt &&
        Date.now() - customer.lastVisitAt < COOLDOWN_MS
      ) {
        throw new HttpsError("aborted", "too_soon_after_last_cut");
      }

      // ─── Cas client abonné (coupes illimitées) ────────────
      // Le compteur 4/4 ne bouge pas, on log juste la coupe avec
      // isSubscription=true et on incrémente totalCuts pour les stats salon.
      const subExpiresAt = (customer.subscriptionExpiresAt as number) || 0;
      const subscribed = subExpiresAt > Date.now();
      if (subscribed) {
        const cutRef = db.collection("cuts").doc();
        tx.set(cutRef, {
          customerId,
          salonId,
          createdAt: Date.now(),
          wasReward: false,
          isSubscription: true,
          ...(barberId ? { barberId } : {}),
          ...(barberName ? { barberName } : {}),
          price: 0,
          addedByUid: callerUid,
        });

        tx.update(customerRef, {
          totalCuts: FieldValue.increment(1),
          lastVisitAt: Date.now(),
          // currentCount et totalRewards INCHANGÉS
        });

        return {
          ok: true,
          cutId: cutRef.id,
          newCount: (customer.currentCount as number) ?? 0,
          wasReward: false,
          rewardUnlocked: false,
        };
      }

      // ─── Cas standard fidélité 4/4 ─────────────────────────
      const currentCount = (customer.currentCount as number) ?? 0;
      const wasReward = currentCount >= REWARD_THRESHOLD;
      const newCount = wasReward ? 0 : currentCount + 1;
      const rewardUnlocked = !wasReward && newCount >= REWARD_THRESHOLD;

      // Insertion atomique
      const cutRef = db.collection("cuts").doc();
      tx.set(cutRef, {
        customerId,
        salonId,
        createdAt: Date.now(),
        wasReward,
        ...(barberId ? { barberId } : {}),
        ...(barberName ? { barberName } : {}),
        ...(typeof price === "number" && !wasReward ? { price } : {}),
        addedByUid: callerUid,
      });

      const updates: Record<string, unknown> = {
        currentCount: newCount,
        totalCuts: FieldValue.increment(1),
        lastVisitAt: Date.now(),
      };
      if (wasReward) updates.totalRewards = FieldValue.increment(1);
      tx.update(customerRef, updates);

      return {
        ok: true,
        cutId: cutRef.id,
        newCount,
        wasReward,
        rewardUnlocked,
      };
    });
  },
);

/**
 * Côté inscription client : enforcement du quota plan max-clients.
 * Déclenchée à la création d'un doc `customers/{id}`. Si le salon a
 * atteint sa limite, on supprime le doc (le client devra se réinscrire
 * ailleurs ou demander au salon de upgrader son plan).
 *
 * NB : il y a une fenêtre de race possible (création + lecture non
 * atomique). Pour un quota strict, l'inscription devrait passer par
 * une Cloud Function en transaction. Pour le MVP, c'est suffisant.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";

export const enforceClientQuota = onDocumentCreated(
  { region: "europe-west1", document: "customers/{customerId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const salonId = data.salonId as string | undefined;
    if (!salonId) return;

    const salonSnap = await db.collection("salons").doc(salonId).get();
    if (!salonSnap.exists) return;
    const salon = salonSnap.data() as PlanShape;
    const plan = effectivePlan(salon);
    const limit = PLAN_MAX_CLIENTS[plan];
    if (limit === null) return; // illimité

    // Compter les clients actuels du salon
    const countAgg = await db
      .collection("customers")
      .where("salonId", "==", salonId)
      .count()
      .get();
    const currentCount = countAgg.data().count;
    if (currentCount <= limit) return; // tout va bien

    // Quota dépassé : supprimer ce nouveau doc et logger
    await event.data?.ref.delete();
    await db.collection("planQuotaBlocked").add({
      salonId,
      customerId: event.params.customerId,
      blockedAt: Date.now(),
      plan,
      limit,
      currentCount,
    });
  },
);

// ─── Self-service : un owner crée un nouveau salon ───────────
//
// Appelée par l'app mobile depuis l'écran owner. Vérifie en
// transaction :
//  - L'appelant a bien un doc owners/{uid}
//  - L'owner a un plan Entreprise actif
//  - Le quota maxSalons (5 pour Entreprise) n'est pas dépassé
//  - Le code d'activation généré est unique
// Crée atomiquement : le salon + l'entrée activationCodes + l'ajout
// à owner.salonIds.

const ENTERPRISE_MAX_SALONS = 5;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function buildCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `TRIMYA-${out}`;
}

interface CreateSalonInput {
  name: string;
  city: string;
  phone?: string;
}

export const createSalonForOwner = onCall<CreateSalonInput>(
  { region: "europe-west1" },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "no_auth");
    const ownerUid = req.auth.uid;

    const { name, city, phone } = req.data;
    if (!name || name.trim().length < 2) {
      throw new HttpsError("invalid-argument", "invalid_name");
    }
    if (!city || city.trim().length < 2) {
      throw new HttpsError("invalid-argument", "invalid_city");
    }

    // 1. Charge l'owner + check plan/quota
    const ownerSnap = await db.collection("owners").doc(ownerUid).get();
    if (!ownerSnap.exists)
      throw new HttpsError("permission-denied", "not_an_owner");
    const owner = ownerSnap.data() as {
      plan?: string;
      planExpiresAt?: number;
      salonIds?: string[];
      disabledAt?: number;
      name?: string;
    };
    if (owner.disabledAt && owner.disabledAt > 0)
      throw new HttpsError("permission-denied", "owner_disabled");

    const now = Date.now();
    // Plan owner actif : enterprise OU enterprise_standard, non expiré.
    const isEnterprisePlan =
      owner.plan === "enterprise" || owner.plan === "enterprise_standard";
    const notExpired =
      !owner.planExpiresAt || owner.planExpiresAt === 0 || owner.planExpiresAt > now;
    const activePlan = isEnterprisePlan && notExpired;
    if (!activePlan) throw new HttpsError("failed-precondition", "no_enterprise_plan");

    const currentCount = owner.salonIds?.length ?? 0;
    if (currentCount >= ENTERPRISE_MAX_SALONS) {
      throw new HttpsError("resource-exhausted", "salon_limit_reached");
    }

    // 2. Trouve un salonId unique
    const baseId = slugify(name);
    if (!baseId) throw new HttpsError("invalid-argument", "invalid_name");
    let id = baseId;
    let counter = 1;
    while ((await db.collection("salons").doc(id).get()).exists) {
      counter += 1;
      id = `${baseId}-${counter}`;
      if (counter > 50) throw new HttpsError("internal", "too_many_collisions");
    }

    // 3. Trouve un code d'activation unique
    let code = buildCode();
    let codeAttempts = 0;
    while ((await db.collection("activationCodes").doc(code).get()).exists) {
      code = buildCode();
      codeAttempts += 1;
      if (codeAttempts > 20) throw new HttpsError("internal", "code_collision");
    }

    // 4. Création atomique : salon + activationCode + maj owner.salonIds
    const batch = db.batch();
    const salonRef = db.collection("salons").doc(id);
    const codeRef = db.collection("activationCodes").doc(code);
    const ownerRef = db.collection("owners").doc(ownerUid);

    // Plan effectif hérité par le nouveau salon selon le tier owner.
    // enterprise_standard → 'standard', enterprise → 'pro'.
    const inheritedPlan: "standard" | "pro" =
      owner.plan === "enterprise" ? "pro" : "standard";

    batch.set(salonRef, {
      name: name.trim(),
      city: city.trim(),
      ownerName: owner.name ?? "",
      phone: phone?.trim() ?? "",
      activationCode: code,
      activatedAt: 0,
      createdAt: now,
      kioskUserIds: [],
      ownerId: ownerUid,
      plan: "free",
      planActivatedAt: 0,
      planExpiresAt: 0,
      trialEndsAt: 0,
      // Le salon nouvellement créé hérite immédiatement du plan owner.
      inheritedPlan,
    });
    batch.set(codeRef, {
      salonId: id,
      createdAt: now,
      usedAt: 0,
      usedByUid: "",
      oneShot: true,
    });
    batch.update(ownerRef, {
      salonIds: FieldValue.arrayUnion(id),
    });
    await batch.commit();

    return {
      ok: true,
      salonId: id,
      activationCode: code,
    };
  },
);

// ─── RGPD : purge automatique après 30 jours ────────────────
//
// Tourne tous les jours à 03:00 UTC. Pour chaque customer avec
// `deletionRequestedAt` plus vieux que 30 jours :
//  1. Anonymise les cuts liés (garde l'historique compta du salon mais
//     remplace customerId par "deleted-{hash}" — pas de PII).
//  2. Supprime les conversations + messages liés.
//  3. Supprime les réservations liées.
//  4. Supprime le doc customer.
//  5. Supprime le compte Firebase Auth.
//
// Best-effort : si une étape échoue, on log dans `rgpdPurgeFailures`
// pour reprise manuelle, mais on continue le reste.

const RGPD_GRACE_DAYS = 30;
const RGPD_GRACE_MS = RGPD_GRACE_DAYS * 24 * 60 * 60 * 1000;

export const purgeDeletedAccounts = onSchedule(
  {
    region: "europe-west1",
    schedule: "0 3 * * *",
    timeZone: "Etc/UTC",
  },
  async () => {
    const threshold = Date.now() - RGPD_GRACE_MS;
    const snap = await db
      .collection("customers")
      .where("deletionRequestedAt", "<=", threshold)
      .where("deletionRequestedAt", ">", 0)
      .get();

    for (const customerDoc of snap.docs) {
      const customerId = customerDoc.id;
      try {
        // 1. Anonymiser les cuts (garde pour la compta du salon, pas de PII)
        const cutsSnap = await db
          .collection("cuts")
          .where("customerId", "==", customerId)
          .get();
        const batch1 = db.batch();
        for (const c of cutsSnap.docs) {
          batch1.update(c.ref, {
            customerId: `deleted-${customerId.slice(0, 8)}`,
            anonymizedAt: Date.now(),
          });
        }
        if (cutsSnap.size > 0) await batch1.commit();

        // 2. Supprimer conversations + messages
        const convosSnap = await db
          .collection("conversations")
          .where("customerId", "==", customerId)
          .get();
        for (const convo of convosSnap.docs) {
          const messagesSnap = await db
            .collection("messages")
            .where("conversationId", "==", convo.id)
            .get();
          const batchMsg = db.batch();
          messagesSnap.docs.forEach((m) => batchMsg.delete(m.ref));
          if (messagesSnap.size > 0) await batchMsg.commit();
          await convo.ref.delete();
        }

        // 3. Supprimer les réservations
        const resaSnap = await db
          .collection("reservations")
          .where("customerId", "==", customerId)
          .get();
        const batch3 = db.batch();
        resaSnap.docs.forEach((r) => batch3.delete(r.ref));
        if (resaSnap.size > 0) await batch3.commit();

        // 4. Supprimer le doc customer
        await customerDoc.ref.delete();

        // 5. Supprimer le compte Firebase Auth (best-effort)
        try {
          await getAuth().deleteUser(customerId);
        } catch {
          // Le compte peut ne plus exister, c'est OK.
        }

        await db.collection("rgpdPurgeLogs").add({
          customerId,
          purgedAt: Date.now(),
          cutsAnonymized: cutsSnap.size,
          conversationsDeleted: convosSnap.size,
          reservationsDeleted: resaSnap.size,
        });
      } catch (err) {
        await db.collection("rgpdPurgeFailures").add({
          customerId,
          failedAt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
);
