import "server-only";
import { NextResponse } from "next/server";

/**
 * CORS pour les endpoints appelés par la PWA Trimya (origins différentes
 * du serveur Vercel admin).
 *
 * Whitelist stricte — on n'utilise JAMAIS `*` pour un endpoint qui accepte
 * des credentials/données utilisateur. Les origines autorisées viennent
 * d'une env var pour pouvoir ajouter des domaines de preview sans
 * redéploiement majeur.
 *
 * ALLOWED_PWA_ORIGINS (env var, optionnelle) : liste CSV. Si absente, on
 * utilise les origins prod par défaut.
 */

const DEFAULT_ORIGINS = [
  "https://trimya-68ae2.web.app",
  "https://trimya-pro.web.app",
  "https://trimya-68ae2.firebaseapp.com",
  // Dev local — à retirer en prod via override env
  "http://localhost:8081",
  "http://localhost:19006",
];

function allowedOrigins(): Set<string> {
  const fromEnv = process.env.ALLOWED_PWA_ORIGINS;
  if (fromEnv) {
    return new Set(
      fromEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return new Set(DEFAULT_ORIGINS);
}

/**
 * Renvoie l'origin à mettre dans Access-Control-Allow-Origin,
 * ou null si l'origin n'est pas autorisée.
 */
export function pickAllowedOrigin(reqOrigin: string | null): string | null {
  if (!reqOrigin) return null;
  const allowed = allowedOrigins();
  return allowed.has(reqOrigin) ? reqOrigin : null;
}

/**
 * Ajoute les headers CORS à une réponse. À appeler sur TOUTES les réponses
 * d'un endpoint cross-origin, y compris les erreurs — sinon le navigateur
 * masque le vrai code HTTP derrière un CORS error, impossible à debugger.
 */
export function withCors<T extends NextResponse>(
  res: T,
  reqOrigin: string | null,
): T {
  const origin = pickAllowedOrigin(reqOrigin);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.headers.set("Access-Control-Max-Age", "86400");
  }
  return res;
}

/**
 * Handler OPTIONS standard (preflight). À exporter depuis chaque route
 * qui accepte des méthodes non-simples (POST+JSON).
 */
export function handleOptions(reqOrigin: string | null): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }), reqOrigin);
}
