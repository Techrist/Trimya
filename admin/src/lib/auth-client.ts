"use client";

import { auth, db } from "./firebase-client";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Ensure the user is an admin
  const snap = await getDoc(doc(db, "admins", cred.user.uid));
  if (!snap.exists()) {
    await fbSignOut(auth);
    throw new Error(
      "Ce compte n'a pas les droits administrateur. Contacte le propriétaire pour être ajouté.",
    );
  }
  return cred.user;
}

export async function logout(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Calls an API route with the current user's ID token.
 * Throws if the user is not signed in.
 */
export async function adminFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers ?? {});
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
