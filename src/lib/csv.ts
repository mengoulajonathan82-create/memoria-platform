/**
 * Génération de CSV compatible Excel (français) :
 * - séparateur « ; », BOM UTF-8 pour les accents, fins de ligne CRLF ;
 * - guillemets échappés ;
 * - protection contre l'injection de formules : une cellule commençant par
 *   = + - @ (ou tabulation / retour chariot) est préfixée d'une apostrophe.
 */
export type CsvValue = string | number | boolean | Date | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "boolean"
        ? value
          ? "oui"
          : "non"
        : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
