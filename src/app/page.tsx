import Link from "next/link";
import { connection } from "next/server";
import { QrCode } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";

/** Page d'accueil publique, personnalisée (Paramètres → Identité et thème). */
export default async function HomePage() {
  await connection();
  const branding = await getBranding(await getDb());
  return (
    <PublicShell branding={branding} theme={branding.publicTheme}>
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-16 text-center sm:py-24">
        <div className="relative animate-scale-in">
          <div aria-hidden="true" className="absolute inset-0 -m-5 animate-glow rounded-full blur-2xl" style={{ background: "var(--pt-glow)" }} />
          <span className="relative flex size-20 items-center justify-center rounded-3xl border border-pt-border bg-pt-surface text-pt-accent shadow-xl">
            <QrCode className="size-9" aria-hidden="true" />
          </span>
        </div>
        <h1 className="mt-10 animate-fade-up font-serif text-4xl font-semibold text-pt-text [animation-delay:0.1s] sm:text-5xl">
          Pages commémoratives
        </h1>
        {branding.welcomeText ? (
          <p className="mt-5 animate-fade-up text-lg leading-relaxed whitespace-pre-line text-pt-muted [animation-delay:0.2s]">
            {branding.welcomeText}
          </p>
        ) : null}
        <ol className="mt-12 grid w-full animate-fade-up gap-3 text-left [animation-delay:0.3s] sm:grid-cols-3">
          {["Ouvrez l'appareil photo de votre téléphone", "Visez le QR code qui vous a été remis", "Touchez le lien qui apparaît"].map(
            (step, i) => (
              <li key={step} className="flex items-center gap-3 rounded-2xl border border-pt-border bg-pt-surface/80 p-4 text-sm shadow-sm backdrop-blur sm:flex-col sm:text-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pt-accent font-semibold text-pt-accent-fg">
                  {i + 1}
                </span>
                {step}
              </li>
            ),
          )}
        </ol>
        <p className="mt-14 text-sm text-pt-muted">
          <Link href="/connexion" className="underline-offset-4 transition hover:text-pt-accent hover:underline">
            Accès réservé au personnel
          </Link>
        </p>
      </main>
    </PublicShell>
  );
}
