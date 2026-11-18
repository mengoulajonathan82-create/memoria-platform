"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/client";
import { familyExists } from "@/lib/families/service";
import type { FormState } from "@/lib/form-state";
import {
  changeProfileStatus,
  createProfile,
  getProfile,
  restoreProfile,
  softDeleteProfile,
  updateProfile,
} from "@/lib/profiles/service";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { profileSchema, profileStatusSchema, type ProfileInput } from "@/lib/validation/profile";

const INVALID_MESSAGE = "Certains champs sont à corriger.";
const idSchema = z.uuid();

/** Valide le formulaire et vérifie que la famille choisie existe. */
async function parseProfileForm(
  db: Database,
  formData: FormData,
): Promise<{ data: ProfileInput } | { state: FormState }> {
  const values = formDataToObject(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { state: { errors: fieldErrorsOf(parsed.error), message: INVALID_MESSAGE, values, key: Date.now() } };
  }
  if (parsed.data.familyId && !(await familyExists(db, parsed.data.familyId))) {
    return {
      state: { errors: { familyId: ["Famille introuvable."] }, message: INVALID_MESSAGE, values, key: Date.now() },
    };
  }
  return { data: parsed.data };
}

export async function createProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor } = await requireActor("profiles.manage");
  const db = await getDb();
  const result = await parseProfileForm(db, formData);
  if ("state" in result) return result.state;
  const id = await createProfile(db, result.data, actor);
  redirect(`/admin/fiches/${id}?ok=cree`);
}

export async function updateProfileAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor } = await requireActor("profiles.manage");
  if (!idSchema.safeParse(id).success) redirect("/admin/fiches?erreur=introuvable");
  const db = await getDb();
  const result = await parseProfileForm(db, formData);
  if ("state" in result) return result.state;

  const fields = await updateProfile(db, id, result.data, actor);
  if (fields === null) redirect("/admin/fiches?erreur=introuvable");
  redirect(`/admin/fiches/${id}?ok=${fields.length ? "modifie" : "inchange"}`);
}

/**
 * Changement de statut. Règles :
 * - passer en « publiée » exige `profiles.publish` ;
 * - quitter « publiée » exige `profiles.unpublish` ;
 * - les autres transitions exigent `profiles.manage`.
 */
export async function changeProfileStatusAction(id: string, formData: FormData): Promise<void> {
  const { user, actor } = await requireActor("profiles.manage");
  if (!idSchema.safeParse(id).success) redirect("/admin/fiches?erreur=introuvable");
  const target = profileStatusSchema.safeParse(formData.get("status"));
  if (!target.success) redirect(`/admin/fiches/${id}?erreur=statut-invalide`);

  const db = await getDb();
  const current = await getProfile(db, id);
  if (!current) redirect("/admin/fiches?erreur=introuvable");

  const needsPublish = target.data === "published";
  const needsUnpublish = current.status === "published";
  if (
    (needsPublish && !hasPermission(user.role, "profiles.publish")) ||
    (needsUnpublish && !hasPermission(user.role, "profiles.unpublish"))
  ) {
    redirect(`/admin/fiches/${id}?erreur=droits-insuffisants`);
  }

  const result = await changeProfileStatus(db, id, target.data, actor);
  redirect(`/admin/fiches/${id}?${result.ok ? "ok=statut" : "erreur=statut-invalide"}`);
}

export async function deleteProfileAction(id: string): Promise<void> {
  const { actor } = await requireActor("profiles.delete");
  if (!idSchema.safeParse(id).success) redirect("/admin/fiches?erreur=introuvable");
  const ok = await softDeleteProfile(await getDb(), id, actor);
  redirect(ok ? `/admin/fiches/${id}?ok=supprime` : "/admin/fiches?erreur=introuvable");
}

export async function restoreProfileAction(id: string): Promise<void> {
  const { actor } = await requireActor("profiles.restore");
  if (!idSchema.safeParse(id).success) redirect("/admin/fiches?erreur=introuvable");
  const ok = await restoreProfile(await getDb(), id, actor);
  redirect(ok ? `/admin/fiches/${id}?ok=restaure` : "/admin/fiches?erreur=introuvable");
}
