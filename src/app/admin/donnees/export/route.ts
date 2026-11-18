/**
 * Export CSV de données non sensibles (permission « export.csv », administrateurs).
 *   GET /admin/donnees/export?type=fiches
 */
import { logActivity } from "@/lib/activity-log";
import { getCurrentUser, getRequestMeta } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { exportProfilesCsv } from "@/lib/exports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });
  if (!hasPermission(user.role, "export.csv")) return new Response("Accès refusé.", { status: 403 });

  const type = new URL(request.url).searchParams.get("type");
  if (type !== "fiches") return new Response("Export inconnu.", { status: 400 });

  const db = await getDb();
  const csv = await exportProfilesCsv(db, getServerEnv().APP_URL);
  const { ipHash } = await getRequestMeta();
  await logActivity(db, { userId: user.id, action: "export.csv", entityType: "export", details: { type }, ipHash });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="memoria-fiches-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
