"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity-log";
import {
  clearSessionCookie,
  getCurrentUser,
  getRequestMeta,
  readSessionCookie,
} from "@/lib/auth/dal";
import { revokeSession } from "@/lib/auth/session-service";
import { getDb } from "@/lib/db";

export async function logoutAction(): Promise<void> {
  const db = await getDb();
  const user = await getCurrentUser();
  const token = await readSessionCookie();
  if (token) await revokeSession(db, token);
  await clearSessionCookie();
  if (user) {
    const { ipHash } = await getRequestMeta();
    await logActivity(db, {
      userId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
      ipHash,
    });
  }
  redirect("/connexion");
}
