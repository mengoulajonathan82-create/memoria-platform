import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import {
  buttonClass,
  Card,
  DefinitionList,
  FlashBanner,
  formatDateTime,
  formatIsoDate,
  HistoryList,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { readFlash } from "@/lib/flash";
import { buildPublicUrl, generateQrSvg, isLocalOnlyUrl } from "@/lib/qr";
import { getEntityHistory } from "@/lib/history";
import { getProfile } from "@/lib/profiles/service";
import {
  PROFILE_STATUS_LABELS,
  type SettableProfileStatus,
} from "@/lib/validation/profile";
import {
  changeProfileStatusAction,
  deleteProfileAction,
  restoreProfileAction,
} from "../actions";

export const metadata: Metadata = { title: "Fiche défunt" };

function Visibility({ on }: { on: boolean }) {
  return on ? (
    <span className="text-xs text-success">Public</span>
  ) : (
    <span className="text-xs text-muted">Masqué</span>
  );
}

const STATUS_ACTIONS: { to: SettableProfileStatus; label: string; unpublishLabel?: string }[] = [
  { to: "published", label: "Publier" },
  { to: "pending", label: "Mettre en attente de validation", unpublishLabel: "Dépublier (en attente)" },
  { to: "draft", label: "Repasser en brouillon", unpublishLabel: "Dépublier (brouillon)" },
  { to: "archived", label: "Archiver" },
];

export default async function ProfilePage(props: PageProps<"/admin/fiches/[id]">) {
  const user = await requirePermission("profiles.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = await getDb();
  const profile = await getProfile(db, id);
  if (!profile) notFound();
  const [history, searchParams] = await Promise.all([
    getEntityHistory(db, "profile", id),
    props.searchParams,
  ]);

  const appUrl = getServerEnv().APP_URL;
  const publicUrl = buildPublicUrl(appUrl, profile.publicId);
  const localOnly = isLocalOnlyUrl(appUrl);
  const qrSvg = profile.status === "deleted" ? "" : await generateQrSvg(publicUrl);

  const isDeleted = profile.status === "deleted";
  const isPublished = profile.status === "published";
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user.role, p);
  const statusActions = STATUS_ACTIONS.filter((a) => {
    if (a.to === profile.status) return false;
    if (a.to === "published" && !can("profiles.publish")) return false;
    if (isPublished && !can("profiles.unpublish")) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title={profile.fullName}
        back={{ href: "/admin/fiches", label: "Fiches défunts" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={profile.status} label={PROFILE_STATUS_LABELS[profile.status]} />
            {profile.publishedAt ? <span>Publiée le {formatDateTime(profile.publishedAt)}</span> : null}
          </span>
        }
        actions={
          isDeleted ? null : (
            <Link href={`/admin/fiches/${id}/modifier`} className={buttonClass.primary}>
              Modifier
            </Link>
          )
        }
      />
      <FlashBanner {...readFlash(searchParams)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Identité">
            <DefinitionList
              items={[
                { label: "Nom complet", value: profile.fullName },
                {
                  label: "Famille",
                  value: profile.familyId ? (
                    <Link href={`/admin/familles/${profile.familyId}`} className="underline underline-offset-4">
                      {profile.familyName}
                    </Link>
                  ) : null,
                },
                {
                  label: "Naissance — décès",
                  value: (
                    <>
                      {formatIsoDate(profile.birthDate)} — {formatIsoDate(profile.deathDate)}{" "}
                      <Visibility on={profile.showDates} />
                    </>
                  ),
                },
              ]}
            />
          </Card>

          <Card title="Biographie" actions={<Visibility on={profile.showBiography} />}>
            <p className="text-sm whitespace-pre-line">{profile.biography || "—"}</p>
          </Card>

          <Card title="Cérémonie" actions={<Visibility on={profile.showCeremony} />}>
            <DefinitionList
              items={[
                {
                  label: "Date et heure",
                  value: profile.ceremonyDate
                    ? `${formatIsoDate(profile.ceremonyDate)}${profile.ceremonyTime ? ` à ${profile.ceremonyTime}` : ""}`
                    : null,
                },
                { label: "Lieu", value: profile.ceremonyLocation },
                { label: "Adresse", value: profile.ceremonyAddress },
                { label: "Diffusion en direct", value: profile.livestreamUrl },
              ]}
            />
          </Card>

          <Card title="Informations pratiques" actions={<Visibility on={profile.showPracticalInfo} />}>
            <p className="text-sm whitespace-pre-line">{profile.practicalInfo || "—"}</p>
          </Card>

          <Card title="Options publiques">
            <ul className="space-y-1 text-sm">
              <li>Galerie de souvenirs : <Visibility on={profile.showGallery} /></li>
              <li>Messages de condoléances : {profile.allowCondolences ? "autorisés (avec modération)" : "désactivés"}</li>
              <li>Bougies numériques : {profile.allowCandles ? "autorisées" : "désactivées"}</li>
            </ul>
          </Card>

          <Card title="Notes internes (privé)">
            <p className="text-sm whitespace-pre-line">{profile.internalNotes || "—"}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publication">
            {isDeleted ? (
              <div className="space-y-3 text-sm">
                <p className="text-muted">Cette fiche est supprimée et n&apos;est plus visible nulle part.</p>
                {can("profiles.restore") ? (
                  <form action={restoreProfileAction.bind(null, id)}>
                    <SubmitButton variant="secondary" pendingLabel="Restauration…">Restaurer en brouillon</SubmitButton>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted">Adresse publique (stable, utilisée par le QR code) :</p>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all rounded bg-background px-2 py-1 text-xs underline-offset-2 hover:underline"
                  >
                    {publicUrl}
                  </a>
                  {!isPublished ? (
                    <p className="mt-1 text-xs text-muted">
                      Non publiée : cette adresse affiche « page non disponible ».
                    </p>
                  ) : null}
                </div>
                <div>
                  <div
                    className="mx-auto w-40 [&>svg]:h-auto [&>svg]:w-full"
                    role="img"
                    aria-label="QR code de la page publique"
                    // SVG produit par la bibliothèque qrcode à partir de notre propre URL.
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <a href={`/admin/fiches/${id}/qr?format=png&download=1`} className="rounded-md border border-border px-3 py-1.5 hover:bg-background">
                      PNG
                    </a>
                    <a href={`/admin/fiches/${id}/qr?format=svg&download=1`} className="rounded-md border border-border px-3 py-1.5 hover:bg-background">
                      SVG
                    </a>
                    <Link href={`/admin/fiches/${id}/qr/imprimer`} className="rounded-md border border-border px-3 py-1.5 hover:bg-background">
                      Imprimer
                    </Link>
                  </div>
                  {localOnly ? (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      APP_URL pointe vers « localhost » : ce QR code ne fonctionnera pas depuis un
                      téléphone. Voir le README, section « Tester sur un téléphone ».
                    </p>
                  ) : null}
                </div>
                {statusActions.length ? (
                  <form action={changeProfileStatusAction.bind(null, id)} className="flex flex-col gap-2">
                    {statusActions.map((a) => (
                      <button
                        key={a.to}
                        type="submit"
                        name="status"
                        value={a.to}
                        className={`rounded-md px-3 py-2 text-left ${
                          a.to === "published"
                            ? "bg-primary text-primary-foreground hover:opacity-90"
                            : "border border-border hover:bg-background"
                        }`}
                      >
                        {isPublished && a.unpublishLabel ? a.unpublishLabel : a.label}
                      </button>
                    ))}
                  </form>
                ) : null}
                {can("profiles.delete") ? (
                  <form action={deleteProfileAction.bind(null, id)} className="border-t border-border pt-4">
                    <ConfirmSubmitButton
                      variant="danger"
                      message={`Supprimer la fiche « ${profile.fullName} » ? Elle ne sera plus visible, mais un administrateur pourra la restaurer.`}
                    >
                      Supprimer la fiche
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            )}
          </Card>

          <Card title="Historique">
            <HistoryList entries={history} statusLabels={PROFILE_STATUS_LABELS} />
          </Card>
        </div>
      </div>
    </div>
  );
}
