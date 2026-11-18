/**
 * Diffusion d'un média pour le BACK-OFFICE (tous statuts, y compris corbeille).
 *   GET /api/admin/medias/<clé>[?v=thumb]
 */
import { getCurrentUser } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getMediaStorage } from "@/lib/media/storage";
import { getMediaByKey } from "@/lib/media/service";
import { parseVariant, serveMediaFile } from "@/lib/media/serve";
import { isValidPublicId } from "@/lib/security/crypto";

export async function GET(request: Request, ctx: RouteContext<"/api/admin/medias/[key]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });
  if (!hasPermission(user.role, "media.manage")) return new Response("Accès refusé.", { status: 403 });

  const { key } = await ctx.params;
  if (!isValidPublicId(key)) return new Response("Introuvable.", { status: 404 });
  const item = await getMediaByKey(await getDb(), key);
  if (!item) return new Response("Introuvable.", { status: 404 });

  return serveMediaFile(
    request,
    getMediaStorage(),
    item,
    parseVariant(new URL(request.url).searchParams.get("v")),
    "private, no-store",
  );
}
