/* eslint-disable @next/next/no-img-element -- fichiers servis par une route protégée, déjà optimisés par sharp */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { Card, FlashBanner, formatDateTime, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import type { Media } from "@/lib/db/schema";
import { readFlash } from "@/lib/flash";
import { listProfileMedia } from "@/lib/media/service";
import { getProfile } from "@/lib/profiles/service";
import {
  deleteMediaAction,
  moveMediaAction,
  restoreMediaAction,
  setMainPhotoAction,
  updateMediaAction,
} from "./actions";
import { MediaUploader } from "./uploader";

export const metadata: Metadata = { title: "Médias" };

const TYPE_LABELS: Record<Media["type"], string> = { image: "Photo", video: "Vidéo", document: "PDF" };

function Preview({ item }: { item: Media }) {
  const src = `/api/admin/medias/${item.publicKey}`;
  if (item.type === "image") {
    return (
      <img
        src={`${src}?v=thumb`}
        alt={item.caption ?? "Photo"}
        loading="lazy"
        className="aspect-[4/3] w-full rounded-md bg-background object-cover"
      />
    );
  }
  if (item.type === "video") {
    return <video src={src} controls preload="metadata" className="aspect-[4/3] w-full rounded-md bg-black" />;
  }
  return (
    <a href={src} className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-background text-sm text-muted underline">
      Document PDF
    </a>
  );
}

const smallButton = "rounded-md border border-border px-2.5 py-1 text-xs hover:bg-background disabled:opacity-40";

export default async function ProfileMediaPage(props: PageProps<"/admin/fiches/[id]/medias">) {
  const user = await requirePermission("media.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await getDb();
  const profile = await getProfile(db, id);
  if (!profile || profile.status === "deleted") notFound();

  const [items, trash, searchParams] = await Promise.all([
    listProfileMedia(db, id, "active"),
    listProfileMedia(db, id, "deleted"),
    props.searchParams,
  ]);
  const canRestore = hasPermission(user.role, "media.restore");

  return (
    <div>
      <PageHeader
        title={`Médias : ${profile.fullName}`}
        back={{ href: `/admin/fiches/${id}`, label: profile.fullName }}
        description={
          profile.showGallery
            ? "Les médias marqués « public » apparaissent dans la galerie de la page publique, dans cet ordre."
            : "La galerie est masquée sur la page publique (option de la fiche). Seule la photo principale est affichée."
        }
      />
      <FlashBanner {...readFlash(searchParams)} />

      <MediaUploader profileId={id} />

      <h2 className="mt-8 mb-3 font-medium">Galerie ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Aucun média pour le moment.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const isMain = profile.mainPhotoMediaId === item.id;
            return (
              <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
                <Preview item={item} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-background px-2 py-0.5">{TYPE_LABELS[item.type]}</span>
                  {isMain ? <span className="rounded bg-primary px-2 py-0.5 text-primary-foreground">Photo principale</span> : null}
                  <span className={item.isPublic ? "text-success" : "text-muted"}>
                    {item.isPublic ? "Public" : "Privé"}
                  </span>
                </div>

                <form action={updateMediaAction.bind(null, id, item.id)} className="mt-3 space-y-2">
                  <label htmlFor={`caption-${item.id}`} className="sr-only">Légende</label>
                  <input
                    id={`caption-${item.id}`}
                    name="caption"
                    defaultValue={item.caption ?? ""}
                    maxLength={300}
                    placeholder="Légende (facultative)"
                    className="block w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="isPublic" defaultChecked={item.isPublic} className="accent-primary" />
                      Visible publiquement
                    </label>
                    <SubmitButton variant="secondary" pendingLabel="…">Enregistrer</SubmitButton>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <form action={moveMediaAction.bind(null, id, item.id, "up")}>
                    <button type="submit" className={smallButton} disabled={index === 0} aria-label="Monter">↑</button>
                  </form>
                  <form action={moveMediaAction.bind(null, id, item.id, "down")}>
                    <button type="submit" className={smallButton} disabled={index === items.length - 1} aria-label="Descendre">↓</button>
                  </form>
                  {item.type === "image" ? (
                    <form action={setMainPhotoAction.bind(null, id, isMain ? null : item.id)}>
                      <button type="submit" className={smallButton}>
                        {isMain ? "Retirer comme photo principale" : "Photo principale"}
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteMediaAction.bind(null, id, item.id)} className="ml-auto">
                    <ConfirmSubmitButton variant="danger" message="Placer ce média dans la corbeille ? Il ne sera plus affiché.">
                      Corbeille
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {trash.length ? (
        <div className="mt-10">
          <Card title={`Corbeille (${trash.length})`}>
            <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {trash.map((item) => (
                <li key={item.id} className="text-sm opacity-80">
                  <Preview item={item} />
                  <p className="mt-1 text-xs text-muted">
                    {TYPE_LABELS[item.type]} · supprimé le {item.deletedAt ? formatDateTime(item.deletedAt) : "—"}
                  </p>
                  {canRestore ? (
                    <form action={restoreMediaAction.bind(null, id, item.id)} className="mt-1">
                      <SubmitButton variant="secondary" pendingLabel="…">Restaurer</SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {!canRestore ? (
              <p className="mt-3 text-xs text-muted">Seul un administrateur peut restaurer un média.</p>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
