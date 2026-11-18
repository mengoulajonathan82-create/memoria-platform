/**
 * Parcours critiques de bout en bout, dans un vrai navigateur :
 * administrateur → famille → fiche → publication → QR code → page publique →
 * condoléances et bougie (visiteur) → modération → dépublication ; puis droits
 * d'un employé créé par l'administrateur.
 */
import { expect, test, type Page } from "@playwright/test";
import { E2E_ENV } from "../playwright.config";

test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

let publicPath = "";
let employeePassword = "";

test("le back-office est inaccessible sans connexion", async ({ page }) => {
  await page.goto("/admin/fiches");
  await expect(page).toHaveURL(/\/connexion$/);
  const qr = await page.request.get("/api/admin/medias/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  expect(qr.status()).toBe(401);
});

test("une erreur de connexion reste générique", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(E2E_ENV.SEED_ADMIN_EMAIL);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
});

test("l'administrateur crée une famille, une fiche, la publie et obtient le QR code", async ({ page }) => {
  await login(page, E2E_ENV.SEED_ADMIN_EMAIL, E2E_ENV.SEED_ADMIN_PASSWORD);

  await page.goto("/admin/familles/nouvelle");
  await page.getByLabel("Nom de la famille").fill("Famille Parcours");
  await page.getByLabel("Notes", { exact: true }).fill("NOTE-PRIVEE-FAMILLE");
  await page.getByRole("button", { name: "Créer la famille" }).click();
  await expect(page.getByText("Enregistrement créé.")).toBeVisible();

  await page.getByRole("link", { name: "Nouvelle fiche pour cette famille" }).click();
  await page.getByLabel("Nom complet").fill("Jeanne Parcours");
  await page.getByLabel("Date de naissance").fill("1940-05-12");
  await page.getByLabel("Date de décès").fill("2026-11-01");
  await page.getByLabel("Texte de présentation").fill("Une vie consacrée aux siens.");
  await page.getByLabel("Notes", { exact: true }).fill("NOTE-PRIVEE-FICHE");
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await expect(page.getByText("Enregistrement créé.")).toBeVisible();

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();

  const link = page.getByRole("link", { name: /\/memoire\// });
  publicPath = new URL((await link.getAttribute("href"))!).pathname;
  expect(publicPath).toMatch(/^\/memoire\/[A-Za-z0-9]{32}$/);

  const png = await page.request.get(page.url().replace(/\?.*$/, "") + "/qr?format=png");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
});

test("un visiteur consulte la page, laisse un message et allume une bougie", async ({ browser }) => {
  const visitor = await browser.newContext(); // aucun cookie
  const page = await visitor.newPage();
  await page.setViewportSize({ width: 390, height: 844 }); // téléphone
  await page.goto(publicPath);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jeanne Parcours");
  await expect(page.getByText("Une vie consacrée aux siens.")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("NOTE-PRIVEE");
  expect(html).not.toContain("Famille Parcours");

  await page.waitForTimeout(3_500); // le jeton anti-robot refuse les envois instantanés
  await page.getByLabel("Votre nom ou prénom").fill("Marie Visiteuse");
  await page.getByLabel("Votre message").fill("Toutes nos pensées vous accompagnent.");
  await page.getByLabel(/J'accepte que mon nom/).check();
  await page.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(page.getByText(/sera publié après relecture/)).toBeVisible();
  await expect(page.getByText("Toutes nos pensées vous accompagnent.")).toHaveCount(0);

  await page.getByLabel("Votre prénom (facultatif)").fill("Paul");
  await page.getByRole("button", { name: "Allumer une bougie" }).click();
  await expect(page.getByText("1 bougie allumée")).toBeVisible();
  await visitor.close();
});

test("l'administrateur approuve le message, puis dépublie la fiche", async ({ page, browser }) => {
  await login(page, E2E_ENV.SEED_ADMIN_EMAIL, E2E_ENV.SEED_ADMIN_PASSWORD);
  await page.goto("/admin/moderation");
  await expect(page.getByText("Toutes nos pensées vous accompagnent.")).toBeVisible();
  await page.getByRole("button", { name: "Approuver" }).click();
  await expect(page.getByText("Décision de modération enregistrée.")).toBeVisible();

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(publicPath);
  await expect(pub.getByText("Toutes nos pensées vous accompagnent.")).toBeVisible();
  await expect(pub.getByText("Marie Visiteuse", { exact: false })).toBeVisible();

  await page.goto("/admin/fiches");
  await page.getByRole("link", { name: "Jeanne Parcours" }).click();
  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();

  await pub.reload();
  await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Cette page n'est plus disponible");
  expect(await pub.content()).not.toContain("Jeanne Parcours");
  await visitor.close();
});

test("l'administrateur crée un compte employé avec un mot de passe provisoire", async ({ page }) => {
  await login(page, E2E_ENV.SEED_ADMIN_EMAIL, E2E_ENV.SEED_ADMIN_PASSWORD);
  await page.goto("/admin/employes");
  await page.getByLabel(/^Nom/).fill("Nouvel Employé");
  await page.getByLabel("E-mail").fill("nouveau-e2e@exemple.test");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  const box = page.getByText("Mot de passe provisoire").locator("..").locator("p.font-mono");
  employeePassword = (await box.textContent())!.trim();
  expect(employeePassword).toMatch(/^[A-Za-z0-9]{16}$/);
});

test("l'employé se connecte mais n'accède pas à l'administration réservée", async ({ page }) => {
  await login(page, "nouveau-e2e@exemple.test", employeePassword);
  const nav = page.getByRole("navigation", { name: "Navigation du back-office" });
  await expect(nav.getByRole("link", { name: "Fiches défunts" })).toBeVisible();
  for (const name of ["Employés", "Journal", "Paramètres", "Données"]) {
    await expect(nav.getByRole("link", { name })).toHaveCount(0);
  }
  for (const path of ["/admin/employes", "/admin/journal", "/admin/parametres", "/admin/donnees"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/acces-refuse/);
  }
  const csv = await page.request.get("/admin/donnees/export?type=fiches");
  expect(csv.status()).toBe(403);
});
