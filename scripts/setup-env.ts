/**
 * Crée le fichier `.env` local à partir de `.env.example`, en générant des
 * valeurs aléatoires pour les secrets et les mots de passe des comptes de test.
 * Ne remplace jamais un `.env` existant.
 *
 * Usage : npm run setup:env
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const ENV_PATH = ".env";
const EXAMPLE_PATH = ".env.example";

/** Mot de passe de test : 20 caractères, au moins une lettre et un chiffre. */
function generateTestPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const chars = Array.from(randomBytes(18), (b) => alphabet[b % alphabet.length]);
  return `${chars.join("")}a7`;
}

if (existsSync(ENV_PATH)) {
  console.log("ℹ Le fichier .env existe déjà : il n'a pas été modifié.");
  process.exit(0);
}

const generated: Record<string, string> = {
  IP_HASH_SECRET: randomBytes(32).toString("base64url"),
  SEED_ADMIN_PASSWORD: generateTestPassword(),
  SEED_EMPLOYEE_PASSWORD: generateTestPassword(),
};

const content = readFileSync(EXAMPLE_PATH, "utf8")
  .split(/\r?\n/)
  .map((line) => {
    const match = /^([A-Z0-9_]+)=$/.exec(line);
    if (match && generated[match[1]]) return `${match[1]}=${generated[match[1]]}`;
    return line;
  })
  .join("\n");

writeFileSync(ENV_PATH, content, { encoding: "utf8", flag: "wx" });
console.log("✔ Fichier .env créé avec des secrets aléatoires.");
console.log("  Les mots de passe des comptes de test se trouvent dans .env");
console.log("  (SEED_ADMIN_PASSWORD et SEED_EMPLOYEE_PASSWORD).");
