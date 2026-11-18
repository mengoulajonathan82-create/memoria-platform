import Link from "next/link";
import {
  ArrowRight,
  BookHeart,
  Clock,
  Flame,
  HeartHandshake,
  MessageSquareHeart,
  Plus,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/count-up";
import { formatDateTime } from "@/components/ui";
import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity-log";
import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardStats, getRecentActivity } from "@/lib/dashboard";
import { getDb } from "@/lib/db";

const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function greeting(): string {
  const h = new Date().getHours();
  return h >= 5 && h < 18 ? "Bonjour" : "Bonsoir";
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tone} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        <CountUp value={value} />
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const className =
    "group block rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-blue-900/5";
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.view");
  const db = await getDb();
  const canViewAllActivity = hasPermission(user.role, "activity.view");
  const canModerate = hasPermission(user.role, "moderation.manage");

  const [stats, activity] = await Promise.all([
    getDashboardStats(db),
    getRecentActivity(db, { limit: 8, userId: canViewAllActivity ? undefined : user.id }),
  ]);
  const toModerate = stats.pendingCondolences + stats.pendingCandles;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* Bandeau d'accueil */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#38bdf8] p-6 text-white shadow-xl shadow-blue-900/20 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-64 animate-float rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 size-72 animate-float rounded-full bg-sky-300/20 blur-3xl [animation-delay:-6s]" />
        <div className="relative">
          <p className="text-sm text-blue-100 first-letter:uppercase">{longDate.format(new Date())}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()} {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-blue-100">
            {toModerate > 0 && canModerate
              ? `${toModerate} contribution${toModerate > 1 ? "s attendent" : " attend"} votre relecture.`
              : "Tout est à jour. Voici l'essentiel de votre activité."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/fiches/nouvelle"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-strong shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Plus className="size-4" aria-hidden="true" /> Nouvelle fiche
            </Link>
            <Link
              href="/admin/familles/nouvelle"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25"
            >
              <Users className="size-4" aria-hidden="true" /> Nouvelle famille
            </Link>
            {canModerate && toModerate > 0 ? (
              <Link
                href="/admin/moderation"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-lg transition hover:-translate-y-0.5"
              >
                <ShieldCheck className="size-4" aria-hidden="true" /> Modérer ({toModerate})
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Indicateurs */}
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">Indicateurs</h2>
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Familles" value={stats.families} icon={Users} tone="bg-blue-50 text-blue-600" href="/admin/familles" />
          <StatCard
            label="Fiches défunts"
            value={stats.profiles}
            hint={`${stats.profilesByStatus.published} publiées · ${stats.profilesByStatus.draft} brouillons · ${stats.profilesByStatus.archived} archivées`}
            icon={BookHeart}
            tone="bg-sky-50 text-sky-600"
            href="/admin/fiches"
          />
          <StatCard
            label="Fiches à valider"
            value={stats.profilesByStatus.pending}
            icon={Clock}
            tone="bg-indigo-50 text-indigo-600"
            href="/admin/fiches?statut=pending"
          />
          <StatCard
            label="Messages à modérer"
            value={stats.pendingCondolences}
            icon={MessageSquareHeart}
            tone="bg-amber-50 text-amber-600"
            href={canModerate ? "/admin/moderation" : undefined}
          />
          <StatCard
            label="Bougies à modérer"
            value={stats.pendingCandles}
            icon={HeartHandshake}
            tone="bg-rose-50 text-rose-600"
            href={canModerate ? "/admin/moderation?type=bougies" : undefined}
          />
          <StatCard label="Bougies allumées" value={stats.approvedCandles} icon={Flame} tone="bg-orange-50 text-orange-500" />
        </div>
      </section>

      {/* Activité récente */}
      <section aria-labelledby="activity-title" className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="activity-title" className="font-semibold">
            {canViewAllActivity ? "Activité récente" : "Votre activité récente"}
          </h2>
          {canViewAllActivity ? (
            <Link href="/admin/journal" className="group inline-flex items-center gap-1 text-sm font-medium text-primary">
              Tout le journal <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Aucune activité pour le moment.</p>
        ) : (
          <ul className="stagger divide-y divide-border">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-primary-soft/40">
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{ACTIVITY_LABELS[entry.action as ActivityAction] ?? entry.action}</span>
                  {entry.userName ? <span className="text-muted"> · {entry.userName}</span> : null}
                </span>
                <time dateTime={entry.createdAt.toISOString()} className="text-xs text-muted tabular-nums">
                  {formatDateTime(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
