import jsQR from "jsqr";
import { PNG } from "pngjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/actor";
import { createFamily } from "@/lib/families/service";
import { getPublicProfile } from "@/lib/profiles/public";
import {
  changeProfileStatus,
  createProfile,
  getProfile,
  softDeleteProfile,
  updateProfile,
} from "@/lib/profiles/service";
import {
  buildPublicUrl,
  generateQrPng,
  generateQrSvg,
  isLocalOnlyUrl,
  qrFileName,
} from "@/lib/qr";
import { generatePublicId } from "@/lib/security/crypto";
import { familySchema } from "@/lib/validation/family";
import { profileSchema } from "@/lib/validation/profile";
import { createTestDb, insertUser } from "./helpers/db";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let conn: TestDb;
let actor: Actor;

beforeEach(async () => {
  conn = await createTestDb();
  const { user } = await insertUser(conn.db);
  actor = { userId: user.id, ipHash: null };
});
afterEach(() => conn.client.close());

const ALL_VISIBLE = {
  showDates: "on",
  showBiography: "on",
  showCeremony: "on",
  showPracticalInfo: "on",
  showGallery: "on",
  allowCondolences: "on",
  allowCandles: "on",
};

const SECRET_NOTE = "NOTE-INTERNE-SECRETE";
const SECRET_FAMILY = "FAMILLE-PRIVEE-XYZ";
const SECRET_PHONE = "0699887766";

async function createFullProfile(overrides: Record<string, unknown> = {}) {
  const familyId = await createFamily(
    conn.db,
    familySchema.parse({ name: SECRET_FAMILY, contactPhone: SECRET_PHONE, internalNotes: SECRET_NOTE }),
    actor,
  );
  const id = await createProfile(
    conn.db,
    profileSchema.parse({
      ...ALL_VISIBLE,
      familyId,
      fullName: "Jeanne Martin",
      birthDate: "1940-01-01",
      deathDate: "2026-11-01",
      biography: "Une vie bien remplie.",
      ceremonyDate: "2026-11-20",
      ceremonyTime: "14:30",
      ceremonyLocation: "Église",
      practicalInfo: "Ni fleurs ni couronnes.",
      internalNotes: SECRET_NOTE,
      ...overrides,
    }),
    actor,
  );
  const profile = (await getProfile(conn.db, id))!;
  return { id, publicId: profile.publicId };
}

describe("page publique : accès", () => {
  it("renvoie « introuvable » pour un identifiant mal formé ou inconnu", async () => {
    expect(await getPublicProfile(conn.db, "abc")).toEqual({ kind: "not_found" });
    expect(await getPublicProfile(conn.db, "' OR 1=1 --")).toEqual({ kind: "not_found" });
    expect(await getPublicProfile(conn.db, generatePublicId())).toEqual({ kind: "not_found" });
  });

  it("ne publie que les fiches au statut « publiée »", async () => {
    const { id, publicId } = await createFullProfile();
    expect(await getPublicProfile(conn.db, publicId)).toEqual({ kind: "unavailable" });

    await changeProfileStatus(conn.db, id, "pending", actor);
    expect((await getPublicProfile(conn.db, publicId)).kind).toBe("unavailable");

    await changeProfileStatus(conn.db, id, "published", actor);
    expect((await getPublicProfile(conn.db, publicId)).kind).toBe("published");

    // Dépublication : effet immédiat, même URL.
    await changeProfileStatus(conn.db, id, "archived", actor);
    expect(await getPublicProfile(conn.db, publicId)).toEqual({ kind: "unavailable" });

    await changeProfileStatus(conn.db, id, "published", actor);
    await softDeleteProfile(conn.db, id, actor);
    expect(await getPublicProfile(conn.db, publicId)).toEqual({ kind: "unavailable" });
  });

  it("garde la même URL quand le contenu change", async () => {
    const { id, publicId } = await createFullProfile();
    await changeProfileStatus(conn.db, id, "published", actor);
    await updateProfile(conn.db, id, profileSchema.parse({ ...ALL_VISIBLE, fullName: "Jeanne Martin-Durand" }), actor);
    const result = await getPublicProfile(conn.db, publicId);
    expect(result.kind === "published" && result.profile.fullName).toBe("Jeanne Martin-Durand");
  });
});

