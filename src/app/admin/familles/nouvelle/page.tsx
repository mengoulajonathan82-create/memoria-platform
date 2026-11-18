import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { createFamilyAction } from "../actions";
import { FamilyForm } from "../family-form";

export const metadata: Metadata = { title: "Nouvelle famille" };

export default async function NewFamilyPage() {
  await requirePermission("families.manage");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nouvelle famille" back={{ href: "/admin/familles", label: "Familles" }} />
      <FamilyForm action={createFamilyAction} submitLabel="Créer la famille" cancelHref="/admin/familles" />
    </div>
  );
}
