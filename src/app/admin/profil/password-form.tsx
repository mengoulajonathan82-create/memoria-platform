"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { changePasswordAction, type PasswordFormState } from "./actions";

const inputClass = "mt-1.5 block w-full rounded-md border border-border bg-surface px-3 py-2";

function PasswordField({ name, label, autoComplete, errors, hint }: { name: string; label: string; autoComplete: string; errors?: string[]; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input id={name} name={name} type="password" autoComplete={autoComplete} required maxLength={128} className={inputClass} aria-invalid={errors?.length ? true : undefined} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {errors?.length ? <p className="mt-1 text-sm text-danger">{errors[0]}</p> : null}
    </div>
  );
}

export function PasswordForm({ minLength }: { minLength: number }) {
  const [state, formAction] = useActionState<PasswordFormState, FormData>(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-4" noValidate>
      {state.success ? (
        <p role="status" className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{state.success}</p>
      ) : (
        <FormMessage message={state.message} />
      )}
      <PasswordField name="currentPassword" label="Mot de passe actuel" autoComplete="current-password" errors={e.currentPassword} />
      <PasswordField
        name="newPassword"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        errors={e.newPassword}
        hint={`Au moins ${minLength} caractères, avec au moins une lettre et un chiffre.`}
      />
      <PasswordField name="confirmPassword" label="Confirmer le nouveau mot de passe" autoComplete="new-password" errors={e.confirmPassword} />
      <SubmitButton>Changer le mot de passe</SubmitButton>
    </form>
  );
}
