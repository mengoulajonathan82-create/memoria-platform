import { ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity-log";
import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardStats, getRecentActivity } from "@/lib/dashboard";
import { getDb } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.view");
  const db = await getDb();
  const canViewAllActivity = hasPermission(user.role, "activity.view");

  const [stats, activity] = await Promise.all([
    getDashboardStats(db),
    getRecentActivity(db, {
      limit: 10,
      userId: canViewAllActivity ? undefined : user.id,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Bonjour {user.name}</h1>
        <p className="mt-1 text-muted">Vue d&apos;ensemble de la plateforme.</p>
      </div>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Indicateurs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Familles" value={stats.families} />
          <StatCard
            label="Fiches défunts"
            value={stats.profiles}
            hint={`${stats.profilesByStatus.published} publiées · ${stats.profilesByStatus.draft} brouillons · ${stats.profilesByStatus.archived} archivées`}
          />
          <StatCard label="Fiches en attente de validation" value={stats.profilesByStatus.pending} />
          <StatCard label="Messages à modérer" value={stats.pendingCondolences} />
          <StatCard label="Bougies à modérer" value={stats.pendingCandles} />
          <StatCard label="Bougies allumées" value={stats.approvedCandles} />
        </div>
      </section>

      <section aria-labelledby="activity-title" className="rounded-lg border border-border bg-surface">
        <h2 id="activity-title" className="border-b border-border px-5 py-3 font-medium">
          {canViewAllActivity ? "Activité récente" : "Votre activité récente"}
        </h2>
        {activity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aucune activité pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <span>
                  {ACTIVITY_LABELS[entry.action as ActivityAction] ?? entry.action}
                  {entry.userName ? <span className="text-muted"> — {entry.userName}</span> : null}
                </span>
                <time dateTime={entry.createdAt.toISOString()} className="text-muted tabular-nums">
                  {dateFormatter.format(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
