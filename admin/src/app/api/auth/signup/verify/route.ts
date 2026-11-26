import { NextRequest } from "next/server";
import { z } from "zod";
import { logServerError } from "@/lib/api-errors";
import { handleOptions } from "@/lib/cors";
import { issueProof, verifyOtp } from "@/lib/email-otp";
import { json } from "@/lib/http";
import { clientIp, consumeLimit, ipHash, RateLimitError } from "@/lib/rate-limit";
import { signupEnabled } from "@/lib/account-utils";

/**
 * POST /api/auth/signup/verify — vérifie le code reçu par email (5 essais,
 * usage unique) et délivre une PREUVE de 15 minutes que /signup/create
 * exigera. Cela sépare l'étape « code » de l'étape « profil ».
 */
const Body = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
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
  if (!parsed.success) return json(origin, { error: "invalid_payload" }, 400);
  const email = parsed.data.email.trim().toLowerCase();

  try {
    await consumeLimit(`signup-verify:ip:${ipHash(clientIp(req))}`, 20, 60 * 60 * 1000);

    const verdict = await verifyOtp("signup", email, parsed.data.code);
    if (verdict === "too_many_attempts") return json(origin, { error: verdict }, 429);
    if (verdict !== "ok") return json(origin, { error: verdict }, 400);

    const proof = await issueProof(email);
    return json(origin, { ok: true, proof });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(origin, { error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds }, 429);
    }
    logServerError("auth/signup/verify", e);
    return json(origin, { error: "internal_error" }, 500);
  }
}
