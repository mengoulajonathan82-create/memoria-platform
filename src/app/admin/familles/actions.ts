"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { createFamily, deleteFamily, updateFamily } from "@/lib/families/service";
import type { FormState } from "@/lib/form-state";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { familySchema } from "@/lib/validation/family";

const INVALID_MESSAGE = "Certains champs sont à corriger.";
const idSchema = z.uuid();

export async function createFamilyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor } = await requireActor("families.manage");
  const values = formDataToObject(formData);
  const parsed = familySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrorsOf(parsed.error), message: INVALID_MESSAGE, values, key: Date.now() };
  }
  const id = await createFamily(await getDb(), parsed.data, actor);
  redirect(`/admin/familles/${id}?ok=cree`);
}

export async function updateFamilyAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { actor } = await requireActor("families.manage");
  if (!idSchema.safeParse(id).success) redirect("/admin/familles?erreur=introuvable");

  const values = formDataToObject(formData);
  const parsed = familySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrorsOf(parsed.error), message: INVALID_MESSAGE, values, key: Date.now() };
  }
  const fields = await updateFamily(await getDb(), id, parsed.data, actor);
  if (fields === null) redirect("/admin/familles?erreur=introuvable");
  redirect(`/admin/familles/${id}?ok=${fields.length ? "modifie" : "inchange"}`);
}

export async function deleteFamilyAction(id: string): Promise<void> {
  const { actor } = await requireActor("families.delete");
  if (!idSchema.safeParse(id).success) redirect("/admin/familles?erreur=introuvable");

  const result = await deleteFamily(await getDb(), id, actor);
  if (!result.ok) {
    redirect(
      result.reason === "has_profiles"
        ? `/admin/familles/${id}?erreur=fiches-liees`
        : "/admin/familles?erreur=introuvable",
    );
  }
  redirect("/admin/familles?ok=supprime");
}
