"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { login } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already signed in, push to dashboard.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
    });
    return unsub;
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion.";
      // Friendlier message for Firebase's default codes
      if (msg.includes("auth/invalid-credential")) {
        setError("Email ou mot de passe incorrect.");
      } else if (msg.includes("auth/too-many-requests")) {
        setError(
          "Trop de tentatives. Réessaie dans quelques minutes ou réinitialise le mot de passe.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold">Trimya Admin</h1>
          <p className="text-sm text-text-muted">
            Connecte-toi pour piloter tes salons
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-text-dim" />
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="toi@trimya.app"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-text-dim" />
            <Input
              id="password"
              type="password"
              label="Mot de passe"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Se connecter
          </Button>

          <p className="pt-2 text-center text-xs text-text-dim">
            L&apos;accès est réservé aux comptes ajoutés dans la collection{" "}
            <code className="rounded bg-surface px-1">admins</code> de Firestore.
          </p>
        </form>
      </div>
    </main>
  );
}
