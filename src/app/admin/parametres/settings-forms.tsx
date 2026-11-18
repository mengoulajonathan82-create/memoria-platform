"use client";

import { useActionState, useState } from "react";
import { CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form";
import type { SettingsFormState } from "./actions";

type Action = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

function Success({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
      {message}
    </p>
  );
}

export function BrandingForm({
  action,
  initial,
  hasLogo,
}: {
  action: Action;
  initial: Record<string, string>;
  hasLogo: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const [color, setColor] = useState(v.primaryColor ?? "#4a5568");

  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-5" noValidate>
      <FormMessage message={state.message} />
      <Success message={state.success} />
      <TextField name="companyName" label="Nom de l'entreprise" required defaultValue={v.companyName} errors={e.companyName} maxLength={120} />

      <div>
        <label htmlFor="primaryColor" className="block text-sm font-medium">Couleur principale</label>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            id="primaryColor"
            name="primaryColor"
            type="color"
            value={color}
            onChange={(ev) => setColor(ev.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-border"
          />
          <span className="rounded-md px-4 py-2 text-sm text-white" style={{ background: color }}>
            Aperçu d&apos;un bouton
          </span>
          <code className="text-xs text-muted">{color}</code>
        </div>
        <p className="mt-1 text-xs text-muted">Choisissez une couleur assez foncée pour que le texte blanc reste lisible.</p>
        {e.primaryColor?.length ? <p className="mt-1 text-sm text-danger">{e.primaryColor[0]}</p> : null}
      </div>

      <TextAreaField name="welcomeText" label="Texte d'accueil" rows={3} defaultValue={v.welcomeText} errors={e.welcomeText} maxLength={1000} hint="Affiché sur la page d'accueil du site." />
      <TextAreaField name="footerText" label="Pied de page" rows={3} defaultValue={v.footerText} errors={e.footerText} maxLength={1000} hint="Affiché en bas des pages commémoratives (adresse, téléphone…)." />

      <div>
        <label htmlFor="logo" className="block text-sm font-medium">Logo</label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1.5 block w-full text-sm" />
        <p className="mt-1 text-xs text-muted">PNG, JPEG ou WebP, 2 Mo maximum. Redimensionné automatiquement.</p>
        {e.logo?.length ? <p className="mt-1 text-sm text-danger">{e.logo[0]}</p> : null}
        {hasLogo ? (
          <div className="mt-3 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo servi par une route dédiée */}
            <img src={`/logo?ts=${state.key ?? 0}`} alt="Logo actuel" className="max-h-16 rounded border border-border bg-white p-1" />
            <CheckboxField name="removeLogo" label="Retirer le logo" />
          </div>
        ) : null}
      </div>

      <SubmitButton>Enregistrer l&apos;identité</SubmitButton>
    </form>
  );
}

export function ModerationForm({ action, words }: { action: Action; words: string[] }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-4">
      <Success message={state.success} />
      <TextAreaField
        name="forbiddenWords"
        label="Mots interdits"
        rows={8}
        defaultValue={words.join("\n")}
        hint="Un mot par ligne. Accents et majuscules sont ignorés. Un message qui contient l'un de ces mots est refusé avant même la modération. Les liens sont toujours refusés."
      />
      <SubmitButton>Enregistrer la liste</SubmitButton>
    </form>
  );
}
