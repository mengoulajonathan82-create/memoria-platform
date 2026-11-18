/**
 * Données initiales pour le développement local :
 * - un compte administrateur de test ;
 * - un compte employé de test ;
 * - les paramètres de personnalisation par défaut.
 *
 * Idempotent : un compte existant (même e-mail) n'est jamais modifié.
 * Usage : npm run db:seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { createDatabase, getDatabaseUrl, type Database } from "../src/lib/db/client";
import { settings, users, type UserRole } from "../src/lib/db/schema";
import { DEFAULT_BRANDING, BRANDING_SETTING_KEY } from "../src/lib/branding";
import { emailSchema, newPasswordSchema } from "../src/lib/validation/auth";

interface SeedAccount {
  role: UserRole;
  name: string | undefined;
  email: string | undefined;
  password: string | undefined;
  envPrefix: string;
}

async function seedAccount(db: Database, account: SeedAccount): Promise<void> {
  const label = account.role === "admin" ? "administrateur" : "employé";
  const email = emailSchema.safeParse(account.email);
  const password = newPasswordSchema.safeParse(account.password);
  if (!email.success || !password.success || !account.name) {
    throw new Error(
      `Compte ${label} : renseignez ${account.envPrefix}_NAME, _EMAIL et _PASSWORD ` +
        "(12 caractères minimum, lettres et chiffres) dans .env.",
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.data))
    .limit(1);
  if (existing) {
    console.log(`ℹ Compte ${label} déjà présent : ${email.data}`);
    return;
  }

  await db.insert(users).values({
    name: account.name,
    email: email.data,
    passwordHash: await hashPassword(password.data),
    role: account.role,
  });
  console.log(`✔ Compte ${label} créé : ${email.data}`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Le seed de test ne doit pas être lancé en production.");
  }
  const { db, client } = await createDatabase(getDatabaseUrl());

  await seedAccount(db, {
    role: "admin",
    name: process.env.SEED_ADMIN_NAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    envPrefix: "SEED_ADMIN",
  });
  await seedAccount(db, {
    role: "employee",
    name: process.env.SEED_EMPLOYEE_NAME,
    email: process.env.SEED_EMPLOYEE_EMAIL,
    password: process.env.SEED_EMPLOYEE_PASSWORD,
    envPrefix: "SEED_EMPLOYEE",
  });

  await db
    .insert(settings)
    .values({ key: BRANDING_SETTING_KEY, value: JSON.stringify(DEFAULT_BRANDING) })
    .onConflictDoNothing();
  console.log("✔ Paramètres par défaut en place.");
  console.log("  Mots de passe des comptes de test : voir le fichier .env");

  client.close();
}

main().catch((error) => {
  console.error("✖ Échec du seed :", error instanceof Error ? error.message : error);
  process.exit(1);
});
