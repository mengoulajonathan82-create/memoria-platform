"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity-log";
import { requireActor } from "@/lib/auth/dal";
import { createBackup, getBackupsRoot } from "@/lib/backup";
import { getDb } from "@/lib/db";
import { getMediaStorage } from "@/lib/media/storage";

export async function createBackupAction(): Promise<void> {
  const { actor } = await requireActor("backup.manage");
  const db = await getDb();
  let ok = true;
  try {
    const info = await createBackup({
      client: db.$client,
      storageRoot: getMediaStorage().root,
      backupsRoot: getBackupsRoot(),
    });
    await logActivity(db, {
      userId: actor.userId,
      action: "backup.create",
      entityType: "backup",
      details: { name: info.name },
      ipHash: actor.ipHash,
    });
  } catch (error) {
    console.error("[sauvegarde] échec :", error);
    ok = false;
  }
  redirect(`/admin/donnees?${ok ? "ok=sauvegarde" : "erreur=sauvegarde"}`);
}
