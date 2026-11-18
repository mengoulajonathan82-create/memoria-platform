/**
 * Habillage des pages publiques : sobre, sans publicité ni pop-up,
 * personnalisé avec le nom de l'entreprise, sa couleur et son pied de page.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Branding } from "@/lib/branding";

export function PublicShell({ branding, children }: { branding: Branding; children: ReactNode }) {
  // primaryColor est validé (#RRGGBB) par brandingSchema avant d'arriver ici.
  const style = { "--primary": branding.primaryColor } as CSSProperties;
  return (
    <div style={style} className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface/70">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-1 px-5 py-3 text-center text-sm tracking-wide text-muted">
          {branding.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi par une route dédiée
            <img src="/logo" alt={branding.companyName} className="max-h-12 w-auto" />
          ) : null}
          <span className={branding.logoPath ? "sr-only" : undefined}>{branding.companyName}</span>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-16 border-t border-border bg-surface/70">
        <div className="mx-auto max-w-2xl space-y-2 px-5 py-6 text-center text-xs text-muted">
          {branding.footerText ? <p className="whitespace-pre-line">{branding.footerText}</p> : null}
          <p className="space-x-4">
            <Link href="/mentions-legales" className="underline underline-offset-4">Mentions légales</Link>
            <Link href="/confidentialite" className="underline underline-offset-4">Confidentialité</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
