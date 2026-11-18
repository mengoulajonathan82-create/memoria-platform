/**
 * Authentification par e-mail / mot de passe avec protection contre la
 * force brute (indépendant de Next.js, donc testable).
 */
import { and, count, eq, gte, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { loginAttempts, users } from "@/lib/db/schema";
import { getDummyHash, verifyPassword } from "./password";
import type { SessionUser } from "./session-service";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Échecs maximum pour un même e-mail sur la fenêtre. */
export const MAX_FAILURES_PER_EMAIL = 5;
/** Échecs maximum pour une même IP (tous comptes confondus) sur la fenêtre. */
export const MAX_FAILURES_PER_IP = 20;

export type AuthenticateResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "throttled" };

interface AuthenticateInput {
  email: string;
  password: string;
  ipHash: string | null;
  now?: Date;
}

export async function isLoginThrottled(
  db: Database,
  email: string,
  ipHash: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);

  const [byEmail] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, since),
      ),
    );
  if ((byEmail?.n ?? 0) >= MAX_FAILURES_PER_EMAIL) return true;

  if (ipHash) {
    const [byIp] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipHash, ipHash),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, since),
        ),
      );
    if ((byIp?.n ?? 0) >= MAX_FAILURES_PER_IP) return true;
  }
  return false;
}

export async function authenticate(
  db: Database,
  input: AuthenticateInput,
): Promise<AuthenticateResult> {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();

  if (await isLoginThrottled(db, email, input.ipHash, now)) {
    return { ok: false, reason: "throttled" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // On vérifie toujours un hachage (réel ou factice) pour un temps constant.
  const passwordOk = await verifyPassword(
    user?.passwordHash ?? (await getDummyHash()),
    input.password,
  );
  const success = Boolean(user && user.isActive && passwordOk);

  await db.insert(loginAttempts).values({
    email,
    ipHash: input.ipHash,
    success,
    createdAt: now,
  });

  if (!success || !user) return { ok: false, reason: "invalid" };

  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

/** Supprime les tentatives de plus de 24 h. */
export async function purgeOldLoginAttempts(
  db: Database,
  now: Date = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff));
}
