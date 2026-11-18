import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/actor";
import { deceasedProfiles, media } from "@/lib/db/schema";
import { detectFileType, fileExtension, MAX_BYTES } from "@/lib/media/detect";
import { processImage } from "@/lib/media/image";
import { parseRange } from "@/lib/media/serve";
import {
  findPublicMedia,
  getMedia,
  ingestUpload,
  listProfileMedia,
  moveMedia,
  restoreMedia,
  setMainPhoto,
  softDeleteMedia,
  updateMediaDetails,
} from "@/lib/media/service";
import { createMediaStorage, type MediaStorage } from "@/lib/media/storage";
import { getPublicProfile } from "@/lib/profiles/public";
import { changeProfileStatus, createProfile, getProfile, softDeleteProfile } from "@/lib/profiles/service";
import { profileSchema } from "@/lib/validation/profile";
import { createTestDb, insertUser } from "./helpers/db";

/* ------------------------------------------------------------------ */
/* Fichiers d'essai                                                    */
/* ------------------------------------------------------------------ */

async function makeJpeg(width = 3000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "METADONNEE-PRIVEE", Artist: "Appareil de Jeanne" } })
    .toBuffer();
}

async function makePng(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
}

const fakeMp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(2000, 7)]);
const fakeMov = () => Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("ftypqt  "), Buffer.alloc(100)]);
const fakeHeic = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(100)]);
const fakePdf = () => Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const html = () => Buffer.from("<html><script>alert(document.cookie)</script></html>");

/* ------------------------------------------------------------------ */

describe("détection du type réel", () => {
  it("reconnaît les formats autorisés par leur signature", async () => {
    expect(detectFileType(await makeJpeg(10, 10))).toMatchObject({ ok: true, file: { type: "image", mime: "image/jpeg" } });
    expect(detectFileType(await makePng())).toMatchObject({ ok: true, file: { mime: "image/png" } });
    const webp = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).webp().toBuffer();
    expect(detectFileType(webp)).toMatchObject({ ok: true, file: { mime: "image/webp" } });
    expect(detectFileType(fakeMp4())).toMatchObject({ ok: true, file: { type: "video", mime: "video/mp4" } });
    expect(detectFileType(fakeMov())).toMatchObject({ ok: true, file: { mime: "video/quicktime" } });
    expect(detectFileType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2]))).toMatchObject({ ok: true, file: { mime: "video/webm" } });
    expect(detectFileType(fakePdf())).toMatchObject({ ok: true, file: { type: "document" } });
  });

  it("refuse le reste, et signale le HEIC", () => {
    expect(detectFileType(html())).toEqual({ ok: false, reason: "unsupported" });
    expect(detectFileType(Buffer.from("MZ\x90\x00"))).toEqual({ ok: false, reason: "unsupported" }); // exécutable Windows
    expect(detectFileType(Buffer.alloc(0))).toEqual({ ok: false, reason: "unsupported" });
    expect(detectFileType(fakeHeic())).toEqual({ ok: false, reason: "heic" });
  });

  it("lit l'extension du nom de fichier", () => {
    expect(fileExtension("Photo.JPG")).toBe("jpg");
    expect(fileExtension("archive.tar.gz")).toBe("gz");
    expect(fileExtension("sans-extension")).toBe("");
    expect(fileExtension("image.jpg.exe")).toBe("exe");
  });
});

describe("optimisation des images", () => {
  it("redimensionne, convertit en WebP et supprime les métadonnées", async () => {
    const input = await makeJpeg();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processImage(input);
    const meta = await sharp(out.main).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(2000);
    expect(meta.height).toBe(1000);
    expect(meta.exif).toBeUndefined();
    expect(out.main.includes(Buffer.from("METADONNEE-PRIVEE"))).toBe(false);

    const thumb = await sharp(out.thumb).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBeLessThanOrEqual(640);
  });

  it("refuse les images démesurées (bombe de décompression)", async () => {
    await expect(processImage(await makeJpeg(3000, 1500), { maxInputPixels: 1_000_000 })).rejects.toThrow();
  });
});

