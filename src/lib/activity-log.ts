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
  | "user.enable"
  | "user.delete"
  | "user.password_reset"
  | "user.password_change"
  | "settings.update"
  | "export.csv"
  | "backup.create"
  | "family.create"
  | "family.update"
  | "family.delete"
  | "profile.create"
  | "profile.update"
  | "profile.status"
  | "profile.publish"
  | "profile.unpublish"
  | "profile.delete"
  | "profile.restore"
  | "media.upload"
  | "media.update"
  | "media.delete"
  | "media.restore"
  | "moderation.update"
  | "moderation.delete";

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "auth.login_failed": "Échec de connexion",
  "user.create": "Création d'un compte",
  "user.update": "Modification d'un compte",
  "user.disable": "Désactivation d'un compte",
  "user.enable": "Réactivation d'un compte",
  "user.delete": "Suppression d'un compte",
  "user.password_reset": "Réinitialisation d'un mot de passe",
  "user.password_change": "Changement de mot de passe",
  "settings.update": "Modification des paramètres",
  "export.csv": "Export CSV",
  "backup.create": "Création d'une sauvegarde",
  "family.create": "Création d'une famille",
  "family.update": "Modification d'une famille",
  "family.delete": "Suppression d'une famille",
  "profile.create": "Création d'une fiche",
  "profile.update": "Modification d'une fiche",
  "profile.status": "Changement de statut d'une fiche",
  "profile.publish": "Publication d'une fiche",
  "profile.unpublish": "Dépublication d'une fiche",
  "profile.delete": "Suppression d'une fiche",
  "profile.restore": "Restauration d'une fiche",
  "media.upload": "Ajout d'un média",
  "media.update": "Modification d'un média",
  "media.delete": "Mise à la corbeille d'un média",
  "media.restore": "Restauration d'un média",
  "moderation.update": "Modération",
  "moderation.delete": "Suppression d'un message ou d'une bougie",
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
