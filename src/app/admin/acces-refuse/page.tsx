import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Accès refusé" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <h1 className="font-serif text-2xl">Accès refusé</h1>
      <p className="mt-3 text-muted">
        Votre compte ne dispose pas des droits nécessaires pour accéder à cette
        page. Contactez un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
      </p>
      <p className="mt-6">
        <Link href="/admin" className="underline underline-offset-4">
          Retour au tableau de bord
        </Link>
      </p>
    </div>
  );
}
