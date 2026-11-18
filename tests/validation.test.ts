import { describe, expect, it } from "vitest";
import {
  buildPagination,
  changedFields,
  escapeLike,
  parsePage,
  parseSearchText,
} from "@/lib/query-utils";
import { formDataToObject } from "@/lib/validation/common";
import { familySchema } from "@/lib/validation/family";
import { profileSchema, profileStatusSchema } from "@/lib/validation/profile";

describe("validation des familles", () => {
  it("accepte une famille minimale et normalise les champs vides", () => {
    const parsed = familySchema.parse({ name: "  Famille Martin ", contactEmail: "", contactPhone: "" });
    expect(parsed).toMatchObject({
      name: "Famille Martin",
      contactEmail: null,
      contactPhone: null,
      status: "active",
    });
  });

  it("rejette les champs invalides", () => {
    const result = familySchema.safeParse({
      name: "",
      contactEmail: "pas-un-email",
      contactPhone: "abc",
      status: "inconnu",
    });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "contactEmail", "contactPhone", "status"]));
  });

  it("normalise l'e-mail en minuscules et limite la longueur des notes", () => {
    expect(familySchema.parse({ name: "X", contactEmail: "A@B.FR" }).contactEmail).toBe("a@b.fr");
    expect(familySchema.safeParse({ name: "X", internalNotes: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("validation des fiches", () => {
  const base = { fullName: "Jeanne Martin" };

  it("accepte une fiche minimale ; cases non cochées = faux", () => {
    const parsed = profileSchema.parse(base);
    expect(parsed.fullName).toBe("Jeanne Martin");
    expect(parsed.birthDate).toBeNull();
    expect(parsed.showDates).toBe(false);
    expect(profileSchema.parse({ ...base, showDates: "on" }).showDates).toBe(true);
  });

  it("vérifie l'ordre des dates", () => {
    const result = profileSchema.safeParse({ ...base, birthDate: "2000-01-02", deathDate: "1999-01-01" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual(["deathDate"]);
    expect(profileSchema.safeParse({ ...base, birthDate: "1940-05-01", deathDate: "2026-01-01" }).success).toBe(true);
  });

  it("rejette dates, heures et identifiants mal formés", () => {
    expect(profileSchema.safeParse({ ...base, birthDate: "31/12/1950" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, birthDate: "1500-01-01" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, ceremonyTime: "25:00" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, ceremonyTime: "14:30" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, familyId: "1 OR 1=1" }).success).toBe(false);
  });

  it("n'accepte que des liens http(s) pour la diffusion", () => {
    expect(profileSchema.safeParse({ ...base, livestreamUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, livestreamUrl: "ftp://exemple.fr" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, livestreamUrl: "https://exemple.fr/live" }).success).toBe(true);
  });

  it("n'accepte pas « supprimée » comme statut à choisir", () => {
    expect(profileStatusSchema.safeParse("published").success).toBe(true);
    expect(profileStatusSchema.safeParse("deleted").success).toBe(false);
  });
});

describe("utilitaires", () => {
  it("lit un numéro de page de façon sûre", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "abc", "9999999"]) expect(parsePage(bad)).toBe(1);
  });

  it("calcule la pagination et borne la page", () => {
    expect(buildPagination(45, 2, 20)).toMatchObject({ page: 2, totalPages: 3, offset: 20, hasPrevious: true, hasNext: true });
    expect(buildPagination(45, 99, 20)).toMatchObject({ page: 3, offset: 40, hasNext: false });
    expect(buildPagination(0, 1, 20)).toMatchObject({ page: 1, totalPages: 1, offset: 0 });
  });

  it("nettoie le texte de recherche", () => {
    expect(parseSearchText("  Martin  ")).toBe("Martin");
    expect(parseSearchText("x".repeat(500))).toHaveLength(100);
    expect(parseSearchText(undefined)).toBe("");
  });

  it("échappe les jokers LIKE", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("liste les champs modifiés sans les valeurs", () => {
    expect(changedFields({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: undefined })).toEqual(["b"]);
    expect(changedFields({ d: new Date(5) }, { d: new Date(5) })).toEqual([]);
  });

  it("convertit un FormData en ignorant les champs techniques", () => {
    const fd = new FormData();
    fd.set("name", "A");
    fd.set("$ACTION_ID_123", "");
    fd.set("file", new Blob(["x"]));
    expect(formDataToObject(fd)).toEqual({ name: "A" });
  });
});
