import { requireAdminRoute } from "@/lib/auth";
import { entryLabel } from "@/lib/balance";
import { sanitizeForSpreadsheet, toCsv } from "@/lib/csv";
import { formatEntryDate } from "@/lib/dates";
import { readFullLedger } from "@/lib/ledger";
import { centsToCsv } from "@/lib/money";

/*
 * The ledger as a spreadsheet.
 *
 * A route handler rather than a Server Action: this returns a file, and the
 * browser has to be able to fetch it with a plain link.
 */

const HEADERS = [
  "Date",
  "Membre",
  "Licence",
  "Type",
  "Libellé",
  "Montant",
  "Enregistré par",
  "Annulée",
] as const;

const KIND_LABELS = {
  debit: "Dépense",
  credit: "Paiement",
  reminder: "Rappel",
} as const;

export async function GET(): Promise<Response> {
  /* Written for exactly this: a guard that answers in HTTP, not a redirect. */
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  const rows = await readFullLedger();

  const body = toCsv([
    [...HEADERS],
    ...rows.map((row) => [
      formatEntryDate(row.occurredOn),
      sanitizeForSpreadsheet(row.memberName),
      sanitizeForSpreadsheet(row.licenceNumber ?? ""),
      KIND_LABELS[row.kind],
      sanitizeForSpreadsheet(entryLabel(row.kind, row.note)),
      /*
       * Not sanitised: a credit is written "-8,00" and has to reach the sheet
       * as a number. The sign is what makes the column add up.
       */
      row.kind === "reminder" ? "" : centsToCsv(signedAmount(row.kind, row.amountCents)),
      sanitizeForSpreadsheet(row.recordedBy ?? ""),
      row.voidedAt ? "oui" : "",
    ]),
  ]);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename()}"`,
      /* An export is a snapshot; serving a cached one would mislead. */
      "Cache-Control": "no-store",
    },
  });
}

/** A debit adds to the debt, a credit reduces it. */
function signedAmount(kind: "debit" | "credit" | "reminder", amountCents: number): number {
  return kind === "credit" ? -amountCents : amountCents;
}

/** "grand-livre-2026-08-12.csv" — sorts correctly in a folder. */
function filename(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `grand-livre-${now.getFullYear()}-${month}-${day}.csv`;
}
