import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Page introuvable</h1>
      <p className="mt-4 leading-relaxed text-muted">
        La page que vous cherchez n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <p className="mt-8">
        <Link href="/" className="underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
