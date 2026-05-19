import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";

export interface AdminContext {
  uid: string;
  email: string | null;
}

/**
 * Reads the Authorization header, validates the Firebase ID token,
 * checks that the user has a doc in `admins/{uid}`. On any failure,
 * returns a NextResponse you should return immediately from the handler.
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<{ ctx: AdminContext } | { res: NextResponse }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return {
      res: NextResponse.json(
        { error: "missing_bearer_token" },
        { status: 401 },
      ),
    };
  }
  const idToken = match[1]!;

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return {
      res: NextResponse.json({ error: "invalid_token" }, { status: 401 }),
    };
  }

  // Admin role lookup
  const adminDoc = await adminDb.collection("admins").doc(decoded.uid).get();
  if (!adminDoc.exists) {
    return {
      res: NextResponse.json({ error: "not_admin" }, { status: 403 }),
    };
  }

  return {
    ctx: { uid: decoded.uid, email: decoded.email ?? null },
  };
}
