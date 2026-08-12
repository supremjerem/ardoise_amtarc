/*
 * Dates, as the members read them.
 *
 * A ledger entry carries a business DATE, not an instant: "11 août 2026" is
 * the day the beer was drunk, everywhere on earth. The database column is
 * `date`, which Drizzle hands over as "2026-08-11".
 *
 * That string must never go through `new Date("2026-08-11")`: the language
 * reads a bare date as UTC midnight, so anyone west of Greenwich would see the
 * previous day. The parts are read explicitly and rebuilt in local time.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formats a business date for display: "2026-08-11" -> "11 août 2026". */
export function formatEntryDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  /* Rather show the raw value than a wrong or absent date. */
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
