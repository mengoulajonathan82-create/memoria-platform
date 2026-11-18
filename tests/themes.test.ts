import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getBranding, brandingSchema, DEFAULT_BRANDING } from "@/lib/branding";
import { settings } from "@/lib/db/schema";
import { getPublicProfile } from "@/lib/profiles/public";
import { changeProfileStatus, createProfile, getProfile, setProfileTheme } from "@/lib/profiles/service";
import { contrastRatio } from "@/lib/settings";
import { isPublicThemeId, PUBLIC_THEMES, PUBLIC_THEME_IDS, resolveTheme, themeStyle } from "@/lib/themes";
import { profileSchema } from "@/lib/validation/profile";
import { createTestDb, insertUser } from "./helpers/db";

describe("thèmes publics", () => {
  it.each(PUBLIC_THEME_IDS)("le thème « %s » respecte les contrastes WCAG AA", (id) => {
    const c = PUBLIC_THEMES[id].colors;
    expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(c.text, c.surface)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(c.muted, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.accentFg, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.accent, c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("résout le thème : fiche, puis paramètres, puis défaut", () => {
    expect(resolveTheme("nuit", "sauge")).toBe("nuit");
    expect(resolveTheme(null, "sauge")).toBe("sauge");
    expect(resolveTheme("inconnu", "aussi-inconnu")).toBe("serenite");
    expect(isPublicThemeId("constructor")).toBe(false);
    expect(isPublicThemeId("__proto__")).toBe(false);
  });

  it("produit uniquement des variables issues du catalogue", () => {
    const style = themeStyle("nuit") as Record<string, string>;
    expect(style["--pt-bg"]).toBe(PUBLIC_THEMES.nuit.colors.bg);
    expect(style.colorScheme).toBe("dark");
  });

  it("tolère d'anciens paramètres sans thème ou avec un thème inconnu", () => {
    const legacy = { ...DEFAULT_BRANDING, primaryColor: "#2261ce" } as Record<string, unknown>;
    delete legacy.publicTheme;
    expect(brandingSchema.parse(legacy).publicTheme).toBe("serenite");
    expect(brandingSchema.parse({ ...legacy, publicTheme: "<script>" }).publicTheme).toBe("serenite");
  });
});

describe("thème par fiche", () => {
  let conn: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    conn = await createTestDb();
  });
  afterEach(() => conn.client.close());

  it("enregistre le thème d'une fiche et l'expose à la page publique", async () => {
    const { user } = await insertUser(conn.db);
    const actor = { userId: user.id, ipHash: null };
    const id = await createProfile(conn.db, profileSchema.parse({ fullName: "Jeanne" }), actor);
    await changeProfileStatus(conn.db, id, "published", actor);
    const publicId = (await getProfile(conn.db, id))!.publicId;

    let page = await getPublicProfile(conn.db, publicId);
    expect(page.kind === "published" && page.profile.theme).toBeNull();
    expect(await setProfileTheme(conn.db, id, "lavande", actor)).toBe(true);
    page = await getPublicProfile(conn.db, publicId);
    expect(page.kind === "published" && page.profile.theme).toBe("lavande");
    expect(await setProfileTheme(conn.db, id, null, actor)).toBe(true);
    page = await getPublicProfile(conn.db, publicId);
    expect(page.kind === "published" && page.profile.theme).toBeNull();
  });

  it("lit un ancien réglage d'identité sans casser l'affichage", async () => {
    await conn.db.insert(settings).values({
      key: "branding",
      value: JSON.stringify({ companyName: "PF", logoPath: null, primaryColor: "#2261ce", welcomeText: "", footerText: "" }),
    });
    expect(await getBranding(conn.db)).toMatchObject({ companyName: "PF", publicTheme: "serenite" });
  });
});
