import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/form";
import {
  buttonClass,
  Card,
  DefinitionList,
  FlashBanner,
  formatIsoDate,
  HistoryList,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getFamily } from "@/lib/families/service";
import { readFlash } from "@/lib/flash";
import { getEntityHistory } from "@/lib/history";
import { listProfiles } from "@/lib/profiles/service";
import { FAMILY_STATUS_LABELS } from "@/lib/validation/family";
import { PROFILE_STATUS_LABELS } from "@/lib/validation/profile";
import { deleteFamilyAction } from "../actions";

export const metadata: Metadata = { title: "Famille" };

export default async function FamilyPage(props: PageProps<"/admin/familles/[id]">) {
  const user = await requirePermission("families.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = await getDb();
  const family = await getFamily(db, id);
  if (!family) notFound();

  const [profiles, history, searchParams] = await Promise.all([
    listProfiles(db, { familyId: id, pageSize: 100 }),
    getEntityHistory(db, "family", id),
    props.searchParams,
  ]);
  const canDelete = hasPermission(user.role, "families.delete");

  return (
    <div>
      <PageHeader
        title={family.name}
        back={{ href: "/admin/familles", label: "Familles" }}
        description={<StatusBadge status={family.status} label={FAMILY_STATUS_LABELS[family.status]} />}
        actions={
          <>
            <Link href={`/admin/familles/${id}/modifier`} className={buttonClass.primary}>
              Modifier
            </Link>
            <Link href={`/admin/fiches/nouvelle?famille=${id}`} className={buttonClass.secondary}>
              Nouvelle fiche pour cette famille
            </Link>
          </>
        }
      />
      <FlashBanner {...readFlash(searchParams)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Contact principal (privé)">
            <DefinitionList
              items={[
                { label: "Nom", value: family.contactName },
                { label: "Téléphone", value: family.contactPhone },
                { label: "E-mail", value: family.contactEmail },
                { label: "Adresse", value: family.address },
                { label: "Notes internes", value: family.internalNotes },
              ]}
            />
          </Card>

          <Card title={`Fiches rattachées (${profiles.pagination.total})`}>
            {profiles.items.length === 0 ? (
              <p className="text-sm text-muted">Aucune fiche pour cette famille.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {profiles.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/fiches/${p.id}`} className="font-medium hover:underline">
                      {p.fullName}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{formatIsoDate(p.deathDate)}</span>
                      <StatusBadge status={p.status} label={PROFILE_STATUS_LABELS[p.status]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canDelete ? (
            <Card title="Zone sensible">
              <p className="mb-3 text-sm text-muted">
                La suppression est définitive et n&apos;est possible que si aucune fiche n&apos;est
                rattachée. Sinon, passez la famille au statut « Archivée ».
              </p>
              <form action={deleteFamilyAction.bind(null, id)}>
                <ConfirmSubmitButton
                  variant="danger"
                  message={`Supprimer définitivement la famille « ${family.name} » ? Cette action est irréversible.`}
                >
                  Supprimer la famille
                </ConfirmSubmitButton>
              </form>
            </Card>
          ) : null}
        </div>

        <Card title="Historique">
          <HistoryList entries={history} />
        </Card>
      </div>
    </div>
  );
}
