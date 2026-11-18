import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import {
  buttonClass,
  EmptyState,
  FlashBanner,
  formatDateTime,
  PageHeader,
  PaginationNav,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { FAMILY_STATUSES } from "@/lib/db/schema";
import { listFamilies } from "@/lib/families/service";
import { readFlash } from "@/lib/flash";
import { parsePage, parseSearchText } from "@/lib/query-utils";
import { FAMILY_STATUS_LABELS } from "@/lib/validation/family";

export const metadata: Metadata = { title: "Familles" };

const statusFilter = z.enum(FAMILY_STATUSES).optional().catch(undefined);

export default async function FamiliesPage(props: PageProps<"/admin/familles">) {
  await requirePermission("families.manage");
  const searchParams = await props.searchParams;
  const q = parseSearchText(searchParams.q);
  const status = statusFilter.parse(searchParams.statut);
  const page = parsePage(searchParams.page);

  const { items, pagination } = await listFamilies(await getDb(), { q, status, page });

  return (
    <div>
      <PageHeader
        title="Familles"
        icon={<Users className="size-6" aria-hidden="true" />}
        description="Données privées, visibles uniquement par le personnel."
        actions={
          <Link href="/admin/familles/nouvelle" className={buttonClass.primary}>
            Nouvelle famille
          </Link>
        }
      />
      <FlashBanner {...readFlash(searchParams)} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-sm font-medium">Rechercher</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Nom de famille ou contact"
            className="mt-1.5 block w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-sm transition focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none" />
        </div>
        <div>
          <label htmlFor="statut" className="block text-sm font-medium">Statut</label>
          <select id="statut" name="statut" defaultValue={status ?? ""}
            className="mt-1.5 block rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-sm transition focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none">
            <option value="">Tous</option>
            {FAMILY_STATUSES.map((s) => <option key={s} value={s}>{FAMILY_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <button type="submit" className={buttonClass.secondary}>Filtrer</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        {items.length === 0 ? (
          <EmptyState>Aucune famille ne correspond à ces critères.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-primary-soft/50 text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Famille</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Fiches</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Modifiée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-primary-soft/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/familles/${f.id}`} className="font-medium underline-offset-4 hover:underline">
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{f.contactName ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{f.profileCount}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} label={FAMILY_STATUS_LABELS[f.status]} /></td>
                  <td className="px-4 py-3 text-muted tabular-nums">{formatDateTime(f.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <PaginationNav pagination={pagination} basePath="/admin/familles" params={{ q, statut: status }} />
    </div>
  );
}
