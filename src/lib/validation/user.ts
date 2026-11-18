import { z } from "zod";
import { USER_ROLES } from "@/lib/db/schema";
import { emailSchema, newPasswordSchema } from "./auth";
import { requiredText } from "./common";

export const userCreateSchema = z.object({
  name: requiredText("Le nom", 120),
  email: emailSchema,
  role: z.enum(USER_ROLES, "Rôle invalide."),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: requiredText("Le nom", 120),
  role: z.enum(USER_ROLES, "Rôle invalide."),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Saisissez votre mot de passe actuel.").max(128),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  });
