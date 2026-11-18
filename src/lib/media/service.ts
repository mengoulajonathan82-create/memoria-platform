/**
 * Service « médias » : ajout sécurisé, ordre, légendes, visibilité,
 * photo principale, corbeille (suppression logique) et règles d'accès.
 * Les contrôles de permission sont faits par l'appelant.
 */
import { and, asc, count, eq, max } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import type { Database } from "@/lib/db/client";
import { deceasedProfiles, media, type Media } from "@/lib/db/schema";
import { generatePublicId } from "@/lib/security/crypto";
import {
  detectFileType,
  fileExtension,
  MAX_BYTES,
  MAX_MEDIA_PER_PROFILE,
} from "./detect";
import { processImage } from "./image";
import type { MediaStorage } from "./storage";

const MB = 1024 * 1024;

export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

export interface UploadInput {
  profileId: string;
  fileName: string;
  bytes: Buffer;
}

export async function ingestUpload(
  db: Database,
  storage: MediaStorage,
  input: UploadInput,
  actor: Actor,
): Promise<UploadResult> {
  const [profile] = await db
    .select({ id: deceasedProfiles.id, status: deceasedProfiles.status })
    .from(deceasedProfiles)
    .where(eq(deceasedProfiles.id, input.profileId))
    .limit(1);
  if (!profile || profile.status === "deleted") return { ok: false, error: "Fiche introuvable." };

  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.profileId, input.profileId), eq(media.status, "active")));
  if (n >= MAX_MEDIA_PER_PROFILE) {
    return { ok: false, error: `Nombre maximal de médias atteint (${MAX_MEDIA_PER_PROFILE}).` };
  }

  if (input.bytes.length === 0) return { ok: false, error: "Le fichier est vide." };

  const detection = detectFileType(input.bytes);
  if (!detection.ok) {
    return {
      ok: false,
      error:
        detection.reason === "heic"
          ? "Format HEIC (photo iPhone) non pris en charge : exportez la photo en JPEG."
          : "Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WebP, MP4, MOV, WebM, PDF.",
    };
  }
  const detected = detection.file;
  if (!detected.allowedExtensions.includes(fileExtension(input.fileName))) {
    return { ok: false, error: "L'extension du fichier ne correspond pas à son contenu." };
  }
  if (input.bytes.length > MAX_BYTES[detected.type]) {
    return {
      ok: false,
      error: `Fichier trop volumineux (maximum ${MAX_BYTES[detected.type] / MB} Mo pour ce type).`,
    };
  }

  const publicKey = generatePublicId();
  const folder = input.profileId;
  const written: string[] = [];

  try {
    let values: Pick<Media, "storagePath" | "thumbPath" | "mimeType" | "sizeBytes" | "width" | "height">;
    if (detected.type === "image") {
      let processed;
      try {
        processed = await processImage(input.bytes);
      } catch {
        return { ok: false, error: "Image illisible, corrompue ou trop grande." };
      }
      const storagePath = `${folder}/${publicKey}.webp`;
      const thumbPath = `${folder}/${publicKey}_thumb.webp`;
      await storage.write(storagePath, processed.main);
      written.push(storagePath);
      await storage.write(thumbPath, processed.thumb);
      written.push(thumbPath);
      values = {
        storagePath,
        thumbPath,
        mimeType: "image/webp",
        sizeBytes: processed.main.length,
        width: processed.width,
        height: processed.height,
      };
    } else {
      // Vidéos et PDF : stockés tels quels (jamais exécutés, servis avec des en-têtes stricts).
      const storagePath = `${folder}/${publicKey}.${detected.ext}`;
      await storage.write(storagePath, input.bytes);
      written.push(storagePath);
      values = {
        storagePath,
        thumbPath: null,
        mimeType: detected.mime,
        sizeBytes: input.bytes.length,
        width: null,
        height: null,
      };
    }

    const [{ last } = { last: null }] = await db
      .select({ last: max(media.sortOrder) })
      .from(media)
      .where(eq(media.profileId, input.profileId));

    const [row] = await db
      .insert(media)
      .values({
        ...values,
        profileId: input.profileId,
        type: detected.type,
        publicKey,
        sortOrder: (last ?? -1) + 1,
        uploadedById: actor.userId,
      })
      .returning({ id: media.id });

    await logActivity(db, {
      userId: actor.userId,
      action: "media.upload",
      entityType: "profile",
      entityId: input.profileId,
      details: { type: detected.type },
      ipHash: actor.ipHash,
    });
    return { ok: true, id: row!.id };
  } catch (error) {
    // Pas de fichier orphelin si l'enregistrement échoue.
    await Promise.all(written.map((p) => storage.remove(p).catch(() => undefined)));
    throw error;
  }
}

export async function listProfileMedia(
  db: Database,
  profileId: string,
  status: "active" | "deleted" = "active",
): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(and(eq(media.profileId, profileId), eq(media.status, status)))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));
}

export async function getMedia(db: Database, id: string): Promise<Media | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function getMediaByKey(db: Database, publicKey: string): Promise<Media | null> {
  const [row] = await db.select().from(media).where(eq(media.publicKey, publicKey)).limit(1);
  return row ?? null;
}

