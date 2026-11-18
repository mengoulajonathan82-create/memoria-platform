/**
 * Journal d'activité minimal. Ne jamais y écrire de donnée sensible
 * (mot de passe, coordonnées, contenu de notes internes…).
 */
import type { Database } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema";

export type ActivityAction =
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "user.create"
  | "user.update"
  | "user.disable"
  | "family.create"
  | "family.update"
  | "profile.create"
  | "profile.update"
  | "profile.publish"
  | "profile.unpublish"
  | "moderation.update";

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "auth.login_failed": "Échec de connexion",
  "user.create": "Création d'un compte",
  "user.update": "Modification d'un compte",
  "user.disable": "Désactivation d'un compte",
  "family.create": "Création d'une famille",
  "family.update": "Modification d'une famille",
  "profile.create": "Création d'une fiche",
  "profile.update": "Modification d'une fiche",
  "profile.publish": "Publication d'une fiche",
  "profile.unpublish": "Dépublication d'une fiche",
  "moderation.update": "Modération",
};

export interface ActivityEntry {
  userId: string | null;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  details?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
}

export async function logActivity(db: Database, entry: ActivityEntry): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipHash: entry.ipHash ?? null,
    });
  } catch (error) {
    // La journalisation ne doit jamais faire échouer l'action principale.
    console.error("[activity-log] écriture impossible :", error);
  }
}
