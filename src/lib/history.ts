/**
 * Historique des modifications d'une entité, lu dans le journal d'activité.
 */
import { and, desc, eq } from "drizzle-orm";
import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity-log";
import type { Database } from "@/lib/db/client";
import { activityLogs, users } from "@/lib/db/schema";

export interface HistoryEntry {
  id: string;
  action: string;
  label: string;
  userName: string | null;
  createdAt: Date;
  details: Record<string, unknown> | null;
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getEntityHistory(
  db: Database,
  entityType: "family" | "profile",
  entityId: string,
  limit = 50,
): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      details: activityLogs.details,
      createdAt: activityLogs.createdAt,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(and(eq(activityLogs.entityType, entityType), eq(activityLogs.entityId, entityId)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    label: ACTIVITY_LABELS[r.action as ActivityAction] ?? r.action,
    userName: r.userName,
    createdAt: r.createdAt,
    details: parseDetails(r.details),
  }));
}
