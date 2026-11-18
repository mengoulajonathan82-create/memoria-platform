import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/form";
import {
  EmptyState,
  FlashBanner,
  formatDateTime,
  PageHeader,
  PaginationNav,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { MODERATION_STATUSES, type ModerationStatus } from "@/lib/db/schema";
import { readFlash } from "@/lib/flash";
import { parsePage } from "@/lib/query-utils";
import { getTributeStats, listForModeration } from "@/lib/tributes/service";
import { MODERATION_STATUS_LABELS, type TributeKind } from "@/lib/validation/tribute";
import { deleteTributeAction, moderateAction } from "./actions";

export const metadata: Metadata = { title: "Modération" };

const KIND_PARAM: Record<string, TributeKind> = { condoleances: "condolence", bougies: "candle" };
const statusParam = z.enum([...MODERATION_STATUSES, "tous"]).catch("pending");
const uuidParam = z.uuid().optional().catch(undefined);

const ACTIONS: { to: "approved" | "rejected" | "hidden"; label: string; style: string }[] = [
  { to: "approved", label: "Approuver", style: "bg-success text-white hover:opacity-90" },
  { to: "rejected", label: "Refuser", style: "border border-border hover:bg-background" },
  { to: "hidden", label: "Masquer", style: "border border-border hover:bg-background" },
];

export default async function ModerationPage(props: PageProps<"/admin/moderation">) {
  await requirePermission("moderation.manage");
  const searchParams = await props.searchParams;
  const kindKey = searchParams.type === "bougies" ? "bougies" : "condoleances";
  const kind = KIND_PARAM[kindKey]!;
  const statusKey = statusParam.parse(searchParams.statut ?? "pending");
  const status: ModerationStatus | undefined = statusKey === "tous" ? undefined : statusKey;
  const profileId = uuidParam.parse(searchParams.fiche);
  const page = parsePage(searchParams.page);

  const db = await getDb();
  const [{ items, pagination }, stats] = await Promise.all([
    listForModeration(db, { kind, status, profileId, page }),
    getTributeStats(db, profileId),
  ]);

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type: kindKey, statut: statusKey, fiche: profileId, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/admin/moderation?${params.toString()}`;
  };
  const returnTo = query({ page: page > 1 ? String(page) : undefined });

  return (
    <div>
      <PageHeader
        title="Modération"
        description="Aucun message n'est publié sans validation. Les bougies sans message sont affichées directement mais peuvent être masquées."
      />
      <FlashBanner {...readFlash(searchParams)} />
      {profileId ? (
        <p className="mb-4 text-sm">
          Filtré sur une fiche.{" "}
          <Link href={query({ fiche: undefined })} className="underline underline-offset-4">Voir toutes les fiches</Link>
        </p>
      ) : null}

      <nav aria-label="Type" className="mb-4 flex gap-2 border-b border-border">
        {(["condoleances", "bougies"] as const).map((k) => {
          const pending = k === "condoleances" ? stats.condolences.pending : stats.candles.pending;
          const active = k === kindKey;
          return (
            <Link
              key={k}
              href={query({ type: k, page: undefined })}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${active ? "border-primary font-medium" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {k === "condoleances" ? "Condoléances" : "Bougies"}
              {pending ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pending}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {(["pending", "approved", "rejected", "hidden", "tous"] as const).map((s) => {
          const counts = kind === "condolence" ? stats.condolences : stats.candles;
          const n = s === "tous" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s];
          return (
            <Link
              key={s}
              href={query({ statut: s, page: undefined })}
              aria-current={s === statusKey ? "true" : undefined}
              className={`rounded-full border px-3 py-1 ${s === statusKey ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-background"}`}
            >
              {s === "tous" ? "Tous" : MODERATION_STATUS_LABELS[s]} ({n})
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState>Rien à afficher ici.</EmptyState>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p>
                    <span className="font-medium">{item.author ?? "Anonyme"}</span>
                    <span className="text-muted"> pour </span>
                    <Link href={`/admin/fiches/${item.profileId}`} className="underline underline-offset-4">
                      {item.profileName}
                    </Link>
                  </p>
                  <p className="text-xs text-muted">Reçu le {formatDateTime(item.createdAt)}</p>
                </div>
                <StatusBadge status={item.status === "approved" ? "published" : item.status === "rejected" ? "deleted" : item.status === "hidden" ? "archived" : "pending"} label={MODERATION_STATUS_LABELS[item.status]} />
              </div>

              {item.message ? (
                <p className="mt-3 rounded-md bg-background px-4 py-3 text-sm whitespace-pre-line">{item.message}</p>
              ) : (
                <p className="mt-3 text-sm text-muted">Bougie sans message.</p>
              )}

              {item.kind === "condolence" ? (
                <div className="mt-3 text-xs text-muted">
                  <p>Consentement à la publication : {item.consentToPublish ? "oui" : "non"}</p>
                  {item.email || item.phone ? (
                    <p>
                      Coordonnées (privées, jamais publiées) : {[item.email, item.phone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {ACTIONS.filter((a) => a.to !== item.status).map((a) => (
                  <form key={a.to} action={moderateAction.bind(null, item.kind, item.id, a.to, returnTo)}>
                    <button type="submit" className={`rounded-md px-3 py-1.5 text-sm ${a.style}`}>
                      {a.label}
                    </button>
                  </form>
                ))}
                <form action={deleteTributeAction.bind(null, item.kind, item.id, returnTo)} className="ml-auto">
                  <ConfirmSubmitButton variant="danger" message="Supprimer définitivement cet élément (et les coordonnées associées) ?">
                    Supprimer
                  </ConfirmSubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PaginationNav
        pagination={pagination}
        basePath="/admin/moderation"
        params={{ type: kindKey, statut: statusKey, fiche: profileId }}
      />
    </div>
  );
}
