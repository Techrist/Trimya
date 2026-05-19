"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase-client";

interface AuthGateProps {
  children: (user: User) => React.ReactNode;
}

/**
 * Renders `children(user)` only when an authenticated admin is signed in.
 * Otherwise redirects to /login. While checking, shows a centered spinner.
 */
export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "authed"; user: User }
    | { status: "unauthed" }
  >({ status: "loading" });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: "unauthed" });
        router.replace("/login");
        return;
      }
      // Confirm admin role each time, so revoked admins are kicked out.
      const snap = await getDoc(doc(db, "admins", user.uid));
      if (!snap.exists()) {
        setState({ status: "unauthed" });
        router.replace("/login");
        return;
      }
      setState({ status: "authed", user });
    });
    return unsub;
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }
  if (state.status === "unauthed") return null;
  return <>{children(state.user)}</>;
}
