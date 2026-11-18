import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authenticate,
  LOGIN_WINDOW_MS,
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
} from "@/lib/auth/login-service";
import {
  createSession,
  revokeAllUserSessions,
  revokeSession,
  validateSessionToken,
} from "@/lib/auth/session-service";
import { sessions, users } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/security/crypto";
import { createTestDb, insertUser } from "./helpers/db";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let conn: TestDb;

beforeEach(async () => {
  conn = await createTestDb();
});
afterEach(() => conn.client.close());

const HOUR = 60 * 60 * 1000;

describe("sessions", () => {
  it("crée une session dont seule l'empreinte est stockée", async () => {
    const { user } = await insertUser(conn.db);
    const { token } = await createSession(conn.db, user.id, { ttlMs: HOUR });

    const rows = await conn.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(sha256Hex(token));
    expect(rows[0]!.id).not.toBe(token);

    const result = await validateSessionToken(conn.db, token);
    expect(result?.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    // Le hachage du mot de passe n'est jamais renvoyé.
    expect(JSON.stringify(result)).not.toContain("argon2");
  });

  it("refuse un jeton inconnu ou vide", async () => {
    expect(await validateSessionToken(conn.db, "inconnu")).toBeNull();
    expect(await validateSessionToken(conn.db, "")).toBeNull();
  });

  it("refuse et supprime une session expirée", async () => {
    const { user } = await insertUser(conn.db);
    const start = new Date("2026-01-01T10:00:00Z");
    const { token } = await createSession(conn.db, user.id, { ttlMs: HOUR, now: start });

    const later = new Date(start.getTime() + HOUR + 1);
    expect(await validateSessionToken(conn.db, token, later)).toBeNull();
    expect(await conn.db.select().from(sessions)).toHaveLength(0);
  });

  it("refuse la session d'un compte désactivé", async () => {
    const { user } = await insertUser(conn.db);
    const { token } = await createSession(conn.db, user.id, { ttlMs: HOUR });
    await conn.db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect(await validateSessionToken(conn.db, token)).toBeNull();
  });

  it("révoque une session ou toutes les sessions d'un utilisateur", async () => {
    const { user } = await insertUser(conn.db);
    const a = await createSession(conn.db, user.id, { ttlMs: HOUR });
    const b = await createSession(conn.db, user.id, { ttlMs: HOUR });

    await revokeSession(conn.db, a.token);
    expect(await validateSessionToken(conn.db, a.token)).toBeNull();
    expect(await validateSessionToken(conn.db, b.token)).not.toBeNull();

    await revokeAllUserSessions(conn.db, user.id);
    expect(await validateSessionToken(conn.db, b.token)).toBeNull();
  });

  it("supprime les sessions quand l'utilisateur est supprimé", async () => {
    const { user } = await insertUser(conn.db);
    await createSession(conn.db, user.id, { ttlMs: HOUR });
    await conn.db.delete(users).where(eq(users.id, user.id));
    expect(await conn.db.select().from(sessions)).toHaveLength(0);
  });
});

describe("connexion", () => {
  it("authentifie avec le bon mot de passe (e-mail insensible à la casse)", async () => {
    const { user, password } = await insertUser(conn.db, { role: "admin" });
    const result = await authenticate(conn.db, {
      email: "TEST@exemple.test",
      password,
      ipHash: "ip-1",
    });
    expect(result).toEqual({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: "admin" },
    });
  });

  it("refuse un mauvais mot de passe ou un e-mail inconnu", async () => {
    await insertUser(conn.db);
    expect(
      await authenticate(conn.db, { email: "test@exemple.test", password: "faux", ipHash: null }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await authenticate(conn.db, { email: "inconnu@exemple.test", password: "x", ipHash: null }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse un compte désactivé même avec le bon mot de passe", async () => {
    const { password } = await insertUser(conn.db, { isActive: false });
    const result = await authenticate(conn.db, {
      email: "test@exemple.test",
      password,
      ipHash: null,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("bloque un e-mail après trop d'échecs, puis le libère après la fenêtre", async () => {
    const { password } = await insertUser(conn.db);
    const now = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      await authenticate(conn.db, { email: "test@exemple.test", password: "faux", ipHash: null, now });
    }
    // Même le bon mot de passe est refusé pendant le blocage.
    expect(
      await authenticate(conn.db, { email: "test@exemple.test", password, ipHash: null, now }),
    ).toEqual({ ok: false, reason: "throttled" });

    const later = new Date(now.getTime() + LOGIN_WINDOW_MS + 1000);
    const result = await authenticate(conn.db, {
      email: "test@exemple.test",
      password,
      ipHash: null,
      now: later,
    });
    expect(result.ok).toBe(true);
  });

  it("bloque une IP qui essaie de nombreux comptes", async () => {
    const now = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      await authenticate(conn.db, {
        email: `victime${i}@exemple.test`,
        password: "faux",
        ipHash: "ip-attaquant",
        now,
      });
    }
    const result = await authenticate(conn.db, {
      email: "autre@exemple.test",
      password: "faux",
      ipHash: "ip-attaquant",
      now,
    });
    expect(result).toEqual({ ok: false, reason: "throttled" });
  });
});
