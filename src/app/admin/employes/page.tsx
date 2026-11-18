import type { Metadata } from "next";
import Link from "next/link";
import { Card, FlashBanner, formatDateTime, PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { readFlash } from "@/lib/flash";
import { listStaff } from "@/lib/users/service";
import { createStaffAction } from "./actions";
import { CreateStaffForm } from "./staff-forms";

export const metadata: Metadata = { title: "Employés" };

/** Comptes du personnel (administrateurs uniquement). */
export default async function EmployeesPage(props: PageProps<"/admin/employes">) {
  const user = await requirePermission("users.manage");
  const [accounts, searchParams] = await Promise.all([listStaff(await getDb()), props.searchParams]);

  return (
    <div className="space-y-8">
      <PageHeader title="Comptes du personnel" description="Créer, modifier, désactiver ou supprimer des comptes." />
      <FlashBanner {...readFlash(searchParams)} />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Dernière connexion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-background">
                <td className="px-4 py-3">
                  <Link href={`/admin/employes/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                    {a.name}
                  </Link>
                  {a.id === user.id ? <span className="ml-2 text-xs text-muted">(vous)</span> : null}
                </td>
                <td className="px-4 py-3">{a.email}</td>
                <td className="px-4 py-3">{ROLE_LABELS[a.role]}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.isActive ? "active" : "deleted"} label={a.isActive ? "Actif" : "Désactivé"} />
                </td>
                <td className="px-4 py-3 text-muted tabular-nums">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-w-2xl">
        <Card title="Nouveau compte">
          <p className="mb-4 text-sm text-muted">
            Un mot de passe provisoire est généré et affiché une seule fois. Aucun e-mail n&apos;est envoyé.
          </p>
          <CreateStaffForm action={createStaffAction} />
        </Card>
      </div>
    </div>
  );
}
