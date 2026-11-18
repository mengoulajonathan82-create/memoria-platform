import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getFamily } from "@/lib/families/service";
import { toFormValues } from "@/lib/form-state";
import { familySchema } from "@/lib/validation/family";
import { updateFamilyAction } from "../../actions";
import { FamilyForm } from "../../family-form";

export const metadata: Metadata = { title: "Modifier la famille" };

export default async function EditFamilyPage(props: PageProps<"/admin/familles/[id]/modifier">) {
  await requirePermission("families.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const family = await getFamily(await getDb(), id);
  if (!family) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Modifier : ${family.name}`} back={{ href: `/admin/familles/${id}`, label: family.name }} />
      <FamilyForm
        action={updateFamilyAction.bind(null, id)}
        initialValues={toFormValues(family, Object.keys(familySchema.shape))}
        submitLabel="Enregistrer"
        cancelHref={`/admin/familles/${id}`}
      />
    </div>
  );
}
