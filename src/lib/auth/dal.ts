/**
 * Couche d'accès aux données d'authentification (Data Access Layer).
 *
 * C'est ici — et non dans le proxy ni dans l'interface — que se font les
 * vérifications d'authentification et d'autorisation. Chaque page protégée,
 * Server Action ou Route Handler doit appeler `requireUser` ou
 * `requirePermission` au plus près des données.
 */
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { hashIp } from "@/lib/security/crypto";
import { hasPermission, type Permission } from "./permissions";
import { validateSessionToken, type SessionUser } from "./session-service";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-memoria_session"
    : "memoria_session";

export const LOGIN_PATH = "/connexion";
export const FORBIDDEN_PATH = "/admin/acces-refuse";

/** Lit l'adresse IP (hachée) et le navigateur de la requête courante. */
export async function getRequestMeta(): Promise<{
  ipHash: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  // Derrière un reverse proxy de confiance uniquement : à configurer au déploiement.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || null;
  return {
    ipHash: hashIp(ip, getServerEnv().IP_HASH_SECRET),
    userAgent: h.get("user-agent"),
  };
}

/** Utilisateur connecté, ou `null`. Mis en cache pour la durée d'un rendu. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await validateSessionToken(await getDb(), token);
  return result?.user ?? null;
});

/** Exige un utilisateur connecté, sinon redirige vers la page de connexion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Exige une permission ; redirige vers une page « accès refusé » sinon. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect(FORBIDDEN_PATH);
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
