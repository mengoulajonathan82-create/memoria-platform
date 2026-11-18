/**
 * Optimisation des images avec sharp :
 * - ré-encodage en WebP (neutralise les fichiers piégés de type « polyglotte ») ;
 * - suppression de TOUTES les métadonnées (EXIF, position GPS, appareil…) ;
 * - orientation corrigée, redimensionnement (2000 px max) et miniature (640 px) ;
 * - refus des images démesurées (« bombes de décompression »).
 */
import sharp from "sharp";

export const IMAGE_MAX_DIMENSION = 2000;
export const THUMB_MAX_DIMENSION = 640;
/** ~50 mégapixels : largement suffisant pour une photo, bloque les images piégées. */
export const MAX_INPUT_PIXELS = 50_000_000;

export interface ProcessedImage {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

export async function processImage(
  input: Buffer,
  options: { maxInputPixels?: number } = {},
): Promise<ProcessedImage> {
  const source = () =>
    sharp(input, {
      limitInputPixels: options.maxInputPixels ?? MAX_INPUT_PIXELS,
      failOn: "error",
      animated: false,
    }).rotate(); // applique l'orientation EXIF puis l'oublie

  const main = await source()
    .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await source()
    .resize({ width: THUMB_MAX_DIMENSION, height: THUMB_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return { main: main.data, thumb, width: main.info.width, height: main.info.height };
}
