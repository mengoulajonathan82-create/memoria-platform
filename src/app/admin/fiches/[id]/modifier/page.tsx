import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { listFamilyOptions } from "@/lib/families/service";
import { toFormValues } from "@/lib/form-state";
import { getProfile } from "@/lib/profiles/service";
import { profileSchema } from "@/lib/validation/profile";
import { updateProfileAction } from "../../actions";
import { ProfileForm } from "../../profile-form";

export const metadata: Metadata = { title: "Modifier la fiche" };

export default async function EditProfilePage(props: PageProps<"/admin/fiches/[id]/modifier">) {
  await requirePermission("profiles.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await getDb();
  const profile = await getProfile(db, id);
  if (!profile || profile.status === "deleted") notFound();
  const familyOptions = await listFamilyOptions(db, profile.familyId);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Modifier : ${profile.fullName}`}
        back={{ href: `/admin/fiches/${id}`, label: profile.fullName }}
      />
      <ProfileForm
        action={updateProfileAction.bind(null, id)}
        initialValues={toFormValues(profile, Object.keys(profileSchema.shape))}
        familyOptions={familyOptions}
        submitLabel="Enregistrer"
        cancelHref={`/admin/fiches/${id}`}
      />
    </div>
  );
}
