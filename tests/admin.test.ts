import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listActivity } from "@/lib/activity-query";
import type { Actor } from "@/lib/actor";
import { authenticate } from "@/lib/auth/login-service";
import { createSession, validateSessionToken } from "@/lib/auth/session-service";
import { createBackup, listBackups, resolveBackupDir, restoreBackup, verifyBackup } from "@/lib/backup";
import { getBranding } from "@/lib/branding";
import { csvCell, toCsv } from "@/lib/csv";
import { createDatabase } from "@/lib/db/client";
import { activityLogs, deceasedProfiles, users } from "@/lib/db/schema";
import { exportProfilesCsv } from "@/lib/exports";
import { createMediaStorage } from "@/lib/media/storage";
import { changeProfileStatus, createProfile, softDeleteProfile } from "@/lib/profiles/service";
import {
  contrastWithWhite,
  getModerationSettings,
  parseWordList,
  saveBranding,
  saveModerationSettings,
} from "@/lib/settings";
import { submitCondolence } from "@/lib/tributes/service";
import {
  changeOwnPassword,
  createStaff,
  deleteStaff,
  generateTemporaryPassword,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from "@/lib/users/service";
import { newPasswordSchema } from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";
import { condolenceSchema } from "@/lib/validation/tribute";
import { passwordChangeSchema } from "@/lib/validation/user";
import { createTestDb, insertUser } from "./helpers/db";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
const HOUR = 3_600_000;

describe("comptes du personnel", () => {
  let conn: TestDb;
  let admin: Actor;

  beforeEach(async () => {
    conn = await createTestDb();
    const { user } = await insertUser(conn.db, { email: "admin@exemple.test", role: "admin" });
    admin = { userId: user.id, ipHash: null };
  });
  afterEach(() => conn.client.close());

  it("génère des mots de passe provisoires conformes et uniques", () => {
    const set = new Set(Array.from({ length: 200 }, generateTemporaryPassword));
    expect(set.size).toBe(200);
    for (const p of set) expect(newPasswordSchema.safeParse(p).success).toBe(true);
  });

  it("crée un compte utilisable, refuse un e-mail déjà pris, ne journalise pas le mot de passe", async () => {
    const r = await createStaff(conn.db, { name: "Léa", email: "lea@exemple.test", role: "employee" }, admin);
    if (!r.ok) throw new Error(r.error);
    const login = await authenticate(conn.db, { email: "lea@exemple.test", password: r.value.temporaryPassword, ipHash: null });
    expect(login).toMatchObject({ ok: true, user: { role: "employee" } });
    expect(await createStaff(conn.db, { name: "X", email: "lea@exemple.test", role: "employee" }, admin)).toMatchObject({ ok: false });
    expect(JSON.stringify(await conn.db.select().from(activityLogs))).not.toContain(r.value.temporaryPassword);
  });

  it("protège contre la perte du dernier administrateur et contre l'auto-sabotage", async () => {
    expect(await setStaffActive(conn.db, admin.userId, false, admin)).toMatchObject({ ok: false });
    expect(await deleteStaff(conn.db, admin.userId, admin)).toMatchObject({ ok: false });
    expect(await updateStaff(conn.db, admin.userId, { name: "A", role: "employee" }, admin)).toMatchObject({ ok: false });

    // Un second admin agit sur le premier : refusé tant qu'il est le dernier admin actif… sauf lui-même.
    const second = await createStaff(conn.db, { name: "B", email: "b@exemple.test", role: "admin" }, admin);
    if (!second.ok) throw new Error();
    const secondActor = { userId: second.value.id, ipHash: null };
    expect(await setStaffActive(conn.db, admin.userId, false, secondActor)).toEqual({ ok: true });
    // Désormais « B » est le seul admin actif : on ne peut pas le rétrograder.
    expect(await updateStaff(conn.db, second.value.id, { name: "B", role: "employee" }, admin)).toMatchObject({ ok: false });
  });

  it("désactiver ou réinitialiser ferme les sessions ; le nouveau mot de passe fonctionne", async () => {
    const r = await createStaff(conn.db, { name: "Léa", email: "lea@exemple.test", role: "employee" }, admin);
    if (!r.ok) throw new Error();
    const s1 = await createSession(conn.db, r.value.id, { ttlMs: HOUR });
    const reset = await resetStaffPassword(conn.db, r.value.id, admin);
    if (!reset.ok) throw new Error();
    expect(await validateSessionToken(conn.db, s1.token)).toBeNull();
    expect((await authenticate(conn.db, { email: "lea@exemple.test", password: r.value.temporaryPassword, ipHash: null })).ok).toBe(false);
    expect((await authenticate(conn.db, { email: "lea@exemple.test", password: reset.value.temporaryPassword, ipHash: null })).ok).toBe(true);

    const s2 = await createSession(conn.db, r.value.id, { ttlMs: HOUR });
    expect(await setStaffActive(conn.db, r.value.id, false, admin)).toEqual({ ok: true });
    expect(await validateSessionToken(conn.db, s2.token)).toBeNull();
    expect((await authenticate(conn.db, { email: "lea@exemple.test", password: reset.value.temporaryPassword, ipHash: null })).ok).toBe(false);
  });

  it("supprime un compte en conservant ses fiches", async () => {
    const r = await createStaff(conn.db, { name: "Léa", email: "lea@exemple.test", role: "employee" }, admin);
    if (!r.ok) throw new Error();
    const pid = await createProfile(conn.db, profileSchema.parse({ fullName: "Fiche" }), { userId: r.value.id, ipHash: null });
    expect(await deleteStaff(conn.db, r.value.id, admin)).toEqual({ ok: true });
    const [p] = await conn.db.select().from(deceasedProfiles).where(eq(deceasedProfiles.id, pid));
    expect(p).toMatchObject({ fullName: "Fiche", createdById: null });
  });

  it("change son propre mot de passe et ferme les autres sessions seulement", async () => {
    const { user, password } = await insertUser(conn.db, { email: "emp@exemple.test" });
    const current = await createSession(conn.db, user.id, { ttlMs: HOUR });
    const other = await createSession(conn.db, user.id, { ttlMs: HOUR });

    expect(await changeOwnPassword(conn.db, { userId: user.id, currentPassword: "faux", newPassword: "nouveau-mdp-2026" }, null)).toMatchObject({ ok: false });
    expect(
      await changeOwnPassword(conn.db, { userId: user.id, currentPassword: password, newPassword: "nouveau-mdp-2026", currentSessionToken: current.token }, null),
    ).toEqual({ ok: true });
    expect(await validateSessionToken(conn.db, current.token)).not.toBeNull();
    expect(await validateSessionToken(conn.db, other.token)).toBeNull();
    expect((await authenticate(conn.db, { email: "emp@exemple.test", password: "nouveau-mdp-2026", ipHash: null })).ok).toBe(true);
  });

  it("valide le formulaire de changement de mot de passe", () => {
    const base = { currentPassword: "ancien-mdp-1", newPassword: "nouveau-mdp-2026", confirmPassword: "nouveau-mdp-2026" };
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ ...base, confirmPassword: "autre-mdp-2026" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: "court1", confirmPassword: "court1" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: base.currentPassword, confirmPassword: base.currentPassword }).success).toBe(false);
  });

  it("filtre le journal par catégorie, utilisateur et date", async () => {
    await createStaff(conn.db, { name: "Léa", email: "lea@exemple.test", role: "employee" }, admin);
    await createProfile(conn.db, profileSchema.parse({ fullName: "Fiche" }), admin);
    expect((await listActivity(conn.db, { category: "user" })).items.map((i) => i.action)).toEqual(["user.create"]);
    expect((await listActivity(conn.db, { category: "profile" })).items).toHaveLength(1);
    expect((await listActivity(conn.db, { userId: admin.userId })).pagination.total).toBe(2);
    expect((await listActivity(conn.db, { to: "2000-01-01" })).items).toHaveLength(0);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect((await listActivity(conn.db, { from: iso, to: iso })).pagination.total).toBe(2);
  });
});

