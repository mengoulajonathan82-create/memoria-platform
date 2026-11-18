import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Lock, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const FEATURES = [
  { icon: QrCode, text: "Un QR code permanent pour chaque page" },
  { icon: Sparkles, text: "Des pages élégantes, adaptées au téléphone" },
  { icon: ShieldCheck, text: "Messages relus avant publication" },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");

  return (
    <main className="grid min-h-dvh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau de marque */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#172554] via-[#1d4ed8] to-[#38bdf8] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -top-24 -left-24 size-96 animate-float rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="absolute right-0 bottom-0 size-[28rem] animate-float rounded-full bg-sky-300/20 blur-3xl [animation-delay:-7s]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:28px_28px]" />

        <p className="relative font-serif text-3xl font-semibold tracking-wide">Memoria</p>
        <div className="relative max-w-md animate-fade-up">
          <h1 className="font-serif text-5xl leading-tight font-semibold">Honorer chaque mémoire avec délicatesse.</h1>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex animate-fade-up items-center gap-3 text-blue-50" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-blue-100">Espace réservé au personnel.</p>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center bg-gradient-to-b from-white to-[#eef3fc] px-6 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <p className="font-serif text-3xl font-semibold text-primary-strong">Memoria</p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-8 shadow-xl shadow-blue-900/5">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-blue-600/30">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Connexion</h2>
            <p className="mt-1 mb-6 text-sm text-muted">Connectez-vous pour gérer les pages commémoratives.</p>
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/" className="inline-flex items-center gap-1 transition hover:text-primary">
              <ChevronLeft className="size-4" aria-hidden="true" /> Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
