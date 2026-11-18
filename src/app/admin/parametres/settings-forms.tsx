"use client";

import { useActionState } from "react";
import { CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form";
import { ThemePicker } from "@/components/theme-picker";
import type { SettingsFormState } from "./actions";

type Action = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

function Success({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="animate-scale-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-success">
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

  return (
    <form key={state.key ?? 0} action={formAction} className="space-y-5" noValidate>
      <FormMessage message={state.message} />
      <Success message={state.success} />
      <TextField name="companyName" label="Nom de l'entreprise" required defaultValue={v.companyName} errors={e.companyName} maxLength={120} />

      <div>
        <p className="text-sm font-medium">Thème des pages commémoratives</p>
        <p className="mt-0.5 mb-3 text-xs text-muted">
          Ce que voient les visiteurs en scannant le QR code. Chaque fiche peut aussi avoir son propre thème.{" "}
          <a href="/admin/apercu-theme" target="_blank" rel="noopener" className="font-medium text-primary underline-offset-4 hover:underline">
            Voir un exemple de page
          </a>
        </p>
        <ThemePicker name="publicTheme" defaultValue={v.publicTheme ?? "serenite"} />
        {e.publicTheme?.length ? <p className="mt-1 text-sm text-danger">{e.publicTheme[0]}</p> : null}
      </div>

      <TextAreaField name="welcomeText" label="Texte d'accueil" rows={3} defaultValue={v.welcomeText} errors={e.welcomeText} maxLength={1000} hint="Affiché sur la page d'accueil du site." />
      <TextAreaField name="footerText" label="Pied de page" rows={3} defaultValue={v.footerText} errors={e.footerText} maxLength={1000} hint="Affiché en bas des pages commémoratives (adresse, téléphone…)." />

      <div>
        <label htmlFor="logo" className="block text-sm font-medium">Logo</label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:font-medium file:text-primary hover:file:bg-blue-100" />
        <p className="mt-1 text-xs text-muted">PNG, JPEG ou WebP, 2 Mo maximum. Redimensionné automatiquement.</p>
        {e.logo?.length ? <p className="mt-1 text-sm text-danger">{e.logo[0]}</p> : null}
        {hasLogo ? (
          <div className="mt-3 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo servi par une route dédiée */}
            <img src={`/logo?ts=${state.key ?? 0}`} alt="Logo actuel" className="max-h-16 rounded-lg border border-border bg-white p-1.5 shadow-sm" />
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
