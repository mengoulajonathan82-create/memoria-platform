"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { deleteTribute, moderateTribute } from "@/lib/tributes/service";
import { TRIBUTE_KINDS, type TributeKind } from "@/lib/validation/tribute";

const kindSchema = z.enum(TRIBUTE_KINDS);
const targetSchema = z.enum(["approved", "rejected", "hidden"]);
const idSchema = z.uuid();

/** N'accepte qu'un retour vers la file de modération (pas de redirection ouverte). */
function safeReturn(returnTo: string, flag: string): string {
  const base = /^\/admin\/moderation(\?[\w=&%-]*)?$/.test(returnTo) ? returnTo : "/admin/moderation";
  const url = new URL(base, "http://local");
  url.searchParams.delete("ok");
  url.searchParams.delete("erreur");
  const [k, v] = flag.split("=");
  url.searchParams.set(k!, v!);
  return `${url.pathname}${url.search}`;
}

export async function moderateAction(
  kind: TributeKind,
  id: string,
  to: "approved" | "rejected" | "hidden",
  returnTo: string,
): Promise<void> {
  const { actor } = await requireActor("moderation.manage");
  const k = kindSchema.safeParse(kind);
  const t = targetSchema.safeParse(to);
  if (!k.success || !t.success || !idSchema.safeParse(id).success) {
    redirect(safeReturn(returnTo, "erreur=introuvable"));
  }
  const ok = await moderateTribute(await getDb(), k.data, id, t.data, actor);
  revalidatePath("/admin", "layout"); // met à jour le compteur du menu
  redirect(safeReturn(returnTo, ok ? "ok=modere" : "erreur=introuvable"));
}

export async function deleteTributeAction(kind: TributeKind, id: string, returnTo: string): Promise<void> {
  const { actor } = await requireActor("moderation.manage");
  const k = kindSchema.safeParse(kind);
  if (!k.success || !idSchema.safeParse(id).success) redirect(safeReturn(returnTo, "erreur=introuvable"));
  const ok = await deleteTribute(await getDb(), k.data, id, actor);
  revalidatePath("/admin", "layout");
  redirect(safeReturn(returnTo, ok ? "ok=supprime" : "erreur=introuvable"));
}
