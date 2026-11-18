import Link from "next/link";

/** Page d'accueil publique, volontairement simple et sobre. */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        Pages commémoratives
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Pour consulter la page d&apos;un proche, scannez le QR code qui vous a
        été remis avec votre téléphone.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/connexion" className="underline underline-offset-4 hover:text-foreground">
          Accès réservé au personnel
        </Link>
      </p>
    </main>
  );
}
