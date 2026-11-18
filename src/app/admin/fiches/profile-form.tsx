"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/form";
import type { FormState } from "@/lib/form-state";

interface ProfileFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initialValues: Record<string, string>;
  familyOptions: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}

export function ProfileForm({
  action,
  initialValues,
  familyOptions,
  submitLabel,
  cancelHref,
}: ProfileFormProps) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? initialValues;
  const e = state.errors ?? {};
  const checked = (name: string) => v[name] === "on";

  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-10" noValidate>
      <FormMessage message={state.message} />

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Identité</legend>
        <TextField name="fullName" label="Nom complet" required defaultValue={v.fullName} errors={e.fullName} maxLength={160} />
        <SelectField
          name="familyId"
          label="Famille associée"
          placeholder="— Aucune famille —"
          defaultValue={v.familyId}
          options={familyOptions.map((f) => ({ value: f.id, label: f.name }))}
          errors={e.familyId}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="birthDate" label="Date de naissance" type="date" defaultValue={v.birthDate} errors={e.birthDate} />
          <TextField name="deathDate" label="Date de décès" type="date" defaultValue={v.deathDate} errors={e.deathDate} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Message ou biographie</legend>
        <TextAreaField name="biography" label="Texte de présentation" rows={8} defaultValue={v.biography} errors={e.biography} maxLength={20000} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Cérémonie</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="ceremonyDate" label="Date" type="date" defaultValue={v.ceremonyDate} errors={e.ceremonyDate} />
          <TextField name="ceremonyTime" label="Heure" type="time" defaultValue={v.ceremonyTime} errors={e.ceremonyTime} />
        </div>
        <TextField name="ceremonyLocation" label="Lieu" defaultValue={v.ceremonyLocation} errors={e.ceremonyLocation} maxLength={200} hint="Ex. : Église Saint-Pierre, salle de cérémonie…" />
        <TextAreaField name="ceremonyAddress" label="Adresse" rows={2} defaultValue={v.ceremonyAddress} errors={e.ceremonyAddress} maxLength={500} />
        <TextField name="livestreamUrl" label="Lien de diffusion en direct" type="url" defaultValue={v.livestreamUrl} errors={e.livestreamUrl} maxLength={500} hint="Facultatif. Adresse commençant par https://" />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Informations pratiques</legend>
        <TextAreaField
          name="practicalInfo"
          label="Fleurs, dons, condoléances, consignes…"
          rows={4}
          defaultValue={v.practicalInfo}
          errors={e.practicalInfo}
          maxLength={5000}
          hint="Texte affiché sur la page publique. N'y mettez pas de coordonnées privées."
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:shadow-md">
        <legend className="px-1 font-medium">Visibilité sur la page publique</legend>
        <p className="text-sm text-muted">
          Seuls les éléments cochés seront affichés une fois la fiche publiée. Le nom et la photo
          principale sont toujours affichés.
        </p>
        <CheckboxField name="showDates" label="Afficher les dates de naissance et de décès" defaultChecked={checked("showDates")} />
        <CheckboxField name="showBiography" label="Afficher la biographie" defaultChecked={checked("showBiography")} />
        <CheckboxField name="showCeremony" label="Afficher les informations de cérémonie" defaultChecked={checked("showCeremony")} />
        <CheckboxField name="showPracticalInfo" label="Afficher les informations pratiques" defaultChecked={checked("showPracticalInfo")} />
        <CheckboxField name="showGallery" label="Afficher la galerie de souvenirs" defaultChecked={checked("showGallery")} />
        <CheckboxField name="allowCondolences" label="Autoriser les messages de condoléances" hint="Toujours soumis à modération." defaultChecked={checked("allowCondolences")} />
        <CheckboxField name="allowCandles" label="Autoriser les bougies numériques" defaultChecked={checked("allowCandles")} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">Notes internes</legend>
        <TextAreaField
          name="internalNotes"
          label="Notes"
          rows={3}
          defaultValue={v.internalNotes}
          errors={e.internalNotes}
          maxLength={5000}
          hint="Visibles uniquement par le personnel. Jamais affichées publiquement."
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:text-primary">
          Annuler
        </Link>
      </div>
    </form>
  );
}
