/**
 * Diffusion PUBLIQUE d'un média : uniquement si la fiche est publiée et que le
 * média est autorisé (photo principale, ou média public avec galerie affichée).
 *   GET /memoire/<publicId>/medias/<clé>[?v=thumb]
 */
import { getDb } from "@/lib/db";
import { getMediaStorage } from "@/lib/media/storage";
import { findPublicMedia } from "@/lib/media/service";
import { parseVariant, serveMediaFile } from "@/lib/media/serve";
import { isValidPublicId } from "@/lib/security/crypto";

export async function GET(request: Request, ctx: RouteContext<"/memoire/[publicId]/medias/[key]">) {
  const { publicId, key } = await ctx.params;
  if (!isValidPublicId(publicId) || !isValidPublicId(key)) {
    return new Response("Introuvable.", { status: 404 });
  }
  const item = await findPublicMedia(await getDb(), publicId, key);
  if (!item) return new Response("Introuvable.", { status: 404 });

  // « no-cache » : le navigateur revalide à chaque fois (304 si inchangé),
  // pour qu'une dépublication ou un masquage prenne effet immédiatement.
  return serveMediaFile(
    request,
    getMediaStorage(),
    item,
    parseVariant(new URL(request.url).searchParams.get("v")),
    "public, no-cache",
  );
}
