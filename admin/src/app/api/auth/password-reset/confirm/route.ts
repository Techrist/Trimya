import { NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { verifyOtp } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/account-utils";

/**
 * POST /api/auth/password-reset/confirm — vérifie le code et change le mot
 * de passe. Les sessions ouvertes sont révoquées (un voleur de session ne
 * survit pas à la réinitialisation).
 */
const Body = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  password: passwordSchema,
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

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
  const email = parsed.data.email.trim().toLowerCase();

  try {
    await consumeLimit(`reset-confirm:ip:${ipHash(clientIp(req))}`, 10, 60 * 60 * 1000);

    const verdict = await verifyOtp("reset", email, parsed.data.code);
    if (verdict === "too_many_attempts") return json(origin, { error: verdict }, 429);
    if (verdict !== "ok") return json(origin, { error: verdict }, 400);

    let uid: string;
    try {
      const user = await adminAuth.getUserByEmail(email);
      if (user.disabled) return json(origin, { error: "invalid_code" }, 400);
      uid = user.uid;
    } catch (e) {
      if ((e as { code?: string })?.code === "auth/user-not-found") {
        return json(origin, { error: "invalid_code" }, 400);
      }
      throw e;
    }

    await adminAuth.updateUser(uid, { password: parsed.data.password, emailVerified: true });
    await adminAuth.revokeRefreshTokens(uid);
    return json(origin, { ok: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/reset/confirm", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
