/**
 * Thèmes des pages commémoratives publiques (choisis par l'administrateur :
 * thème par défaut dans Paramètres, et éventuellement un thème par fiche).
 *
 * Chaque palette a été choisie pour un contexte de recueillement : tons doux,
 * contrastes suffisants (texte et boutons ≥ 4,5:1, vérifiés par les tests).
 * Les valeurs ne viennent JAMAIS d'une saisie libre : seul l'identifiant du
 * thème est stocké, ce qui empêche toute injection de style.
 */
import type { CSSProperties } from "react";

export interface PublicTheme {
  label: string;
  description: string;
  dark: boolean;
  colors: {
    bg: string;
    bg2: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentFg: string;
    accentSoft: string;
    glow: string;
    flame: string;
  };
}

export const PUBLIC_THEMES = {
  serenite: {
    label: "Sérénité",
    description: "Bleu ciel apaisant et blanc lumineux.",
    dark: false,
    colors: {
      bg: "#f5f8fd",
      bg2: "#e3ecf9",
      surface: "#ffffff",
      text: "#1b2a44",
      muted: "#56647d",
      border: "#dbe4f2",
      accent: "#2f5c9e",
      accentFg: "#ffffff",
      accentSoft: "#e5edf9",
      glow: "rgba(110, 150, 220, 0.35)",
      flame: "#f59e0b",
    },
  },
  lavande: {
    label: "Lavande",
    description: "Mauve doux et tendre, tout en délicatesse.",
    dark: false,
    colors: {
      bg: "#f8f6fc",
      bg2: "#ebe4f6",
      surface: "#ffffff",
      text: "#2d2540",
      muted: "#6a6280",
      border: "#e5def1",
      accent: "#6b4fa3",
      accentFg: "#ffffff",
      accentSoft: "#eee8f8",
      glow: "rgba(160, 130, 210, 0.35)",
      flame: "#f59e0b",
    },
  },
  sauge: {
    label: "Sauge",
    description: "Vert naturel et paisible, comme un jardin.",
    dark: false,
    colors: {
      bg: "#f5f8f4",
      bg2: "#e2ebdf",
      surface: "#ffffff",
      text: "#1f2d22",
      muted: "#5a6a5d",
      border: "#dbe5d8",
      accent: "#3f6b4a",
      accentFg: "#ffffff",
      accentSoft: "#e5efe4",
      glow: "rgba(120, 170, 120, 0.32)",
      flame: "#f59e0b",
    },
  },
  sable: {
    label: "Sable doré",
    description: "Beige chaleureux et touches dorées.",
    dark: false,
    colors: {
      bg: "#fbf8f2",
      bg2: "#f1e6d2",
      surface: "#ffffff",
      text: "#33281b",
      muted: "#6e604d",
      border: "#ecdfc9",
      accent: "#8a5a1c",
      accentFg: "#ffffff",
      accentSoft: "#f6ecda",
      glow: "rgba(220, 170, 90, 0.35)",
      flame: "#f59e0b",
    },
  },
  rose: {
    label: "Rose poudré",
    description: "Rose léger et chaleur réconfortante.",
    dark: false,
    colors: {
      bg: "#fcf7f7",
      bg2: "#f5e3e3",
      surface: "#ffffff",
      text: "#3a2427",
      muted: "#735b5f",
      border: "#f0dfe0",
      accent: "#9b4553",
      accentFg: "#ffffff",
      accentSoft: "#f8e8ea",
      glow: "rgba(220, 140, 150, 0.32)",
      flame: "#f59e0b",
    },
  },
  ardoise: {
    label: "Ardoise",
    description: "Gris élégant et intemporel, très sobre.",
    dark: false,
    colors: {
      bg: "#f6f7f8",
      bg2: "#e4e7eb",
      surface: "#ffffff",
      text: "#1f2429",
      muted: "#5c646d",
      border: "#dfe3e8",
      accent: "#3d4955",
      accentFg: "#ffffff",
      accentSoft: "#e9ecef",
      glow: "rgba(140, 150, 165, 0.32)",
      flame: "#f59e0b",
    },
  },
  nuit: {
    label: "Nuit étoilée",
    description: "Bleu nuit profond et lueurs dorées.",
    dark: true,
    colors: {
      bg: "#0d1526",
      bg2: "#172644",
      surface: "#15203a",
      text: "#eef2fa",
      muted: "#a6b2c9",
      border: "#26365a",
      accent: "#e7b860",
      accentFg: "#1a1405",
      accentSoft: "#23314f",
      glow: "rgba(231, 184, 96, 0.28)",
      flame: "#fbbf24",
    },
  },
} as const satisfies Record<string, PublicTheme>;

export type PublicThemeId = keyof typeof PUBLIC_THEMES;
export const PUBLIC_THEME_IDS = Object.keys(PUBLIC_THEMES) as [PublicThemeId, ...PublicThemeId[]];
export const DEFAULT_PUBLIC_THEME: PublicThemeId = "serenite";

export function isPublicThemeId(value: unknown): value is PublicThemeId {
  // Object.hasOwn : « constructor », « __proto__ »… ne sont pas des thèmes.
  return typeof value === "string" && Object.hasOwn(PUBLIC_THEMES, value);
}

/** Thème effectif : celui de la fiche, sinon celui des paramètres, sinon le défaut. */
export function resolveTheme(profileTheme: string | null | undefined, defaultTheme: string | null | undefined): PublicThemeId {
  if (isPublicThemeId(profileTheme)) return profileTheme;
  if (isPublicThemeId(defaultTheme)) return defaultTheme;
  return DEFAULT_PUBLIC_THEME;
}

/** Variables CSS (--pt-*) à appliquer sur le conteneur de la page publique. */
export function themeStyle(id: PublicThemeId): CSSProperties {
  const c = PUBLIC_THEMES[id].colors;
  return {
    "--pt-bg": c.bg,
    "--pt-bg-2": c.bg2,
    "--pt-surface": c.surface,
    "--pt-text": c.text,
    "--pt-muted": c.muted,
    "--pt-border": c.border,
    "--pt-accent": c.accent,
    "--pt-accent-fg": c.accentFg,
    "--pt-accent-soft": c.accentSoft,
    "--pt-glow": c.glow,
    "--pt-flame": c.flame,
    colorScheme: PUBLIC_THEMES[id].dark ? "dark" : "light",
  } as CSSProperties;
}
