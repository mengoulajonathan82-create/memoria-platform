/**
 * Service « familles » : lecture, création, modification, suppression.
 * Toutes les données des familles sont PRIVÉES (back-office uniquement).
 * Les contrôles de permission sont faits par l'appelant (Server Actions).
 */
import { and, count, desc, eq, inArray, ne, or, type SQL } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import type { Database } from "@/lib/db/client";
import { deceasedProfiles, families, type Family, type FamilyStatus } from "@/lib/db/schema";
import {
  buildPagination,
  changedFields,
  containsInsensitive,
  DEFAULT_PAGE_SIZE,
  type Pagination,
} from "@/lib/query-utils";
import type { FamilyInput } from "@/lib/validation/family";

export interface FamilyListFilters {
  q?: string;
  status?: FamilyStatus;
  page?: number;
  pageSize?: number;
}

export interface FamilyListItem {
  id: string;
  name: string;
  contactName: string | null;
  status: FamilyStatus;
  updatedAt: Date;
  profileCount: number;
}

export async function listFamilies(
  db: Database,
  filters: FamilyListFilters = {},
): Promise<{ items: FamilyListItem[]; pagination: Pagination }> {
  const conditions: SQL[] = [];
  if (filters.q) {
    const nameMatch = containsInsensitive(families.name, filters.q);
    const contactMatch = containsInsensitive(families.contactName, filters.q);
    conditions.push(or(nameMatch, contactMatch)!);
  }
  if (filters.status) conditions.push(eq(families.status, filters.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(families).where(where);
  const pagination = buildPagination(
    totalRow?.n ?? 0,
    filters.page ?? 1,
    filters.pageSize ?? DEFAULT_PAGE_SIZE,
  );

  const rows = await db
    .select({
      id: families.id,
      name: families.name,
      contactName: families.contactName,
      status: families.status,
      updatedAt: families.updatedAt,
    })
    .from(families)
    .where(where)
    .orderBy(desc(families.updatedAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  const counts = rows.length
    ? await db
        .select({ familyId: deceasedProfiles.familyId, n: count() })
        .from(deceasedProfiles)
        .where(
          and(
            inArray(deceasedProfiles.familyId, rows.map((r) => r.id)),
            ne(deceasedProfiles.status, "deleted"),
          ),
        )
        .groupBy(deceasedProfiles.familyId)
    : [];
  const countByFamily = new Map(counts.map((c) => [c.familyId, c.n]));

  return {
    items: rows.map((r) => ({ ...r, profileCount: countByFamily.get(r.id) ?? 0 })),
    pagination,
  };
}

export async function getFamily(db: Database, id: string): Promise<Family | null> {
  const [row] = await db.select().from(families).where(eq(families.id, id)).limit(1);
  return row ?? null;
}

/** Familles proposables dans un formulaire de fiche (non archivées). */
export async function listFamilyOptions(
  db: Database,
  includeId?: string | null,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: families.id, name: families.name, status: families.status })
    .from(families)
    .orderBy(families.name);
  return rows
    .filter((r) => r.status !== "archived" || r.id === includeId)
    .map(({ id, name }) => ({ id, name }));
}

export async function familyExists(db: Database, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: families.id })
    .from(families)
    .where(eq(families.id, id))
    .limit(1);
  return Boolean(row);
}

export async function createFamily(
  db: Database,
  input: FamilyInput,
  actor: Actor,
): Promise<string> {
  const [row] = await db
    .insert(families)
    .values({ ...input, createdById: actor.userId, updatedById: actor.userId })
    .returning({ id: families.id });
  await logActivity(db, {
    userId: actor.userId,
    action: "family.create",
    entityType: "family",
    entityId: row!.id,
    ipHash: actor.ipHash,
  });
  return row!.id;
}

/** Met à jour une famille. Retourne la liste des champs modifiés, ou `null` si introuvable. */
export async function updateFamily(
  db: Database,
  id: string,
  input: FamilyInput,
  actor: Actor,
): Promise<string[] | null> {
  const existing = await getFamily(db, id);
  if (!existing) return null;
  const fields = changedFields(existing, input);
  if (fields.length === 0) return [];

  await db
    .update(families)
    .set({ ...input, updatedById: actor.userId })
    .where(eq(families.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "family.update",
    entityType: "family",
    entityId: id,
    // Seuls les NOMS des champs sont journalisés, jamais leurs valeurs.
    details: { fields: fields.join(",") },
    ipHash: actor.ipHash,
  });
  return fields;
}

export type DeleteFamilyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_profiles" };

/**
 * Suppression définitive, refusée tant que des fiches (même supprimées
 * logiquement) sont rattachées : il faut alors archiver la famille.
 */
export async function deleteFamily(
  db: Database,
  id: string,
  actor: Actor,
): Promise<DeleteFamilyResult> {
  const existing = await getFamily(db, id);
  if (!existing) return { ok: false, reason: "not_found" };

  const [linked] = await db
    .select({ n: count() })
    .from(deceasedProfiles)
    .where(eq(deceasedProfiles.familyId, id));
  if ((linked?.n ?? 0) > 0) return { ok: false, reason: "has_profiles" };

  await db.delete(families).where(eq(families.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "family.delete",
    entityType: "family",
    entityId: id,
    ipHash: actor.ipHash,
  });
  return { ok: true };
}
