"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE, MAX_BYTES } from "@/lib/media/detect";

type Status = { name: string; state: "waiting" | "uploading" | "done" | "error"; message?: string };

const MB = 1024 * 1024;

/**
 * Envoi des fichiers un par un vers /api/admin/medias. Le serveur revérifie
 * tout (type réel, taille, droits) : les contrôles ici ne sont qu'un confort.
 */
export function MediaUploader({ profileId }: { profileId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(files: File[]) {
    setBusy(true);
    setStatuses(files.map((f) => ({ name: f.name, state: "waiting" })));
    const update = (i: number, patch: Partial<Status>) =>
      setStatuses((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

    for (const [i, file] of files.entries()) {
      update(i, { state: "uploading" });
      const body = new FormData();
      body.set("profileId", profileId);
      body.set("file", file);
      try {
        const response = await fetch("/api/admin/medias", { method: "POST", body });
        const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (response.ok && result?.ok) update(i, { state: "done" });
        else update(i, { state: "error", message: result?.error ?? "Échec de l'envoi." });
      } catch {
        update(i, { state: "error", message: "Connexion interrompue." });
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-5">
      <label htmlFor="media-files" className="block font-medium">
        Ajouter des photos, vidéos ou documents
      </label>
      <p className="mt-1 text-xs text-muted">
        Photos JPEG, PNG ou WebP (max {MAX_BYTES.image / MB} Mo) · vidéos MP4, MOV ou WebM (max{" "}
        {MAX_BYTES.video / MB} Mo) · PDF (max {MAX_BYTES.document / MB} Mo). Les photos sont
        optimisées et leurs métadonnées (position GPS…) supprimées.
      </p>
      <input
        ref={inputRef}
        id="media-files"
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        disabled={busy}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void upload(files);
        }}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
      />
      {statuses.length ? (
        <ul className="mt-4 space-y-1 text-sm" aria-live="polite">
          {statuses.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex flex-wrap justify-between gap-2">
              <span className="truncate">{s.name}</span>
              <span
                className={
                  s.state === "error" ? "text-danger" : s.state === "done" ? "text-success" : "text-muted"
                }
              >
                {s.state === "waiting" && "En attente"}
                {s.state === "uploading" && "Envoi…"}
                {s.state === "done" && "Ajouté"}
                {s.state === "error" && s.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
