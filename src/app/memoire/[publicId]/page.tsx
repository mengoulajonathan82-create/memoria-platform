/**
 * Page commémorative PUBLIQUE, ouverte par le QR code.
 *
 * - Rendue à chaque requête : une dépublication prend effet immédiatement.
 * - Ne reçoit que l'objet `PublicProfile` (liste blanche, champs masqués à null) :
 *   aucune donnée privée ne peut se retrouver dans le HTML ou les métadonnées.
 * - Ordre d'affichage imposé par le cahier des charges : photo et nom, dates,
 *   biographie, cérémonie, galerie (Phase 4), condoléances et bougies (Phase 5).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { PublicShell } from "@/components/public-shell";
import { formatIsoDate } from "@/components/ui";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import { getPublicProfile, type PublicProfile } from "@/lib/profiles/public";

const lookup = cache(async (publicId: string) => getPublicProfile(await getDb(), publicId));

export async function generateMetadata(
  props: PageProps<"/memoire/[publicId]">,
): Promise<Metadata> {
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

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-center font-serif text-xl text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Memorial({ profile }: { profile: PublicProfile }) {
  const { ceremony } = profile;
  const dates = [profile.birthDate, profile.deathDate].some(Boolean);

  return (
    <article className="mx-auto max-w-2xl px-5 pt-10 sm:pt-14">
      {/* 1. Photo et nom (photo réelle : Phase 4) */}
      <header className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex size-28 items-center justify-center rounded-full border border-border bg-surface font-serif text-3xl text-muted sm:size-36"
        >
          {initials(profile.fullName)}
        </div>
        <p className="mt-6 text-sm tracking-widest text-muted uppercase">En mémoire de</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl">{profile.fullName}</h1>

        {/* 2. Dates importantes */}
        {dates ? (
          <p className="mt-3 text-lg text-muted">
            {profile.birthDate ? formatIsoDate(profile.birthDate) : "…"}
            <span aria-hidden="true"> — </span>
            <span className="sr-only"> au </span>
            {profile.deathDate ? formatIsoDate(profile.deathDate) : "…"}
          </p>
        ) : null}
      </header>

      {/* 3. Message ou biographie */}
      {profile.biography ? (
        <section className="mt-10">
          <p className="text-lg leading-relaxed whitespace-pre-line text-foreground/90">{profile.biography}</p>
        </section>
      ) : null}

      {/* 4. Informations sur la cérémonie */}
      {ceremony ? (
        <Section title="Cérémonie">
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            {ceremony.date ? (
              <p className="text-lg font-medium">
                {formatIsoDate(ceremony.date)}
                {ceremony.time ? ` à ${formatTime(ceremony.time)}` : ""}
              </p>
            ) : null}
            {ceremony.location ? <p className="mt-2">{ceremony.location}</p> : null}
            {ceremony.address ? (
              <p className="mt-1 whitespace-pre-line text-muted">{ceremony.address}</p>
            ) : null}
            {ceremony.livestreamUrl ? (
              <p className="mt-5">
                <a
                  href={ceremony.livestreamUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-block rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground"
                >
                  Suivre la cérémonie en direct
                </a>
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {profile.practicalInfo ? (
        <Section title="Informations pratiques">
          <p className="leading-relaxed whitespace-pre-line text-foreground/90">{profile.practicalInfo}</p>
        </Section>
      ) : null}

      {/* 5. Galerie de souvenirs — Phase 4 */}
      {/* 6. Messages de condoléances — Phase 5 */}
      {/* 7. Bougies numériques — Phase 5 */}
    </article>
  );
}

function Unavailable() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <h1 className="font-serif text-2xl">Cette page n&apos;est plus disponible</h1>
      <p className="mt-4 leading-relaxed text-muted">
        La page que vous recherchez n&apos;est pas accessible pour le moment. Pour toute
        question, vous pouvez vous adresser à l&apos;entreprise qui vous a remis ce QR code.
      </p>
    </main>
  );
}

export default async function MemorialPage(props: PageProps<"/memoire/[publicId]">) {
  await connection();
  const { publicId } = await props.params;
  const [result, branding] = await Promise.all([lookup(publicId), getDb().then(getBranding)]);

  if (result.kind === "not_found") notFound();

  return (
    <PublicShell branding={branding}>
      {result.kind === "published" ? (
        <main>
          <Memorial profile={result.profile} />
        </main>
      ) : (
        <Unavailable />
      )}
    </PublicShell>
  );
}
