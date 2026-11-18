import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { buttonClass, EmptyState, formatDateTime, PageHeader, PaginationNav } from "@/components/ui";
import { ACTIVITY_CATEGORIES, listActivity, type ActivityCategory } from "@/lib/activity-query";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { parsePage } from "@/lib/query-utils";
import { listStaff } from "@/lib/users/service";

export const metadata: Metadata = { title: "Journal d'activité" };

const categoryParam = z.enum(Object.keys(ACTIVITY_CATEGORIES) as [ActivityCategory, ...ActivityCategory[]]).optional().catch(undefined);
const dateParam = z.iso.date().optional().catch(undefined);
const uuidParam = z.uuid().optional().catch(undefined);
const inputClass = "mt-1.5 block w-full rounded-md border border-border bg-surface px-3 py-2";

/** Lien vers l'élément concerné, quand il existe dans le back-office. */
function entityHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "profile") return `/admin/fiches/${id}`;
  if (type === "family") return `/admin/familles/${id}`;
  if (type === "user") return `/admin/employes/${id}`;
  return null;
}

/** Détails lisibles (le journal ne contient jamais de donnée sensible). */
function describe(details: string | null): string | null {
  if (!details) return null;
  try {
    const d = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(d)
      .map(([k, v]) => `${k} : ${String(v)}`)
      .join(" · ");
  } catch {
    return null;
  }
}

export default async function ActivityPage(props: PageProps<"/admin/journal">) {
  await requirePermission("activity.view");
  const sp = await props.searchParams;
  const filters = {
    userId: uuidParam.parse(sp.utilisateur),
    category: categoryParam.parse(sp.categorie),
    from: dateParam.parse(sp.du),
    to: dateParam.parse(sp.au),
    page: parsePage(sp.page),
  };
  const db = await getDb();
  const [{ items, pagination }, staff] = await Promise.all([listActivity(db, filters), listStaff(db)]);

  return (
    <div>
      <PageHeader title="Journal d'activité" description="Connexions, créations, modifications, publications, suppressions, modération, paramètres. Les adresses IP sont conservées sous forme hachée uniquement." />

      <form method="get" role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="utilisateur" className="block text-sm font-medium">Utilisateur</label>
          <select id="utilisateur" name="utilisateur" defaultValue={filters.userId ?? ""} className={inputClass}>
            <option value="">Tous</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="categorie" className="block text-sm font-medium">Catégorie</label>
          <select id="categorie" name="categorie" defaultValue={filters.category ?? ""} className={inputClass}>
            <option value="">Toutes</option>
            {Object.entries(ACTIVITY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="du" className="block text-sm font-medium">Du</label>
          <input id="du" name="du" type="date" defaultValue={filters.from} className={inputClass} />
        </div>
        <div>
          <label htmlFor="au" className="block text-sm font-medium">Au</label>
          <input id="au" name="au" type="date" defaultValue={filters.to} className={inputClass} />
        </div>
        <button type="submit" className={buttonClass.secondary}>Filtrer</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {items.length === 0 ? (
          <EmptyState>Aucune entrée ne correspond à ces critères.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Par</th>
                <th className="px-4 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((row) => {
                const href = entityHref(row.entityType, row.entityId);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular-nums">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {href ? <Link href={href} className="underline-offset-4 hover:underline">{row.label}</Link> : row.label}
                    </td>
                    <td className="px-4 py-2.5">{row.userName ?? <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{describe(row.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <PaginationNav
        pagination={pagination}
        basePath="/admin/journal"
        params={{ utilisateur: filters.userId, categorie: filters.category, du: filters.from, au: filters.to }}
      />
    </div>
  );
}