describe("export CSV", () => {
  it("échappe les cellules et neutralise les formules", () => {
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell('a;b"c')).toBe('"a;b""c"');
    expect(csvCell("ligne1\nligne2")).toBe('"ligne1\nligne2"');
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    for (const bad of ["+1+1", "-2", "@SUM(A1)"]) expect(csvCell(bad).startsWith("'")).toBe(true);
    expect(csvCell(-2)).toBe("-2"); // un vrai nombre n'est pas altéré
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("oui");
    const csv = toCsv(["A", "B"], [["x", 1]]);
    expect(csv.startsWith("﻿A;B\r\nx;1\r\n")).toBe(true);
  });

  it("n'exporte que des données non sensibles", async () => {
    const conn = await createTestDb();
    const { user } = await insertUser(conn.db);
    const actor = { userId: user.id, ipHash: null };
    const a = await createProfile(conn.db, profileSchema.parse({ fullName: "Jeanne", internalNotes: "NOTE-SECRETE" }), actor);
    await changeProfileStatus(conn.db, a, "published", actor);
    const b = await createProfile(conn.db, profileSchema.parse({ fullName: "Supprimée" }), actor);
    await softDeleteProfile(conn.db, b, actor);

    const csv = await exportProfilesCsv(conn.db, "https://exemple.fr");
    expect(csv).toContain("Jeanne");
    expect(csv).toContain("Publiée");
    expect(csv).toContain("https://exemple.fr/memoire/");
    expect(csv).not.toContain("Supprimée");
    expect(csv).not.toContain("NOTE-SECRETE");
    expect(csv).not.toContain(a); // pas d'identifiant interne
    conn.client.close();
  });
});

