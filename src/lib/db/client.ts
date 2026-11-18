/**
 * Fabrique de connexion à la base de données.
 * Ce module n'importe pas `server-only` afin d'être utilisable par les
 * scripts (migrations, seed) et les tests.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema> & { $client: Client };

export interface DatabaseConnection {
  db: Database;
  client: Client;
}

/** Crée le dossier parent d'une base SQLite locale (`file:./data/x.db`). */
function ensureLocalDirectory(url: string): void {
  if (!url.startsWith("file:") || url.includes(":memory:")) return;
  const path = url.slice("file:".length);
  mkdirSync(dirname(path), { recursive: true });
}

export async function createDatabase(url: string): Promise<DatabaseConnection> {
  ensureLocalDirectory(url);
  const client = createClient({ url });
  // SQLite n'applique les clés étrangères que si on le demande explicitement.
  await client.execute("PRAGMA foreign_keys = ON");
  return { client, db: drizzle({ client, schema }) };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas défini. Lancez `npm run setup:env` puis réessayez.",
    );
  }
  return url;
}
