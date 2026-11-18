/**
 * Proxy (anciennement « middleware ») : vérification OPTIMISTE uniquement.
 * Il redirige vers la connexion quand aucun cookie de session n'est présent,
 * pour éviter un rendu inutile. La vraie vérification (session valide,
 * compte actif, rôle) est faite dans `src/lib/auth/dal.ts`.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = ["memoria_session", "__Host-memoria_session"];

export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    request.cookies.has(name),
  );
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
