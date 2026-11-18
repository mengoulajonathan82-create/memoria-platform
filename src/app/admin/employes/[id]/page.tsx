import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, DefinitionList, formatDateTime, HistoryList, PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getEntityHistory } from "@/lib/history";
import { getStaff } from "@/lib/users/service";
import {
  deleteStaffAction,
  resetPasswordAction,
  setActiveAction,
  updateStaffAction,
} from "../actions";
import { ConfirmActionForm, EditStaffForm, ResetPasswordForm } from "../staff-forms";

export const metadata: Metadata = { title: "Compte" };

export default async function StaffPage(props: PageProps<"/admin/employes/[id]">) {
  const user = await requirePermission("users.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await getDb();
  const account = await getStaff(db, id);
  if (!account) notFound();
  const history = await getEntityHistory(db, "user", id);
  const isSelf = account.id === user.id;

  return (
    <div>
      <PageHeader
        title={account.name}
        back={{ href: "/admin/employes", label: "Comptes du personnel" }}
        description={
          <StatusBadge status={account.isActive ? "active" : "deleted"} label={account.isActive ? "Actif" : "Désactivé"} />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Informations">
            <DefinitionList
              items={[
                { label: "E-mail", value: account.email },
                { label: "Rôle", value: ROLE_LABELS[account.role] },
                { label: "Créé le", value: formatDateTime(account.createdAt) },
                { label: "Dernière connexion", value: account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Jamais" },
              ]}
            />
          </Card>

          <Card title="Modifier">
            <EditStaffForm action={updateStaffAction.bind(null, id)} initial={{ name: account.name, role: account.role }} />
          </Card>

          <Card title="Accès">
            {isSelf ? (
              <p className="text-sm text-muted">
                C&apos;est votre propre compte : pour changer votre mot de passe, utilisez « Mon profil ».
                Vous ne pouvez ni le désactiver ni le supprimer.
              </p>
            ) : (
              <div className="space-y-6">
                <ResetPasswordForm action={resetPasswordAction.bind(null, id)} />
                <ConfirmActionForm
                  action={setActiveAction.bind(null, id, !account.isActive)}
                  label={account.isActive ? "Désactiver le compte" : "Réactiver le compte"}
                  confirm={
                    account.isActive
                      ? "Désactiver ce compte ? La personne sera déconnectée et ne pourra plus se connecter."
                      : "Réactiver ce compte ?"
                  }
                />
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-xs text-muted">
                    Suppression définitive. Les fiches et le journal sont conservés, sans nom d&apos;auteur.
                    Préférez la désactivation si vous n&apos;êtes pas sûr.
                  </p>
                  <ConfirmActionForm
                    action={deleteStaffAction.bind(null, id)}
                    label="Supprimer le compte"
                    confirm={`Supprimer définitivement le compte de ${account.name} ? Cette action est irréversible.`}
                    danger
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
        <Card title="Historique du compte">
          <HistoryList entries={history} />
        </Card>
      </div>
    </div>
  );
}
