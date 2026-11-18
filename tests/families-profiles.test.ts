import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/actor";
import { activityLogs, deceasedProfiles } from "@/lib/db/schema";
import {
  createFamily,
  deleteFamily,
  getFamily,
  listFamilies,
  listFamilyOptions,
  updateFamily,
} from "@/lib/families/service";
import { getEntityHistory } from "@/lib/history";
import {
  changeProfileStatus,
  createProfile,
  getProfile,
  listProfiles,
  restoreProfile,
  softDeleteProfile,
  updateProfile,
} from "@/lib/profiles/service";
import { isValidPublicId } from "@/lib/security/crypto";
import { familySchema } from "@/lib/validation/family";
import { profileSchema } from "@/lib/validation/profile";
import { createTestDb, insertUser } from "./helpers/db";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let conn: TestDb;
let actor: Actor;

beforeEach(async () => {
  conn = await createTestDb();
  const { user } = await insertUser(conn.db);
  actor = { userId: user.id, ipHash: "ip" };
});
afterEach(() => conn.client.close());

const family = (input: Record<string, unknown>) => familySchema.parse(input);
const profile = (input: Record<string, unknown>) => profileSchema.parse(input);

describe("familles", () => {
  it("crée, lit et journalise la création", async () => {
    const id = await createFamily(conn.db, family({ name: "Famille Martin", internalNotes: "secret" }), actor);
    const stored = await getFamily(conn.db, id);
    expect(stored).toMatchObject({ name: "Famille Martin", status: "active", createdById: actor.userId });

    const history = await getEntityHistory(conn.db, "family", id);
    expect(history.map((h) => h.action)).toEqual(["family.create"]);
  });

  it("journalise les noms des champs modifiés, jamais leurs valeurs", async () => {
    const id = await createFamily(conn.db, family({ name: "Famille Martin" }), actor);
    const fields = await updateFamily(
      conn.db,
      id,
      family({ name: "Famille Martin", internalNotes: "Note très confidentielle", contactPhone: "0601020304" }),
      actor,
    );
    expect(fields?.sort()).toEqual(["contactPhone", "internalNotes"]);

    const logs = await conn.db.select().from(activityLogs);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("confidentielle");
    expect(serialized).not.toContain("0601020304");

    // Aucune modification réelle → rien n'est écrit.
    expect(await updateFamily(conn.db, id, family({ name: "Famille Martin", internalNotes: "Note très confidentielle", contactPhone: "0601020304" }), actor)).toEqual([]);
    expect(await updateFamily(conn.db, crypto.randomUUID(), family({ name: "X" }), actor)).toBeNull();
  });

  it("recherche sans tenir compte de la casse et filtre par statut", async () => {
    await createFamily(conn.db, family({ name: "Famille MARTIN" }), actor);
    await createFamily(conn.db, family({ name: "Famille Durand", contactName: "Paul Martin" }), actor);
    await createFamily(conn.db, family({ name: "Famille Petit", status: "archived" }), actor);

    expect((await listFamilies(conn.db, { q: "martin" })).items).toHaveLength(2);
    expect((await listFamilies(conn.db, { status: "archived" })).items.map((f) => f.name)).toEqual(["Famille Petit"]);
    // Les archivées ne sont pas proposées dans les formulaires de fiche.
    expect((await listFamilyOptions(conn.db)).map((f) => f.name)).not.toContain("Famille Petit");
  });

  it("traite les jokers de recherche comme du texte", async () => {
    await createFamily(conn.db, family({ name: "Famille 100% Martin" }), actor);
    await createFamily(conn.db, family({ name: "Famille Durand" }), actor);
    expect((await listFamilies(conn.db, { q: "%" })).items.map((f) => f.name)).toEqual(["Famille 100% Martin"]);
    expect((await listFamilies(conn.db, { q: "_" })).items).toHaveLength(0);
  });

  it("pagine les résultats", async () => {
    for (let i = 0; i < 25; i++) await createFamily(conn.db, family({ name: `Famille ${i}` }), actor);
    const page1 = await listFamilies(conn.db, { page: 1, pageSize: 10 });
    const page3 = await listFamilies(conn.db, { page: 3, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page3.items).toHaveLength(5);
    expect(page1.pagination).toMatchObject({ total: 25, totalPages: 3 });
  });

  it("refuse de supprimer une famille ayant des fiches", async () => {
    const id = await createFamily(conn.db, family({ name: "Famille Martin" }), actor);
    await createProfile(conn.db, profile({ fullName: "Jeanne Martin", familyId: id }), actor);
    expect(await deleteFamily(conn.db, id, actor)).toEqual({ ok: false, reason: "has_profiles" });

    const empty = await createFamily(conn.db, family({ name: "Famille Vide" }), actor);
    expect(await deleteFamily(conn.db, empty, actor)).toEqual({ ok: true });
    expect(await getFamily(conn.db, empty)).toBeNull();
    expect(await deleteFamily(conn.db, empty, actor)).toEqual({ ok: false, reason: "not_found" });
  });

  it("compte les fiches rattachées (hors supprimées)", async () => {
    const id = await createFamily(conn.db, family({ name: "Famille Martin" }), actor);
    await createProfile(conn.db, profile({ fullName: "A", familyId: id }), actor);
    const b = await createProfile(conn.db, profile({ fullName: "B", familyId: id }), actor);
    await softDeleteProfile(conn.db, b, actor);
    expect((await listFamilies(conn.db)).items[0]!.profileCount).toBe(1);
  });
});

describe("fiches défunts", () => {
  it("crée une fiche en brouillon avec un identifiant public sûr et unique", async () => {
    const a = await createProfile(conn.db, profile({ fullName: "Jeanne Martin" }), actor);
    const b = await createProfile(conn.db, profile({ fullName: "Paul Durand" }), actor);
    const pa = (await getProfile(conn.db, a))!;
    const pb = (await getProfile(conn.db, b))!;
    expect(pa.status).toBe("draft");
    expect(isValidPublicId(pa.publicId)).toBe(true);
    expect(pa.publicId).not.toBe(pb.publicId);
    expect(pa.publicId).not.toContain(pa.id);
  });

  it("conserve l'identifiant public lors des modifications", async () => {
    const id = await createProfile(conn.db, profile({ fullName: "Jeanne Martin" }), actor);
    const before = (await getProfile(conn.db, id))!.publicId;
    await updateProfile(conn.db, id, profile({ fullName: "Jeanne Martin-Durand", biography: "Texte" }), actor);
    await changeProfileStatus(conn.db, id, "published", actor);
    expect((await getProfile(conn.db, id))!.publicId).toBe(before);
  });

  it("gère les statuts, la date de publication et le journal", async () => {
    const id = await createProfile(conn.db, profile({ fullName: "Jeanne Martin" }), actor);
    const now = new Date("2026-03-01T10:00:00Z");

    expect(await changeProfileStatus(conn.db, id, "pending", actor)).toMatchObject({ ok: true, from: "draft", to: "pending" });
    expect(await changeProfileStatus(conn.db, id, "published", actor, now)).toMatchObject({ ok: true });
    expect((await getProfile(conn.db, id))!.publishedAt).toEqual(now);
    expect(await changeProfileStatus(conn.db, id, "published", actor)).toEqual({ ok: false, reason: "unchanged" });
    expect(await changeProfileStatus(conn.db, id, "archived", actor)).toMatchObject({ ok: true });

    const actions = (await getEntityHistory(conn.db, "profile", id)).map((h) => h.action);
    expect(actions).toEqual(
      expect.arrayContaining(["profile.create", "profile.status", "profile.publish", "profile.unpublish"]),
    );
  });

  it("supprime logiquement puis restaure en brouillon", async () => {
    const id = await createProfile(conn.db, profile({ fullName: "Jeanne Martin" }), actor);
    await changeProfileStatus(conn.db, id, "published", actor);

    expect(await softDeleteProfile(conn.db, id, actor)).toBe(true);
    expect((await getProfile(conn.db, id))!.status).toBe("deleted");
    // La ligne existe toujours (suppression logique).
    expect(await conn.db.select().from(deceasedProfiles)).toHaveLength(1);
    // Invisible dans la liste par défaut, visible avec le filtre « supprimée ».
    expect((await listProfiles(conn.db)).items).toHaveLength(0);
    expect((await listProfiles(conn.db, { status: "deleted" })).items).toHaveLength(1);
    // Ni modifiable ni publiable tant qu'elle est supprimée.
    expect(await updateProfile(conn.db, id, profile({ fullName: "X" }), actor)).toBeNull();
    expect(await changeProfileStatus(conn.db, id, "published", actor)).toEqual({ ok: false, reason: "deleted" });

    expect(await restoreProfile(conn.db, id, actor)).toBe(true);
    expect((await getProfile(conn.db, id))!.status).toBe("draft");
    expect(await restoreProfile(conn.db, id, actor)).toBe(false);
  });

  it("filtre par nom, statut, famille et période de décès", async () => {
    const fam = await createFamily(conn.db, family({ name: "Famille Martin" }), actor);
    await createProfile(conn.db, profile({ fullName: "Jeanne Martin", familyId: fam, deathDate: "2026-01-15" }), actor);
    const paul = await createProfile(conn.db, profile({ fullName: "Paul Durand", deathDate: "2025-06-01" }), actor);
    await changeProfileStatus(conn.db, paul, "published", actor);

    const names = async (f: Parameters<typeof listProfiles>[1]) =>
      (await listProfiles(conn.db, f)).items.map((p) => p.fullName);
    expect(await names({ q: "JEANNE" })).toEqual(["Jeanne Martin"]);
    expect(await names({ status: "published" })).toEqual(["Paul Durand"]);
    expect(await names({ familyId: fam })).toEqual(["Jeanne Martin"]);
    expect(await names({ deathFrom: "2026-01-01" })).toEqual(["Jeanne Martin"]);
    expect(await names({ deathTo: "2025-12-31" })).toEqual(["Paul Durand"]);
    expect((await listProfiles(conn.db, { familyId: fam })).items[0]!.familyName).toBe("Famille Martin");
  });

  it("refuse en base une fiche rattachée à une famille inexistante (clé étrangère)", async () => {
    await expect(
      createProfile(conn.db, profile({ fullName: "X", familyId: crypto.randomUUID() }), actor),
    ).rejects.toThrow();
  });
});
