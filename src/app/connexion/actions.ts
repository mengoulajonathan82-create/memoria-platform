"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity-log";
import { getRequestMeta, setSessionCookie } from "@/lib/auth/dal";
import { authenticate } from "@/lib/auth/login-service";
import { createSession } from "@/lib/auth/session-service";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { loginSchema } from "@/lib/validation/auth";

export interface LoginState {
  error?: string;
  email?: string;
}

const GENERIC_ERROR = "Adresse e-mail ou mot de passe incorrect.";
const THROTTLED_ERROR =
  "Trop de tentatives de connexion. Veuillez patienter 15 minutes avant de réessayer.";

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "").slice(0, 254);
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    // Message générique : ne pas indiquer quel champ est en cause.
    return { error: GENERIC_ERROR, email: rawEmail };
  }

  const db = await getDb();
  const env = getServerEnv();
  const { ipHash, userAgent } = await getRequestMeta();

  const result = await authenticate(db, {
    email: parsed.data.email,
    password: parsed.data.password,
    ipHash,
  });

  if (!result.ok) {
    await logActivity(db, {
      userId: null,
      action: "auth.login_failed",
      details: { reason: result.reason },
      ipHash,
    });
    return {
      error: result.reason === "throttled" ? THROTTLED_ERROR : GENERIC_ERROR,
      email: parsed.data.email,
    };
  }

  const { token, expiresAt } = await createSession(db, result.user.id, {
    ttlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    ipHash,
    userAgent,
  });
  await setSessionCookie(token, expiresAt);
  await logActivity(db, {
    userId: result.user.id,
    action: "auth.login",
    entityType: "user",
    entityId: result.user.id,
    ipHash,
  });

  redirect("/admin");
}
