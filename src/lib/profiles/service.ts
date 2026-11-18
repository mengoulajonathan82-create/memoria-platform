/**
 * Service « fiches défunts » (back-office).
 * Les contrôles de permission sont faits par l'appelant (Server Actions).
 * Les requêtes destinées à l'espace PUBLIC seront écrites séparément (Phase 3)
 * avec une liste blanche de colonnes.
 */
import { and, count, desc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { logActivity, type ActivityAction } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import type { Database } from "@/lib/db/client";
import {
  deceasedProfiles,
  families,
  type DeceasedProfile,
  type ProfileStatus,
} from "@/lib/db/schema";
import {
  buildPagination,
  changedFields,
  containsInsensitive,
  DEFAULT_PAGE_SIZE,
  type Pagination,
} from "@/lib/query-utils";
import { generatePublicId } from "@/lib/security/crypto";
import type { ProfileInput, SettableProfileStatus } from "@/lib/validation/profile";

export interface ProfileListFilters {
  q?: string;
  status?: ProfileStatus;
  familyId?: string;
  /** Bornes sur la date de décès (AAAA-MM-JJ). */
  deathFrom?: string;
  deathTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ProfileListItem {
  id: string;
  fullName: string;
  birthDate: string | null;
  deathDate: string | null;
  status: ProfileStatus;
  familyId: string | null;
  familyName: string | null;
  updatedAt: Date;
}

export async function listProfiles(
  db: Database,
  filters: ProfileListFilters = {},
): Promise<{ items: ProfileListItem[]; pagination: Pagination }> {
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(containsInsensitive(deceasedProfiles.fullName, filters.q));
  // Les fiches supprimées n'apparaissent que si on les demande explicitement.
  conditions.push(
    filters.status
      ? eq(deceasedProfiles.status, filters.status)
      : ne(deceasedProfiles.status, "deleted"),
  );
  if (filters.familyId) conditions.push(eq(deceasedProfiles.familyId, filters.familyId));
  if (filters.deathFrom) conditions.push(gte(deceasedProfiles.deathDate, filters.deathFrom));
  if (filters.deathTo) conditions.push(lte(deceasedProfiles.deathDate, filters.deathTo));
  const where = and(...conditions);

  const [totalRow] = await db.select({ n: count() }).from(deceasedProfiles).where(where);
  const pagination = buildPagination(
    totalRow?.n ?? 0,
    filters.page ?? 1,
    filters.pageSize ?? DEFAULT_PAGE_SIZE,
  );

  const items = await db
    .select({
      id: deceasedProfiles.id,
      fullName: deceasedProfiles.fullName,
      birthDate: deceasedProfiles.birthDate,
      deathDate: deceasedProfiles.deathDate,
      status: deceasedProfiles.status,
      familyId: deceasedProfiles.familyId,
      familyName: families.name,
      updatedAt: deceasedProfiles.updatedAt,
    })
    .from(deceasedProfiles)
    .leftJoin(families, eq(deceasedProfiles.familyId, families.id))
    .where(where)
    .orderBy(desc(deceasedProfiles.updatedAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  return { items, pagination };
}

export type ProfileDetail = DeceasedProfile & { familyName: string | null };

export async function getProfile(db: Database, id: string): Promise<ProfileDetail | null> {
  const [row] = await db
    .select({ profile: deceasedProfiles, familyName: families.name })
    .from(deceasedProfiles)
    .leftJoin(families, eq(deceasedProfiles.familyId, families.id))
    .where(eq(deceasedProfiles.id, id))
    .limit(1);
  return row ? { ...row.profile, familyName: row.familyName } : null;
}

export async function createProfile(
  db: Database,
  input: ProfileInput,
  actor: Actor,
): Promise<string> {
  const [row] = await db
    .insert(deceasedProfiles)
    .values({
      ...input,
      // Identifiant public généré une fois pour toutes : l'URL du QR code ne changera jamais.
      publicId: generatePublicId(),
      status: "draft",
      createdById: actor.userId,
      updatedById: actor.userId,
    })
    .returning({ id: deceasedProfiles.id });
  await logActivity(db, {
    userId: actor.userId,
    action: "profile.create",
    entityType: "profile",
    entityId: row!.id,
    ipHash: actor.ipHash,
  });
  return row!.id;
}

export async function updateProfile(
  db: Database,
  id: string,
  input: ProfileInput,
  actor: Actor,
): Promise<string[] | null> {
  const existing = await getProfile(db, id);
  if (!existing || existing.status === "deleted") return null;
  const fields = changedFields(existing, input);
  if (fields.length === 0) return [];

  await db
    .update(deceasedProfiles)
    .set({ ...input, updatedById: actor.userId })
    .where(eq(deceasedProfiles.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "profile.update",
    entityType: "profile",
    entityId: id,
    details: { fields: fields.join(",") },
    ipHash: actor.ipHash,
  });
  return fields;
}

export type StatusChangeResult =
  | { ok: true; from: ProfileStatus; to: ProfileStatus }
  | { ok: false; reason: "not_found" | "deleted" | "unchanged" };

export async function changeProfileStatus(
  db: Database,
  id: string,
  to: SettableProfileStatus,
  actor: Actor,
  now: Date = new Date(),
): Promise<StatusChangeResult> {
  const existing = await getProfile(db, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "deleted") return { ok: false, reason: "deleted" };
  if (existing.status === to) return { ok: false, reason: "unchanged" };

  await db
    .update(deceasedProfiles)
    .set({
      status: to,
      updatedById: actor.userId,
      ...(to === "published" ? { publishedAt: now } : {}),
    })
    .where(eq(deceasedProfiles.id, id));

  const action: ActivityAction =
    to === "published"
      ? "profile.publish"
      : existing.status === "published"
        ? "profile.unpublish"
        : "profile.status";
  await logActivity(db, {
    userId: actor.userId,
    action,
    entityType: "profile",
    entityId: id,
    details: { from: existing.status, to },
    ipHash: actor.ipHash,
  });
  return { ok: true, from: existing.status, to };
}

/** Suppression LOGIQUE : la fiche n'est plus visible nulle part mais reste restaurable. */
export async function softDeleteProfile(
  db: Database,
  id: string,
  actor: Actor,
): Promise<boolean> {
  const existing = await getProfile(db, id);
  if (!existing || existing.status === "deleted") return false;
  await db
    .update(deceasedProfiles)
    .set({ status: "deleted", updatedById: actor.userId })
    .where(eq(deceasedProfiles.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "profile.delete",
    entityType: "profile",
    entityId: id,
    details: { from: existing.status },
    ipHash: actor.ipHash,
  });
  return true;
}

/** Restaure une fiche supprimée, en brouillon (jamais directement publiée). */
export async function restoreProfile(
  db: Database,
  id: string,
  actor: Actor,
): Promise<boolean> {
  const existing = await getProfile(db, id);
  if (!existing || existing.status !== "deleted") return false;
  await db
    .update(deceasedProfiles)
    .set({ status: "draft", updatedById: actor.userId })
    .where(eq(deceasedProfiles.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "profile.restore",
    entityType: "profile",
    entityId: id,
    ipHash: actor.ipHash,
  });
  return true;
}
