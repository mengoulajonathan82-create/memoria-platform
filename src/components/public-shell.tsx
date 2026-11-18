/**
 * Habillage des pages publiques : thème choisi par l'administrateur,
 * sans publicité ni pop-up, personnalisé avec le nom et le logo de l'entreprise.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Branding } from "@/lib/branding";
import { PUBLIC_THEMES, themeStyle, type PublicThemeId } from "@/lib/themes";

/**
 * Les composants communs (formulaires, boutons) utilisent les jetons
 * --primary, --surface… : on les fait pointer vers les couleurs du thème.
 */
const BRIDGE = {
  "--primary": "var(--pt-accent)",
  "--primary-strong": "var(--pt-accent)",
  "--primary-soft": "var(--pt-accent-soft)",
  "--primary-foreground": "var(--pt-accent-fg)",
  "--surface": "var(--pt-surface)",
  "--background": "var(--pt-bg)",
  "--border": "var(--pt-border)",
  "--foreground": "var(--pt-text)",
  "--muted": "var(--pt-muted)",
} as CSSProperties;

export function PublicShell({
  branding,
  theme,
  children,
}: {
  branding: Branding;
  theme: PublicThemeId;
  children: ReactNode;
}) {
  return (
    <div
      style={{ ...themeStyle(theme), ...BRIDGE }}
      className="relative flex min-h-dvh flex-1 flex-col overflow-x-clip bg-pt-bg text-pt-text"
    >
      {/* Fond de page aux couleurs du thème (visible lors du rebond de défilement sur mobile).
          Valeur issue du catalogue de thèmes, jamais d'une saisie. */}
      <style>{`html,body{background:${PUBLIC_THEMES[theme].colors.bg}}`}</style>
      {/* Lueurs d'ambiance, très discrètes. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[46rem] bg-gradient-to-b from-pt-bg-2 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 size-96 animate-float rounded-full opacity-70 blur-3xl" style={{ background: "var(--pt-accent-soft)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute top-48 -right-48 size-[26rem] animate-float rounded-full opacity-50 blur-3xl [animation-delay:-7s]" style={{ background: "var(--pt-accent-soft)" }} />
      {PUBLIC_THEMES[theme].dark ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] animate-fade-in opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20px 30px, #fff8, transparent), radial-gradient(1px 1px at 90px 120px, #fff6, transparent), radial-gradient(1.5px 1.5px at 160px 60px, #ffe8b0aa, transparent), radial-gradient(1px 1px at 230px 170px, #fff5, transparent), radial-gradient(1px 1px at 300px 90px, #fff7, transparent)",
            backgroundSize: "320px 220px",
          }}
        />
      ) : null}

      <header className="relative z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-5 py-5">
          {branding.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi par une route dédiée
            <img src="/logo" alt={branding.companyName} className="max-h-11 w-auto animate-fade-in" />
          ) : (
            <span className="animate-fade-in text-xs font-medium tracking-[0.25em] text-pt-muted uppercase">
              {branding.companyName}
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 flex-1">{children}</div>

      <footer className="relative z-10 mt-20 border-t border-pt-border bg-pt-surface/60 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-3 px-5 py-8 text-center text-sm text-pt-muted">
          <p className="font-serif text-lg text-pt-text">{branding.companyName}</p>
          {branding.footerText ? <p className="whitespace-pre-line">{branding.footerText}</p> : null}
          <p className="space-x-5 text-xs">
            <Link href="/mentions-legales" className="underline-offset-4 hover:underline">Mentions légales</Link>
            <Link href="/confidentialite" className="underline-offset-4 hover:underline">Confidentialité</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
