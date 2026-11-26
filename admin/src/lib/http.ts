import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";
import { withCors } from "./cors";

/** Réponse JSON + CORS (à utiliser sur TOUTES les réponses, erreurs comprises). */
export function json(
  origin: string | null,
  body: unknown,
  status = 200,
): NextResponse {
  return withCors(NextResponse.json(body, { status }), origin);
}

/** Authentifie l'appelant via son Firebase ID token (kiosque anonyme ou owner). */
export async function requireUid(
  req: NextRequest,
  origin: string | null,
): Promise<{ uid: string } | { res: NextResponse }> {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  if (!match) {
    return { res: json(origin, { error: "missing_bearer_token" }, 401) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]!);
    return { uid: decoded.uid };
  } catch {
    return { res: json(origin, { error: "invalid_token" }, 401) };
  }
}
