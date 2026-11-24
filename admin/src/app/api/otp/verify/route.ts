import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions, withCors } from "@/lib/cors";

/**
 * POST /api/otp/verify
 *
 * Vérifie le code OTP. Si valide, crée/récupère l'utilisateur Firebase Auth
 * et renvoie un Custom Token que la PWA utilise avec signInWithCustomToken().
 *
 * Sécurité :
 *  - Comparaison du hash SHA-256 en timing-safe
 *  - Maximum 5 tentatives, après quoi le document est détruit
 *  - Le document est TOUJOURS supprimé après un verify réussi (code one-shot)
 *  - Expiration stricte (expiresAt)
 *  - Jamais de leak sur l'existence de l'email (anti-énumération)
 */

const Body = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
});

const MAX_ATTEMPTS = 5;

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Comparaison timing-safe de deux hex strings de même longueur.
 * Évite les attaques par timing sur la comparaison du code.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  // ─── 1) Parse body ─────────────────────────────────────────
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
  const email = parsed.data.email.trim().toLowerCase();
  const code = parsed.data.code;
  const codeHash = await hashCode(code);

  // ─── 2) Vérifier le code (transaction) ────────────────────
  const docRef = adminDb.collection("emailOtps").doc(email);
  type Role = "client" | "owner";
  // Rôle demandé initialement par le client dans /api/otp/send. Utilisé
  // uniquement en garde (ligne ~182) pour refuser un signin owner quand
  // aucun doc owners/{uid} n'existe. Le rôle *réel* assigné dans le
  // custom token vient du lookup serveur.
  let role: Role = "client" as Role;

  try {
    const verdict = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return "invalid" as const;
      const data = snap.data() ?? {};
      const expiresAt = (data.expiresAt as number | undefined) ?? 0;
      const attempts = (data.attempts as number | undefined) ?? 0;
      const storedHash = data.codeHash as string | undefined;
      const storedRole =
        (data.role as "client" | "owner" | undefined) ?? "client";

      if (expiresAt < Date.now()) {
        tx.delete(docRef);
        return "expired" as const;
      }

      if (attempts >= MAX_ATTEMPTS) {
        tx.delete(docRef);
        return "too_many_attempts" as const;
      }

      if (!storedHash || !timingSafeEqual(storedHash, codeHash)) {
        tx.update(docRef, { attempts: attempts + 1 });
        return "invalid" as const;
      }

      // Succès → consomme le code (one-shot)
      tx.delete(docRef);
      role = storedRole;
      return "ok" as const;
    });

    if (verdict === "expired") {
      return withCors(
        NextResponse.json({ error: "code_expired" }, { status: 400 }),
        origin,
      );
    }
    if (verdict === "too_many_attempts") {
      return withCors(
        NextResponse.json({ error: "too_many_attempts" }, { status: 429 }),
        origin,
      );
    }
    if (verdict === "invalid") {
      return withCors(
        NextResponse.json({ error: "invalid_code" }, { status: 400 }),
        origin,
      );
    }

    // ─── 3) Récupérer ou créer l'utilisateur Firebase ────────
    // Firebase Admin SDK porte le code sur `.code` (ex "auth/user-not-found"),
    // pas dans `.message`. On check les deux pour la robustesse — certains
    // wrappers (Edge runtime, polyfills) perdent le code et ne gardent que
    // le message anglais.
    let uid: string;
    try {
      const user = await adminAuth.getUserByEmail(email);
      uid = user.uid;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      const isNotFound =
        code === "auth/user-not-found" ||
        msg.includes("user-not-found") ||
        msg.includes("no user record");
      if (!isNotFound) {
        throw e;
      }
      const newUser = await adminAuth.createUser({
        email,
        emailVerified: true, // L'OTP prouve que l'user contrôle l'email
      });
      uid = newUser.uid;
    }

    // ─── 4) Résoudre le role côté SERVEUR (anti-escalation) ───
    // Ne jamais faire confiance au `role` envoyé par le client dans
    // /api/otp/send : il est juste un hint UI. La vérité vient de la
    // présence d'un doc owners/{uid}. Un attaquant qui demanderait
    // `role: 'owner'` sans doc owner correspondant se verrait attribuer
    // 'client' ici → pas d'escalade possible via le claim.
    const ownerSnap = await adminDb.collection("owners").doc(uid).get();
    const resolvedRole: "client" | "owner" = ownerSnap.exists
      ? "owner"
      : "client";
    // Rejet rapide si l'owner existe mais a été désactivé par l'admin.
    if (ownerSnap.exists) {
      const d = ownerSnap.data() ?? {};
      if (typeof d.disabledAt === "number" && d.disabledAt > 0) {
        return withCors(
          NextResponse.json({ error: "account_disabled" }, { status: 403 }),
          origin,
        );
      }
    }
    // Si le client a demandé 'owner' mais que le serveur résout 'client',
    // c'est que l'owner n'existe pas encore. On refuse pour que l'UI
    // affiche un message clair plutôt que de router vers OwnerTabs puis
    // échouer silencieusement sur findOwnerForAuthUser.
    if (role === "owner" && resolvedRole !== "owner") {
      return withCors(
        NextResponse.json({ error: "not_an_owner" }, { status: 403 }),
        origin,
      );
    }

    // ─── 5) Créer un Custom Token avec le role RÉSOLU ────────
    const customToken = await adminAuth.createCustomToken(uid, {
      role: resolvedRole,
      viaOtp: true,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        token: customToken,
        role: resolvedRole,
        uid,
      }),
      origin,
    );
  } catch (e: unknown) {
    logServerError("otp/verify", e);
    return withCors(
      NextResponse.json({ error: "internal_error" }, { status: 500 }),
      origin,
    );
  }
}
