/**
 * Données de DÉMONSTRATION (clairement identifiées comme exemples) :
 * une famille fictive et deux fiches fictives.
 * Idempotent : ne fait rien si la famille d'exemple existe déjà.
 *
 * Usage : npm run db:seed:demo   (après npm run db:seed)
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDatabase, getDatabaseUrl } from "../src/lib/db/client";
import { families, users } from "../src/lib/db/schema";
import { createFamily } from "../src/lib/families/service";
import { changeProfileStatus, createProfile } from "../src/lib/profiles/service";
import { familySchema } from "../src/lib/validation/family";
import { profileSchema } from "../src/lib/validation/profile";

const DEMO_FAMILY_NAME = "Famille Exemple (démonstration)";
const ALL_PUBLIC = {
  showDates: "on",
  showBiography: "on",
  showCeremony: "on",
  showPracticalInfo: "on",
  showGallery: "on",
  allowCondolences: "on",
  allowCandles: "on",
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Les données de démonstration ne doivent pas être créées en production.");
  }
  const { db, client } = await createDatabase(getDatabaseUrl());

  const [existing] = await db.select({ id: families.id }).from(families).where(eq(families.name, DEMO_FAMILY_NAME)).limit(1);
  if (existing) {
    console.log("ℹ Données de démonstration déjà présentes.");
    client.close();
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const [admin] = email
    ? await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    : [];
  if (!admin) throw new Error("Compte administrateur de test introuvable : lancez d'abord `npm run db:seed`.");
  const actor = { userId: admin.id, ipHash: null };

  const familyId = await createFamily(
    db,
    familySchema.parse({
      name: DEMO_FAMILY_NAME,
      contactName: "Contact fictif",
      contactPhone: "01 23 45 67 89",
      contactEmail: "contact@exemple.test",
      internalNotes: "EXEMPLE — données fictives de démonstration. Note interne jamais publique.",
    }),
    actor,
  );

  const published = await createProfile(
    db,
    profileSchema.parse({
      ...ALL_PUBLIC,
      familyId,
      fullName: "Jeanne Exemple",
      birthDate: "1938-04-12",
      deathDate: "2026-11-02",
      biography:
        "[Fiche de démonstration — personne fictive]\n\nJeanne aimait son jardin, les longues promenades et les après-midi en famille. Elle laisse le souvenir d'une femme généreuse et attentive.",
      ceremonyDate: "2026-11-25",
      ceremonyTime: "14:30",
      ceremonyLocation: "Salle de cérémonie (exemple)",
      ceremonyAddress: "1 rue de l'Exemple, 00000 Ville-Exemple",
      practicalInfo: "Ni fleurs ni couronnes : dons possibles à une association (exemple).",
      internalNotes: "EXEMPLE — note interne.",
    }),
    actor,
  );
  await changeProfileStatus(db, published, "published", actor);

  await createProfile(
    db,
    profileSchema.parse({
      ...ALL_PUBLIC,
      familyId,
      fullName: "Paul Exemple",
      birthDate: "1941-09-30",
      deathDate: "2026-11-10",
      biography: "[Fiche de démonstration — brouillon non publié]",
    }),
    actor,
  );

  console.log("✔ Données de démonstration créées : 1 famille, 2 fiches (1 publiée, 1 brouillon).");
  client.close();
}

main().catch((error) => {
  console.error("✖ Échec :", error instanceof Error ? error.message : error);
  process.exit(1);
});
