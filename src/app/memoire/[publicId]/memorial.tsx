/* eslint-disable @next/next/no-img-element -- images servies par une route contrôlée, déjà optimisées par sharp */
/**
 * Contenu d'une page commémorative. Ne reçoit que l'objet `PublicProfile`
 * (liste blanche) : aucune donnée privée ne peut s'y retrouver.
 * Utilisé par la page publique et par l'aperçu de thème des administrateurs
 * (dans ce cas `formToken` est null et les formulaires sont désactivés).
 */
import {
  BookOpen,
  CalendarDays,
  Clock,
  Flame,
  Images,
  Info,
  MapPin,
  MessageSquareHeart,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { formatIsoDate } from "@/components/ui";
import type { PublicProfile } from "@/lib/profiles/public";
import { submitCandleAction, submitCondolenceAction } from "./actions";
import { Gallery } from "./gallery";
import { CandleForm, CondolenceForm } from "./tribute-forms";

const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

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

function years(birth: string | null, death: string | null): string | null {
  if (!birth || !death) return null;
  const [by, bm, bd] = birth.split("-").map(Number);
  const [dy, dm, dd] = death.split("-").map(Number);
  let age = dy! - by!;
  if (dm! < bm! || (dm === bm && dd! < bd!)) age -= 1;
  return age >= 0 ? `${age} an${age > 1 ? "s" : ""}` : null;
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Reveal as="section" className="scroll-mt-20 pt-16">
      <div id={id} className="mb-6 flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pt-accent-soft text-pt-accent shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-serif text-3xl font-semibold text-pt-text">{title}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-pt-border to-transparent" />
      </div>
      {children}
    </Reveal>
  );
}

function Candle({ delay = 0 }: { delay?: number }) {
  return (
    <span className="candle block" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}>
      <span className="halo" style={{ animationDelay: `${-delay}ms` }} />
      <span className="flame" style={{ animationDelay: `${-delay * 1.7}ms` }} />
    </span>
  );
}

