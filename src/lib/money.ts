/*
 * Money handling.
 *
 * RULE: an amount is ALWAYS an integer number of cents, both in code and in
 * the database. 3.30 EUR is written as 330. This file is the only place
 * allowed to convert to or from a decimal representation.
 *
 * Why: binary floating point cannot represent 0.10 exactly (much like 1/3 in
 * base 10). The error accumulates across successive additions, so a member who
 * settles up to the cent ends with a balance of 0.000000000000003 EUR — an
 * account that never reads as "settled".
 */

/** Maximum amount accepted from a form: 10 000 EUR. Beyond that it is a typo. */
export const MAX_AMOUNT_CENTS = 1_000_000;

/**
 * Non-breaking space (U+00A0). French typography never leaves the euro sign
 * stranded at the start of a line, separated from its amount.
 */
const NON_BREAKING_SPACE = String.fromCharCode(0x00a0);

/** Typographic minus sign (U+2212), more legible than a hyphen. */
const MINUS_SIGN = String.fromCharCode(0x2212);

/**
 * Formats an amount for display: 1250 -> "12,50 €".
 * Always two decimals, French decimal comma.
 */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? MINUS_SIGN : "";
  const absolute = Math.abs(Math.trunc(cents));
  const euros = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}${euros},${String(remainder).padStart(2, "0")}${NON_BREAKING_SPACE}€`;
}

/**
 * Formats without the sign, for when the surrounding copy already carries it
 * ("Avoir 12,50 €", or a line prefixed with an explicit + / −).
 */
export function formatMoneyAbsolute(cents: number): string {
  return formatMoney(Math.abs(cents));
}

/**
 * Parses a hand-typed amount. Accepts comma or dot, stray spaces and a stray
 * euro sign: people type fast behind the bar, on a phone, sometimes with a
 * keyboard that forces a dot.
 *
 * Returns null when the input is not a usable amount.
 */
export function parseMoney(input: string): number | null {
  if (typeof input !== "string") return null;

  const cleaned = input.replace(/\s/g, "").replace(/ /g, "").replace(/€/g, "").replace(",", ".");

  if (cleaned === "") return null;
  /* An amount is digits and at most two decimals. Nothing else. */
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [wholePart, decimalPart = ""] = cleaned.split(".");
  const cents = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) return null;
  if (cents > MAX_AMOUNT_CENTS) return null;

  return cents;
}

/**
 * Value for an <input type="number">: 1250 -> "12.50".
 * The dot is mandated by the HTML specification, regardless of locale.
 */
export function centsToInputValue(cents: number): string {
  return (Math.trunc(cents) / 100).toFixed(2);
}

/** Bare amount for a CSV export: 1250 -> "12,50" (no symbol, French comma). */
export function centsToCsv(cents: number): string {
  const absolute = Math.abs(Math.trunc(cents));
  const sign = cents < 0 ? "-" : "";
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}
