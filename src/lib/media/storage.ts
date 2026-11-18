/**
 * Stockage local des médias, HORS du dossier `public/` : aucun fichier n'est
 * servi directement par le serveur web ; tout passe par des routes qui
 * vérifient les droits. Les fichiers ne sont jamais exécutés.
 *
 * Remplaçable plus tard par un stockage objet (S3…) en gardant cette interface.
 */
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";

export interface MediaStorage {
  root: string;
  resolvePath(relativePath: string): string;
  write(relativePath: string, data: Uint8Array): Promise<void>;
  read(relativePath: string): Promise<Buffer>;
  size(relativePath: string): Promise<number>;
  remove(relativePath: string): Promise<void>;
}

export function createMediaStorage(rootDir: string): MediaStorage {
  const root = resolve(rootDir);

  /** Refuse tout chemin qui sortirait du dossier racine (« ../ », chemin absolu…). */
  function resolvePath(relativePath: string): string {
    if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\0")) {
      throw new Error("Chemin de stockage invalide.");
    }
    const full = resolve(root, relativePath);
    if (!full.startsWith(root + sep)) throw new Error("Chemin de stockage invalide.");
    return full;
  }

  return {
    root,
    resolvePath,
    async write(relativePath, data) {
      const full = resolvePath(relativePath);
      await mkdir(dirname(full), { recursive: true });
      // flag « wx » : n'écrase jamais un fichier existant.
      await writeFile(full, data, { flag: "wx" });
    },
    read: (relativePath) => readFile(resolvePath(relativePath)),
    size: async (relativePath) => (await stat(resolvePath(relativePath))).size,
    remove: (relativePath) => rm(resolvePath(relativePath), { force: true }),
  };
}

let shared: MediaStorage | undefined;

/** Stockage de l'application (dossier MEDIA_STORAGE_DIR, `./uploads` par défaut). */
export function getMediaStorage(): MediaStorage {
  shared ??= createMediaStorage(process.env.MEDIA_STORAGE_DIR || "./uploads");
  return shared;
}
