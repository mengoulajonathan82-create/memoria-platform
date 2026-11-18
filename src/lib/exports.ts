/**
 * Exports CSV de données NON sensibles (administrateurs uniquement).
 * Exclus volontairement : familles et leurs contacts, notes internes,
 * coordonnées des visiteurs, contenus des messages, adresses IP, comptes.
 */
import { and, count, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { candles, condolenceMessages, deceasedProfiles, media } from "@/lib/db/schema";
import { buildPublicUrl } from "@/lib/qr";
import { toCsv } from "@/lib/csv";
import { PROFILE_STATUS_LABELS } from "@/lib/validation/profile";

export const EXPORT_TYPES = { fiches: "Fiches défunts et statistiques" } as const;
export type ExportType = keyof typeof EXPORT_TYPES;

async function countsBy(
  db: Database,
  table: typeof condolenceMessages | typeof candles | typeof media,
  where: ReturnType<typeof eq>,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ profileId: table.profileId, n: count() })
    .from(table)
    .where(where)
    .groupBy(table.profileId);
  return new Map(rows.map((r) => [r.profileId, r.n]));
}

export async function exportProfilesCsv(db: Database, appUrl: string): Promise<string> {
  const profiles = await db
    .select({
      id: deceasedProfiles.id,
      publicId: deceasedProfiles.publicId,
      fullName: deceasedProfiles.fullName,
      birthDate: deceasedProfiles.birthDate,
      deathDate: deceasedProfiles.deathDate,
      status: deceasedProfiles.status,
      publishedAt: deceasedProfiles.publishedAt,
      createdAt: deceasedProfiles.createdAt,
    })
    .from(deceasedProfiles)
    .where(ne(deceasedProfiles.status, "deleted"))
    .orderBy(deceasedProfiles.fullName);

  const [messages, lit, medias] = await Promise.all([
    countsBy(db, condolenceMessages, eq(condolenceMessages.status, "approved")),
    countsBy(db, candles, eq(candles.status, "approved")),
    countsBy(db, media, and(eq(media.status, "active"))!),
  ]);

  return toCsv(
    ["Nom", "Naissance", "Décès", "Statut", "Publiée le", "Adresse publique", "Messages publiés", "Bougies", "Médias", "Créée le"],
    profiles.map((p) => [
      p.fullName,
      p.birthDate,
      p.deathDate,
      PROFILE_STATUS_LABELS[p.status],
      p.status === "published" ? p.publishedAt : null,
      buildPublicUrl(appUrl, p.publicId),
      messages.get(p.id) ?? 0,
      lit.get(p.id) ?? 0,
      medias.get(p.id) ?? 0,
      p.createdAt,
    ]),
  );
}
