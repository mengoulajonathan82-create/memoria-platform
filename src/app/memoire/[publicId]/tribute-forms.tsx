"use client";

/**
 * Formulaires publics : simples, lisibles sur téléphone, sans pop-up.
 */
import { useActionState } from "react";
import { CheckboxField, SubmitButton, TextAreaField, TextField } from "@/components/form";
import type { PublicFormState } from "./actions";

type Action = (state: PublicFormState, formData: FormData) => Promise<PublicFormState>;

/** Champ piège caché aux humains (et aux lecteurs d'écran). */
function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Ne pas remplir
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

function Feedback({ state }: { state: PublicFormState }) {
  if (state.success) {
    return (
      <p role="status" className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        {state.success}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return null;
}

export function CondolenceForm({ action, formToken }: { action: Action; formToken: string }) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form key={state.key ?? 0} action={formAction} className="relative space-y-4" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="formToken" value={formToken} />
      <Honeypot />
      <TextField name="authorName" label="Votre nom ou prénom" required defaultValue={v.authorName} errors={e.authorName} maxLength={80} autoComplete="name" />
      <TextAreaField name="message" label="Votre message" required rows={5} defaultValue={v.message} errors={e.message} maxLength={2000} />
      <details className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer">Laisser vos coordonnées à la famille (facultatif)</summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted">Elles ne seront jamais affichées sur cette page.</p>
          <TextField name="email" label="E-mail" type="email" defaultValue={v.email} errors={e.email} maxLength={254} autoComplete="email" />
          <TextField name="phone" label="Téléphone" type="tel" defaultValue={v.phone} errors={e.phone} maxLength={20} autoComplete="tel" />
        </div>
      </details>
      <div>
        <CheckboxField
          name="consentToPublish"
          label="J'accepte que mon nom et mon message soient publiés sur cette page après relecture."
          defaultChecked={v.consentToPublish === "on"}
        />
        {e.consentToPublish?.length ? <p className="mt-1 text-sm text-danger">{e.consentToPublish[0]}</p> : null}
      </div>
      <SubmitButton pendingLabel="Envoi…">Envoyer mon message</SubmitButton>
    </form>
  );
}

export function CandleForm({ action, formToken }: { action: Action; formToken: string }) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form key={state.key ?? 0} action={formAction} className="relative space-y-4" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="formToken" value={formToken} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Noms distincts du formulaire de condoléances : identifiants HTML uniques sur la page. */}
        <TextField name="candleFirstName" label="Votre prénom (facultatif)" defaultValue={v.candleFirstName} errors={e.candleFirstName} maxLength={40} autoComplete="given-name" />
        <TextField name="candleMessage" label="Un mot (facultatif)" defaultValue={v.candleMessage} errors={e.candleMessage} maxLength={140} hint="140 caractères maximum." />
      </div>
      <SubmitButton pendingLabel="…">Allumer une bougie</SubmitButton>
    </form>
  );
}
