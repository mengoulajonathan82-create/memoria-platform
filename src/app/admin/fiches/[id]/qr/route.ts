/**
 * Téléchargement du QR code d'une fiche (back-office uniquement).
 *   GET /admin/fiches/<id>/qr?format=png|svg[&download=1]
 */
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getProfile } from "@/lib/profiles/service";
import { buildPublicUrl, generateQrPng, generateQrSvg, qrFileName } from "@/lib/qr";

const formatSchema = z.enum(["png", "svg"]).catch("png");

export async function GET(request: Request, ctx: RouteContext<"/admin/fiches/[id]/qr">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });
  if (!hasPermission(user.role, "profiles.manage")) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Introuvable.", { status: 404 });
  const profile = await getProfile(await getDb(), id);
  if (!profile || profile.status === "deleted") return new Response("Introuvable.", { status: 404 });

  const params = new URL(request.url).searchParams;
  const format = formatSchema.parse(params.get("format"));
  const url = buildPublicUrl(getServerEnv().APP_URL, profile.publicId);

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (params.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="${qrFileName(profile.fullName, format)}"`);
  }

  if (format === "svg") {
    headers.set("Content-Type", "image/svg+xml; charset=utf-8");
    // Le SVG ne contient que des tracés générés : on interdit tout script par sécurité.
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    return new Response(await generateQrSvg(url), { headers });
  }
  headers.set("Content-Type", "image/png");
  return new Response(new Uint8Array(await generateQrPng(url)), { headers });
}
