/**
 * Applique les migrations SQL du dossier `drizzle/` à la base configurée.
 * Usage : npm run db:migrate
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase, getDatabaseUrl } from "../src/lib/db/client";

async function main() {
  const { db, client } = await createDatabase(getDatabaseUrl());
  await migrate(db, { migrationsFolder: "./drizzle" });
  client.close();
  console.log("✔ Migrations appliquées.");
}

main().catch((error) => {
  console.error("✖ Échec des migrations :", error);
  process.exit(1);
});