describe("stockage protégé", () => {
  let dir: string;
  let storage: MediaStorage;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "memoria-storage-"));
    storage = createMediaStorage(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("refuse toute sortie du dossier de stockage", () => {
    for (const bad of ["../secret.txt", "a/../../secret.txt", "/etc/passwd", "C:\\Windows\\win.ini", "", "a\0b"]) {
      expect(() => storage.resolvePath(bad), bad).toThrow();
    }
    expect(storage.resolvePath("profil/fichier.webp").startsWith(storage.root)).toBe(true);
  });

  it("n'écrase jamais un fichier existant", async () => {
    await storage.write("x/a.bin", Buffer.from("1"));
    await expect(storage.write("x/a.bin", Buffer.from("2"))).rejects.toThrow();
    expect((await storage.read("x/a.bin")).toString()).toBe("1");
  });
});

describe("requêtes partielles (lecture vidéo)", () => {
  it("analyse l'en-tête Range", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=200-300", 100)).toBeNull();
    expect(parseRange("bytes=9-1", 100)).toBeNull();
    expect(parseRange("octets=0-1", 100)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

describe("service médias", () => {
  type TestDb = Awaited<ReturnType<typeof createTestDb>>;
  let conn: TestDb;
  let actor: Actor;
  let dir: string;
  let storage: MediaStorage;
  let profileId: string;

  beforeEach(async () => {
    conn = await createTestDb();
    const { user } = await insertUser(conn.db);
    actor = { userId: user.id, ipHash: null };
    dir = await mkdtemp(join(tmpdir(), "memoria-media-"));
    storage = createMediaStorage(dir);
    profileId = await createProfile(
      conn.db,
      profileSchema.parse({ fullName: "Jeanne Martin", showGallery: "on" }),
      actor,
    );
  });
  afterEach(async () => {
    conn.client.close();
    await rm(dir, { recursive: true, force: true });
  });

  const upload = async (bytes: Buffer, fileName: string, pid = profileId) =>
    ingestUpload(conn.db, storage, { profileId: pid, fileName, bytes }, actor);

  async function uploadOk(bytes: Buffer, fileName: string) {
    const result = await upload(bytes, fileName);
    if (!result.ok) throw new Error(result.error);
    return result.id;
  }

  it("enregistre une photo optimisée, sa miniature, et l'ordre d'arrivée", async () => {
    const a = await uploadOk(await makeJpeg(), "portrait.jpg");
    const b = await uploadOk(await makePng(), "souvenir.PNG");
    const ma = (await getMedia(conn.db, a))!;
    expect(ma).toMatchObject({ type: "image", mimeType: "image/webp", width: 2000, height: 1000, sortOrder: 0 });
    expect((await getMedia(conn.db, b))!.sortOrder).toBe(1);
    expect(existsSync(storage.resolvePath(ma.storagePath))).toBe(true);
    expect(existsSync(storage.resolvePath(ma.thumbPath!))).toBe(true);
    expect(ma.storagePath).not.toContain("portrait"); // nom d'origine jamais réutilisé
  });

  it("stocke vidéos et PDF tels quels", async () => {
    const v = (await getMedia(conn.db, await uploadOk(fakeMp4(), "film.mp4")))!;
    expect(v).toMatchObject({ type: "video", mimeType: "video/mp4", thumbPath: null });
    expect(v.storagePath.endsWith(".mp4")).toBe(true);
    const d = (await getMedia(conn.db, await uploadOk(fakePdf(), "faire-part.pdf")))!;
    expect(d).toMatchObject({ type: "document", mimeType: "application/pdf" });
  });

  it("refuse les fichiers déguisés, incohérents, vides ou trop lourds, sans rien écrire", async () => {
    expect(await upload(html(), "photo.jpg")).toMatchObject({ ok: false });
    expect(await upload(await makePng(), "photo.jpg")).toEqual({
      ok: false,
      error: "L'extension du fichier ne correspond pas à son contenu.",
    });
    expect(await upload(fakePdf(), "document.exe")).toMatchObject({ ok: false });
    expect(await upload(Buffer.alloc(0), "vide.jpg")).toMatchObject({ ok: false });
    expect((await upload(fakeHeic(), "IMG_0001.heic")) as { error: string }).toMatchObject({
      ok: false,
      error: expect.stringContaining("HEIC"),
    });
    const tooBig = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_BYTES.image)]);
    expect(await upload(tooBig, "grosse.jpg")).toMatchObject({ ok: false, error: expect.stringContaining("volumineux") });
    // Image corrompue : signature JPEG valide mais contenu illisible.
    expect(await upload(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(500, 1)]), "x.jpg")).toMatchObject({
      ok: false,
      error: expect.stringContaining("illisible"),
    });

    expect(await conn.db.select().from(media)).toHaveLength(0);
    expect(existsSync(join(dir, profileId))).toBe(false);
  });

  it("refuse l'ajout sur une fiche supprimée ou inconnue", async () => {
    await softDeleteProfile(conn.db, profileId, actor);
    expect(await upload(await makePng(), "a.png")).toEqual({ ok: false, error: "Fiche introuvable." });
    expect(await upload(await makePng(), "a.png", crypto.randomUUID())).toEqual({ ok: false, error: "Fiche introuvable." });
  });

  it("modifie l'ordre, la légende et la visibilité", async () => {
    const a = await uploadOk(await makePng(), "a.png");
    const b = await uploadOk(await makePng(), "b.png");
    const c = await uploadOk(await makePng(), "c.png");
    expect(await moveMedia(conn.db, c, "up", actor)).toBe(true);
    expect((await listProfileMedia(conn.db, profileId)).map((m) => m.id)).toEqual([a, c, b]);
    expect(await moveMedia(conn.db, a, "up", actor)).toBe(false); // déjà en tête

    expect(await updateMediaDetails(conn.db, b, { caption: "Été 1975", isPublic: false }, actor)).toBe(true);
    expect(await getMedia(conn.db, b)).toMatchObject({ caption: "Été 1975", isPublic: false });
  });

  it("corbeille et restauration ; la photo principale est retirée si supprimée", async () => {
    const a = await uploadOk(await makePng(), "a.png");
    const b = await uploadOk(await makePng(), "b.png");
    expect(await setMainPhoto(conn.db, profileId, a, actor)).toBe(true);
    expect((await getProfile(conn.db, profileId))!.mainPhotoMediaId).toBe(a);

    expect(await softDeleteMedia(conn.db, a, actor)).toBe(true);
    expect((await getProfile(conn.db, profileId))!.mainPhotoMediaId).toBeNull();
    expect((await listProfileMedia(conn.db, profileId)).map((m) => m.id)).toEqual([b]);
    expect((await listProfileMedia(conn.db, profileId, "deleted")).map((m) => m.id)).toEqual([a]);
    // Fichier conservé (suppression logique) pour permettre la restauration.
    expect(existsSync(storage.resolvePath((await getMedia(conn.db, a))!.storagePath))).toBe(true);

    expect(await restoreMedia(conn.db, a, actor)).toBe(true);
    expect((await listProfileMedia(conn.db, profileId)).map((m) => m.id)).toEqual([b, a]);
    expect(await restoreMedia(conn.db, a, actor)).toBe(false);
  });

  it("n'accepte comme photo principale qu'une image active de la même fiche", async () => {
    const video = await uploadOk(fakeMp4(), "v.mp4");
    expect(await setMainPhoto(conn.db, profileId, video, actor)).toBe(false);

    const other = await createProfile(conn.db, profileSchema.parse({ fullName: "Autre" }), actor);
    const foreign = (await ingestUpload(conn.db, storage, { profileId: other, fileName: "x.png", bytes: await makePng() }, actor)) as { id: string };
    expect(await setMainPhoto(conn.db, profileId, foreign.id, actor)).toBe(false);
    expect(await setMainPhoto(conn.db, profileId, null, actor)).toBe(true);
  });

  describe("accès public", () => {
    let publicId: string;
    beforeEach(async () => {
      publicId = (await getProfile(conn.db, profileId))!.publicId;
    });
    const keyOf = async (id: string) => (await getMedia(conn.db, id))!.publicKey;

    it("n'expose rien tant que la fiche n'est pas publiée", async () => {
      const a = await uploadOk(await makePng(), "a.png");
      expect(await findPublicMedia(conn.db, publicId, await keyOf(a))).toBeNull();
      await changeProfileStatus(conn.db, profileId, "published", actor);
      expect(await findPublicMedia(conn.db, publicId, await keyOf(a))).not.toBeNull();
      await changeProfileStatus(conn.db, profileId, "archived", actor);
      expect(await findPublicMedia(conn.db, publicId, await keyOf(a))).toBeNull();
    });

    it("applique visibilité, galerie, photo principale et corbeille", async () => {
      await changeProfileStatus(conn.db, profileId, "published", actor);
      const main = await uploadOk(await makePng(), "main.png");
      const priv = await uploadOk(await makePng(), "priv.png");
      const pub = await uploadOk(await makePng(), "pub.png");
      await setMainPhoto(conn.db, profileId, main, actor);
      await updateMediaDetails(conn.db, main, { caption: null, isPublic: false }, actor);
      await updateMediaDetails(conn.db, priv, { caption: null, isPublic: false }, actor);

      expect(await findPublicMedia(conn.db, publicId, await keyOf(main))).not.toBeNull(); // principale : toujours
      expect(await findPublicMedia(conn.db, publicId, await keyOf(priv))).toBeNull(); // privée
      expect(await findPublicMedia(conn.db, publicId, await keyOf(pub))).not.toBeNull();

      // Galerie masquée : seule la photo principale reste accessible.
      await conn.db.update(deceasedProfiles).set({ showGallery: false });
      expect(await findPublicMedia(conn.db, publicId, await keyOf(pub))).toBeNull();
      expect(await findPublicMedia(conn.db, publicId, await keyOf(main))).not.toBeNull();
      await conn.db.update(deceasedProfiles).set({ showGallery: true });

      await softDeleteMedia(conn.db, pub, actor);
      expect(await findPublicMedia(conn.db, publicId, await keyOf(pub))).toBeNull();
    });

    it("refuse une clé de média combinée à une autre fiche", async () => {
      await changeProfileStatus(conn.db, profileId, "published", actor);
      const a = await uploadOk(await makePng(), "a.png");
      const other = await createProfile(conn.db, profileSchema.parse({ fullName: "Autre" }), actor);
      await changeProfileStatus(conn.db, other, "published", actor);
      const otherPublicId = (await getProfile(conn.db, other))!.publicId;
      expect(await findPublicMedia(conn.db, otherPublicId, await keyOf(a))).toBeNull();
    });

    it("la page publique ne liste que les médias publics, sans donnée interne", async () => {
      await changeProfileStatus(conn.db, profileId, "published", actor);
      const main = await uploadOk(await makePng(), "main.png");
      const pub = await uploadOk(fakeMp4(), "film.mp4");
      const priv = await uploadOk(await makePng(), "priv.png");
      await setMainPhoto(conn.db, profileId, main, actor);
      await updateMediaDetails(conn.db, pub, { caption: "Mariage", isPublic: true }, actor);
      await updateMediaDetails(conn.db, priv, { caption: "PRIVEE", isPublic: false }, actor);

      const result = await getPublicProfile(conn.db, publicId);
      if (result.kind !== "published") throw new Error("attendu : publiée");
      expect(result.profile.mainPhoto?.url).toBe(`/memoire/${publicId}/medias/${await keyOf(main)}`);
      expect(result.profile.gallery).toHaveLength(1); // la principale n'est pas dupliquée
      expect(result.profile.gallery[0]).toMatchObject({ type: "video", caption: "Mariage", thumbUrl: null });
      expect(Object.keys(result.profile.gallery[0]!).sort()).toEqual(
        ["caption", "height", "mimeType", "thumbUrl", "type", "url", "width"],
      );
      const serialized = JSON.stringify(result);
      for (const secret of ["PRIVEE", main, pub, priv, profileId, "storage", dir]) {
        expect(serialized).not.toContain(secret);
      }
    });
  });
});
