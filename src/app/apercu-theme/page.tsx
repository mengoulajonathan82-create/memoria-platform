/**
 * Aperçu d'un thème sur une page commémorative FICTIVE (administrateurs).
 * Aucune donnée réelle n'est utilisée ; les formulaires sont désactivés.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Eye } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { requirePermission } from "@/lib/auth/dal";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import type { PublicProfile } from "@/lib/profiles/public";
import { isPublicThemeId, PUBLIC_THEMES, PUBLIC_THEME_IDS } from "@/lib/themes";
import { Memorial } from "../memoire/[publicId]/memorial";

export const metadata: Metadata = { title: "Aperçu des thèmes" };

const SAMPLE: PublicProfile = {
  fullName: "Jeanne Martin",
  theme: null,
  mainPhoto: null,
  gallery: [],
  birthDate: "1938-04-12",
  deathDate: "2026-11-02",
  biography:
    "Jeanne aimait son jardin, les longues promenades au bord de la mer et les après-midi en famille. " +
    "Elle laisse le souvenir d'une femme généreuse, attentive et pleine d'humour.\n\n(Exemple fictif)",
  ceremony: {
    date: "2026-11-25",
    time: "14:30",
    location: "Église Saint-Pierre",
    address: "1 place de l'Église, 00000 Ville-Exemple",
    livestreamUrl: null,
  },
  practicalInfo: "Ni fleurs ni couronnes. Des dons peuvent être faits à une association (exemple).",
  showGallery: true,
  allowCondolences: true,
  allowCandles: true,
  condolences: [
    { authorName: "Marie Durand", message: "Toutes nos pensées vous accompagnent dans ce moment difficile.", createdAt: new Date("2026-11-05T10:00:00Z") },
    { authorName: "Les voisins", message: "Nous garderons le souvenir de son sourire et de sa gentillesse.", createdAt: new Date("2026-11-04T09:00:00Z") },
  ],
  candles: {
    count: 7,
    recent: [
      { firstName: "Paul", message: null, createdAt: new Date() },
      { firstName: "Claire", message: "Je pense fort à toi", createdAt: new Date() },
      { firstName: null, message: null, createdAt: new Date() },
      { firstName: "Lucas", message: null, createdAt: new Date() },
    ],
  },
};

export default async function ThemePreviewPage(props: PageProps<"/apercu-theme">) {
  await requirePermission("settings.manage");
  await connection();
  const branding = await getBranding(await getDb());
  const requested = (await props.searchParams).theme;
  const theme = isPublicThemeId(requested) ? requested : branding.publicTheme;

  return (
    <PublicShell branding={branding} theme={theme}>
      <div className="sticky top-0 z-40 border-b border-pt-border bg-pt-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-2.5 text-sm whitespace-nowrap [scrollbar-width:none]">
          <span className="mr-2 inline-flex shrink-0 items-center gap-1.5 font-medium">
            <Eye className="size-4" aria-hidden="true" /> Aperçu (exemple fictif)
          </span>
          {PUBLIC_THEME_IDS.map((id) => (
            <Link
              key={id}
              href={`/apercu-theme?theme=${id}`}
              aria-current={id === theme ? "true" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1 transition ${
                id === theme ? "border-pt-accent bg-pt-accent text-pt-accent-fg" : "border-pt-border hover:border-pt-accent"
              }`}
            >
              {PUBLIC_THEMES[id].label}
            </Link>
          ))}
          <Link href="/admin/parametres" className="ml-auto shrink-0 pl-2 text-pt-muted underline-offset-4 hover:underline">
            Retour
          </Link>
        </div>
      </div>
      <main>
        <Memorial profile={SAMPLE} publicId="apercu" formToken={null} />
      </main>
    </PublicShell>
  );
}
