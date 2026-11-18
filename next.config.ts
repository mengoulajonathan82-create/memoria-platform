import type { NextConfig } from "next";

/**
 * Configuration Next.js.
 *
 * - `cacheComponents` est désactivé : le back-office lit la session (cookies)
 *   sur chaque requête et affiche des données vivantes ; le modèle de rendu
 *   dynamique classique est plus simple et plus sûr ici.
 * - Les modules natifs (libsql, argon2) restent hors du bundle serveur.
 * - En-têtes de sécurité appliqués à toutes les réponses.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    // Formulaires avec fichier (logo : 2 Mo max). Les médias passent par /api/admin/medias.
    serverActions: { bodySizeLimit: "3mb" },
  },
  serverExternalPackages: ["@libsql/client", "libsql", "@node-rs/argon2", "sharp"],
  turbopack: {
    // Le dossier parent contient un autre projet (avec son package-lock.json) :
    // on fixe explicitement la racine pour éviter toute confusion de Turbopack.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
