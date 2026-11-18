"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import {
  createStaff,
  deleteStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from "@/lib/users/service";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation/user";

export interface StaffFormState extends FormState {
  /** Mot de passe provisoire, affiché UNE seule fois puis oublié. */
  temporaryPassword?: string;
  createdEmail?: string;
  success?: string;
}

const idSchema = z.uuid();
const INVALID = "Certains champs sont à corriger.";

export async function createStaffAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const { actor } = await requireActor("users.manage");
  const values = formDataToObject(formData);
  const parsed = userCreateSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error), message: INVALID, values, key: Date.now() };
  const result = await createStaff(await getDb(), parsed.data, actor);
  if (!result.ok) return { message: result.error, values, key: Date.now() };
  revalidatePath("/admin/employes");
  return { temporaryPassword: result.value.temporaryPassword, createdEmail: parsed.data.email, key: Date.now() };
}

export async function updateStaffAction(id: string, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const { actor } = await requireActor("users.manage");
  if (!idSchema.safeParse(id).success) return { message: "Compte introuvable." };
  const values = formDataToObject(formData);
  const parsed = userUpdateSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error), message: INVALID, values, key: Date.now() };
  const result = await updateStaff(await getDb(), id, parsed.data, actor);
  if (!result.ok) return { message: result.error, values, key: Date.now() };
  revalidatePath(`/admin/employes/${id}`);
  return { success: "Modifications enregistrées.", key: Date.now() };
}

export async function resetPasswordAction(id: string): Promise<StaffFormState> {
  const { actor } = await requireActor("users.manage");
  if (!idSchema.safeParse(id).success) return { message: "Compte introuvable." };
  const result = await resetStaffPassword(await getDb(), id, actor);
  if (!result.ok) return { message: result.error };
  revalidatePath(`/admin/employes/${id}`);
  return { temporaryPassword: result.value.temporaryPassword, key: Date.now() };
}

export async function setActiveAction(id: string, active: boolean): Promise<StaffFormState> {
  const { actor } = await requireActor("users.manage");
  if (!idSchema.safeParse(id).success) return { message: "Compte introuvable." };
  const result = await setStaffActive(await getDb(), id, active, actor);
  if (!result.ok) return { message: result.error, key: Date.now() };
  revalidatePath(`/admin/employes/${id}`);
  return { success: active ? "Compte réactivé." : "Compte désactivé : ses sessions ont été fermées.", key: Date.now() };
}

export async function deleteStaffAction(id: string): Promise<StaffFormState> {
  const { actor } = await requireActor("users.manage");
  if (!idSchema.safeParse(id).success) return { message: "Compte introuvable." };
  const result = await deleteStaff(await getDb(), id, actor);
  if (!result.ok) return { message: result.error, key: Date.now() };
  redirect("/admin/employes?ok=supprime");
}