async function logMedia(db: Database, actor: Actor, action: "media.update" | "media.delete" | "media.restore", m: Media, details?: Record<string, string>) {
  await logActivity(db, {
    userId: actor.userId,
    action,
    entityType: "profile",
    entityId: m.profileId,
    details: { type: m.type, ...details },
    ipHash: actor.ipHash,
  });
}

export async function updateMediaDetails(
  db: Database,
  id: string,
  input: { caption: string | null; isPublic: boolean },
  actor: Actor,
): Promise<boolean> {
  const existing = await getMedia(db, id);
  if (!existing || existing.status !== "active") return false;
  await db.update(media).set(input).where(eq(media.id, id));
  await logMedia(db, actor, "media.update", existing, { fields: "caption,isPublic" });
  return true;
}

/** Échange la position d'un média avec son voisin (haut / bas). */
export async function moveMedia(
  db: Database,
  id: string,
  direction: "up" | "down",
  actor: Actor,
): Promise<boolean> {
  const existing = await getMedia(db, id);
  if (!existing || existing.status !== "active") return false;
  const list = await listProfileMedia(db, existing.profileId);
  const index = list.findIndex((m) => m.id === id);
  const neighbour = list[direction === "up" ? index - 1 : index + 1];
  if (!neighbour) return false;

  // Renumérotation complète : robuste même si des ordres sont égaux.
  const reordered = [...list];
  [reordered[index], reordered[index + (direction === "up" ? -1 : 1)]] = [neighbour, existing];
  await db.transaction(async (tx) => {
    for (const [position, item] of reordered.entries()) {
      if (item.sortOrder !== position) {
        await tx.update(media).set({ sortOrder: position }).where(eq(media.id, item.id));
      }
    }
  });
  await logMedia(db, actor, "media.update", existing, { fields: "sortOrder" });
  return true;
}

/** Corbeille : le média n'est plus affiché nulle part mais reste restaurable. */
export async function softDeleteMedia(db: Database, id: string, actor: Actor): Promise<boolean> {
  const existing = await getMedia(db, id);
  if (!existing || existing.status !== "active") return false;
  await db.transaction(async (tx) => {
    await tx.update(media).set({ status: "deleted", deletedAt: new Date() }).where(eq(media.id, id));
    await tx
      .update(deceasedProfiles)
      .set({ mainPhotoMediaId: null })
      .where(and(eq(deceasedProfiles.id, existing.profileId), eq(deceasedProfiles.mainPhotoMediaId, id)));
  });
  await logMedia(db, actor, "media.delete", existing);
  return true;
}

export async function restoreMedia(db: Database, id: string, actor: Actor): Promise<boolean> {
  const existing = await getMedia(db, id);
  if (!existing || existing.status !== "deleted") return false;
  const [{ last } = { last: null }] = await db
    .select({ last: max(media.sortOrder) })
    .from(media)
    .where(and(eq(media.profileId, existing.profileId), eq(media.status, "active")));
  await db
    .update(media)
    .set({ status: "active", deletedAt: null, sortOrder: (last ?? -1) + 1 })
    .where(eq(media.id, id));
  await logMedia(db, actor, "media.restore", existing);
  return true;
}

/** Définit (ou retire avec `null`) la photo principale d'une fiche. */
export async function setMainPhoto(
  db: Database,
  profileId: string,
  mediaId: string | null,
  actor: Actor,
): Promise<boolean> {
  if (mediaId) {
    const m = await getMedia(db, mediaId);
    if (!m || m.profileId !== profileId || m.type !== "image" || m.status !== "active") return false;
  }
  const result = await db
    .update(deceasedProfiles)
    .set({ mainPhotoMediaId: mediaId, updatedById: actor.userId })
    .where(eq(deceasedProfiles.id, profileId))
    .returning({ id: deceasedProfiles.id });
  if (result.length === 0) return false;
  await logActivity(db, {
    userId: actor.userId,
    action: "profile.update",
    entityType: "profile",
    entityId: profileId,
    details: { fields: "mainPhotoMediaId" },
    ipHash: actor.ipHash,
  });
  return true;
}

/**
 * Règle d'accès PUBLIC à un fichier : la fiche doit être publiée, le média
 * actif et rattaché à cette fiche, et soit être la photo principale, soit
 * être public avec la galerie affichée.
 */
export async function findPublicMedia(
  db: Database,
  profilePublicId: string,
  mediaKey: string,
): Promise<Media | null> {
  const [row] = await db
    .select({
      media,
      status: deceasedProfiles.status,
      showGallery: deceasedProfiles.showGallery,
      mainPhotoMediaId: deceasedProfiles.mainPhotoMediaId,
    })
    .from(media)
    .innerJoin(deceasedProfiles, eq(media.profileId, deceasedProfiles.id))
    .where(and(eq(media.publicKey, mediaKey), eq(deceasedProfiles.publicId, profilePublicId)))
    .limit(1);
  if (!row) return null;
  if (row.status !== "published" || row.media.status !== "active") return null;
  const isMainPhoto = row.mainPhotoMediaId === row.media.id;
  if (!isMainPhoto && !(row.media.isPublic && row.showGallery)) return null;
  return row.media;
}
