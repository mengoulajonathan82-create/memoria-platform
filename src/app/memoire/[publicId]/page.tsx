/**
 * Page commémorative PUBLIQUE, ouverte par le QR code.
 *
 * - Rendue à chaque requête : une dépublication prend effet immédiatement.
 * - Ne reçoit que l'objet `PublicProfile` (liste blanche, champs masqués à null) :
 *   aucune donnée privée ne peut se retrouver dans le HTML ou les métadonnées.
 * - Thème : celui de la fiche, sinon celui choisi dans les paramètres.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { Flower2 } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getPublicProfile } from "@/lib/profiles/public";
import { resolveTheme } from "@/lib/themes";
import { createFormToken } from "@/lib/tributes/spam";
import { Memorial } from "./memorial";

const lookup = cache(async (publicId: string) => getPublicProfile(await getDb(), publicId));

export async function generateMetadata(props: PageProps<"/memoire/[publicId]">): Promise<Metadata> {
  await connection();
  const { publicId } = await props.params;
  const result = await lookup(publicId);
  return {
    title: result.kind === "published" ? `En mémoire de ${result.profile.fullName}` : "Page non disponible",
    description: "Page commémorative",
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

function Unavailable() {
  return (
    <main className="mx-auto flex max-w-xl animate-fade-up flex-col items-center px-6 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-pt-accent-soft text-pt-accent">
        <Flower2 className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-serif text-3xl font-semibold">Cette page n&apos;est plus disponible</h1>
      <p className="mt-4 leading-relaxed text-pt-muted">
        La page que vous recherchez n&apos;est pas accessible pour le moment. Pour toute question, vous
        pouvez vous adresser à l&apos;entreprise qui vous a remis ce QR code.
      </p>
    </main>
  );
}

export default async function MemorialPage(props: PageProps<"/memoire/[publicId]">) {
  await connection();
  const { publicId } = await props.params;
  const [result, branding] = await Promise.all([lookup(publicId), getDb().then(getBranding)]);

  if (result.kind === "not_found") notFound();

  const theme = resolveTheme(result.kind === "published" ? result.profile.theme : null, branding.publicTheme);

  return (
    <PublicShell branding={branding} theme={theme}>
      {result.kind === "published" ? (
        <main>
          <Memorial
            profile={result.profile}
            publicId={publicId}
            formToken={createFormToken(getServerEnv().IP_HASH_SECRET, publicId)}
          />
        </main>
      ) : (
        <Unavailable />
      )}
    </PublicShell>
  );
}
