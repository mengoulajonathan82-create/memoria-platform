"use client";

/**
 * Navigation du back-office : barre latérale bleue (ordinateur) et menu
 * coulissant (téléphone). Les éléments sont déjà filtrés par rôle côté serveur.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookHeart,
  CircleUser,
  Database,
  LayoutDashboard,
  Menu,
  MessageSquareHeart,
  ScrollText,
  Settings,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/familles": Users,
  "/admin/fiches": BookHeart,
  "/admin/moderation": MessageSquareHeart,
  "/admin/employes": UserCog,
  "/admin/journal": ScrollText,
  "/admin/parametres": Settings,
  "/admin/donnees": Database,
  "/admin/profil": CircleUser,
};

export interface NavEntry {
  href: string;
  label: string;
  badge?: number;
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.href] ?? LayoutDashboard;
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-white text-primary-strong shadow-lg shadow-blue-950/20"
                  : "text-blue-100 hover:translate-x-0.5 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-primary" : ""}`}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950"
                  aria-label={`${item.badge} en attente`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 px-2">
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-white">
          <path
            fill="currentColor"
            d="M12 2c.5 2.3-.6 3.6-1.6 4.8C9.4 8 8.5 9.1 8.5 10.8a3.5 3.5 0 0 0 7 0c0-1.1-.4-2-.9-2.8 1.6.7 3.4 2.6 3.4 5.4A6 6 0 0 1 6 13.4C6 8.6 10.5 6.7 12 2Z"
          />
        </svg>
      </span>
      <span className="font-serif text-2xl font-semibold tracking-wide text-white">Memoria</span>
    </Link>
  );
}

export function AdminSidebar({ items, footer }: { items: NavEntry[]; footer: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-gradient-to-b from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] px-4 py-6 lg:flex print:hidden">
      <Brand />
      <nav aria-label="Navigation du back-office" className="mt-8 flex-1 overflow-y-auto">
        <NavList items={items} />
      </nav>
      <div className="mt-4 border-t border-white/15 pt-4">{footer}</div>
    </aside>
  );
}

export function AdminMobileBar({ items, footer }: { items: NavEntry[]; footer: ReactNode }) {
  // Le menu se ferme lors d'un clic sur un lien (onNavigate), sur le fond ou avec Échap.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const pending = items.reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <div className="lg:hidden print:hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] px-4 py-3 shadow-md">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          <Menu className="size-6" aria-hidden="true" />
          {pending ? <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-amber-400" /> : null}
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col bg-gradient-to-b from-[#1e3a8a] to-[#2563eb] px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Fermer le menu">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Navigation du back-office" className="mt-6 flex-1 overflow-y-auto">
              <NavList items={items} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-4 border-t border-white/15 pt-4">{footer}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
