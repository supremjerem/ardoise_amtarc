import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { entryLabel, totalOwed } from "@/lib/balance";
import { formatEntryDate } from "@/lib/dates";
import { readFullLedger } from "@/lib/ledger";
import { listMembersWithBalances } from "@/lib/members";
import { formatMoney } from "@/lib/money";
import { readSettings } from "@/lib/settings";

import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Grand livre — Caisse du club",
};

const KIND_LABELS = {
  debit: "Dépense",
  credit: "Paiement",
  reminder: "Rappel",
} as const;

/*
 * Columns size themselves to their content, so without a gutter a
 * right-aligned amount ends up touching the name in the next column —
 * "18,00 €Bernard Lefèvre". The last column keeps the table flush right.
 */
const TABLE_CLASS =
  "w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0";

/*
 * The ledger, laid out to be printed or filed.
 *
 * Deliberately plain: black on white, no cards, no colour. It is a document
 * that ends up in a binder at the annual meeting, not a screen — and the
 * treasurer should not have to spend a colour cartridge to read it.
 *
 * Voided entries are shown, struck through and marked. An accounting record
 * that hid its own corrections would not be one.
 */
export default async function Page() {
  await requireAdmin();

  const [rows, members, settings] = await Promise.all([
    readFullLedger(),
    listMembersWithBalances(),
    readSettings(),
  ]);

  const owed = totalOwed(members);
  const printedOn = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main id="contenu" className="ledger flex w-full max-w-235 flex-col px-5 pb-25">
      <header className="flex flex-wrap items-center gap-3 px-0.5 pt-6 pb-4.5 print:hidden">
        <Link
          href="/caisse/reglages"
          aria-label="Retour aux réglages"
          className="text-ink-soft inline-flex min-h-11 items-center px-1 text-xl"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Grand livre</h1>

        <PrintButton />

        <a
          href="/caisse/grand-livre/export"
          className="border-line-strong rounded-field bg-surface text-ink inline-flex min-h-11 items-center border px-4 text-sm font-semibold"
        >
          Exporter en CSV
        </a>
      </header>

      {/* The document itself, and the only part that reaches the printer. */}
      <article className="bg-surface rounded-card p-6 print:rounded-none print:p-0">
        <div className="mb-5">
          <h2 className="font-display text-xl font-semibold">Grand livre — {settings.clubName}</h2>
          <p className="text-ink-soft mt-1 text-sm">
            Édité le {printedOn} · {members.length} membres · Total dû&nbsp;: {formatMoney(owed)}
          </p>
        </div>

        <h3 className="mb-2 text-base font-semibold">Soldes</h3>
        <table className={`mb-7 ${TABLE_CLASS}`}>
          <thead>
            <tr className="border-line border-b">
              <th className="py-1.5 font-semibold">Membre</th>
              <th className="py-1.5 font-semibold">Licence</th>
              <th className="py-1.5 text-right font-semibold">Solde</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-line-soft border-b">
                <td className="py-1.5">{member.name}</td>
                <td className="text-ink-soft py-1.5">{member.licenceNumber ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMoney(member.balanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mb-2 text-base font-semibold">Écritures</h3>
        {rows.length === 0 ? (
          <p className="text-ink-soft py-6 text-center text-sm">Aucune écriture.</p>
        ) : (
          <table className={TABLE_CLASS}>
            <thead>
              <tr className="border-line border-b">
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">Membre</th>
                <th className="py-1.5 font-semibold">Type</th>
                <th className="py-1.5 font-semibold">Libellé</th>
                <th className="py-1.5 text-right font-semibold">Montant</th>
                <th className="py-1.5 font-semibold">Par</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-line-soft border-b ${
                    row.voidedAt ? "text-ink-soft line-through" : ""
                  }`}
                >
                  <td className="py-1.5 whitespace-nowrap">{formatEntryDate(row.occurredOn)}</td>
                  <td className="py-1.5">{row.memberName}</td>
                  <td className="py-1.5">{KIND_LABELS[row.kind]}</td>
                  <td className="py-1.5">
                    {entryLabel(row.kind, row.note)}
                    {row.voidedAt && (
                      /*
                       * inline-block, not no-underline: a text decoration
                       * propagates to descendants and cannot be switched off
                       * by them, but it stops at an atomic inline box. This is
                       * the one word on a struck row that has to stay legible.
                       */
                      <span className="ml-1 inline-block">(annulée)</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                    {row.kind === "reminder" ? "—" : formatMoney(signedAmount(row))}
                  </td>
                  <td className="text-ink-soft py-1.5">{row.recordedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </main>
  );
}

/** A debit adds to the debt, a credit reduces it. */
function signedAmount(row: { kind: "debit" | "credit" | "reminder"; amountCents: number }): number {
  return row.kind === "credit" ? -row.amountCents : row.amountCents;
}
