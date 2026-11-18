"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { FAMILY_STATUS_LABELS } from "@/lib/validation/family";

interface FamilyFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initialValues?: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
}

const STATUS_OPTIONS = Object.entries(FAMILY_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function FamilyForm({ action, initialValues = {}, submitLabel, cancelHref }: FamilyFormProps) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? initialValues;
  const e = state.errors ?? {};

  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-8" noValidate>
      <FormMessage message={state.message} />

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Famille</legend>
        <TextField name="name" label="Nom de la famille" required defaultValue={v.name} errors={e.name} maxLength={120} />
        <SelectField name="status" label="Statut" defaultValue={v.status ?? "active"} options={STATUS_OPTIONS} errors={e.status} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Contact principal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="contactName" label="Nom du contact" defaultValue={v.contactName} errors={e.contactName} maxLength={120} />
          <TextField name="contactPhone" label="Téléphone" type="tel" defaultValue={v.contactPhone} errors={e.contactPhone} maxLength={20} />
        </div>
        <TextField name="contactEmail" label="E-mail" type="email" defaultValue={v.contactEmail} errors={e.contactEmail} maxLength={254} />
        <TextAreaField name="address" label="Adresse" rows={2} defaultValue={v.address} errors={e.address} maxLength={500} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Notes internes</legend>
        <TextAreaField
          name="internalNotes"
          label="Notes"
          hint="Visibles uniquement par le personnel. Jamais affichées publiquement."
          rows={4}
          defaultValue={v.internalNotes}
          errors={e.internalNotes}
          maxLength={5000}
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">
          Annuler
        </Link>
      </div>
    </form>
  );
}
