"use client";
/* eslint-disable @next/next/no-img-element -- images servies par une route contrôlée, déjà optimisées */

/**
 * Galerie de souvenirs : grille animée + visionneuse plein écran
 * (flèches, clavier, glissement du doigt, fermeture par Échap).
 */
import { ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicMediaItem } from "@/lib/profiles/public";

export function Gallery({ items, name }: { items: PublicMediaItem[]; name: string }) {
  const images = items.filter((i) => i.type === "image");
  const others = items.filter((i) => i.type !== "image");
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close, move]);

  const current = open === null ? null : images[open];

  return (
    <div className="space-y-6">
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((item, i) => (
            <li key={item.url} className={i === 0 && images.length > 2 ? "col-span-2 row-span-2" : ""}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-pt-border bg-pt-surface shadow-sm transition-shadow duration-300 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-pt-accent/40"
                aria-label={`Agrandir : ${item.caption ?? `souvenir de ${name}`}`}
              >
                <img
                  src={item.thumbUrl ?? item.url}
                  alt={item.caption ?? `Souvenir de ${name}`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                {item.caption ? (
                  <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2.5 text-left text-xs text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
                    {item.caption}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {others.map((item) =>
        item.type === "video" ? (
          <figure key={item.url} className="overflow-hidden rounded-2xl border border-pt-border bg-black shadow-sm">
            <video controls preload="metadata" playsInline className="w-full">
              <source src={item.url} type={item.mimeType} />
            </video>
            {item.caption ? <figcaption className="bg-pt-surface px-4 py-2.5 text-sm text-pt-muted">{item.caption}</figcaption> : null}
          </figure>
        ) : (
          <a
            key={item.url}
            href={item.url}
            className="flex items-center gap-3 rounded-2xl border border-pt-border bg-pt-surface px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-pt-accent-soft text-pt-accent">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm">
              <span className="block font-medium">{item.caption ?? "Document"}</span>
              <span className="text-pt-muted">Télécharger (PDF)</span>
            </span>
          </a>
        ),
      )}

      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.caption ?? `Souvenir de ${name}`}
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={close}
          onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0]!.clientX - touchX.current;
            if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <figure className="max-h-full max-w-5xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <img src={current.url} alt={current.caption ?? `Souvenir de ${name}`} className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl" />
            <figcaption className="mt-3 text-center text-sm text-white/85">
              {current.caption}
              {images.length > 1 ? <span className="ml-2 text-white/50">{open! + 1} / {images.length}</span> : null}
            </figcaption>
          </figure>
          <button type="button" onClick={close} className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label="Fermer">
            <X className="size-6" aria-hidden="true" />
          </button>
          {images.length > 1 ? (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); move(-1); }} className="absolute left-3 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20" aria-label="Photo précédente">
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); move(1); }} className="absolute right-3 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20" aria-label="Photo suivante">
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
