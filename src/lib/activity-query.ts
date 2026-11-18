/**
 * Consultation du journal d'activité (administrateurs).
 */
import { and, count, desc, eq, gte, like, lt, type SQL } from "drizzle-orm";
import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity-log";
import type { Database } from "@/lib/db/client";
import { activityLogs, users } from "@/lib/db/schema";
import { buildPagination, DEFAULT_PAGE_SIZE, escapeLike, type Pagination } from "@/lib/query-utils";

export const ACTIVITY_CATEGORIES = {
  auth: "Connexions",
  user: "Comptes",
  family: "Familles",
  profile: "Fiches",
  media: "Médias",
  moderation: "Modération",
  settings: "Paramètres",
  export: "Exports",
  backup: "Sauvegardes",
} as const;
export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;

export interface ActivityFilters {
  userId?: string;
  category?: ActivityCategory;
  /** Bornes de date AAAA-MM-JJ (incluses), en heure locale du serveur. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityRow {
  id: string;
  action: string;
  label: string;
  userName: string | null;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: Date;
}

function dayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export async function listActivity(
  db: Database,
  filters: ActivityFilters = {},
): Promise<{ items: ActivityRow[]; pagination: Pagination }> {
  const conditions: SQL[] = [];
  if (filters.userId) conditions.push(eq(activityLogs.userId, filters.userId));
  if (filters.category) {
    conditions.push(like(activityLogs.action, `${escapeLike(filters.category)}.%`));
  }
  if (filters.from) conditions.push(gte(activityLogs.createdAt, dayStart(filters.from)));
  if (filters.to) {
    const end = dayStart(filters.to);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(activityLogs.createdAt, end));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [total] = await db.select({ n: count() }).from(activityLogs).where(where);
  const pagination = buildPagination(total?.n ?? 0, filters.page ?? 1, filters.pageSize ?? 50);
  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      userName: users.name,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      details: activityLogs.details,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  return {
    pagination,
    items: rows.map((r) => ({ ...r, label: ACTIVITY_LABELS[r.action as ActivityAction] ?? r.action })),
  };
}

export { DEFAULT_PAGE_SIZE };