export function Memorial({
  profile,
  publicId,
  formToken,
}: {
  profile: PublicProfile;
  publicId: string;
  /** null = aperçu : formulaires désactivés. */
  formToken: string | null;
}) {
  const { ceremony } = profile;
  const age = years(profile.birthDate, profile.deathDate);
  const hasDates = Boolean(profile.birthDate || profile.deathDate);

  const nav = [
    profile.biography && { href: "#hommage", label: "Hommage" },
    ceremony && { href: "#ceremonie", label: "Cérémonie" },
    profile.gallery.length > 0 && { href: "#souvenirs", label: "Souvenirs" },
    profile.condolences && { href: "#messages", label: "Messages" },
    profile.candles && { href: "#bougies", label: "Bougies" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <article className="mx-auto max-w-3xl px-5">
      {/* 1-2. Photo, nom et dates */}
      <header className="pt-6 pb-4 text-center sm:pt-10">
        <div className="relative mx-auto w-fit animate-scale-in">
          <div aria-hidden="true" className="absolute inset-0 -m-6 animate-glow rounded-full blur-2xl" style={{ background: "var(--pt-glow)" }} />
          {profile.mainPhoto ? (
            <img
              src={profile.mainPhoto.url}
              alt={`Portrait de ${profile.fullName}`}
              width={profile.mainPhoto.width ?? undefined}
              height={profile.mainPhoto.height ?? undefined}
              className="relative size-44 rounded-full border-4 border-pt-surface object-cover shadow-2xl sm:size-56"
            />
          ) : (
            <div
              aria-hidden="true"
              className="relative flex size-36 items-center justify-center rounded-full border-4 border-pt-surface bg-pt-accent-soft font-serif text-5xl text-pt-accent shadow-2xl sm:size-44"
            >
              {initials(profile.fullName)}
            </div>
          )}
        </div>

        <p className="mt-8 animate-fade-up text-xs font-medium tracking-[0.3em] text-pt-muted uppercase [animation-delay:0.15s]">
          En mémoire de
        </p>
        <h1 className="mt-3 animate-fade-up font-serif text-4xl leading-tight font-semibold text-balance text-pt-text [animation-delay:0.25s] sm:text-6xl">
          {profile.fullName}
        </h1>
        {hasDates ? (
          <p className="mt-4 flex animate-fade-up items-center justify-center gap-3 text-lg text-pt-muted [animation-delay:0.35s]">
            <span>{profile.birthDate ? formatIsoDate(profile.birthDate) : "…"}</span>
            <span aria-hidden="true" className="text-pt-accent">✦</span>
            <span className="sr-only"> au </span>
            <span>{profile.deathDate ? formatIsoDate(profile.deathDate) : "…"}</span>
          </p>
        ) : null}
        {age ? <p className="mt-1 animate-fade-up text-sm text-pt-muted [animation-delay:0.4s]">{age}</p> : null}

        {nav.length > 1 ? (
          <nav aria-label="Sections de la page" className="mt-8 flex animate-fade-up flex-wrap justify-center gap-2 [animation-delay:0.5s]">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-pt-border bg-pt-surface/80 px-4 py-1.5 text-sm text-pt-muted shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-pt-accent hover:text-pt-accent"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {/* 3. Message ou biographie */}
      {profile.biography ? (
        <Reveal as="section" className="scroll-mt-20 pt-12">
          <div id="hommage" className="relative rounded-3xl border border-pt-border bg-pt-surface/85 p-7 shadow-sm backdrop-blur sm:p-10">
            <span aria-hidden="true" className="absolute -top-6 left-8 font-serif text-8xl leading-none text-pt-accent/25">“</span>
            <div className="relative flex items-center gap-2 text-sm font-medium text-pt-accent">
              <BookOpen className="size-4" aria-hidden="true" /> Hommage
            </div>
            <p className="relative mt-4 font-serif text-xl leading-relaxed whitespace-pre-line text-pt-text sm:text-2xl">
              {profile.biography}
            </p>
          </div>
        </Reveal>
      ) : null}

      {/* 4. Informations sur la cérémonie */}
      {ceremony ? (
        <Section id="ceremonie" title="Cérémonie" icon={CalendarDays}>
          <div className="overflow-hidden rounded-3xl border border-pt-border bg-pt-surface shadow-sm">
            <ul className="divide-y divide-pt-border">
              {ceremony.date ? (
                <li className="flex items-center gap-4 px-6 py-4">
                  <CalendarDays className="size-5 shrink-0 text-pt-accent" aria-hidden="true" />
                  <span className="text-lg font-medium first-letter:uppercase">{formatIsoDate(ceremony.date)}</span>
                </li>
              ) : null}
              {ceremony.time ? (
                <li className="flex items-center gap-4 px-6 py-4">
                  <Clock className="size-5 shrink-0 text-pt-accent" aria-hidden="true" />
                  <span className="text-lg">{formatTime(ceremony.time)}</span>
                </li>
              ) : null}
              {ceremony.location || ceremony.address ? (
                <li className="flex items-start gap-4 px-6 py-4">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-pt-accent" aria-hidden="true" />
                  <span>
                    {ceremony.location ? <span className="block text-lg font-medium">{ceremony.location}</span> : null}
                    {ceremony.address ? <span className="block whitespace-pre-line text-pt-muted">{ceremony.address}</span> : null}
                  </span>
                </li>
              ) : null}
            </ul>
            {ceremony.livestreamUrl ? (
              <div className="border-t border-pt-border bg-pt-accent-soft/60 px-6 py-4">
                <a
                  href={ceremony.livestreamUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 rounded-xl bg-pt-accent px-5 py-2.5 font-medium text-pt-accent-fg shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Video className="size-4" aria-hidden="true" /> Suivre la cérémonie en direct
                </a>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {profile.practicalInfo ? (
        <Section id="informations" title="Informations pratiques" icon={Info}>
          <p className="rounded-3xl border border-pt-border bg-pt-surface p-6 leading-relaxed whitespace-pre-line shadow-sm">
            {profile.practicalInfo}
          </p>
        </Section>
      ) : null}

      {/* 5. Galerie de souvenirs */}
      {profile.gallery.length ? (
        <Section id="souvenirs" title="Souvenirs" icon={Images}>
          <Gallery items={profile.gallery} name={profile.fullName} />
        </Section>
      ) : null}

      {/* 6. Messages de condoléances */}
      {profile.condolences ? (
        <Section id="messages" title="Messages de condoléances" icon={MessageSquareHeart}>
          {profile.condolences.length ? (
            <ul className="space-y-4">
              {profile.condolences.map((c, i) => (
                <Reveal as="li" key={i} delay={Math.min(i, 5) * 80}>
                  <figure className="rounded-3xl border border-pt-border bg-pt-surface p-6 shadow-sm transition duration-300 hover:shadow-md">
                    <blockquote className="leading-relaxed whitespace-pre-line text-pt-text">{c.message}</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3 text-sm">
                      <span className="flex size-9 items-center justify-center rounded-full bg-pt-accent-soft font-semibold text-pt-accent">
                        {initials(c.authorName)}
                      </span>
                      <span>
                        <span className="block font-medium">{c.authorName}</span>
                        <span className="text-xs text-pt-muted">{longDate.format(c.createdAt)}</span>
                      </span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl border border-dashed border-pt-border px-6 py-8 text-center text-pt-muted">
              Soyez le premier à laisser un message.
            </p>
          )}
          <div className="mt-6 rounded-3xl border border-pt-border bg-pt-surface p-6 shadow-sm sm:p-8">
            <h3 className="font-serif text-2xl font-semibold">Laisser un message</h3>
            <p className="mt-1 mb-5 text-sm text-pt-muted">Les messages sont relus avant d&apos;être publiés.</p>
            {formToken ? (
              <CondolenceForm action={submitCondolenceAction.bind(null, publicId)} formToken={formToken} />
            ) : (
              <p className="text-sm text-pt-muted italic">Formulaire désactivé dans l&apos;aperçu.</p>
            )}
          </div>
        </Section>
      ) : null}

      {/* 7. Bougies numériques */}
      {profile.candles ? (
        <Section id="bougies" title="Bougies" icon={Flame}>
          <div className="relative overflow-hidden rounded-3xl border border-pt-border bg-gradient-to-b from-pt-surface to-pt-bg-2 p-6 text-center shadow-sm sm:p-8">
            <p className="text-lg">
              {profile.candles.count === 0 ? (
                "Aucune bougie allumée pour le moment."
              ) : (
                <>
                  <span className="font-serif text-4xl font-semibold text-pt-accent">{profile.candles.count}</span>{" "}
                  bougie{profile.candles.count > 1 ? "s" : ""} allumée{profile.candles.count > 1 ? "s" : ""}
                </>
              )}
            </p>
            {profile.candles.recent.length ? (
              <ul className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4">
                {profile.candles.recent.map((c, i) => (
                  <Reveal as="li" key={i} delay={Math.min(i, 8) * 60} className="flex flex-col items-center">
                    <div className="h-16">
                      <Candle delay={i * 230} />
                    </div>
                    <span className="mt-2 text-sm font-medium">{c.firstName ?? "Une pensée"}</span>
                    {c.message ? <span className="mt-0.5 line-clamp-3 text-xs text-pt-muted">{c.message}</span> : null}
                  </Reveal>
                ))}
              </ul>
            ) : (
              <div className="mt-6 h-16 opacity-60">
                <Candle />
              </div>
            )}
            <div className="mx-auto mt-8 max-w-lg rounded-2xl bg-pt-surface/80 p-5 text-left shadow-sm backdrop-blur">
              {formToken ? (
                <CandleForm action={submitCandleAction.bind(null, publicId)} formToken={formToken} />
              ) : (
                <p className="text-center text-sm text-pt-muted italic">Formulaire désactivé dans l&apos;aperçu.</p>
              )}
            </div>
          </div>
        </Section>
      ) : null}
    </article>
  );
}
