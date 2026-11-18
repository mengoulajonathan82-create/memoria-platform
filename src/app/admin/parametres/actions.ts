"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { getMediaStorage } from "@/lib/media/storage";
import {
  brandingFormSchema,
  MAX_LOGO_BYTES,
  parseWordList,
  saveBranding,
  saveModerationSettings,
  type LogoChange,
} from "@/lib/settings";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";

export interface SettingsFormState extends FormState {
  success?: string;
}

export async function saveBrandingAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { actor } = await requireActor("settings.manage");
  const values = formDataToObject(formData);
  const parsed = brandingFormSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrorsOf(parsed.error), message: "Certains champs sont à corriger.", values, key: Date.now() };
  }

  let logo: LogoChange = { kind: "keep" };
  const file = formData.get("logo");
  if (values.removeLogo === "on") logo = { kind: "remove" };
  else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return { errors: { logo: ["Logo trop lourd (2 Mo maximum)."] }, values, key: Date.now() };
    logo = { kind: "replace", bytes: Buffer.from(await file.arrayBuffer()) };
  }

  const result = await saveBranding(await getDb(), getMediaStorage(), parsed.data, logo, actor);
  if (!result.ok) return { errors: { logo: [result.error] }, message: result.error, values, key: Date.now() };
  revalidatePath("/", "layout");
  return { success: "Identité enregistrée.", key: Date.now() };
}

export async function saveModerationAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { actor } = await requireActor("settings.manage");
  const raw = String(formData.get("forbiddenWords") ?? "").slice(0, 20_000);
  const forbiddenWords = parseWordList(raw);
  await saveModerationSettings(await getDb(), { forbiddenWords }, actor);
  return { success: `Liste enregistrée (${forbiddenWords.length} mots).`, key: Date.now() };
}
