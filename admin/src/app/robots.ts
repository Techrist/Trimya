import type { MetadataRoute } from "next";

/**
 * Génère /robots.txt — autorise le crawling des pages publiques marketing,
 * bloque l'admin (/dashboard, /login) et les API routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/login", "/api/"],
      },
    ],
    sitemap: "https://trimya.com/sitemap.xml",
  };
}
