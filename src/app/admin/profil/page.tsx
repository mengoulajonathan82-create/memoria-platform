import type { Metadata } from "next";
import { Card, DefinitionList, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Mon profil" />
      <Card title="Mon compte">
        <DefinitionList
          items={[
            { label: "Nom", value: user.name },
            { label: "E-mail", value: user.email },
            { label: "Rôle", value: ROLE_LABELS[user.role] },
          ]}
        />
      </Card>
      <Card title="Changer mon mot de passe">
        <PasswordForm minLength={PASSWORD_MIN_LENGTH} />
      </Card>
    </div>
  );
}
