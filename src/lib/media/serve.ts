/**
 * Envoi d'un fichier stocké en réponse HTTP, avec :
 * - en-têtes de sécurité stricts (pas de détection de type, aucun script) ;
 * - requêtes partielles (Range / 206), indispensables à la lecture vidéo sur iOS ;
 * - ETag pour éviter de retransférer un fichier inchangé.
 */
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { Media } from "@/lib/db/schema";
import type { MediaStorage } from "./storage";

export type Variant = "full" | "thumb";

export function parseVariant(value: string | null): Variant {
  return value === "thumb" ? "thumb" : "full";
}

/** Analyse « bytes=début-fin ». Retourne null si absente ou invalide. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    // « bytes=-500 » : les 500 derniers octets.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

export async function serveMediaFile(
  request: Request,
  storage: MediaStorage,
  item: Media,
  variant: Variant,
  cacheControl: string,
): Promise<Response> {
  const relativePath = variant === "thumb" && item.thumbPath ? item.thumbPath : item.storagePath;
  const mime = relativePath.endsWith(".webp") ? "image/webp" : item.mimeType;
  const etag = `"${item.publicKey}-${variant}"`;

  const headers = new Headers({
    "Content-Type": mime,
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Accept-Ranges": "bytes",
  });
  // Les PDF sont téléchargés, jamais affichés dans le contexte du site.
  headers.set(
    "Content-Disposition",
    item.type === "document" ? `attachment; filename="document.pdf"` : "inline",
  );

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  let size: number;
  try {
    size = await storage.size(relativePath);
  } catch {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  const full = storage.resolvePath(relativePath);

  const rangeHeader = request.headers.get("range");
  const range = parseRange(rangeHeader, size);
  if (rangeHeader && !range) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers });
}
