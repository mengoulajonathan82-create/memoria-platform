import { z } from "zod";
import { MODERATION_STATUSES } from "@/lib/db/schema";
import { checkbox, optionalEmail, optionalPhone, optionalText } from "./common";

const text = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .trim()
      .min(min, min <= 1 ? `${label} est obligatoire.` : `${label} : ${min} caractères minimum.`)
      .max(max, `${label} : ${max} caractères maximum.`),
  );

export const condolenceSchema = z.object({
  authorName: text("Votre nom", 2, 80),
  message: text("Le message", 5, 2000),
  email: optionalEmail,
  phone: optionalPhone,
  consentToPublish: checkbox.refine((v) => v, "Votre accord est nécessaire pour publier le message."),
});
export type CondolenceInput = z.infer<typeof condolenceSchema>;

export const candleSchema = z.object({
  firstName: optionalText(40),
  message: optionalText(140),
});
export type CandleInput = z.infer<typeof candleSchema>;

export const MODERATION_STATUS_LABELS: Record<(typeof MODERATION_STATUSES)[number], string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  hidden: "Masqué",
};

export const TRIBUTE_KINDS = ["condolence", "candle"] as const;
export type TributeKind = (typeof TRIBUTE_KINDS)[number];
