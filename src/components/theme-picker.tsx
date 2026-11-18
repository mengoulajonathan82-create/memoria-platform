"use client";

/**
 * Choix d'un thème public sous forme de cartes-aperçus (boutons radio
 * accessibles au clavier). Utilisé dans Paramètres et sur chaque fiche.
 */
import { Check } from "lucide-react";
import { PUBLIC_THEMES, PUBLIC_THEME_IDS, type PublicThemeId } from "@/lib/themes";

function ThemePreview({ id }: { id: PublicThemeId }) {
  const c = PUBLIC_THEMES[id].colors;
  return (
    <div
      aria-hidden="true"
      className="relative h-28 overflow-hidden rounded-xl"
      style={{ background: `linear-gradient(160deg, ${c.bg2}, ${c.bg} 65%)` }}
    >
      <div className="absolute -top-6 -right-6 size-20 rounded-full blur-xl" style={{ background: c.glow }} />
      <div className="relative flex h-full flex-col items-center justify-center gap-1.5">
        <span className="size-8 rounded-full border-2" style={{ borderColor: c.surface, background: c.accentSoft, boxShadow: `0 0 0 3px ${c.glow}` }} />
        <span className="font-serif text-sm font-semibold" style={{ color: c.text }}>
          Jeanne Martin
        </span>
        <span className="h-1 w-14 rounded-full" style={{ background: c.muted, opacity: 0.4 }} />
        <span className="mt-1 rounded-md px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: c.accent, color: c.accentFg }}>
          Allumer une bougie
        </span>
      </div>
    </div>
  );
}

export function ThemePicker({
  name,
  defaultValue,
  allowDefault,
  defaultLabel,
}: {
  name: string;
  defaultValue: string;
  /** Ajoute un choix « Thème par défaut » (valeur vide). */
  allowDefault?: boolean;
  defaultLabel?: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Thème de la page publique</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allowDefault ? (
          <label className="group relative cursor-pointer">
            <input type="radio" name={name} value="" defaultChecked={defaultValue === ""} className="peer sr-only" />
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-surface p-4 text-center transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/50 peer-checked:border-solid peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:shadow-lg peer-checked:shadow-blue-600/10 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
              <span className="font-semibold">Thème par défaut</span>
              <span className="text-xs text-muted">{defaultLabel ?? "Celui défini dans les paramètres"}</span>
            </div>
            <Check className="absolute top-3 right-3 hidden size-5 rounded-full bg-primary p-0.5 text-white peer-checked:block" aria-hidden="true" />
          </label>
        ) : null}
        {PUBLIC_THEME_IDS.map((id) => (
          <label key={id} className="group relative cursor-pointer">
            <input type="radio" name={name} value={id} defaultChecked={defaultValue === id} className="peer sr-only" />
            <div className="rounded-2xl border-2 border-border bg-surface p-2 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg peer-checked:border-primary peer-checked:shadow-lg peer-checked:shadow-blue-600/15 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
              <ThemePreview id={id} />
              <div className="px-1.5 pt-2.5 pb-1">
                <p className="text-sm font-semibold">{PUBLIC_THEMES[id].label}</p>
                <p className="text-xs text-muted">{PUBLIC_THEMES[id].description}</p>
              </div>
            </div>
            <Check className="absolute top-4 right-4 hidden size-6 animate-scale-in rounded-full bg-primary p-1 text-white shadow-md peer-checked:block" aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
