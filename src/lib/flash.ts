/**
 * Messages de confirmation passés par l'URL (`?ok=…` / `?erreur=…`).
 * Seules des clés connues sont acceptées : aucun texte libre n'est réaffiché.
 */
const SUCCESS_MESSAGES = {
  cree: "Enregistrement créé.",
  modifie: "Modifications enregistrées.",
  inchange: "Aucune modification à enregistrer.",
  statut: "Statut mis à jour.",
  supprime: "Suppression effectuée.",
  restaure: "Fiche restaurée en brouillon.",
  ordre: "Ordre d'affichage mis à jour.",
  photo: "Photo principale mise à jour.",
  corbeille: "Média placé dans la corbeille.",
  "restaure-media": "Média restauré.",
} as const;

const ERROR_MESSAGES = {
  "fiches-liees":
    "Cette famille a des fiches rattachées : elle ne peut pas être supprimée. Vous pouvez l'archiver.",
  introuvable: "Élément introuvable.",
  "statut-invalide": "Ce changement de statut n'est pas possible.",
  "droits-insuffisants": "Vous n'avez pas les droits nécessaires pour cette action.",
  "legende-invalide": "Légende invalide (300 caractères maximum).",
} as const;

export type SuccessKey = keyof typeof SUCCESS_MESSAGES;
export type ErrorKey = keyof typeof ERROR_MESSAGES;

export function readFlash(searchParams: Record<string, string | string[] | undefined>): {
  success?: string;
  error?: string;
} {
  const ok = searchParams.ok;
  const err = searchParams.erreur;
  return {
    success: typeof ok === "string" && ok in SUCCESS_MESSAGES ? SUCCESS_MESSAGES[ok as SuccessKey] : undefined,
    error: typeof err === "string" && err in ERROR_MESSAGES ? ERROR_MESSAGES[err as ErrorKey] : undefined,
  };
}
