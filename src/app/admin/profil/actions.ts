"use server";

import { getRequestMeta, readSessionCookie, requireUser } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { changeOwnPassword } from "@/lib/users/service";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { passwordChangeSchema } from "@/lib/validation/user";

export interface PasswordFormState extends FormState {
  success?: string;
}

export async function changePasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const user = await requireUser();
  const values = formDataToObject(formData);
  const parsed = passwordChangeSchema.safeParse(values);
  // Les mots de passe ne sont jamais renvoyés au navigateur.
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error), message: "Certains champs sont à corriger.", key: Date.now() };

  const { ipHash } = await getRequestMeta();
  const result = await changeOwnPassword(
    await getDb(),
    {
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      currentSessionToken: await readSessionCookie(),
    },
    ipHash,
  );
  if (!result.ok) return { errors: { currentPassword: [result.error] }, message: result.error, key: Date.now() };
  return { success: "Mot de passe modifié. Vos autres sessions ont été fermées.", key: Date.now() };
}
