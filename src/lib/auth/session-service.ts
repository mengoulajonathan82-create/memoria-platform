/**
 * Gestion des sessions en base (indépendante de Next.js, donc testable).
 *
 * Le navigateur reçoit un jeton aléatoire de 256 bits ; la base ne stocke que
 * son empreinte SHA-256. Les sessions ont une expiration absolue.
 */
import { eq, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { sessions, users, type UserRole } from "@/lib/db/schema";
import { generateToken, sha256Hex } from "@/lib/security/crypto";

/** Données utilisateur exposables au rendu (jamais le hachage du mot de passe). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CreateSessionOptions {
  ttlMs: number;
  ipHash?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export async function createSession(
  db: Database,
  userId: string,
  options: CreateSessionOptions,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken(32);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + options.ttlMs);
  await db.insert(sessions).values({
    id: sha256Hex(token),
    userId,
    expiresAt,
    ipHash: options.ipHash ?? null,
    userAgent: options.userAgent?.slice(0, 255) ?? null,
    createdAt: now,
  });
  return { token, expiresAt };
}

/**
 * Valide un jeton de session. Retourne `null` si la session est inconnue,
 * expirée ou si le compte est désactivé.
 */
export async function validateSessionToken(
  db: Database,
  token: string,
  now: Date = new Date(),
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
  if (!token || token.length > 128) return null;
  const sessionId = sha256Hex(token);

  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  if (!row.isActive) {
    await db.delete(sessions).where(eq(sessions.userId, row.id));
    return null;
  }

  return {
    user: { id: row.id, name: row.name, email: row.email, role: row.role },
    expiresAt: row.expiresAt,
  };
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256Hex(token)));
}

/** Déconnecte un utilisateur partout (ex. : compte désactivé, mot de passe changé). */
export async function revokeAllUserSessions(
  db: Database,
  userId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(
  db: Database,
  now: Date = new Date(),
): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
