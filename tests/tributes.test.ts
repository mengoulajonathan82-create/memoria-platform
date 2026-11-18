import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/actor";
import { activityLogs, candles, condolenceMessages, deceasedProfiles } from "@/lib/db/schema";
import { getPublicProfile } from "@/lib/profiles/public";
import { changeProfileStatus, createProfile, getProfile } from "@/lib/profiles/service";
import { generatePublicId } from "@/lib/security/crypto";
import {
  countPending,
  deleteTribute,
  getTributeStats,
  LIMITS,
  listForModeration,
  moderateTribute,
  submitCandle,
  submitCondolence,
} from "@/lib/tributes/service";
import {
  checkContent,
  checkFormToken,
  containsForbiddenWord,
  containsLink,
  createFormToken,
  MAX_FORM_AGE_MS,
} from "@/lib/tributes/spam";
import { profileSchema } from "@/lib/validation/profile";
import { candleSchema, condolenceSchema } from "@/lib/validation/tribute";
import { createTestDb, insertUser } from "./helpers/db";

const SECRET = "s".repeat(40);

describe("anti-spam", () => {
  const publicId = generatePublicId();
  const t0 = 1_800_000_000_000;

  it("vérifie le jeton de formulaire (signature, délai minimal, expiration)", () => {
    const token = createFormToken(SECRET, publicId, t0);
    expect(checkFormToken(SECRET, publicId, token, t0 + 5_000)).toBe("ok");
    expect(checkFormToken(SECRET, publicId, token, t0 + 1_000)).toBe("too_fast");
    expect(checkFormToken(SECRET, publicId, token, t0 + MAX_FORM_AGE_MS + 1)).toBe("expired");
    expect(checkFormToken(SECRET, generatePublicId(), token, t0 + 5_000)).toBe("invalid"); // autre page
    expect(checkFormToken("t".repeat(40), publicId, token, t0 + 5_000)).toBe("invalid"); // autre secret
    const [, sig] = token.split(".");
    expect(checkFormToken(SECRET, publicId, `${t0 - 60_000}.${sig}`, t0 + 5_000)).toBe("invalid"); // date falsifiée
    for (const bad of [undefined, "", "abc", 42]) expect(checkFormToken(SECRET, publicId, bad, t0)).toBe("invalid");
  });

  it("détecte les liens", () => {
    for (const s of ["voir https://x.fr", "www.exemple.com", "allez sur promo-casino.xyz", "HTTP://A.B"]) {
      expect(containsLink(s), s).toBe(true);
    }
    for (const s of ["Toutes nos pensées. Repose en paix.", "Rendez-vous à 14 h 30.", "Avec affection, M. Dupont"]) {
      expect(containsLink(s), s).toBe(false);
    }
  });

  it("détecte les mots interdits sans faux positifs évidents", () => {
    expect(containsForbiddenWord("Quel ENCULÉ")).toBe(true);
    expect(containsForbiddenWord("gagnez au casino")).toBe(true);
    expect(containsForbiddenWord("Une personne unique, sans dispute")).toBe(false);
    expect(checkContent("Marie", "Sincères condoléances")).toBe("ok");
    expect(checkContent("Bob", "https://spam.ru")).toBe("link");
  });

  it("valide les formulaires publics", () => {
    const ok = { authorName: "Marie", message: "Toutes nos pensées.", consentToPublish: "on" };
    expect(condolenceSchema.safeParse(ok).success).toBe(true);
    expect(condolenceSchema.safeParse({ ...ok, consentToPublish: undefined }).success).toBe(false);
    expect(condolenceSchema.safeParse({ ...ok, authorName: "M" }).success).toBe(false);
    expect(condolenceSchema.safeParse({ ...ok, message: "x".repeat(2001) }).success).toBe(false);
    expect(condolenceSchema.safeParse({ ...ok, email: "pas-un-mail" }).success).toBe(false);
    expect(candleSchema.parse({})).toEqual({ firstName: null, message: null });
    expect(candleSchema.safeParse({ message: "x".repeat(141) }).success).toBe(false);
  });
});