describe("paramètres", () => {
  let conn: TestDb;
  let actor: Actor;
  let dir: string;

  beforeEach(async () => {
    conn = await createTestDb();
    const { user } = await insertUser(conn.db, { role: "admin" });
    actor = { userId: user.id, ipHash: null };
    dir = await mkdtemp(join(tmpdir(), "memoria-settings-"));
  });
  afterEach(async () => {
    conn.client.close();
    await rm(dir, { recursive: true, force: true });
  });

  const brandingInput = { companyName: "PF Martin", primaryColor: "#2f4858", welcomeText: "Bienvenue", footerText: "1 rue X" };

  it("vérifie le contraste de la couleur principale", () => {
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 0);
    expect(contrastWithWhite("#4a5568")).toBeGreaterThan(4.5);
    expect(contrastWithWhite("#ffeb3b")).toBeLessThan(4.5);
  });

  it("enregistre l'identité, remplace et retire le logo sans laisser d'ancien fichier", async () => {
    const storage = createMediaStorage(dir);
    const png = await sharp({ create: { width: 1200, height: 600, channels: 4, background: "#123456" } }).png().toBuffer();

    expect(await saveBranding(conn.db, storage, brandingInput, { kind: "replace", bytes: png }, actor)).toEqual({ ok: true });
    const first = await getBranding(conn.db);
    expect(first).toMatchObject({ companyName: "PF Martin", primaryColor: "#2f4858" });
    expect(first.logoPath).toMatch(/^branding\/logo-/);
    const meta = await sharp(await storage.read(first.logoPath!)).metadata();
    expect(meta.width).toBeLessThanOrEqual(400);
    expect(meta.height).toBeLessThanOrEqual(160);

    await saveBranding(conn.db, storage, brandingInput, { kind: "replace", bytes: png }, actor);
    const second = await getBranding(conn.db);
    expect(second.logoPath).not.toBe(first.logoPath);
    expect(existsSync(storage.resolvePath(first.logoPath!))).toBe(false);

    await saveBranding(conn.db, storage, brandingInput, { kind: "remove" }, actor);
    expect((await getBranding(conn.db)).logoPath).toBeNull();
    expect(existsSync(storage.resolvePath(second.logoPath!))).toBe(false);
  });

  it("refuse un logo qui n'est pas une image", async () => {
    const storage = createMediaStorage(dir);
    const result = await saveBranding(conn.db, storage, brandingInput, { kind: "replace", bytes: Buffer.from("<svg onload=alert(1)>") }, actor);
    expect(result).toMatchObject({ ok: false });
  });

  it("normalise la liste de mots interdits et l'applique aux messages", async () => {
    expect(parseWordList("Arnaque\nPROMO, éèà;x\n  arnaque ")).toEqual(["arnaque", "promo", "eea"]);
    await saveModerationSettings(conn.db, { forbiddenWords: ["arnaque"] }, actor);
    expect((await getModerationSettings(conn.db)).forbiddenWords).toEqual(["arnaque"]);

    const pid = await createProfile(conn.db, profileSchema.parse({ fullName: "Jeanne", allowCondolences: "on" }), actor);
    await changeProfileStatus(conn.db, pid, "published", actor);
    const [p] = await conn.db.select().from(deceasedProfiles);
    const message = (text: string) => condolenceSchema.parse({ authorName: "Marie", message: text, consentToPublish: "on" });
    expect(await submitCondolence(conn.db, p!.publicId, message("Attention arnaque ici"), "ip")).toMatchObject({ ok: false });
    // Un mot de la liste par défaut n'est plus bloqué puisqu'elle a été remplacée.
    expect((await submitCondolence(conn.db, p!.publicId, message("Ni casino ni rien"), "ip")).ok).toBe(true);
  });
});

