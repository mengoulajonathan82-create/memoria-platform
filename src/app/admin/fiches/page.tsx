import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  buttonClass,
  EmptyState,
  FlashBanner,
  formatDateTime,
  formatIsoDate,
  PageHeader,
  PaginationNav,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { PROFILE_STATUSES } from "@/lib/db/schema";
import { listFamilyOptions } from "@/lib/families/service";
import { readFlash } from "@/lib/flash";
import { listProfiles } from "@/lib/profiles/service";
import { parsePage, parseSearchText } from "@/lib/query-utils";
import { PROFILE_STATUS_LABELS, profileStatusFilterSchema } from "@/lib/validation/profile";

export const metadata: Metadata = { title: "Fiches défunts" };

const isoDateParam = z.iso.date().optional().catch(undefined);
const uuidParam = z.uuid().optional().catch(undefined);
const inputClass = "mt-1.5 block w-full rounded-md border border-border bg-surface px-3 py-2";

export default async function ProfilesPage(props: PageProps<"/admin/fiches">) {
  await requirePermission("profiles.manage");
  const searchParams = await props.searchParams;
  const q = parseSearchText(searchParams.q);
  const status = profileStatusFilterSchema.parse(searchParams.statut);
  const familyId = uuidParam.parse(searchParams.famille);
  const deathFrom = isoDateParam.parse(searchParams.deces_du);
  const deathTo = isoDateParam.parse(searchParams.deces_au);
  const page = parsePage(searchParams.page);

  const db = await getDb();
  const [{ items, pagination }, familyOptions] = await Promise.all([
    listProfiles(db, { q, status, familyId, deathFrom, deathTo, page }),
    listFamilyOptions(db),
  ]);

  return (
    <div>
      <PageHeader
        title="Fiches défunts"
        actions={
          <Link href="/admin/fiches/nouvelle" className={buttonClass.primary}>
            Nouvelle fiche
          </Link>
        }
      />
      <FlashBanner {...readFlash(searchParams)} />

      <form method="get" role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Rechercher un nom</label>
          <input id="q" name="q" type="search" defaultValue={q} className={inputClass} />
        </div>
        <div>
          <label htmlFor="statut" className="block text-sm font-medium">Statut</label>
          <select id="statut" name="statut" defaultValue={status ?? ""} className={inputClass}>
            <option value="">Tous (hors supprimées)</option>
            {PROFILE_STATUSES.map((s) => <option key={s} value={s}>{PROFILE_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="famille" className="block text-sm font-medium">Famille</label>
          <select id="famille" name="famille" defaultValue={familyId ?? ""} className={inputClass}>
            <option value="">Toutes</option>
            {familyOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deces_du" className="block text-sm font-medium">Décès du</label>
          <input id="deces_du" name="deces_du" type="date" defaultValue={deathFrom} className={inputClass} />
        </div>
        <div>
          <label htmlFor="deces_au" className="block text-sm font-medium">au</label>
          <input id="deces_au" name="deces_au" type="date" defaultValue={deathTo} className={inputClass} />
        </div>
        <button type="submit" className={buttonClass.secondary}>Filtrer</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {items.length === 0 ? (
          <EmptyState>Aucune fiche ne correspond à ces critères.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Décès</th>
                <th className="px-4 py-3 font-medium">Famille</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Modifiée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/admin/fiches/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                      {p.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatIsoDate(p.deathDate)}</td>
                  <td className="px-4 py-3">{p.familyName ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} label={PROFILE_STATUS_LABELS[p.status]} /></td>
                  <td className="px-4 py-3 text-muted tabular-nums">{formatDateTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <PaginationNav
        pagination={pagination}
        basePath="/admin/fiches"
        params={{ q, statut: status, famille: familyId, deces_du: deathFrom, deces_au: deathTo }}
      />
    </div>
  );
}
