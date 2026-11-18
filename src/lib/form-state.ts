import type { FieldErrors } from "@/lib/validation/common";

/**
 * État renvoyé par une Server Action de formulaire.
 * `values` permet de réafficher la saisie après une erreur ; `key` force le
 * remontage du formulaire pour que les valeurs par défaut soient réappliquées.
 */
export interface FormState {
  errors?: FieldErrors;
  message?: string;
  values?: Record<string, string>;
  key?: number;
}

/**
 * Convertit un enregistrement en valeurs de formulaire (cases cochées = « on »).
 * `keys` limite les champs transmis au navigateur aux seuls champs du formulaire.
 */
export function toFormValues(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      if (value) out[key] = "on";
    } else if (typeof value === "string") {
      out[key] = value;
    } else if (typeof value === "number") {
      out[key] = String(value);
    }
  }
  return out;
}
