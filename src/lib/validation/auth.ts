import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Adresse e-mail trop longue.")
  .pipe(z.email("Adresse e-mail invalide."));

export const loginSchema = z.object({
  email: emailSchema,
  // Pas de règle de complexité à la connexion : seulement des bornes.
  password: z
    .string()
    .min(1, "Le mot de passe est obligatoire.")
    .max(PASSWORD_MAX_LENGTH, "Mot de passe trop long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Règle appliquée à la création ou au changement d'un mot de passe. */
export const newPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  )
  .max(PASSWORD_MAX_LENGTH, "Mot de passe trop long.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), {
    message: "Le mot de passe doit contenir au moins une lettre et un chiffre.",
  });
