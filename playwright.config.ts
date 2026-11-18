/**
 * Tests de parcours (Playwright) sur une base DÉDIÉE (data/e2e.db), recréée à
 * chaque lancement : les données de développement ne sont jamais touchées.
 * Navigateur : Chrome installé sur la machine (aucun téléchargement).
 *
 * Usage : npm run test:e2e   (construit l'application puis lance les tests)
 */
import { defineConfig } from "@playwright/test";

const PORT = 3100;

/** Valeurs de TEST uniquement (base jetable, jamais utilisées ailleurs). */
export const E2E_ENV = {
  DATABASE_URL: "file:./data/e2e.db",
  MEDIA_STORAGE_DIR: "./data/e2e-uploads",
  BACKUP_DIR: "./data/e2e-backups",
  APP_URL: `http://localhost:${PORT}`,
  IP_HASH_SECRET: "e2e-secret-de-test-uniquement-0123456789",
  SESSION_TTL_HOURS: "2",
  SEED_ADMIN_NAME: "Admin E2E",
  SEED_ADMIN_EMAIL: "admin-e2e@exemple.test",
  SEED_ADMIN_PASSWORD: "admin-e2e-motdepasse-2026",
  SEED_EMPLOYEE_NAME: "Employé E2E",
  SEED_EMPLOYEE_EMAIL: "employe-e2e@exemple.test",
  SEED_EMPLOYEE_PASSWORD: "employe-e2e-motdepasse-2026",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: E2E_ENV.APP_URL,
    channel: "chrome",
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  webServer: {
    // Base de test recréée puis serveur de production démarré.
    command: `npx tsx e2e/prepare-db.ts && npx next start -p ${PORT}`,
    url: E2E_ENV.APP_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
