/**
 * Gestion des comptes du personnel.
 *
 * Garde-fous :
 * - un administrateur ne peut ni se désactiver, ni se supprimer, ni retirer
 *   son propre rôle d'administrateur ;
 * - il reste toujours au moins un administrateur actif ;
 * - toute désactivation, réinitialisation ou changement de mot de passe
 *   ferme les sessions ouvertes du compte concerné.
 * Les mots de passe provisoires sont générés aléatoirement et affichés une
 * seule fois ; ils ne sont jamais journalisés.
 */
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session-service";
import type { Database } from "@/lib/db/client";
import { sessions, users, type UserRole } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/security/crypto";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validation/user";

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const accountColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

/** Mot de passe provisoire : 16 caractères sans ambiguïté, avec lettres et chiffres. */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < 14) {
    for (const b of randomBytes(32)) {
      if (b < limit && out.length < 14) out += alphabet[b % alphabet.length];
    }
  }
  const digits = "23456789";
  return `${out}${digits[randomBytes(1)[0]! % digits.length]}a`;
}

export async function listStaff(db: Database): Promise<StaffAccount[]> {
  return db.select(accountColumns).from(users).orderBy(asc(users.name));
}

export async function getStaff(db: Database, id: string): Promise<StaffAccount | null> {
  const [row] = await db.select(accountColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

async function activeAdminCount(db: Database, excludeId?: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.role, "admin"),
        eq(users.isActive, true),
        excludeId ? ne(users.id, excludeId) : undefined,
      ),
    );
  return row?.n ?? 0;
}

export type UserResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export async function createStaff(
  db: Database,
  input: UserCreateInput,
  actor: Actor,
): Promise<UserResult<{ id: string; temporaryPassword: string }>> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) return { ok: false, error: "Un compte existe déjà avec cette adresse e-mail." };

  const temporaryPassword = generateTemporaryPassword();
  const [row] = await db
    .insert(users)
    .values({ ...input, passwordHash: await hashPassword(temporaryPassword) })
    .returning({ id: users.id });
  await logActivity(db, {
    userId: actor.userId,
    action: "user.create",
    entityType: "user",
    entityId: row!.id,
    details: { role: input.role },
    ipHash: actor.ipHash,
  });
  return { ok: true, value: { id: row!.id, temporaryPassword } };
}

export async function updateStaff(
  db: Database,
  id: string,
  input: UserUpdateInput,
  actor: Actor,
): Promise<UserResult> {
  const existing = await getStaff(db, id);
  if (!existing) return { ok: false, error: "Compte introuvable." };
  if (existing.role === "admin" && input.role !== "admin") {
    if (id === actor.userId) return { ok: false, error: "Vous ne pouvez pas retirer votre propre rôle d'administrateur." };
    if (existing.isActive && (await activeAdminCount(db, id)) === 0) {
      return { ok: false, error: "Il doit rester au moins un administrateur actif." };
    }
  }
  await db.update(users).set(input).where(eq(users.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "user.update",
    entityType: "user",
    entityId: id,
    details: { role: input.role },
    ipHash: actor.ipHash,
  });
  return { ok: true };
}

export async function setStaffActive(
  db: Database,
  id: string,
  active: boolean,
  actor: Actor,
): Promise<UserResult> {
  const existing = await getStaff(db, id);
  if (!existing) return { ok: false, error: "Compte introuvable." };
  if (!active) {
    if (id === actor.userId) return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte." };
    if (existing.role === "admin" && (await activeAdminCount(db, id)) === 0) {
      return { ok: false, error: "Il doit rester au moins un administrateur actif." };
    }
  }
  await db.update(users).set({ isActive: active }).where(eq(users.id, id));
  if (!active) await revokeAllUserSessions(db, id);
  await logActivity(db, {
    userId: actor.userId,
    action: active ? "user.enable" : "user.disable",
    entityType: "user",
    entityId: id,
    ipHash: actor.ipHash,
  });
  return { ok: true };
}

export async function resetStaffPassword(
  db: Database,
  id: string,
  actor: Actor,
): Promise<UserResult<{ temporaryPassword: string }>> {
  const existing = await getStaff(db, id);
  if (!existing) return { ok: false, error: "Compte introuvable." };
  const temporaryPassword = generateTemporaryPassword();
  await db.update(users).set({ passwordHash: await hashPassword(temporaryPassword) }).where(eq(users.id, id));
  await revokeAllUserSessions(db, id);
  await logActivity(db, {
    userId: actor.userId,
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
    ipHash: actor.ipHash,
  });
  return { ok: true, value: { temporaryPassword } };
}

/**
 * Suppression définitive d'un compte. Ses contenus (fiches, journal…) sont
 * conservés : leurs références à l'auteur passent à « inconnu ».
 */
export async function deleteStaff(db: Database, id: string, actor: Actor): Promise<UserResult> {
  const existing = await getStaff(db, id);
  if (!existing) return { ok: false, error: "Compte introuvable." };
  if (id === actor.userId) return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." };
  if (existing.role === "admin" && existing.isActive && (await activeAdminCount(db, id)) === 0) {
    return { ok: false, error: "Il doit rester au moins un administrateur actif." };
  }
  await db.delete(users).where(eq(users.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    details: { role: existing.role },
    ipHash: actor.ipHash,
  });
  return { ok: true };
}

/**
 * Changement de son propre mot de passe : vérifie l'actuel, puis ferme toutes
 * les AUTRES sessions (la session en cours reste ouverte).
 */
export async function changeOwnPassword(
  db: Database,
  input: { userId: string; currentPassword: string; newPassword: string; currentSessionToken?: string },
  ipHash: string | null,
): Promise<UserResult> {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    return { ok: false, error: "Mot de passe actuel incorrect." };
  }
  await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, input.userId));
  const keep = input.currentSessionToken ? sha256Hex(input.currentSessionToken) : null;
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, input.userId), keep ? ne(sessions.id, keep) : undefined));
  await logActivity(db, {
    userId: input.userId,
    action: "user.password_change",
    entityType: "user",
    entityId: input.userId,
    ipHash,
  });
  return { ok: true };
}
