import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s — Memoria" },
};

interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  /** Section prévue dans une phase ultérieure (affichée désactivée). */
  upcoming?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", permission: "dashboard.view" },
  { href: "/admin/familles", label: "Familles", permission: "families.manage" },
  { href: "/admin/fiches", label: "Fiches défunts", permission: "profiles.manage" },
  { href: "/admin/moderation", label: "Modération", permission: "moderation.manage", upcoming: "Phase 5" },
  { href: "/admin/employes", label: "Employés", permission: "users.manage" },
  { href: "/admin/parametres", label: "Paramètres", permission: "settings.manage", upcoming: "Phase 6" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Garde serveur : toute page sous /admin exige une session valide.
  const user = await requireUser();
  const items = NAV_ITEMS.filter((item) => hasPermission(user.role, item.permission));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-serif text-lg">
            Memoria
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">
              {user.name}{" "}
              <span className="rounded bg-background px-2 py-0.5 text-xs">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 hover:bg-background"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Navigation du back-office" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="flex gap-1 overflow-x-auto pb-2 text-sm">
            {items.map((item) => (
              <li key={item.href}>
                {item.upcoming ? (
                  <span
                    className="block cursor-not-allowed rounded-md px-3 py-1.5 whitespace-nowrap text-muted/70"
                    title={`Disponible en ${item.upcoming}`}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="block rounded-md px-3 py-1.5 whitespace-nowrap hover:bg-background"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
