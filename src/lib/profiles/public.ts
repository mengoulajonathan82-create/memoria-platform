/**
 * Lecture PUBLIQUE d'une fiche (page accessible par QR code).
 *
 * Règles de confidentialité :
 * - sélection d'une LISTE BLANCHE de colonnes : les notes internes, la famille,
 *   les auteurs, l'identifiant interne… ne sont jamais lus ici ;
 * - les champs masqués par l'employé sont remplacés par `null` avant de
 *   quitter ce module ;
 * - seule une fiche au statut « publiée » est renvoyée.
 */
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { deceasedProfiles, media } from "@/lib/db/schema";
import { isValidPublicId } from "@/lib/security/crypto";
import { isPublicThemeId, type PublicThemeId } from "@/lib/themes";
import {
  getPublicCandles,
  listPublicCondolences,
  type PublicCandle,
  type PublicCondolence,
} from "@/lib/tributes/service";

export interface PublicCeremony {
  date: string | null;
  time: string | null;
  location: string | null;
  address: string | null;
  livestreamUrl: string | null;
}

export interface PublicPhoto {
  url: string;
  width: number | null;
  height: number | null;
}

export interface PublicMediaItem {
  type: "image" | "video" | "document";
  url: string;
  thumbUrl: string | null;
  mimeType: string;
  caption: string | null;
  width: number | null;
  height: number | null;
}

/** Données pouvant être affichées publiquement. Rien d'autre ne doit y figurer. */
export interface PublicProfile {
  fullName: string;
  /** Thème propre à la fiche (null = thème par défaut des paramètres). */
  theme: PublicThemeId | null;
  mainPhoto: PublicPhoto | null;
  gallery: PublicMediaItem[];
  birthDate: string | null;
  deathDate: string | null;
  biography: string | null;
  ceremony: PublicCeremony | null;
  practicalInfo: string | null;
  showGallery: boolean;
  allowCondolences: boolean;
  allowCandles: boolean;
  /** Messages approuvés (nom, message, date — jamais les coordonnées). null si désactivés. */
  condolences: PublicCondolence[] | null;
  /** Bougies approuvées. null si désactivées. */
  candles: { count: number; recent: PublicCandle[] } | null;
}

export type PublicProfileLookup =
  | { kind: "published"; profile: PublicProfile }
  /** La fiche existe mais n'est pas (ou plus) publiée : page sobre, sans aucune donnée. */
  | { kind: "unavailable" }
  | { kind: "not_found" };

export async function getPublicProfile(
  db: Database,
  publicId: string,
): Promise<PublicProfileLookup> {
  if (!isValidPublicId(publicId)) return { kind: "not_found" };

  const [row] = await db
    .select({
      // Utilisé uniquement pour charger les médias ; jamais renvoyé.
      internalId: deceasedProfiles.id,
      mainPhotoMediaId: deceasedProfiles.mainPhotoMediaId,
      theme: deceasedProfiles.theme,
      status: deceasedProfiles.status,
      fullName: deceasedProfiles.fullName,
      birthDate: deceasedProfiles.birthDate,
      deathDate: deceasedProfiles.deathDate,
      biography: deceasedProfiles.biography,
      ceremonyDate: deceasedProfiles.ceremonyDate,
      ceremonyTime: deceasedProfiles.ceremonyTime,
      ceremonyLocation: deceasedProfiles.ceremonyLocation,
      ceremonyAddress: deceasedProfiles.ceremonyAddress,
      livestreamUrl: deceasedProfiles.livestreamUrl,
      practicalInfo: deceasedProfiles.practicalInfo,
      showDates: deceasedProfiles.showDates,
      showBiography: deceasedProfiles.showBiography,
      showCeremony: deceasedProfiles.showCeremony,
      showPracticalInfo: deceasedProfiles.showPracticalInfo,
      showGallery: deceasedProfiles.showGallery,
      allowCondolences: deceasedProfiles.allowCondolences,
      allowCandles: deceasedProfiles.allowCandles,
    })
    .from(deceasedProfiles)
    .where(eq(deceasedProfiles.publicId, publicId))
    .limit(1);

  if (!row) return { kind: "not_found" };
  if (row.status !== "published") return { kind: "unavailable" };

  const ceremony: PublicCeremony = {
    date: row.ceremonyDate,
    time: row.ceremonyTime,
    location: row.ceremonyLocation,
    address: row.ceremonyAddress,
    livestreamUrl: row.livestreamUrl,
  };
  const hasCeremony = Object.values(ceremony).some(Boolean);

  const activeMedia = await db
    .select({
      id: media.id,
      publicKey: media.publicKey,
      type: media.type,
      mimeType: media.mimeType,
      caption: media.caption,
      width: media.width,
      height: media.height,
      isPublic: media.isPublic,
      thumbPath: media.thumbPath,
    })
    .from(media)
    .where(and(eq(media.profileId, row.internalId), eq(media.status, "active")))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));

  const mediaUrl = (key: string) => `/memoire/${publicId}/medias/${key}`;
  const main = activeMedia.find((m) => m.id === row.mainPhotoMediaId && m.type === "image");
  const gallery: PublicMediaItem[] = row.showGallery
    ? activeMedia
        .filter((m) => m.isPublic && m.id !== main?.id)
        .map((m) => ({
          type: m.type,
          url: mediaUrl(m.publicKey),
          thumbUrl: m.thumbPath ? `${mediaUrl(m.publicKey)}?v=thumb` : null,
          mimeType: m.mimeType,
          caption: m.caption,
          width: m.width,
          height: m.height,
        }))
    : [];

  return {
    kind: "published",
    profile: {
      fullName: row.fullName,
      theme: isPublicThemeId(row.theme) ? row.theme : null,
      mainPhoto: main ? { url: mediaUrl(main.publicKey), width: main.width, height: main.height } : null,
      gallery,
      birthDate: row.showDates ? row.birthDate : null,
      deathDate: row.showDates ? row.deathDate : null,
      biography: row.showBiography ? row.biography : null,
      ceremony: row.showCeremony && hasCeremony ? ceremony : null,
      practicalInfo: row.showPracticalInfo ? row.practicalInfo : null,
      showGallery: row.showGallery,
      allowCondolences: row.allowCondolences,
      allowCandles: row.allowCandles,
      condolences: row.allowCondolences ? await listPublicCondolences(db, row.internalId) : null,
      candles: row.allowCandles ? await getPublicCandles(db, row.internalId) : null,
    },
  };
}
