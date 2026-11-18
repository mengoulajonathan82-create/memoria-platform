/**
 * Composants d'interface du back-office (rendu serveur).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { HistoryEntry } from "@/lib/history";
import type { Pagination } from "@/lib/query-utils";

const isoDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Formate une date AAAA-MM-JJ sans décalage de fuseau horaire. */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return isoDateFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}

export const buttonClass = {
  primary:
    "inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90",
  secondary:
    "inline-block rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-background",
};

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href={back.href} className="text-sm text-muted hover:text-foreground">
          ← {back.label}
        </Link>
      ) : null}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">{title}</h1>
          {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  published: "bg-success/10 text-success",
  active: "bg-success/10 text-success",
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-background text-muted",
  inactive: "bg-background text-muted",
  archived: "bg-stone-200 text-stone-700",
  deleted: "bg-danger/10 text-danger",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_TONES[status] ?? "bg-background"}`}
    >
      {label}
    </span>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      {title ? (
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-medium">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd className="whitespace-pre-line break-words">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FlashBanner({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-6 rounded-md border px-4 py-3 text-sm ${
        error ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success"
      }`}
    >
      {error ?? success}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

/** Liens de pagination qui conservent les filtres courants. */
export function PaginationNav({
  pagination,
  basePath,
  params,
}: {
  pagination: Pagination;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pagination.totalPages <= 1) {
    return (
      <p className="mt-4 text-sm text-muted">
        {pagination.total} résultat{pagination.total > 1 ? "s" : ""}
      </p>
    );
  }
  const href = (page: number) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {pagination.total} résultats — page {pagination.page} sur {pagination.totalPages}
      </p>
      <div className="flex gap-2">
        {pagination.hasPrevious ? (
          <Link href={href(pagination.page - 1)} className={buttonClass.secondary}>
            ← Précédente
          </Link>
        ) : null}
        {pagination.hasNext ? (
          <Link href={href(pagination.page + 1)} className={buttonClass.secondary}>
            Suivante →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "nom",
  contactName: "contact",
  contactPhone: "téléphone",
  contactEmail: "e-mail",
  address: "adresse",
  internalNotes: "notes internes",
  status: "statut",
  familyId: "famille",
  fullName: "nom complet",
  birthDate: "date de naissance",
  deathDate: "date de décès",
  biography: "biographie",
  ceremonyDate: "date de cérémonie",
  ceremonyTime: "heure de cérémonie",
  ceremonyLocation: "lieu de cérémonie",
  ceremonyAddress: "adresse de cérémonie",
  livestreamUrl: "lien de diffusion",
  practicalInfo: "informations pratiques",
  showDates: "visibilité des dates",
  showBiography: "visibilité de la biographie",
  showCeremony: "visibilité de la cérémonie",
  showPracticalInfo: "visibilité des infos pratiques",
  showGallery: "visibilité de la galerie",
  allowCondolences: "condoléances",
  allowCandles: "bougies",
};

function describeDetails(details: Record<string, unknown> | null, statusLabels?: Record<string, string>) {
  if (!details) return null;
  if (typeof details.fields === "string" && details.fields) {
    return `Champs modifiés : ${details.fields
      .split(",")
      .map((f) => FIELD_LABELS[f] ?? f)
      .join(", ")}`;
  }
  if (typeof details.from === "string" && typeof details.to === "string") {
    const l = (s: string) => statusLabels?.[s] ?? s;
    return `${l(details.from)} → ${l(details.to)}`;
  }
  return null;
}

export function HistoryList({
  entries,
  statusLabels,
}: {
  entries: HistoryEntry[];
  statusLabels?: Record<string, string>;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted">Aucun historique.</p>;
  return (
    <ol className="space-y-3 text-sm">
      {entries.map((e) => {
        const detail = describeDetails(e.details, statusLabels);
        return (
          <li key={e.id} className="border-l-2 border-border pl-3">
            <p>
              {e.label}
              {e.userName ? <span className="text-muted"> — {e.userName}</span> : null}
            </p>
            {detail ? <p className="text-xs text-muted">{detail}</p> : null}
            <time dateTime={e.createdAt.toISOString()} className="text-xs text-muted tabular-nums">
              {formatDateTime(e.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
