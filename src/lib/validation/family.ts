import { z } from "zod";
import { FAMILY_STATUSES } from "@/lib/db/schema";
import {
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
} from "./common";

export const familySchema = z.object({
  name: requiredText("Le nom de la famille", 120),
  contactName: optionalText(120),
  contactPhone: optionalPhone,
  contactEmail: optionalEmail,
  address: optionalText(500),
  internalNotes: optionalText(5000),
  status: z.enum(FAMILY_STATUSES, "Statut invalide.").default("active"),
});

export type FamilyInput = z.infer<typeof familySchema>;

export const FAMILY_STATUS_LABELS: Record<(typeof FAMILY_STATUSES)[number], string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archivée",
};
