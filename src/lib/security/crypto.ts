/**
 * Primitives cryptographiques (module Node `crypto`, aucune dépendance).
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

/** Jeton aléatoire encodé en base64url (32 octets = 256 bits par défaut). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const PUBLIC_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const PUBLIC_ID_LENGTH = 32;

/**
 * Identifiant public d'une fiche (utilisé dans l'URL du QR code).
 * 32 caractères pris dans un alphabet de 57 symboles sans caractères ambigus
 * (≈ 186 bits d'entropie) : impossible à deviner ou à balayer.
 * Tirage sans biais modulo (rejet des octets ≥ 228).
 */
export function generatePublicId(length = PUBLIC_ID_LENGTH): string {
  const alphabetSize = PUBLIC_ID_ALPHABET.length;
  const limit = 256 - (256 % alphabetSize);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += PUBLIC_ID_ALPHABET[byte % alphabetSize];
      if (out.length === length) break;
    }
  }
  return out;
}

export function isValidPublicId(value: string): boolean {
  if (value.length !== PUBLIC_ID_LENGTH) return false;
  for (const char of value) {
    if (!PUBLIC_ID_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Empreinte d'une adresse IP (HMAC-SHA256 tronqué) : permet l'anti-spam et
 * la journalisation sans conserver l'adresse en clair.
 */
export function hashIp(ip: string | null | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHmac("sha256", secret).update(ip.trim()).digest("hex").slice(0, 32);
}
