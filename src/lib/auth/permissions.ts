/**
 * Contrôle d'accès par rôle. Toute vérification d'autorisation passe par
 * `hasPermission`, côté serveur.
 */
import type { UserRole } from "@/lib/db/schema";

export const PERMISSIONS = [
  "dashboard.view",
  "users.manage",
  "families.manage",
  "profiles.manage",
  "profiles.publish",
  "profiles.unpublish",
  "media.manage",
  "media.restore",
  "moderation.manage",
  "settings.manage",
  "activity.view",
  "export.csv",
  "backup.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  employee: new Set<Permission>([
    "dashboard.view",
    "families.manage",
    "profiles.manage",
    "profiles.publish",
    "profiles.unpublish",
    "media.manage",
    "moderation.manage",
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  employee: "Employé",
};
