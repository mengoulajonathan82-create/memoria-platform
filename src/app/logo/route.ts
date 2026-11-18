/**
 * Logo de l'entreprise (public). Fichier stocké hors de public/, ré-encodé en PNG.
 */
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import { getMediaStorage } from "@/lib/media/storage";

export async function GET() {
  const { logoPath } = await getBranding(await getDb());
  if (!logoPath) return new Response("Aucun logo.", { status: 404 });
  try {
    const data = await getMediaStorage().read(logoPath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, no-cache",
        ETag: `"${logoPath.slice(-36)}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Aucun logo.", { status: 404 });
  }
}
