import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { countPending } from "@/lib/tributes/service";
import { logoutAction } from "./actions";
import { AdminMobileBar, AdminSidebar, type NavEntry } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s — Memoria" },
};

const NAV_ITEMS: (NavEntry & { permission: Permission })[] = [
  { href: "/admin", label: "Tableau de bord", permission: "dashboard.view" },
  { href: "/admin/familles", label: "Familles", permission: "families.manage" },
  { href: "/admin/fiches", label: "Fiches défunts", permission: "profiles.manage" },
  { href: "/admin/moderation", label: "Modération", permission: "moderation.manage" },
  { href: "/admin/employes", label: "Employés", permission: "users.manage" },
  { href: "/admin/journal", label: "Journal", permission: "activity.view" },
  { href: "/admin/parametres", label: "Paramètres", permission: "settings.manage" },
  { href: "/admin/donnees", label: "Données", permission: "backup.manage" },
  { href: "/admin/profil", label: "Mon profil", permission: "dashboard.view" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Garde serveur : toute page sous /admin exige une session valide.
  const user = await requireUser();
  const pendingModeration = hasPermission(user.role, "moderation.manage")
    ? await countPending(await getDb())
    : 0;
  const items: NavEntry[] = NAV_ITEMS.filter((item) => hasPermission(user.role, item.permission)).map(
    ({ href, label }) => ({ href, label, badge: href === "/admin/moderation" ? pendingModeration : undefined }),
  );

  const userCard = (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary-strong">
        {initials(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="text-xs text-blue-200">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg p-2 text-blue-100 transition hover:bg-white/10 hover:text-white"
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background lg:flex-row">
      <AdminSidebar items={items} footer={userCard} />
      <AdminMobileBar items={items} footer={userCard} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
