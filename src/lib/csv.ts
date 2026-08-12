/*
 * CSV, as a French spreadsheet expects to receive it.
 *
 * Three decisions, none of them cosmetic:
 *
 *   1. The separator is a SEMICOLON. Amounts here are written "12,50" — the
 *      comma is the decimal separator in French, so a comma-separated file
 *      would split every amount across two columns. This is what Excel and
 *      LibreOffice assume in a French locale.
 *   2. The file opens with a byte order mark, because Excel reads a CSV as
 *      the local codepage unless one is present, and "Émilie Rousseau"
 *      arrives as "Ã‰milie" without it.
 *   3. Free text is neutralised against formula injection — see below.
 */

const SEPARATOR = ";";
/** RFC 4180 asks for CRLF, and Excel is happier with it. */
const LINE_END = "\r\n";
/** U+FEFF. Tells Excel the file is UTF-8. */
export const UTF8_BOM = "﻿";

/** Quotes a single field if it contains anything that would break the row. */
function escapeField(value: string): string {
  if (!/[";\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Defuses a value a spreadsheet would treat as a formula.
 *
 * A note typed behind the bar ends up in this file, and a cell starting with
 * =, +, - or @ is executed on open — the standard CSV injection (CWE-1236).
 * A leading apostrophe forces the cell to be read as text; the apostrophe
 * itself is not displayed.
 *
 * Apply this to free text ONLY. Amounts legitimately start with a minus sign
 * and must reach the sheet as numbers, not as quoted text.
 */
export function sanitizeForSpreadsheet(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Builds a complete CSV document, byte order mark included.
 * Every value is expected to be a string already formatted for display.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => row.map(escapeField).join(SEPARATOR)).join(LINE_END);
  return `${UTF8_BOM}${body}${LINE_END}`;
}
