import Link from "next/link";
import { connection } from "next/server";
import { PublicShell } from "@/components/public-shell";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";

/** Page d'accueil publique, sobre, personnalisée (Paramètres → Identité). */
export default async function HomePage() {
  await connection();
  const branding = await getBranding(await getDb());
  return (
    <PublicShell branding={branding}>
      <main className="mx-auto flex w-full max-w-2xl flex-col justify-center px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Pages commémoratives</h1>
        {branding.welcomeText ? (
          <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-muted">{branding.welcomeText}</p>
        ) : null}
        <p className="mt-12 text-sm text-muted">
          <Link href="/connexion" className="underline underline-offset-4 hover:text-foreground">
            Accès réservé au personnel
          </Link>
        </p>
      </main>
    </PublicShell>
  );
}
