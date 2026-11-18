/**
 * Requêtes du tableau de bord (indicateurs agrégés, aucune donnée privée).
 */
import { count, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  activityLogs,
  candles,
  condolenceMessages,
  deceasedProfiles,
  families,
  users,
  type ProfileStatus,
} from "@/lib/db/schema";

export interface DashboardStats {
  families: number;
  profiles: number;
  profilesByStatus: Record<ProfileStatus, number>;
  pendingCondolences: number;
  pendingCandles: number;
  approvedCandles: number;
}

export async function getDashboardStats(db: Database): Promise<DashboardStats> {
  const [[familyRow], statusRows, [pendingMsgRow], candleRows] =
    await Promise.all([
      db.select({ n: count() }).from(families),
      db
        .select({ status: deceasedProfiles.status, n: count() })
        .from(deceasedProfiles)
        .groupBy(deceasedProfiles.status),
      db
        .select({ n: count() })
        .from(condolenceMessages)
        .where(eq(condolenceMessages.status, "pending")),
      db
        .select({ status: candles.status, n: count() })
        .from(candles)
        .where(inArray(candles.status, ["pending", "approved"]))
        .groupBy(candles.status),
    ]);

  const profilesByStatus: Record<ProfileStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    archived: 0,
    deleted: 0,
  };
  for (const row of statusRows) profilesByStatus[row.status] = row.n;

  return {
    families: familyRow?.n ?? 0,
    profiles: statusRows
      .filter((r) => r.status !== "deleted")
      .reduce((sum, r) => sum + r.n, 0),
    profilesByStatus,
    pendingCondolences: pendingMsgRow?.n ?? 0,
    pendingCandles: candleRows.find((r) => r.status === "pending")?.n ?? 0,
    approvedCandles: candleRows.find((r) => r.status === "approved")?.n ?? 0,
  };
}

export interface RecentActivity {
  id: string;
  action: string;
  createdAt: Date;
  userName: string | null;
}

/**
 * Activité récente. Si `userId` est fourni, seule l'activité de cet
 * utilisateur est renvoyée (cas d'un employé).
 */
export async function getRecentActivity(
  db: Database,
  options: { limit?: number; userId?: string } = {},
): Promise<RecentActivity[]> {
  const query = db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      createdAt: activityLogs.createdAt,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(options.limit ?? 10);

  return options.userId
    ? query.where(eq(activityLogs.userId, options.userId))
    : query;
}