describe("condoléances et bougies", () => {
  type TestDb = Awaited<ReturnType<typeof createTestDb>>;
  let conn: TestDb;
  let actor: Actor;
  let profileId: string;
  let publicId: string;

  const condolence = (overrides: Record<string, unknown> = {}) =>
    condolenceSchema.parse({
      authorName: "Marie Durand",
      message: "Toutes nos pensées vous accompagnent.",
      email: "marie@exemple.test",
      phone: "0601020304",
      consentToPublish: "on",
      ...overrides,
    });

  beforeEach(async () => {
    conn = await createTestDb();
    const { user } = await insertUser(conn.db);
    actor = { userId: user.id, ipHash: null };
    profileId = await createProfile(
      conn.db,
      profileSchema.parse({ fullName: "Jeanne Martin", allowCondolences: "on", allowCandles: "on" }),
      actor,
    );
    publicId = (await getProfile(conn.db, profileId))!.publicId;
  });
  afterEach(() => conn.client.close());

  it("refuse les dépôts sur une fiche non publiée ou fermée", async () => {
    expect(await submitCondolence(conn.db, publicId, condolence(), "ip1")).toMatchObject({ ok: false });
    expect(await submitCandle(conn.db, publicId, candleSchema.parse({}), "ip1")).toMatchObject({ ok: false });

    await changeProfileStatus(conn.db, profileId, "published", actor);
    await conn.db.update(deceasedProfiles).set({ allowCondolences: false, allowCandles: false });
    expect(await submitCondolence(conn.db, publicId, condolence(), "ip1")).toMatchObject({ ok: false });
    expect(await submitCandle(conn.db, publicId, candleSchema.parse({}), "ip1")).toMatchObject({ ok: false });
    expect(await conn.db.select().from(condolenceMessages)).toHaveLength(0);
  });

  describe("fiche publiée", () => {
    beforeEach(async () => {
      await changeProfileStatus(conn.db, profileId, "published", actor);
    });

    it("met tout message en attente et n'affiche que les messages approuvés, sans coordonnées", async () => {
      expect(await submitCondolence(conn.db, publicId, condolence(), "ip1")).toEqual({ ok: true, status: "pending" });
      let page = await getPublicProfile(conn.db, publicId);
      expect(page.kind === "published" && page.profile.condolences).toEqual([]);

      const [{ items }] = [await listForModeration(conn.db, { kind: "condolence", status: "pending" })];
      expect(items[0]).toMatchObject({ author: "Marie Durand", email: "marie@exemple.test", phone: "0601020304" });
      expect(await moderateTribute(conn.db, "condolence", items[0]!.id, "approved", actor)).toBe(true);

      page = await getPublicProfile(conn.db, publicId);
      if (page.kind !== "published") throw new Error("attendu : publiée");
      expect(page.profile.condolences).toHaveLength(1);
      expect(Object.keys(page.profile.condolences![0]!).sort()).toEqual(["authorName", "createdAt", "message"]);
      const serialized = JSON.stringify(page);
      for (const secret of ["marie@exemple.test", "0601020304", "ip1"]) expect(serialized).not.toContain(secret);

      // Masqué ou refusé : n'apparaît plus.
      await moderateTribute(conn.db, "condolence", items[0]!.id, "hidden", actor);
      page = await getPublicProfile(conn.db, publicId);
      expect(page.kind === "published" && page.profile.condolences).toEqual([]);
    });

    it("refuse liens et mots interdits", async () => {
      expect(await submitCondolence(conn.db, publicId, condolence({ message: "Visitez www.promo.com" }), "ip1")).toMatchObject({
        ok: false,
        error: expect.stringContaining("liens"),
      });
      expect(await submitCondolence(conn.db, publicId, condolence({ authorName: "Casino Royal" }), "ip1")).toMatchObject({ ok: false });
      expect(await submitCandle(conn.db, publicId, candleSchema.parse({ message: "https://spam.ru" }), "ip1")).toMatchObject({ ok: false });
      expect(await conn.db.select().from(condolenceMessages)).toHaveLength(0);
    });

    it("limite la fréquence des messages par adresse IP", async () => {
      const now = new Date("2026-11-20T10:00:00Z");
      for (let i = 0; i < LIMITS.condolencesPer10Min; i++) {
        expect((await submitCondolence(conn.db, publicId, condolence(), "ip1", now)).ok).toBe(true);
      }
      expect(await submitCondolence(conn.db, publicId, condolence(), "ip1", now)).toMatchObject({ ok: false });
      // Une autre personne n'est pas bloquée.
      expect((await submitCondolence(conn.db, publicId, condolence(), "ip2", now)).ok).toBe(true);
      // Après 10 minutes, c'est de nouveau possible.
      expect((await submitCondolence(conn.db, publicId, condolence(), "ip1", new Date(now.getTime() + 11 * 60_000))).ok).toBe(true);
    });

    it("plafonne les messages d'une même IP sur 24 h", async () => {
      const start = new Date("2026-11-20T00:00:00Z").getTime();
      for (let i = 0; i < LIMITS.condolencesPerDay; i++) {
        const when = new Date(start + i * 15 * 60_000); // espacés de 15 min
        expect((await submitCondolence(conn.db, publicId, condolence(), "ip1", when)).ok).toBe(true);
      }
      const later = new Date(start + LIMITS.condolencesPerDay * 15 * 60_000);
      expect(await submitCondolence(conn.db, publicId, condolence(), "ip1", later)).toMatchObject({ ok: false });
    });

    it("allume une bougie : directe sans message, modérée avec message, une par heure", async () => {
      const now = new Date("2026-11-20T10:00:00Z");
      expect(await submitCandle(conn.db, publicId, candleSchema.parse({ firstName: "Paul" }), "ip1", now)).toEqual({
        ok: true,
        status: "approved",
      });
      expect(await submitCandle(conn.db, publicId, candleSchema.parse({}), "ip1", now)).toMatchObject({ ok: false });
      expect(
        await submitCandle(conn.db, publicId, candleSchema.parse({ message: "Je pense à toi" }), "ip2", now),
      ).toEqual({ ok: true, status: "pending" });
      expect((await submitCandle(conn.db, publicId, candleSchema.parse({}), "ip1", new Date(now.getTime() + 61 * 60_000))).ok).toBe(true);

      const page = await getPublicProfile(conn.db, publicId);
      if (page.kind !== "published") throw new Error("attendu : publiée");
      expect(page.profile.candles?.count).toBe(2); // la bougie avec message attend la modération
      expect(page.profile.candles?.recent.map((c) => c.message)).not.toContain("Je pense à toi");
      expect(JSON.stringify(page)).not.toContain("ip1");
    });

    it("modère, supprime définitivement, journalise et compte", async () => {
      await submitCondolence(conn.db, publicId, condolence(), "ip1");
      await submitCandle(conn.db, publicId, candleSchema.parse({ message: "Un mot" }), "ip1");
      expect(await countPending(conn.db)).toBe(2);

      const [candle] = await conn.db.select().from(candles);
      expect(await moderateTribute(conn.db, "candle", candle!.id, "rejected", actor)).toBe(true);
      expect(await moderateTribute(conn.db, "candle", candle!.id, "rejected", actor)).toBe(false);
      expect((await conn.db.select().from(candles))[0]).toMatchObject({ status: "rejected", moderatedById: actor.userId });

      const [message] = await conn.db.select().from(condolenceMessages);
      expect(await deleteTribute(conn.db, "condolence", message!.id, actor)).toBe(true);
      expect(await conn.db.select().from(condolenceMessages)).toHaveLength(0);
      expect(await deleteTribute(conn.db, "condolence", message!.id, actor)).toBe(false);

      const stats = await getTributeStats(conn.db, profileId);
      expect(stats.candles).toEqual({ pending: 0, approved: 0, rejected: 1, hidden: 0 });
      expect(await countPending(conn.db)).toBe(0);

      const logs = await conn.db.select().from(activityLogs).where(eq(activityLogs.entityId, profileId));
      const actions = logs.map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(["moderation.update", "moderation.delete"]));
      expect(JSON.stringify(logs)).not.toContain("marie@exemple.test");
    });

    it("filtre la file de modération par statut et par fiche", async () => {
      const other = await createProfile(conn.db, profileSchema.parse({ fullName: "Autre", allowCondolences: "on" }), actor);
      await changeProfileStatus(conn.db, other, "published", actor);
      const otherPublicId = (await getProfile(conn.db, other))!.publicId;
      await submitCondolence(conn.db, publicId, condolence(), "ip1");
      await submitCondolence(conn.db, otherPublicId, condolence(), "ip2");

      expect((await listForModeration(conn.db, { kind: "condolence" })).items).toHaveLength(2);
      expect((await listForModeration(conn.db, { kind: "condolence", profileId: other })).items).toHaveLength(1);
      expect((await listForModeration(conn.db, { kind: "condolence", status: "approved" })).items).toHaveLength(0);
    });
  });
});
