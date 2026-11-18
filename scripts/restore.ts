/**
 * Restaure une sauvegarde. SERVEUR ARRÊTÉ uniquement.
 *
 *   npm run restore                          → liste les sauvegardes disponibles
 *   npm run restore -- <nom> --confirm       → restaure (après sauvegarde de sécurité)
 */
import "dotenv/config";
import {
  createBackup,
  getBackupsRoot,
  listBackups,
  resolveBackupDir,
  restoreBackup,
  sqlitePathFromUrl,
} from "../src/lib/backup";
import { createDatabase, getDatabaseUrl } from "../src/lib/db/client";

async function main() {
  const [name, flag] = process.argv.slice(2);
  const backupsRoot = getBackupsRoot();
  const storageRoot = process.env.MEDIA_STORAGE_DIR || "./uploads";

  if (!name) {
    const list = await listBackups(backupsRoot);
    if (list.length === 0) console.log("Aucune sauvegarde dans", backupsRoot);
    for (const b of list) console.log(`- ${b.name}  (${b.createdAt.toLocaleString("fr-FR")})`);
    console.log("\nPour restaurer : npm run restore -- <nom> --confirm   (serveur arrêté)");
    return;
  }
  const backupDir = resolveBackupDir(backupsRoot, name);
  if (flag !== "--confirm") {
    console.log(`La restauration de « ${name} » REMPLACERA la base et les médias actuels.`);
    console.log("Arrêtez d'abord le serveur, puis relancez avec --confirm.");
    process.exit(2);
  }

  // 1. Sauvegarde de sécurité de l'état actuel.
  const url = getDatabaseUrl();
  const { client } = await createDatabase(url);
  const safety = await createBackup({ client, storageRoot, backupsRoot, suffix: "avant-restauration" });
  client.close();
  console.log(`✔ Sauvegarde de sécurité : ${safety.name}`);

  // 2. Restauration.
  await restoreBackup({ backupDir, dbPath: sqlitePathFromUrl(url), storageRoot });
  console.log(`✔ Sauvegarde « ${name} » restaurée. Lancez « npm run db:migrate » puis redémarrez le serveur.`);
}

main().catch((error) => {
  console.error("✖ Échec de la restauration :", error instanceof Error ? error.message : error);
  process.exit(1);
});
