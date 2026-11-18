"use client";

/**
 * Champs de formulaire accessibles (libellé, aide, erreur reliée au champ).
 */
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-foreground shadow-sm transition-all duration-200 placeholder:text-muted/70 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none aria-[invalid=true]:border-danger aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-red-500/10";

interface BaseFieldProps {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
}

function FieldShell({
  name,
  label,
  hint,
  errors,
  required,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, hint?: string, errors?: string[]) {
  const ids = [hint ? `${name}-hint` : null, errors?.length ? `${name}-error` : null];
  return ids.filter(Boolean).join(" ") || undefined;
}

export function TextField(
  props: BaseFieldProps & {
    defaultValue?: string;
    type?: "text" | "email" | "tel" | "date" | "time" | "url";
    maxLength?: number;
    autoComplete?: string;
  },
) {
  const { name, errors, hint, required, type = "text" } = props;
  return (
    <FieldShell {...props}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={props.defaultValue}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete ?? "off"}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function TextAreaField(
  props: BaseFieldProps & { defaultValue?: string; rows?: number; maxLength?: number },
) {
  const { name, errors, hint } = props;
  return (
    <FieldShell {...props}>
      <textarea
        id={name}
        name={name}
        rows={props.rows ?? 4}
        defaultValue={props.defaultValue}
        maxLength={props.maxLength}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function SelectField(
  props: BaseFieldProps & {
    defaultValue?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
  },
) {
  const { name, errors, hint } = props;
  return (
    <FieldShell {...props}>
      <select
        id={name}
        name={name}
        defaultValue={props.defaultValue ?? ""}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        className={inputClass}
      >
        {props.placeholder !== undefined ? <option value="">{props.placeholder}</option> : null}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-[18px] cursor-pointer rounded accent-primary"
      />
      <label htmlFor={name} className="text-sm">
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "secondary";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary:
      "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110",
    danger: "bg-danger text-white shadow-md shadow-red-600/20 hover:-translate-y-0.5 hover:brightness-110",
    secondary:
      "border border-border bg-surface text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:translate-y-0 disabled:opacity-60 ${styles}`}
    >
      {pending ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Bouton de soumission qui demande une confirmation avant d'envoyer. */
export function ConfirmSubmitButton({
  children,
  message,
  variant = "secondary",
}: {
  children: ReactNode;
  message: string;
  variant?: "danger" | "secondary";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "danger"
      ? "border border-red-200 bg-surface text-danger hover:border-danger hover:bg-red-50"
      : "border border-border bg-surface text-foreground hover:border-primary/40 hover:text-primary";
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium shadow-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="animate-scale-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger"
    >
      {message}
    </p>
  );
}
