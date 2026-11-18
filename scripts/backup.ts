/**
 * Crée une sauvegarde (base + médias) dans BACKUP_DIR (./backups par défaut).
 * Usage : npm run backup
 */
import "dotenv/config";
import { createBackup, getBackupsRoot } from "../src/lib/backup";
import { createDatabase, getDatabaseUrl } from "../src/lib/db/client";

async function main() {
  const { client } = await createDatabase(getDatabaseUrl());
  const info = await createBackup({
    client,
    storageRoot: process.env.MEDIA_STORAGE_DIR || "./uploads",
    backupsRoot: getBackupsRoot(),
  });
  client.close();
  console.log(`✔ Sauvegarde créée : ${info.name} (${Math.round(info.sizeBytes / 1024)} Ko)`);
}

main().catch((error) => {
  console.error("✖ Échec de la sauvegarde :", error instanceof Error ? error.message : error);
  process.exit(1);
});
