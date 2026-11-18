import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { listFamilyOptions } from "@/lib/families/service";
import { createProfileAction } from "../actions";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Nouvelle fiche" };

/** Par défaut, toutes les sections publiques sont activées. */
const DEFAULT_VALUES = {
  showDates: "on",
  showBiography: "on",
  showCeremony: "on",
  showPracticalInfo: "on",
  showGallery: "on",
  allowCondolences: "on",
  allowCandles: "on",
};

export default async function NewProfilePage(props: PageProps<"/admin/fiches/nouvelle">) {
  await requirePermission("profiles.manage");
  const searchParams = await props.searchParams;
  const familyOptions = await listFamilyOptions(await getDb());
  const preselected = z.uuid().safeParse(searchParams.famille);
  const familyId =
    preselected.success && familyOptions.some((f) => f.id === preselected.data)
      ? preselected.data
      : "";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouvelle fiche défunt"
        description="La fiche est créée en brouillon : elle ne sera visible publiquement qu'après publication."
        back={{ href: "/admin/fiches", label: "Fiches défunts" }}
      />
      <ProfileForm
        action={createProfileAction}
        initialValues={{ ...DEFAULT_VALUES, familyId }}
        familyOptions={familyOptions}
        submitLabel="Créer la fiche"
        cancelHref="/admin/fiches"
      />
    </div>
  );
}
