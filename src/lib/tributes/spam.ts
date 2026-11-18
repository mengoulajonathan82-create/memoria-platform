/**
 * Protection anti-spam simple pour les formulaires publics, sans service externe :
 * - champ piège invisible (« honeypot ») que seuls les robots remplissent ;
 * - jeton signé contenant l'heure d'affichage du formulaire : refus des envois
 *   trop rapides (robots) ou trop anciens, et des jetons falsifiés ;
 * - refus des liens et d'une liste basique de mots interdits.
 * Les limites de fréquence par adresse IP (hachée) sont dans le service.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_FILL_MS = 3_000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

function sign(secret: string, publicId: string, timestamp: number): string {
  return createHmac("sha256", `form-token:${secret}`)
    .update(`${publicId}:${timestamp}`)
    .digest("base64url")
    .slice(0, 32);
}

export function createFormToken(secret: string, publicId: string, now = Date.now()): string {
  return `${now}.${sign(secret, publicId, now)}`;
}

export type FormTokenCheck = "ok" | "invalid" | "too_fast" | "expired";

export function checkFormToken(
  secret: string,
  publicId: string,
  token: unknown,
  now = Date.now(),
): FormTokenCheck {
  if (typeof token !== "string") return "invalid";
  const match = /^(\d{10,16})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return "invalid";
  const timestamp = Number(match[1]);
  const expected = Buffer.from(sign(secret, publicId, timestamp));
  const given = Buffer.from(match[2]!);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - timestamp;
  if (age < MIN_FILL_MS) return "too_fast";
  if (age > MAX_FORM_AGE_MS) return "expired";
  return "ok";
}

/** Normalise pour la détection : minuscules, sans accents, séparateurs simplifiés. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const LINK_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|fr|io|ru|xyz|info|biz|top|click)\b)/i;

export function containsLink(text: string): boolean {
  return LINK_PATTERN.test(normalize(text));
}

/**
 * Liste par défaut, volontairement courte et prudente (insultes et termes de
 * spam courants). Modifiable dans Paramètres → Modération.
 */
export const FORBIDDEN_WORDS = [
  "connard",
  "connasse",
  "salope",
  "encule",
  "batard",
  "pute",
  "nique",
  "fdp",
  "ntm",
  "casino",
  "viagra",
  "crypto",
  "bitcoin",
  "porn",
] as const;

export function containsForbiddenWord(text: string, words: readonly string[] = FORBIDDEN_WORDS): boolean {
  const tokens = new Set(normalize(text).split(/[^a-z0-9]+/).filter(Boolean));
  return words.some((w) => tokens.has(w));
}

export type ContentCheck = "ok" | "link" | "forbidden";

export function checkContent(
  fields: (string | null | undefined)[],
  words: readonly string[] = FORBIDDEN_WORDS,
): ContentCheck {
  const text = fields.filter(Boolean).join(" \n ");
  if (containsLink(text)) return "link";
  if (containsForbiddenWord(text, words)) return "forbidden";
  return "ok";
}
