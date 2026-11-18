/**
 * Prépare une base de test VIERGE (data/e2e.db) avant de démarrer le serveur
 * des tests de parcours. Lancé par la commande `webServer` de Playwright,
 * avec les variables E2E_ENV : la base de développement n'est jamais touchée.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

if (process.env.DATABASE_URL !== "file:./data/e2e.db") {
  throw new Error("Sécurité : ce script ne s'exécute que sur la base de test data/e2e.db.");
}
for (const path of ["./data/e2e.db", "./data/e2e.db-journal", "./data/e2e-uploads", "./data/e2e-backups"]) {
  rmSync(path, { recursive: true, force: true });
}
execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
