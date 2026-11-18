/**
 * Téléversement d'un média (un fichier par requête).
 *   POST /api/admin/medias   (multipart : profileId, file)
 *
 * Placée hors de /admin car le proxy y limite le corps des requêtes à 10 Mo
 * (les vidéos peuvent aller jusqu'à 100 Mo). Les contrôles sont donc faits ici :
 * origine de la requête, session, permission, taille, type réel du fichier.
 */
import { z } from "zod";
import { getCurrentUser, getRequestMeta } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/media/detect";
import { ingestUpload } from "@/lib/media/service";
import { getMediaStorage } from "@/lib/media/storage";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Protection CSRF : la requête doit venir de la même origine que le site. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Origine refusée." }, 403);

  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: "Session expirée : reconnectez-vous." }, 401);
  if (!hasPermission(user.role, "media.manage")) return json({ ok: false, error: "Accès refusé." }, 403);

  // Refus précoce si la taille annoncée dépasse la limite (marge pour l'enveloppe multipart).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return json({ ok: false, error: "Fichier trop volumineux." }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Envoi invalide." }, 400);
  }
  const profileId = z.uuid().safeParse(form.get("profileId"));
  const file = form.get("file");
  if (!profileId.success || !(file instanceof File)) {
    return json({ ok: false, error: "Envoi invalide." }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, error: "Fichier trop volumineux." }, 413);

  const { ipHash } = await getRequestMeta();
  const result = await ingestUpload(
    await getDb(),
    getMediaStorage(),
    { profileId: profileId.data, fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
    { userId: user.id, ipHash },
  );
  return json(result, result.ok ? 201 : 422);
}