describe("page publique : confidentialité", () => {
  it("n'expose qu'une liste blanche de champs, sans donnée privée", async () => {
    const { id, publicId } = await createFullProfile();
    await changeProfileStatus(conn.db, id, "published", actor);
    const result = await getPublicProfile(conn.db, publicId);
    expect(result.kind).toBe("published");
    if (result.kind !== "published") return;

    expect(Object.keys(result.profile).sort()).toEqual([
      "allowCandles",
      "allowCondolences",
      "biography",
      "birthDate",
      "ceremony",
      "deathDate",
      "fullName",
      "gallery",
      "mainPhoto",
      "practicalInfo",
      "showGallery",
    ]);
    const serialized = JSON.stringify(result);
    for (const secret of [SECRET_NOTE, SECRET_FAMILY, SECRET_PHONE, id, actor.userId]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("remplace les champs masqués par null", async () => {
    const { id, publicId } = await createFullProfile({
      showDates: undefined,
      showBiography: undefined,
      showCeremony: undefined,
      showPracticalInfo: undefined,
    });
    await changeProfileStatus(conn.db, id, "published", actor);
    const result = await getPublicProfile(conn.db, publicId);
    if (result.kind !== "published") throw new Error("attendu : publiée");
    expect(result.profile).toMatchObject({
      fullName: "Jeanne Martin",
      birthDate: null,
      deathDate: null,
      biography: null,
      ceremony: null,
      practicalInfo: null,
    });
    expect(JSON.stringify(result)).not.toContain("Une vie bien remplie");
    expect(JSON.stringify(result)).not.toContain("Église");
  });

  it("n'affiche pas de bloc cérémonie vide", async () => {
    const { id, publicId } = await createFullProfile({
      ceremonyDate: "",
      ceremonyTime: "",
      ceremonyLocation: "",
    });
    await changeProfileStatus(conn.db, id, "published", actor);
    const result = await getPublicProfile(conn.db, publicId);
    expect(result.kind === "published" && result.profile.ceremony).toBeNull();
  });
});

describe("QR code", () => {
  const publicId = generatePublicId();

  it("construit l'URL publique stable sans identifiant interne", () => {
    expect(buildPublicUrl("http://localhost:3000", publicId)).toBe(`http://localhost:3000/memoire/${publicId}`);
    expect(buildPublicUrl("https://exemple.fr/", publicId)).toBe(`https://exemple.fr/memoire/${publicId}`);
    expect(() => buildPublicUrl("https://exemple.fr", "../admin")).toThrow();
  });

  it("détecte une APP_URL inutilisable depuis un téléphone", () => {
    expect(isLocalOnlyUrl("http://localhost:3000")).toBe(true);
    expect(isLocalOnlyUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalOnlyUrl("http://192.168.1.20:3000")).toBe(false);
    expect(isLocalOnlyUrl("https://exemple.fr")).toBe(false);
  });

  it("encode exactement l'URL publique (décodage réel de l'image PNG)", async () => {
    const url = buildPublicUrl("https://exemple.fr", publicId);
    const image = PNG.sync.read(await generateQrPng(url, 400));
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    expect(decoded?.data).toBe(url);
  });

  it("produit un SVG sans script et un PNG valide", async () => {
    const url = buildPublicUrl("https://exemple.fr", publicId);
    const svg = await generateQrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script|javascript:|onload=/i);

    const png = await generateQrPng(url);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.length).toBeGreaterThan(1000);
  });

  it("génère des noms de fichiers sûrs", () => {
    expect(qrFileName("Jeanne Marie Dûpont-Éléonore", "png")).toBe("qr-jeanne-marie-dupont-eleonore.png");
    expect(qrFileName('../../"evil"', "svg")).toBe("qr-evil.svg");
    expect(qrFileName("???", "png")).toBe("qr-fiche.png");
  });
});
