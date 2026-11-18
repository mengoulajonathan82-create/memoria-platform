/**
 * URL publique stable d'une fiche et génération du QR code (bibliothèque
 * open source `qrcode`, licence MIT, aucun service externe).
 *
 * Le QR code encode UNIQUEMENT l'URL publique `/memoire/<publicId>` :
 * - aucun identifiant interne ni donnée personnelle ;
 * - l'URL ne change jamais, même si le contenu de la fiche évolue.
 */
import QRCode from "qrcode";
import { isValidPublicId } from "@/lib/security/crypto";

export const PUBLIC_PROFILE_PATH = "/memoire";

/** Construit l'URL publique absolue d'une fiche à partir de APP_URL. */
export function buildPublicUrl(appUrl: string, publicId: string): string {
  if (!isValidPublicId(publicId)) throw new Error("Identifiant public invalide.");
  return new URL(`${PUBLIC_PROFILE_PATH}/${publicId}`, appUrl).toString();
}

/** APP_URL pointe-t-elle vers la machine locale (QR inutilisable depuis un téléphone) ? */
export function isLocalOnlyUrl(appUrl: string): boolean {
  const { hostname } = new URL(appUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

const QR_OPTIONS = {
  // Niveau « Q » (~25 % de redondance) : reste lisible sur un support imprimé abîmé.
  errorCorrectionLevel: "Q",
  margin: 4, // zone de silence standard
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
}

/** PNG haute définition (1024 px par défaut) adapté à l'impression. */
export function generateQrPng(url: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...QR_OPTIONS, type: "png", width });
}

/** Nom de fichier ASCII sûr à partir du nom du défunt. */
export function qrFileName(fullName: string, extension: "png" | "svg"): string {
  const slug = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `qr-${slug || "fiche"}.${extension}`;
}
