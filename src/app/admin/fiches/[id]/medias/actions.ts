"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import {
  getMedia,
  moveMedia,
  restoreMedia,
  setMainPhoto,
  softDeleteMedia,
  updateMediaDetails,
} from "@/lib/media/service";
import { checkbox, optionalText } from "@/lib/validation/common";

const idSchema = z.uuid();
const detailsSchema = z.object({ caption: optionalText(300), isPublic: checkbox });

/** Vérifie les identifiants et que le média appartient bien à la fiche. */
async function loadOwnedMedia(profileId: string, mediaId: string) {
  if (!idSchema.safeParse(profileId).success || !idSchema.safeParse(mediaId).success) {
    redirect("/admin/fiches?erreur=introuvable");
  }
  const item = await getMedia(await getDb(), mediaId);
  if (!item || item.profileId !== profileId) redirect(`/admin/fiches/${profileId}/medias?erreur=introuvable`);
  return item;
}

const back = (profileId: string, flag: string) => redirect(`/admin/fiches/${profileId}/medias?${flag}`);

export async function updateMediaAction(profileId: string, mediaId: string, formData: FormData) {
  const { actor } = await requireActor("media.manage");
  await loadOwnedMedia(profileId, mediaId);
  const parsed = detailsSchema.safeParse({
    caption: formData.get("caption"),
    isPublic: formData.get("isPublic"),
  });
  if (!parsed.success) back(profileId, "erreur=legende-invalide");
  const ok = await updateMediaDetails(await getDb(), mediaId, parsed.data!, actor);
  back(profileId, ok ? "ok=modifie" : "erreur=introuvable");
}

export async function moveMediaAction(profileId: string, mediaId: string, direction: "up" | "down") {
  const { actor } = await requireActor("media.manage");
  await loadOwnedMedia(profileId, mediaId);
  await moveMedia(await getDb(), mediaId, direction === "up" ? "up" : "down", actor);
  back(profileId, "ok=ordre");
}

export async function setMainPhotoAction(profileId: string, mediaId: string | null) {
  const { actor } = await requireActor("media.manage");
  if (mediaId) await loadOwnedMedia(profileId, mediaId);
  else if (!idSchema.safeParse(profileId).success) redirect("/admin/fiches?erreur=introuvable");
  const ok = await setMainPhoto(await getDb(), profileId, mediaId, actor);
  back(profileId, ok ? "ok=photo" : "erreur=introuvable");
}

export async function deleteMediaAction(profileId: string, mediaId: string) {
  const { actor } = await requireActor("media.manage");
  await loadOwnedMedia(profileId, mediaId);
  const ok = await softDeleteMedia(await getDb(), mediaId, actor);
  back(profileId, ok ? "ok=corbeille" : "erreur=introuvable");
}

export async function restoreMediaAction(profileId: string, mediaId: string) {
  const { actor } = await requireActor("media.restore");
  await loadOwnedMedia(profileId, mediaId);
  const ok = await restoreMedia(await getDb(), mediaId, actor);
  back(profileId, ok ? "ok=restaure-media" : "erreur=introuvable");
}
