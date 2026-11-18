import type { Metadata } from "next";
import { SubmitButton } from "@/components/form";
import { buttonClass, Card, FlashBanner, formatDateTime, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getBackupsRoot, listBackups } from "@/lib/backup";
import { readFlash } from "@/lib/flash";
import { redirect } from "next/navigation";
import { createBackupAction } from "./actions";

export const metadata: Metadata = { title: "Données" };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default async function DataPage(props: PageProps<"/admin/donnees">) {
  const user = await requireUser();
  const canExport = hasPermission(user.role, "export.csv");
  const canBackup = hasPermission(user.role, "backup.manage");
  if (!canExport && !canBackup) redirect("/admin/acces-refuse");

  const [backups, searchParams] = await Promise.all([
    canBackup ? listBackups(getBackupsRoot()) : Promise.resolve([]),
    props.searchParams,
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Données" description="Export de données non sensibles et sauvegardes locales." />
      <FlashBanner {...readFlash(searchParams)} />

      {canExport ? (
        <Card title="Export CSV">
          <p className="mb-4 text-sm text-muted">
            Liste des fiches (nom, dates, statut, adresse publique) avec le nombre de messages publiés,
            de bougies et de médias. <strong>Ne contient pas</strong> les familles, les notes internes, le
            contenu des messages ni les coordonnées des visiteurs. Format compatible Excel. Chaque export est
            journalisé.
          </p>
          <a href="/admin/donnees/export?type=fiches" className={buttonClass.primary}>
            Télécharger les fiches (CSV)
          </a>
        </Card>
      ) : null}

      {canBackup ? (
        <Card title="Sauvegardes">
          <p className="mb-4 text-sm text-muted">
            Une sauvegarde copie la base de données et tous les médias dans le dossier{" "}
            <code className="rounded bg-background px-1">backups/</code> de ce serveur. Elle contient des
            données personnelles : conservez-la en lieu sûr (disque chiffré) et copiez-la régulièrement
            sur un autre support.
          </p>
          <form action={createBackupAction}>
            <SubmitButton pendingLabel="Sauvegarde en cours…">Créer une sauvegarde maintenant</SubmitButton>
          </form>

          {backups.length ? (
            <table className="mt-6 w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="py-2 font-medium">Sauvegarde</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Taille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map((b) => (
                  <tr key={b.name}>
                    <td className="py-2 font-mono text-xs">{b.name}</td>
                    <td className="py-2 tabular-nums">{formatDateTime(b.createdAt)}</td>
                    <td className="py-2 tabular-nums">{formatSize(b.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-muted">Aucune sauvegarde pour le moment.</p>
          )}

          <div className="mt-6 rounded-md bg-background p-4 text-sm">
            <p className="font-medium">Restaurer une sauvegarde</p>
            <p className="mt-1 text-muted">
              Par sécurité, la restauration ne se fait pas depuis le navigateur. Arrêtez le serveur, puis
              lancez dans un terminal :
            </p>
            <code className="mt-2 block rounded bg-surface px-3 py-2 text-xs">npm run restore -- NOM_DE_LA_SAUVEGARDE --confirm</code>
            <p className="mt-2 text-xs text-muted">
              L&apos;état actuel est automatiquement sauvegardé avant d&apos;être remplacé.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
