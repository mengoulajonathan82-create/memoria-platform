/**
 * Sauvegarde et restauration locales.
 *
 * Une sauvegarde est un dossier `backups/sauvegarde-AAAAMMJJ-HHMMSS/` contenant :
 * - `memoria.db` : copie cohérente de la base (SQLite « VACUUM INTO ») ;
 * - `uploads/`   : copie des médias et du logo ;
 * - `manifest.json`.
 * Les sauvegardes contiennent des données personnelles : le dossier n'est pas
 * versionné et doit être protégé (disque chiffré, copie hors site sécurisée…).
 *
 * La restauration se fait UNIQUEMENT en ligne de commande, serveur arrêté
 * (scripts/restore.ts) : elle crée d'abord une sauvegarde de sécurité.
 */
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Client } from "@libsql/client";

export const BACKUP_NAME_PATTERN = /^sauvegarde-\d{8}-\d{6}(-[a-z0-9]+)?$/;

export interface BackupInfo {
  name: string;
  createdAt: Date;
  sizeBytes: number;
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function dirSize(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return total;
}

/** Résout le dossier d'une sauvegarde à partir de son nom, sans sortir du dossier racine. */
export function resolveBackupDir(backupsRoot: string, name: string): string {
  if (!BACKUP_NAME_PATTERN.test(name)) throw new Error("Nom de sauvegarde invalide.");
  const root = resolve(backupsRoot);
  const dir = resolve(root, name);
  if (!dir.startsWith(root + sep)) throw new Error("Nom de sauvegarde invalide.");
  return dir;
}

export async function createBackup(options: {
  client: Client;
  storageRoot: string;
  backupsRoot: string;
  now?: Date;
  suffix?: string;
}): Promise<BackupInfo> {
  const now = options.now ?? new Date();
  const name = `sauvegarde-${stamp(now)}${options.suffix ? `-${options.suffix}` : ""}`;
  const dir = resolveBackupDir(options.backupsRoot, name);
  if (await exists(dir)) throw new Error("Une sauvegarde porte déjà ce nom : réessayez dans une seconde.");
  await mkdir(dir, { recursive: true });

  try {
    // Copie cohérente même si l'application est en cours d'utilisation.
    await options.client.execute({ sql: "VACUUM INTO ?", args: [join(dir, "memoria.db")] });
    const storageRoot = resolve(options.storageRoot);
    if (await exists(storageRoot)) await cp(storageRoot, join(dir, "uploads"), { recursive: true });
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({ format: 1, createdAt: now.toISOString(), database: "memoria.db", uploads: "uploads" }, null, 2),
    );
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { name, createdAt: now, sizeBytes: await dirSize(dir) };
}

export async function listBackups(backupsRoot: string): Promise<BackupInfo[]> {
  const root = resolve(backupsRoot);
  if (!(await exists(root))) return [];
  const result: BackupInfo[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !BACKUP_NAME_PATTERN.test(entry.name)) continue;
    const dir = join(root, entry.name);
    try {
      const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { createdAt: string };
      result.push({ name: entry.name, createdAt: new Date(manifest.createdAt), sizeBytes: await dirSize(dir) });
    } catch {
      // Dossier incomplet : ignoré.
    }
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Vérifie qu'une sauvegarde est complète et que sa base est intègre.
 * Utilise le module SQLite intégré à Node (`node:sqlite`), en lecture seule :
 * contrairement au pilote libsql, il libère le fichier dès la fermeture
 * (important sous Windows).
 */
export async function verifyBackup(dir: string): Promise<void> {
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { format?: number };
  if (manifest.format !== 1) throw new Error("Format de sauvegarde inconnu.");
  const dbFile = join(dir, "memoria.db");
  if (!(await exists(dbFile))) throw new Error("Base de données absente de la sauvegarde.");
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(dbFile, { readOnly: true });
    const check = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown> | undefined;
    if (!check || Object.values(check)[0] !== "ok") throw new Error("corrompue");
    const users = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!users) throw new Error("pas une base Memoria");
  } catch (error) {
    throw new Error(`Sauvegarde invalide ou corrompue (${error instanceof Error ? error.message : "erreur"}).`);
  } finally {
    database?.close();
  }
}

/**
 * Remplace la base et les médias actuels par ceux d'une sauvegarde.
 * À n'appeler que serveur arrêté. La base est recopiée SUR PLACE (et non
 * renommée), ce qui fonctionne même si Windows garde un verrou de lecture ;
 * une copie de secours permet de revenir en arrière en cas d'échec.
 */
export async function restoreBackup(options: { backupDir: string; dbPath: string; storageRoot: string }): Promise<void> {
  await verifyBackup(options.backupDir);
  const dbPath = resolve(options.dbPath);
  const storageRoot = resolve(options.storageRoot);
  const suffix = `.restauration-${Date.now()}`;

  const hadDb = await exists(dbPath);
  const hadUploads = await exists(storageRoot);
  if (hadDb) await copyFile(dbPath, dbPath + suffix);
  if (hadUploads) await rename(storageRoot, storageRoot + suffix);

  try {
    await mkdir(resolve(dbPath, ".."), { recursive: true });
    await copyFile(join(options.backupDir, "memoria.db"), dbPath);
    for (const extra of [`${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) await rm(extra, { force: true });
    const uploads = join(options.backupDir, "uploads");
    if (await exists(uploads)) await cp(uploads, storageRoot, { recursive: true });
  } catch (error) {
    // Échec : retour à l'état précédent.
    if (hadDb) await copyFile(dbPath + suffix, dbPath);
    await rm(storageRoot, { recursive: true, force: true });
    if (hadUploads) await rename(storageRoot + suffix, storageRoot);
    throw error;
  }
  if (hadDb) await rm(dbPath + suffix, { force: true });
  if (hadUploads) await rm(storageRoot + suffix, { recursive: true, force: true });
}

/** Chemin du fichier SQLite à partir de DATABASE_URL (`file:./data/memoria.db`). */
export function sqlitePathFromUrl(url: string): string {
  if (!url.startsWith("file:") || url.includes(":memory:")) {
    throw new Error("La sauvegarde intégrée ne prend en charge que SQLite en fichier local.");
  }
  return url.slice("file:".length);
}

export function getBackupsRoot(): string {
  return process.env.BACKUP_DIR || "./backups";
}
