import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Mentions légales" };

/** TEXTE PROVISOIRE à faire rédiger / valider avant toute mise en ligne. */
export default function LegalNoticePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 leading-relaxed">
      <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Texte provisoire, à personnaliser et à faire valider avant toute mise en ligne.
      </p>
      <h1 className="font-serif text-3xl">Mentions légales</h1>
      <h2 className="mt-8 font-medium">Éditeur du site</h2>
      <p className="mt-2 text-muted">[Raison sociale] — [forme juridique] — [adresse] — [numéro d&apos;immatriculation] — [contact].</p>
      <h2 className="mt-8 font-medium">Directeur de la publication</h2>
      <p className="mt-2 text-muted">[Nom et fonction].</p>
      <h2 className="mt-8 font-medium">Hébergement</h2>
      <p className="mt-2 text-muted">[Nom, adresse et contact de l&apos;hébergeur].</p>
      <h2 className="mt-8 font-medium">Contenus</h2>
      <p className="mt-2 text-muted">
        Les pages commémoratives sont publiées avec l&apos;accord des familles. Les messages de
        condoléances sont modérés avant publication. Pour demander la modification ou le retrait
        d&apos;un contenu : [contact].
      </p>
      <p className="mt-10"><Link href="/" className="underline underline-offset-4">Retour à l&apos;accueil</Link></p>
    </main>
  );
}
