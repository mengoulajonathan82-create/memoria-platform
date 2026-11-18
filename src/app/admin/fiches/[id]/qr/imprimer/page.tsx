import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/print-button";
import { buttonClass, formatIsoDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getProfile } from "@/lib/profiles/service";
import { buildPublicUrl, generateQrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Imprimer le QR code" };

/** Carte imprimable : nom de l'entreprise, nom du défunt, QR code et adresse. */
export default async function PrintQrPage(props: PageProps<"/admin/fiches/[id]/qr/imprimer">) {
  await requirePermission("profiles.manage");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await getDb();
  const profile = await getProfile(db, id);
  if (!profile || profile.status === "deleted") notFound();

  const branding = await getBranding(db);
  const url = buildPublicUrl(getServerEnv().APP_URL, profile.publicId);
  const svg = await generateQrSvg(url);
  const showDates = profile.showDates && (profile.birthDate || profile.deathDate);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/fiches/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {profile.fullName}
        </Link>
        <div className="flex gap-2">
          <a href={`/admin/fiches/${id}/qr?format=png&download=1`} className={buttonClass.secondary}>PNG</a>
          <a href={`/admin/fiches/${id}/qr?format=svg&download=1`} className={buttonClass.secondary}>SVG</a>
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-sm rounded-xl border border-border bg-white p-8 text-center text-black print:border-0 print:p-0">
        <p className="text-xs tracking-widest uppercase">{branding.companyName}</p>
        <p className="mt-6 text-sm">En mémoire de</p>
        <p className="mt-1 font-serif text-2xl">{profile.fullName}</p>
        {showDates ? (
          <p className="mt-1 text-sm">
            {formatIsoDate(profile.birthDate)} — {formatIsoDate(profile.deathDate)}
          </p>
        ) : null}
        <div
          className="mx-auto mt-6 w-56 [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={`QR code menant à la page de ${profile.fullName}`}
          // SVG produit par la bibliothèque qrcode à partir de notre propre URL.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-4 text-sm">Scannez ce code avec votre téléphone</p>
        <p className="mt-2 text-[10px] break-all text-neutral-600">{url}</p>
      </div>
      {profile.status !== "published" ? (
        <p className="mt-6 text-center text-sm text-muted print:hidden">
          Cette fiche n&apos;est pas publiée : le QR code affichera « page non disponible » tant
          qu&apos;elle ne l&apos;est pas.
        </p>
      ) : null}
    </div>
  );
}
