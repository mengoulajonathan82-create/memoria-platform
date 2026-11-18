import { z } from "zod";
import { PROFILE_STATUSES, type ProfileStatus } from "@/lib/db/schema";
import {
  checkbox,
  optionalDate,
  optionalHttpUrl,
  optionalId,
  optionalText,
  optionalTime,
  requiredText,
} from "./common";

/**
 * Formulaire de fiche défunt. Le statut n'en fait pas partie : il change via
 * des actions dédiées (publication, archivage…) soumises à des permissions.
 */
export const profileSchema = z
  .object({
    familyId: optionalId,
    fullName: requiredText("Le nom complet", 160),
    birthDate: optionalDate,
    deathDate: optionalDate,
    biography: optionalText(20_000),
    ceremonyDate: optionalDate,
    ceremonyTime: optionalTime,
    ceremonyLocation: optionalText(200),
    ceremonyAddress: optionalText(500),
    livestreamUrl: optionalHttpUrl,
    practicalInfo: optionalText(5000),
    showDates: checkbox,
    showBiography: checkbox,
    showCeremony: checkbox,
    showPracticalInfo: checkbox,
    showGallery: checkbox,
    allowCondolences: checkbox,
    allowCandles: checkbox,
    internalNotes: optionalText(5000),
  })
  .refine(
    (v) => !v.birthDate || !v.deathDate || v.birthDate <= v.deathDate,
    { message: "La date de décès doit être postérieure à la date de naissance.", path: ["deathDate"] },
  );

export type ProfileInput = z.infer<typeof profileSchema>;

/** Statuts qu'on peut choisir via le changement de statut (pas « supprimée »). */
export const SETTABLE_PROFILE_STATUSES = [
  "draft",
  "pending",
  "published",
  "archived",
] as const satisfies readonly ProfileStatus[];
export type SettableProfileStatus = (typeof SETTABLE_PROFILE_STATUSES)[number];

export const profileStatusSchema = z.enum(SETTABLE_PROFILE_STATUSES, "Statut invalide.");

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  draft: "Brouillon",
  pending: "En attente de validation",
  published: "Publiée",
  archived: "Archivée",
  deleted: "Supprimée",
};

export const profileStatusFilterSchema = z.enum(PROFILE_STATUSES).optional().catch(undefined);
