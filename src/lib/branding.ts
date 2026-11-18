/**
 * Paramètres de personnalisation (nom de l'entreprise, logo, couleur, textes).
 * Stockés dans la table `settings` sous la clé `branding`.
 * L'écran d'édition arrive en Phase 6.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export const BRANDING_SETTING_KEY = "branding";

export const brandingSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  logoPath: z.string().max(255).nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue."),
  welcomeText: z.string().max(1000),
  footerText: z.string().max(1000),
});

export type Branding = z.infer<typeof brandingSchema>;

export const DEFAULT_BRANDING: Branding = {
  companyName: "Pompes funèbres (exemple)",
  logoPath: null,
  primaryColor: "#4a5568",
  welcomeText:
    "Pour consulter la page d'un proche, scannez le QR code qui vous a été remis.",
  footerText: "Texte de pied de page à personnaliser.",
};

export async function getBranding(db: Database): Promise<Branding> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, BRANDING_SETTING_KEY))
    .limit(1);
  if (!row) return DEFAULT_BRANDING;
  try {
    const parsed = brandingSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULT_BRANDING;
  } catch {
    return DEFAULT_BRANDING;
  }
}
