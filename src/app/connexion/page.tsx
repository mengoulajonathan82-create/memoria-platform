import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-serif text-2xl">Espace professionnel</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Connectez-vous pour gérer les pages commémoratives.
        </p>
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/" className="underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