describe("sauvegarde et restauration", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "memoria-backup-"));
  });
  // Sous Windows, libsql garde le fichier verrouillé jusqu'au ramasse-miettes :
  // le nettoyage du dossier temporaire peut échouer sans conséquence.
  afterEach(() => rm(dir, { recursive: true, force: true }).catch(() => undefined));

  it("refuse les noms de sauvegarde dangereux", () => {
    for (const bad of ["../data", "sauvegarde-x", "sauvegarde-20260101-120000/../..", ""]) {
      expect(() => resolveBackupDir(dir, bad), bad).toThrow();
    }
    expect(resolveBackupDir(dir, "sauvegarde-20260101-120000")).toContain("sauvegarde-20260101-120000");
  });

  it("sauvegarde puis restaure base et médias", async () => {
    const dbPath = join(dir, "data", "memoria.db");
    const uploads = join(dir, "uploads");
    const backups = join(dir, "backups");
    await mkdir(join(uploads, "profil"), { recursive: true });
    await writeFile(join(uploads, "profil", "photo.webp"), "IMAGE-V1");

    let { db, client } = await createDatabase(`file:${dbPath}`);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await insertUser(db, { email: "avant@exemple.test" });

    const info = await createBackup({ client, storageRoot: uploads, backupsRoot: backups, now: new Date(2026, 0, 2, 3, 4, 5) });
    expect(info.name).toBe("sauvegarde-20260102-030405");
    expect((await listBackups(backups)).map((b) => b.name)).toEqual([info.name]);
    await verifyBackup(join(backups, info.name));

    // Modifications après la sauvegarde.
    await insertUser(db, { email: "apres@exemple.test" });
    await writeFile(join(uploads, "profil", "photo.webp"), "IMAGE-V2");
    client.close();

    await restoreBackup({ backupDir: join(backups, info.name), dbPath, storageRoot: uploads });

    ({ db, client } = await createDatabase(`file:${dbPath}`));
    const emails = (await db.select({ email: users.email }).from(users)).map((u) => u.email);
    expect(emails).toEqual(["avant@exemple.test"]);
    expect(await readFile(join(uploads, "profil", "photo.webp"), "utf8")).toBe("IMAGE-V1");
    client.close();
  });

  it("refuse une sauvegarde incomplète ou corrompue sans toucher aux données", async () => {
    const backupDir = join(dir, "backups", "sauvegarde-20260101-000000");
    await mkdir(backupDir, { recursive: true });
    await writeFile(join(backupDir, "manifest.json"), JSON.stringify({ format: 1 }));
    await writeFile(join(backupDir, "memoria.db"), "pas une base");
    const dbPath = join(dir, "live.db");
    await writeFile(dbPath, "DONNEES-ACTUELLES");
    await expect(restoreBackup({ backupDir, dbPath, storageRoot: join(dir, "u") })).rejects.toThrow();
    expect(await readFile(dbPath, "utf8")).toBe("DONNEES-ACTUELLES");
  });
});
