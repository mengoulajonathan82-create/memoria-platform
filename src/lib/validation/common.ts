/**
 * Briques de validation réutilisables pour les formulaires (FormData → Zod).
 * Les champs vides deviennent `null` ; les chaînes sont nettoyées (trim).
 */
import { z } from "zod";

function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

export function requiredText(label: string, max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .trim()
      .min(1, `${label} est obligatoire.`)
      .max(max, `${max} caractères maximum.`),
  );
}

export function optionalText(max: number) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().max(max, `${max} caractères maximum.`).nullable(),
  );
}

/** Date AAAA-MM-JJ (format des champs `<input type="date">`), entre 1800 et 2200. */
export const optionalDate = z.preprocess(
  emptyToNull,
  z.iso
    .date("Date invalide.")
    .refine((v) => {
      const year = Number(v.slice(0, 4));
      return year >= 1800 && year <= 2200;
    }, "Date hors limites.")
    .nullable(),
);

/** Heure HH:MM (24 h). */
export const optionalTime = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (format HH:MM).")
    .nullable(),
);

export const optionalEmail = z.preprocess(
  (v) => {
    const n = emptyToNull(v);
    return typeof n === "string" ? n.trim().toLowerCase() : n;
  },
  z.email("Adresse e-mail invalide.").max(254).nullable(),
);

export const optionalPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,20}$/, "Numéro de téléphone invalide.")
    .nullable(),
);

/** URL http(s) uniquement (pas de `javascript:` ni de schéma exotique). */
export const optionalHttpUrl = z.preprocess(
  emptyToNull,
  z
    .url({ protocol: /^https?$/, error: "Adresse web invalide (http ou https)." })
    .max(500, "500 caractères maximum.")
    .nullable(),
);

/** Case à cocher HTML : présente (« on ») = vrai, absente = faux. */
export const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

export const optionalId = z.preprocess(
  emptyToNull,
  z.uuid("Identifiant invalide.").nullable(),
);

/** Convertit un FormData en objet simple (une valeur par clé, fichiers ignorés). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
