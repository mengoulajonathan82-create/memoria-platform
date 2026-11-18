"use client";

import { useActionState } from "react";
import {
  ConfirmSubmitButton,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/form";
import type { StaffFormState } from "./actions";

type Action = (state: StaffFormState, formData: FormData) => Promise<StaffFormState>;

const ROLE_OPTIONS = [
  { value: "employee", label: "Employé" },
  { value: "admin", label: "Administrateur" },
];

function Success({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
      {message}
    </p>
  );
}

/** Affiche un mot de passe provisoire une seule fois. */
export function TemporaryPassword({ password, email }: { password: string; email?: string }) {
  return (
    <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">
        {email ? `Compte créé pour ${email}.` : "Mot de passe réinitialisé."} Mot de passe provisoire :
      </p>
      <p className="mt-2 select-all rounded bg-white px-3 py-2 font-mono text-base tracking-wide">{password}</p>
      <p className="mt-2 text-xs">
        Communiquez-le de vive voix ou par un canal sûr, et demandez à la personne de le changer
        dès sa première connexion (menu « Mon profil »). Il ne sera plus affiché.
      </p>
    </div>
  );
}

export function CreateStaffForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <div className="space-y-4">
      {state.temporaryPassword ? (
        <TemporaryPassword password={state.temporaryPassword} email={state.createdEmail} />
      ) : null}
      <form key={state.key ?? 0} action={formAction} className="space-y-4" noValidate>
        <FormMessage message={state.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="Nom" required defaultValue={v.name} errors={e.name} maxLength={120} />
          <TextField name="email" label="E-mail" type="email" required defaultValue={v.email} errors={e.email} maxLength={254} />
        </div>
        <SelectField name="role" label="Rôle" defaultValue={v.role ?? "employee"} options={ROLE_OPTIONS} errors={e.role} />
        <SubmitButton pendingLabel="Création…">Créer le compte</SubmitButton>
      </form>
    </div>
  );
}

export function EditStaffForm({ action, initial }: { action: Action; initial: { name: string; role: string } }) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <Success message={state.success} />
      <TextField name="name" label="Nom" required defaultValue={v.name} errors={e.name} maxLength={120} />
      <SelectField name="role" label="Rôle" defaultValue={v.role} options={ROLE_OPTIONS} errors={e.role} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <div className="space-y-3">
      {state.temporaryPassword ? <TemporaryPassword password={state.temporaryPassword} /> : null}
      <FormMessage message={state.message} />
      <form action={formAction}>
        <ConfirmSubmitButton message="Générer un nouveau mot de passe provisoire ? L'ancien ne fonctionnera plus et les sessions de ce compte seront fermées.">
          Réinitialiser le mot de passe
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

export function ConfirmActionForm({
  action,
  label,
  confirm,
  danger,
}: {
  action: Action;
  label: string;
  confirm: string;
  danger?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <div className="space-y-2">
      <FormMessage message={state.message} />
      <Success message={state.success} />
      <form action={formAction}>
        <ConfirmSubmitButton variant={danger ? "danger" : "secondary"} message={confirm}>
          {label}
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
