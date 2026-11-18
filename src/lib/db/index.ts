/**
 * Connexion partagée à la base, pour le code serveur de l'application.
 * Mise en cache sur `globalThis` pour survivre au rechargement à chaud.
 */
import "server-only";
import { createDatabase, getDatabaseUrl, type Database } from "./client";

const globalForDb = globalThis as unknown as {
  memoriaDb?: Promise<Database>;
};

export function getDb(): Promise<Database> {
  globalForDb.memoriaDb ??= createDatabase(getDatabaseUrl()).then((c) => c.db);
  return globalForDb.memoriaDb;
}

export type { Database } from "./client";
export * as schema from "./schema";
