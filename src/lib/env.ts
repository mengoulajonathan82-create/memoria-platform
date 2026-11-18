/**
 * Lecture et validation des variables d'environnement côté serveur.
 * Toute valeur manquante ou invalide provoque une erreur explicite.
 */
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 7).default(8),
  IP_HASH_SECRET: z
    .string()
    .min(32, "IP_HASH_SECRET doit contenir au moins 32 caractères."),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `- ${i.path.join(".")} : ${i.message}`)
      .join("\n");
    throw new Error(
      `Configuration invalide (fichier .env). Lancez \`npm run setup:env\`.\n${details}`,
    );
  }
  cached = parsed.data;
  return cached;
}
