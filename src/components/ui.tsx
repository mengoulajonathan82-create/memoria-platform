/**
 * Composants d'interface du back-office (rendu serveur), thème bleu et blanc.
 */
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Inbox } from "lucide-react";
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

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-primary text-primary-foreground shadow-md shadow-blue-600/20 hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-lg hover:shadow-blue-600/25`,
  secondary: `${buttonBase} border border-border bg-surface text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-md`,
};

export function PageHeader({
  title,
  description,
  actions,
  back,
  icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  icon?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link
          href={back.href}
          className="group mb-3 inline-flex items-center gap-1 text-sm text-muted transition hover:text-primary"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon ? (
            <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-blue-600/25 sm:flex">
              {icon}
            </span>
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {description ? <div className="mt-1.5 max-w-2xl text-sm text-muted">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/25",
  draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  archived: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  deleted: "bg-red-50 text-red-700 ring-red-600/20",
};
const DOT_TONES: Record<string, string> = {
  published: "bg-emerald-500",
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  draft: "bg-slate-400",
  inactive: "bg-slate-400",
  archived: "bg-indigo-500",
  deleted: "bg-red-500",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${BADGE_TONES[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}`}
    >
      <span className={`size-1.5 rounded-full ${DOT_TONES[status] ?? "bg-slate-400"} ${status === "pending" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

export function Card({
  title,
  children,
  actions,
  icon,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-slate-200/60 transition-shadow duration-300 hover:shadow-md">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-primary-soft/60 to-transparent px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            {icon ? <span className="text-primary">{icon}</span> : null}
            {title}
          </h2>
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
          <dd className="break-words whitespace-pre-line text-foreground">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FlashBanner({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  const Icon = error ? CircleAlert : CheckCircle2;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-6 flex animate-scale-in items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
        error ? "border-red-200 bg-red-50 text-danger" : "border-emerald-200 bg-emerald-50 text-success"
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {error ?? success}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Inbox className="size-6" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

/** Classes communes des tableaux du back-office. */
export const tableClass = {
  wrapper: "overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm",
  table: "w-full text-left text-sm",
  thead: "border-b border-border bg-primary-soft/50 text-xs tracking-wide text-muted uppercase",
  th: "px-4 py-3 font-semibold",
  row: "transition-colors hover:bg-primary-soft/40",
  td: "px-4 py-3",
};

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
            <ChevronLeft className="size-4" aria-hidden="true" /> Précédente
          </Link>
        ) : null}
        {pagination.hasNext ? (
          <Link href={href(pagination.page + 1)} className={buttonClass.secondary}>
            Suivante <ChevronRight className="size-4" aria-hidden="true" />
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
  mainPhotoMediaId: "photo principale",
  theme: "thème de la page",
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

/** Historique présenté en frise chronologique. */
export function HistoryList({
  entries,
  statusLabels,
}: {
  entries: HistoryEntry[];
  statusLabels?: Record<string, string>;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted">Aucun historique.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-primary-soft pl-5 text-sm">
      {entries.map((e) => {
        const detail = describeDetails(e.details, statusLabels);
        return (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-surface bg-primary shadow" />
            <p className="font-medium text-foreground">{e.label}</p>
            {e.userName ? <p className="text-xs text-muted">{e.userName}</p> : null}
            {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
            <time dateTime={e.createdAt.toISOString()} className="text-xs text-muted/80 tabular-nums">
              {formatDateTime(e.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
