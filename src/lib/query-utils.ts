/**
 * Utilitaires de requête : pagination, recherche textuelle, diff de champs.
 */
import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const DEFAULT_PAGE_SIZE = 20;

/** Lit un numéro de page depuis l'URL (entier ≥ 1, sinon 1). */
export function parsePage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? n : 1;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  offset: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function buildPagination(
  total: number,
  requestedPage: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    page,
    pageSize,
    total,
    totalPages,
    offset: (page - 1) * pageSize,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

/** Lit un paramètre texte de l'URL, nettoyé et borné. */
export function parseSearchText(value: unknown, max = 100): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** Échappe les jokers LIKE (% _ \) d'une saisie utilisateur. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Condition « contient », insensible à la casse et portable
 * (SQLite et PostgreSQL) grâce à lower() des deux côtés.
 */
export function containsInsensitive(column: AnySQLiteColumn, term: string): SQL {
  const pattern = `%${escapeLike(term.toLowerCase())}%`;
  return sql`lower(${column}) LIKE ${pattern} ESCAPE '\\'`;
}

/** Liste des champs dont la valeur a changé (les valeurs ne sont pas renvoyées). */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): string[] {
  const normalize = (v: unknown) => (v instanceof Date ? v.getTime() : v ?? null);
  return Object.keys(after).filter(
    (key) => normalize(before[key]) !== normalize(after[key]),
  );
}
