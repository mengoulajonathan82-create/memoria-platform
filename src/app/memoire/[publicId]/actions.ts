"use server";

/**
 * Actions PUBLIQUES (sans compte) : dépôt d'un message de condoléances et
 * d'une bougie. Tout est revérifié ici : jeton anti-robot, champ piège,
 * validation, contenu interdit, limites de fréquence, statut de la fiche.
 */
import { revalidatePath } from "next/cache";
import { getRequestMeta } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { isValidPublicId } from "@/lib/security/crypto";
import { submitCandle, submitCondolence } from "@/lib/tributes/service";
import { checkFormToken } from "@/lib/tributes/spam";
import { fieldErrorsOf, formDataToObject, type FieldErrors } from "@/lib/validation/common";
import { candleSchema, condolenceSchema } from "@/lib/validation/tribute";

export interface PublicFormState {
  success?: string;
  error?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
  key?: number;
}

/** Contrôles communs. Retourne un état d'erreur, « bot » (ignorer en silence) ou null. */
function precheck(publicId: string, values: Record<string, string>): PublicFormState | "bot" | null {
  if (!isValidPublicId(publicId)) return { error: "Page introuvable." };
  // Champ piège : invisible pour les humains, rempli par les robots.
  if (values.website) return "bot";
  const token = checkFormToken(getServerEnv().IP_HASH_SECRET, publicId, values.formToken);
  if (token === "too_fast") return { error: "Merci de patienter quelques secondes avant d'envoyer.", values, key: Date.now() };
  if (token === "expired") return { error: "La page a expiré : rechargez-la puis réessayez.", values, key: Date.now() };
  if (token !== "ok") return "bot";
  return null;
}

/** Réponse identique à un succès, pour ne pas renseigner les robots. */
const FAKE_SUCCESS = (message: string): PublicFormState => ({ success: message, key: Date.now() });

const CONDOLENCE_SUCCESS = "Merci. Votre message a bien été reçu ; il sera publié après relecture.";

export async function submitCondolenceAction(
  publicId: string,
  _previous: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const values = formDataToObject(formData);
  const pre = precheck(publicId, values);
  if (pre === "bot") return FAKE_SUCCESS(CONDOLENCE_SUCCESS);
  if (pre) return pre;

  const parsed = condolenceSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrorsOf(parsed.error), error: "Certains champs sont à corriger.", values, key: Date.now() };
  }
  const { ipHash } = await getRequestMeta();
  const result = await submitCondolence(await getDb(), publicId, parsed.data, ipHash);
  if (!result.ok) return { error: result.error, values, key: Date.now() };
  return { success: CONDOLENCE_SUCCESS, key: Date.now() };
}

export async function submitCandleAction(
  publicId: string,
  _previous: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const values = formDataToObject(formData);
  const pre = precheck(publicId, values);
  if (pre === "bot") return FAKE_SUCCESS("Votre bougie est allumée.");
  if (pre) return pre;

  // Les champs portent des noms préfixés (identifiants HTML uniques sur la page).
  const parsed = candleSchema.safeParse({ firstName: values.candleFirstName, message: values.candleMessage });
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    return {
      errors: { candleFirstName: errors.firstName, candleMessage: errors.message },
      error: "Certains champs sont à corriger.",
      values,
      key: Date.now(),
    };
  }
  const { ipHash } = await getRequestMeta();
  const result = await submitCandle(await getDb(), publicId, parsed.data, ipHash);
  if (!result.ok) return { error: result.error, values, key: Date.now() };

  revalidatePath(`/memoire/${publicId}`);
  return {
    success:
      result.status === "approved"
        ? "Votre bougie est allumée. Merci pour cette pensée."
        : "Votre bougie est allumée ; votre message sera visible après relecture.",
    key: Date.now(),
  };
}
