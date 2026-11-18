/**
 * Paramètres modifiables depuis le back-office :
 * - identité (nom, logo, couleur, textes d'accueil et de pied de page) ;
 * - règles de modération (liste des mots interdits).
 */
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import { BRANDING_SETTING_KEY, type Branding, getBranding } from "@/lib/branding";
import type { Database } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { detectFileType } from "@/lib/media/detect";
import type { MediaStorage } from "@/lib/media/storage";
import { generatePublicId } from "@/lib/security/crypto";
import { FORBIDDEN_WORDS } from "@/lib/tributes/spam";

export const MODERATION_SETTING_KEY = "moderation";

/* -------------------------------------------------------------------------- */
/* Contraste (accessibilité)                                                  */
/* -------------------------------------------------------------------------- */

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Rapport de contraste WCAG entre une couleur et le blanc. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const brandingFormSchema = z.object({
  companyName: z.preprocess((v) => v ?? "", z.string().trim().min(1, "Le nom est obligatoire.").max(120)),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.")
    .refine((c) => contrastWithWhite(c) >= 4.5, "Couleur trop claire : le texte blanc des boutons serait illisible."),
  welcomeText: z.preprocess((v) => v ?? "", z.string().trim().max(1000, "1000 caractères maximum.")),
  footerText: z.preprocess((v) => v ?? "", z.string().trim().max(1000, "1000 caractères maximum.")),
});
export type BrandingFormInput = z.infer<typeof brandingFormSchema>;

/** Liste saisie (une entrée par ligne ou séparée par des virgules) → mots normalisés. */
export function parseWordList(raw: string): string[] {
  const words = raw
    .split(/[\n,;]+/)
    .map((w) =>
      w
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim(),
    )
    .filter((w) => /^[a-z0-9]{2,40}$/.test(w));
  return [...new Set(words)].slice(0, 500);
}

const moderationSchema = z.object({ forbiddenWords: z.array(z.string()).max(500) });
export type ModerationSettings = z.infer<typeof moderationSchema>;
export const DEFAULT_MODERATION: ModerationSettings = { forbiddenWords: [...FORBIDDEN_WORDS] };

/* -------------------------------------------------------------------------- */
/* Lecture / écriture                                                         */
/* -------------------------------------------------------------------------- */

async function writeSetting(db: Database, key: string, value: unknown, userId: string) {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key, value: json, updatedById: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedById: userId, updatedAt: new Date() } });
}

export async function getModerationSettings(db: Database): Promise<ModerationSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, MODERATION_SETTING_KEY)).limit(1);
  if (!row) return DEFAULT_MODERATION;
  try {
    const parsed = moderationSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULT_MODERATION;
  } catch {
    return DEFAULT_MODERATION;
  }
}

export async function saveModerationSettings(db: Database, value: ModerationSettings, actor: Actor) {
  await writeSetting(db, MODERATION_SETTING_KEY, value, actor.userId);
  await logActivity(db, {
    userId: actor.userId,
    action: "settings.update",
    entityType: "settings",
    details: { section: "moderation", words: value.forbiddenWords.length },
    ipHash: actor.ipHash,
  });
}

export type LogoChange = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; bytes: Buffer };

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Enregistre l'identité visuelle. Le logo est vérifié (type réel), ré-encodé
 * en PNG (400 × 160 max, sans métadonnées) et stocké hors de `public/`.
 */
export async function saveBranding(
  db: Database,
  storage: MediaStorage,
  input: BrandingFormInput,
  logo: LogoChange,
  actor: Actor,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getBranding(db);
  let logoPath = current.logoPath;

  if (logo.kind === "replace") {
    if (logo.bytes.length > MAX_LOGO_BYTES) return { ok: false, error: "Logo trop lourd (2 Mo maximum)." };
    const detected = detectFileType(logo.bytes);
    if (!detected.ok || detected.file.type !== "image") {
      return { ok: false, error: "Le logo doit être une image JPEG, PNG ou WebP." };
    }
    let png: Buffer;
    try {
      png = await sharp(logo.bytes, { limitInputPixels: 25_000_000, failOn: "error" })
        .resize({ width: 400, height: 160, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      return { ok: false, error: "Image de logo illisible." };
    }
    logoPath = `branding/logo-${generatePublicId()}.png`;
    await storage.write(logoPath, png);
  } else if (logo.kind === "remove") {
    logoPath = null;
  }

  const next: Branding = { ...input, logoPath };
  await writeSetting(db, BRANDING_SETTING_KEY, next, actor.userId);
  if (current.logoPath && current.logoPath !== logoPath) {
    await storage.remove(current.logoPath).catch(() => undefined);
  }
  await logActivity(db, {
    userId: actor.userId,
    action: "settings.update",
    entityType: "settings",
    details: { section: "branding", logo: logo.kind },
    ipHash: actor.ipHash,
  });
  return { ok: true };
}
