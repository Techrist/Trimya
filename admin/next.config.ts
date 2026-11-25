import type { NextConfig } from "next";

/**
 * Consigne envoyée aux moteurs de recherche : ne pas indexer, ne pas suivre
 * les liens, ne pas garder de copie en cache.
 *
 * On passe par un en-tête HTTP (et non par robots.txt) volontairement : un
 * Disallow empêche Google d'explorer la page, donc de lire la consigne
 * « noindex », et l'URL peut quand même apparaître dans les résultats.
 */
const NOINDEX = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive",
};

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Hôtes techniques : ils servent le même projet que www.trimya.app
      // (pages publiques comprises) mais ne doivent JAMAIS être indexés.
      // Seul https://www.trimya.app est la version publique.
      {
        source: "/:path*",
        has: [{ type: "host", value: "admin.trimya.app" }],
        headers: [NOINDEX],
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "trimya-admin.vercel.app" }],
        headers: [NOINDEX],
      },
      // Espace d'administration : jamais indexé, quel que soit l'hôte.
      { source: "/login", headers: [NOINDEX] },
      { source: "/dashboard/:path*", headers: [NOINDEX] },
    ];
  },
};

export default nextConfig;
