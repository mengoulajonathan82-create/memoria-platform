/**
 * Hachage des mots de passe avec Argon2id (paramètres recommandés par l'OWASP).
 */
import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19_456, // 19 Mio
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Hachage corrompu ou format inconnu : on refuse sans lever d'erreur.
    return false;
  }
}

/**
 * Hachage factice calculé une seule fois : vérifié lorsque l'e-mail n'existe
 * pas, pour que le temps de réponse ne révèle pas l'existence d'un compte.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("compte-inexistant-valeur-factice");
  return dummyHash;
}
