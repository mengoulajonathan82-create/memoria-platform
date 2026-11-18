import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db";

export const metadata: Metadata = { title: "Employés" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Liste des comptes (lecture seule en Phase 1, réservée aux administrateurs).
 * Création / désactivation : Phase 6.
 */
export default async function EmployeesPage() {
  await requirePermission("users.manage");
  const db = await getDb();
  const accounts = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Comptes du personnel</h1>
        <p className="mt-1 text-sm text-muted">
          Lecture seule pour le moment — la création et la désactivation des comptes arrivent en Phase 6.
        </p>
      </div>
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
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-4 py-3">{account.name}</td>
                <td className="px-4 py-3">{account.email}</td>
                <td className="px-4 py-3">{ROLE_LABELS[account.role]}</td>
                <td className="px-4 py-3">
                  {account.isActive ? (
                    <span className="text-success">Actif</span>
                  ) : (
                    <span className="text-danger">Désactivé</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted tabular-nums">
                  {account.lastLoginAt ? dateFormatter.format(account.lastLoginAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
