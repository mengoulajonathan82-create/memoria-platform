import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  generatePublicId,
  generateToken,
  hashIp,
  isValidPublicId,
  PUBLIC_ID_LENGTH,
  sha256Hex,
} from "@/lib/security/crypto";
import { loginSchema, newPasswordSchema } from "@/lib/validation/auth";

describe("mots de passe (Argon2id)", () => {
  it("hache et vérifie un mot de passe", async () => {
    const hash = await hashPassword("un-mot-de-passe-123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("un-mot-de-passe-123");
    expect(await verifyPassword(hash, "un-mot-de-passe-123")).toBe(true);
    expect(await verifyPassword(hash, "mauvais-mot-de-passe")).toBe(false);
  });

  it("refuse un hachage corrompu sans lever d'erreur", async () => {
    expect(await verifyPassword("pas-un-hachage", "x")).toBe(false);
  });

  it("applique la politique de mot de passe", () => {
    expect(newPasswordSchema.safeParse("court1").success).toBe(false);
    expect(newPasswordSchema.safeParse("seulementdeslettres").success).toBe(false);
    expect(newPasswordSchema.safeParse("123456789012345").success).toBe(false);
    expect(newPasswordSchema.safeParse("lettres-et-chiffres-42").success).toBe(true);
  });
});

describe("identifiants publics", () => {
  it("génère des identifiants longs, valides et uniques", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generatePublicId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) {
      expect(id).toHaveLength(PUBLIC_ID_LENGTH);
      expect(isValidPublicId(id)).toBe(true);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("rejette les identifiants mal formés", () => {
    expect(isValidPublicId("")).toBe(false);
    expect(isValidPublicId("1")).toBe(false);
    expect(isValidPublicId("a".repeat(31) + "/")).toBe(false);
    expect(isValidPublicId("0".repeat(PUBLIC_ID_LENGTH))).toBe(false); // « 0 » exclu
  });
});

describe("jetons et empreintes", () => {
  it("génère des jetons de 256 bits", () => {
    expect(generateToken()).toHaveLength(43);
    expect(generateToken()).not.toBe(generateToken());
  });

  it("calcule une empreinte SHA-256", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("ne conserve jamais l'IP en clair", () => {
    const secret = "s".repeat(32);
    const hashed = hashIp("192.168.1.10", secret);
    expect(hashed).toHaveLength(32);
    expect(hashed).not.toContain("192");
    expect(hashIp("192.168.1.10", secret)).toBe(hashed);
    expect(hashIp("192.168.1.10", "t".repeat(32))).not.toBe(hashed);
    expect(hashIp(null, secret)).toBeNull();
  });
});

describe("rôles et permissions", () => {
  it("donne toutes les permissions à l'administrateur", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission("admin", permission)).toBe(true);
    }
  });

  it("limite les permissions de l'employé", () => {
    expect(hasPermission("employee", "dashboard.view")).toBe(true);
    expect(hasPermission("employee", "profiles.manage")).toBe(true);
    expect(hasPermission("employee", "moderation.manage")).toBe(true);
    expect(hasPermission("employee", "users.manage")).toBe(false);
    expect(hasPermission("employee", "settings.manage")).toBe(false);
    expect(hasPermission("employee", "backup.manage")).toBe(false);
    expect(hasPermission("employee", "activity.view")).toBe(false);
    expect(hasPermission("employee", "media.restore")).toBe(false);
  });
});

describe("validation de la connexion", () => {
  it("normalise l'e-mail", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Exemple.TEST ", password: "x" });
    expect(parsed.email).toBe("admin@exemple.test");
  });

  it("rejette les entrées invalides", () => {
    expect(loginSchema.safeParse({ email: "pas-un-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "x".repeat(129) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.fr" }).success).toBe(false);
  });
});
