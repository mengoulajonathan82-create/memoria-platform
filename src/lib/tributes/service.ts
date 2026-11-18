/**
 * Condoléances et bougies : dépôt public, limites anti-abus, modération,
 * lecture publique (champs autorisés uniquement) et statistiques.
 *
 * Règles :
 * - un message de condoléances est TOUJOURS en attente de modération ;
 * - une bougie sans message est publiée directement ; avec un message, elle
 *   passe en modération ; toute bougie peut ensuite être masquée ou supprimée ;
 * - e-mail, téléphone et IP hachée ne sont jamais renvoyés publiquement.
 */
import { and, count, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/actor";
import type { Database } from "@/lib/db/client";
import {
  candles,
  condolenceMessages,
  deceasedProfiles,
  type ModerationStatus,
} from "@/lib/db/schema";
import { buildPagination, DEFAULT_PAGE_SIZE, type Pagination } from "@/lib/query-utils";
import type { CandleInput, CondolenceInput, TributeKind } from "@/lib/validation/tribute";
import { getModerationSettings } from "@/lib/settings";
import { checkContent } from "./spam";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Limites de fréquence (par adresse IP hachée). */
export const LIMITS = {
  condolencesPer10Min: 3,
  condolencesPerDay: 10,
  candlesPer10Min: 5,
  /** Une seule bougie par personne et par fiche sur cette durée. */
  candleSameProfileWindowMs: HOUR,
  /** Plafond global par fiche et par jour (protection contre les vagues). */
  perProfilePerDay: 300,
} as const;

export type SubmitResult = { ok: true; status: ModerationStatus } | { ok: false; error: string };

const CONTENT_ERRORS = {
  link: "Les liens ne sont pas autorisés dans les messages.",
  forbidden: "Votre message contient des termes non autorisés.",
} as const;

const RATE_ERROR = "Vous avez envoyé plusieurs messages récemment. Merci de réessayer un peu plus tard.";

/** Fiche publiée correspondant à l'identifiant public, avec ses options. */
async function findOpenProfile(db: Database, publicId: string) {
  const [row] = await db
    .select({
      id: deceasedProfiles.id,
      status: deceasedProfiles.status,
      allowCondolences: deceasedProfiles.allowCondolences,
      allowCandles: deceasedProfiles.allowCandles,
    })
    .from(deceasedProfiles)
    .where(eq(deceasedProfiles.publicId, publicId))
    .limit(1);
  return row && row.status === "published" ? row : null;
}

async function countSince(
  db: Database,
  table: typeof condolenceMessages | typeof candles,
  since: Date,
  extra: SQL,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(and(gte(table.createdAt, since), extra));
  return row?.n ?? 0;
}

export async function submitCondolence(
  db: Database,
  publicId: string,
  input: CondolenceInput,
  ipHash: string | null,
  now: Date = new Date(),
): Promise<SubmitResult> {
  const profile = await findOpenProfile(db, publicId);
  if (!profile || !profile.allowCondolences) {
    return { ok: false, error: "Les messages ne sont pas ouverts sur cette page." };
  }

  const { forbiddenWords } = await getModerationSettings(db);
  const content = checkContent([input.authorName, input.message], forbiddenWords);
  if (content !== "ok") return { ok: false, error: CONTENT_ERRORS[content] };

  const ip = ipHash ?? "inconnue";
  const byIp = eq(condolenceMessages.ipHash, ip);
  if (
    (await countSince(db, condolenceMessages, new Date(now.getTime() - 10 * MINUTE), byIp)) >=
      LIMITS.condolencesPer10Min ||
    (await countSince(db, condolenceMessages, new Date(now.getTime() - 24 * HOUR), byIp)) >=
      LIMITS.condolencesPerDay ||
    (await countSince(db, condolenceMessages, new Date(now.getTime() - 24 * HOUR), eq(condolenceMessages.profileId, profile.id))) >=
      LIMITS.perProfilePerDay
  ) {
    return { ok: false, error: RATE_ERROR };
  }

  await db.insert(condolenceMessages).values({
    profileId: profile.id,
    authorName: input.authorName,
    message: input.message,
    email: input.email,
    phone: input.phone,
    consentToPublish: input.consentToPublish,
    status: "pending",
    ipHash: ip,
    createdAt: now,
  });
  return { ok: true, status: "pending" };
}

export async function submitCandle(
  db: Database,
  publicId: string,
  input: CandleInput,
  ipHash: string | null,
  now: Date = new Date(),
): Promise<SubmitResult> {
  const profile = await findOpenProfile(db, publicId);
  if (!profile || !profile.allowCandles) {
    return { ok: false, error: "Les bougies ne sont pas ouvertes sur cette page." };
  }

  const { forbiddenWords } = await getModerationSettings(db);
  const content = checkContent([input.firstName, input.message], forbiddenWords);
  if (content !== "ok") return { ok: false, error: CONTENT_ERRORS[content] };

  const ip = ipHash ?? "inconnue";
  if (
    (await countSince(
      db,
      candles,
      new Date(now.getTime() - LIMITS.candleSameProfileWindowMs),
      and(eq(candles.ipHash, ip), eq(candles.profileId, profile.id))!,
    )) > 0
  ) {
    return { ok: false, error: "Vous avez déjà allumé une bougie pour cette personne. Merci pour votre pensée." };
  }
  if (
    (await countSince(db, candles, new Date(now.getTime() - 10 * MINUTE), eq(candles.ipHash, ip))) >=
      LIMITS.candlesPer10Min ||
    (await countSince(db, candles, new Date(now.getTime() - 24 * HOUR), eq(candles.profileId, profile.id))) >=
      LIMITS.perProfilePerDay
  ) {
    return { ok: false, error: RATE_ERROR };
  }

  const status: ModerationStatus = input.message ? "pending" : "approved";
  await db.insert(candles).values({
    profileId: profile.id,
    firstName: input.firstName,
    message: input.message,
    status,
    ipHash: ip,
    createdAt: now,
  });
  return { ok: true, status };
}

/* -------------------------------------------------------------------------- */
/* Lecture publique                                                           */
/* -------------------------------------------------------------------------- */

export interface PublicCondolence {
  authorName: string;
  message: string;
  createdAt: Date;
}

export interface PublicCandle {
  firstName: string | null;
  message: string | null;
  createdAt: Date;
}

export async function listPublicCondolences(
  db: Database,
  profileId: string,
  limit = 100,
): Promise<PublicCondolence[]> {
  return db
    .select({
      authorName: condolenceMessages.authorName,
      message: condolenceMessages.message,
      createdAt: condolenceMessages.createdAt,
    })
    .from(condolenceMessages)
    .where(
      and(
        eq(condolenceMessages.profileId, profileId),
        eq(condolenceMessages.status, "approved"),
        eq(condolenceMessages.consentToPublish, true),
      ),
    )
    .orderBy(desc(condolenceMessages.createdAt))
    .limit(limit);
}

export async function getPublicCandles(
  db: Database,
  profileId: string,
  limit = 12,
): Promise<{ count: number; recent: PublicCandle[] }> {
  const approved = and(eq(candles.profileId, profileId), eq(candles.status, "approved"));
  const [[total], recent] = await Promise.all([
    db.select({ n: count() }).from(candles).where(approved),
    db
      .select({ firstName: candles.firstName, message: candles.message, createdAt: candles.createdAt })
      .from(candles)
      .where(approved)
      .orderBy(desc(candles.createdAt))
      .limit(limit),
  ]);
  return { count: total?.n ?? 0, recent };
}

/* -------------------------------------------------------------------------- */
/* Modération                                                                 */
/* -------------------------------------------------------------------------- */

export interface ModerationItem {
  id: string;
  kind: TributeKind;
  profileId: string;
  profileName: string;
  author: string | null;
  message: string | null;
  email: string | null;
  phone: string | null;
  consentToPublish: boolean | null;
  status: ModerationStatus;
  createdAt: Date;
  moderatedAt: Date | null;
}

export async function listForModeration(
  db: Database,
  filters: { kind: TributeKind; status?: ModerationStatus; profileId?: string; page?: number; pageSize?: number },
): Promise<{ items: ModerationItem[]; pagination: Pagination }> {
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  if (filters.kind === "condolence") {
    const t = condolenceMessages;
    const where = and(
      filters.status ? eq(t.status, filters.status) : undefined,
      filters.profileId ? eq(t.profileId, filters.profileId) : undefined,
    );
    const [total] = await db.select({ n: count() }).from(t).where(where);
    const pagination = buildPagination(total?.n ?? 0, filters.page ?? 1, pageSize);
    const rows = await db
      .select({ row: t, profileName: deceasedProfiles.fullName })
      .from(t)
      .innerJoin(deceasedProfiles, eq(t.profileId, deceasedProfiles.id))
      .where(where)
      .orderBy(desc(t.createdAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset);
    return {
      pagination,
      items: rows.map(({ row, profileName }) => ({
        id: row.id,
        kind: "condolence",
        profileId: row.profileId,
        profileName,
        author: row.authorName,
        message: row.message,
        email: row.email,
        phone: row.phone,
        consentToPublish: row.consentToPublish,
        status: row.status,
        createdAt: row.createdAt,
        moderatedAt: row.moderatedAt,
      })),
    };
  }

  const t = candles;
  const where = and(
    filters.status ? eq(t.status, filters.status) : undefined,
    filters.profileId ? eq(t.profileId, filters.profileId) : undefined,
  );
  const [total] = await db.select({ n: count() }).from(t).where(where);
  const pagination = buildPagination(total?.n ?? 0, filters.page ?? 1, pageSize);
  const rows = await db
    .select({ row: t, profileName: deceasedProfiles.fullName })
    .from(t)
    .innerJoin(deceasedProfiles, eq(t.profileId, deceasedProfiles.id))
    .where(where)
    .orderBy(desc(t.createdAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);
  return {
    pagination,
    items: rows.map(({ row, profileName }) => ({
      id: row.id,
      kind: "candle",
      profileId: row.profileId,
      profileName,
      author: row.firstName,
      message: row.message,
      email: null,
      phone: null,
      consentToPublish: null,
      status: row.status,
      createdAt: row.createdAt,
      moderatedAt: row.moderatedAt,
    })),
  };
}

function tableOf(kind: TributeKind) {
  return kind === "condolence" ? condolenceMessages : candles;
}

export async function moderateTribute(
  db: Database,
  kind: TributeKind,
  id: string,
  to: Exclude<ModerationStatus, "pending">,
  actor: Actor,
  now: Date = new Date(),
): Promise<boolean> {
  const t = tableOf(kind);
  const [existing] = await db
    .select({ status: t.status, profileId: t.profileId })
    .from(t)
    .where(eq(t.id, id))
    .limit(1);
  if (!existing || existing.status === to) return false;
  await db.update(t).set({ status: to, moderatedById: actor.userId, moderatedAt: now }).where(eq(t.id, id));
  await logActivity(db, {
    userId: actor.userId,
    action: "moderation.update",
    entityType: "profile",
    entityId: existing.profileId,
    details: { kind, from: existing.status, to },
    ipHash: actor.ipHash,
  });
  return true;
}

/** Suppression DÉFINITIVE d'un message ou d'une bougie (et de ses coordonnées). */
export async function deleteTribute(
  db: Database,
  kind: TributeKind,
  id: string,
  actor: Actor,
): Promise<boolean> {
  const t = tableOf(kind);
  const deleted = await db.delete(t).where(eq(t.id, id)).returning({ profileId: t.profileId });
  if (deleted.length === 0) return false;
  await logActivity(db, {
    userId: actor.userId,
    action: "moderation.delete",
    entityType: "profile",
    entityId: deleted[0]!.profileId,
    details: { kind },
    ipHash: actor.ipHash,
  });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Statistiques                                                               */
/* -------------------------------------------------------------------------- */

export type StatusCounts = Record<ModerationStatus, number>;

const emptyCounts = (): StatusCounts => ({ pending: 0, approved: 0, rejected: 0, hidden: 0 });

export async function getTributeStats(
  db: Database,
  profileId?: string,
): Promise<{ condolences: StatusCounts; candles: StatusCounts }> {
  const condolenceRows = await db
    .select({ status: condolenceMessages.status, n: count() })
    .from(condolenceMessages)
    .where(profileId ? eq(condolenceMessages.profileId, profileId) : undefined)
    .groupBy(condolenceMessages.status);
  const candleRows = await db
    .select({ status: candles.status, n: count() })
    .from(candles)
    .where(profileId ? eq(candles.profileId, profileId) : undefined)
    .groupBy(candles.status);

  const condolencesCounts = emptyCounts();
  for (const r of condolenceRows) condolencesCounts[r.status] = r.n;
  const candleCounts = emptyCounts();
  for (const r of candleRows) candleCounts[r.status] = r.n;
  return { condolences: condolencesCounts, candles: candleCounts };
}

/** Nombre total d'éléments en attente (badge de navigation). */
export async function countPending(db: Database): Promise<number> {
  const [[a], [b]] = await Promise.all([
    db.select({ n: count() }).from(condolenceMessages).where(eq(condolenceMessages.status, "pending")),
    db.select({ n: count() }).from(candles).where(inArray(candles.status, ["pending"])),
  ]);
  return (a?.n ?? 0) + (b?.n ?? 0);
}
