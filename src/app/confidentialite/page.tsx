import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/** TEXTE PROVISOIRE à faire rédiger / valider avant toute mise en ligne. */
export default function PrivacyPage() {
  const sections: { title: string; body: string }[] = [
    {
      title: "Données collectées",
      body:
        "Sur les pages commémoratives : les informations publiées avec l'accord de la famille. " +
        "Lorsque vous déposez un message ou allumez une bougie : le nom ou prénom indiqué, le message " +
        "et, si vous les fournissez, vos coordonnées (jamais affichées publiquement). Données techniques : " +
        "une empreinte non réversible de votre adresse IP, utilisée uniquement contre les abus.",
    },
    {
      title: "Finalités",
      body:
        "Permettre l'hommage au défunt, la modération des messages, la prévention des abus et la sécurité du service. " +
        "Aucune publicité, aucun traceur publicitaire, aucune revente de données.",
    },
    {
      title: "Durée de conservation",
      body: "[À définir : durée de conservation des pages, des messages et des données techniques.]",
    },
    {
      title: "Vos droits",
      body:
        "Vous pouvez demander l'accès, la rectification ou la suppression de vos données, ainsi que le retrait " +
        "d'un message : [contact]. Vous pouvez aussi saisir l'autorité de protection des données compétente.",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 leading-relaxed">
      <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Texte provisoire, à personnaliser et à faire valider avant toute mise en ligne.
      </p>
      <h1 className="font-serif text-3xl">Politique de confidentialité</h1>
      <p className="mt-4 text-muted">Responsable du traitement : [raison sociale, adresse, contact].</p>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="mt-8 font-medium">{s.title}</h2>
          <p className="mt-2 text-muted">{s.body}</p>
        </section>
      ))}
      <p className="mt-10"><Link href="/" className="underline underline-offset-4">Retour à l&apos;accueil</Link></p>
    </main>
  );
}
