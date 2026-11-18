/**
 * Détection du VRAI type d'un fichier à partir de ses premiers octets
 * (« signature »), indépendamment du nom et du type annoncé par le navigateur.
 */
import type { MediaType } from "@/lib/db/schema";

export interface DetectedFile {
  type: MediaType;
  mime: string;
  /** Extension canonique utilisée pour le stockage. */
  ext: string;
  /** Extensions de nom de fichier acceptées pour ce type. */
  allowedExtensions: readonly string[];
}

const KINDS = {
  jpeg: { type: "image", mime: "image/jpeg", ext: "jpg", allowedExtensions: ["jpg", "jpeg"] },
  png: { type: "image", mime: "image/png", ext: "png", allowedExtensions: ["png"] },
  webp: { type: "image", mime: "image/webp", ext: "webp", allowedExtensions: ["webp"] },
  mp4: { type: "video", mime: "video/mp4", ext: "mp4", allowedExtensions: ["mp4", "m4v"] },
  mov: { type: "video", mime: "video/quicktime", ext: "mov", allowedExtensions: ["mov"] },
  webm: { type: "video", mime: "video/webm", ext: "webm", allowedExtensions: ["webm"] },
  pdf: { type: "document", mime: "application/pdf", ext: "pdf", allowedExtensions: ["pdf"] },
} as const satisfies Record<string, DetectedFile>;

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buf.subarray(start, end));
}

/** Marques « ftyp » des conteneurs HEIF/HEIC (photos iPhone) : non prises en charge. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export type DetectionResult =
  | { ok: true; file: DetectedFile }
  | { ok: false; reason: "unsupported" | "heic" };

export function detectFileType(buf: Uint8Array): DetectionResult {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { ok: true, file: KINDS.jpeg };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, file: KINDS.png };
  if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    return { ok: true, file: KINDS.webp };
  }
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, file: KINDS.pdf }; // %PDF-
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { ok: true, file: KINDS.webm }; // EBML
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12).toLowerCase();
    if (HEIF_BRANDS.has(brand)) return { ok: false, reason: "heic" };
    if (brand === "qt  ") return { ok: true, file: KINDS.mov };
    return { ok: true, file: KINDS.mp4 };
  }
  return { ok: false, reason: "unsupported" };
}

/** Extension du nom de fichier fourni, en minuscules ("" si absente). */
export function fileExtension(name: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? match[1]!.toLowerCase() : "";
}

export const ACCEPT_ATTRIBUTE =
  "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf";

/** Tailles maximales par type (octets). */
export const MAX_BYTES: Record<MediaType, number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_BYTES));
export const MAX_MEDIA_PER_PROFILE = 100;
