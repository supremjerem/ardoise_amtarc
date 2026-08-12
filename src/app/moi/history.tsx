import { describeEntry, entryLabel } from "@/lib/balance";
import { formatEntryDate } from "@/lib/dates";
import type { LedgerEntry } from "@/lib/ledger";

/*
 * The member's own history: what was put on the slate, and what was paid off.
 *
 * A reminder carries no amount — it is a trace that someone was asked to
 * settle up, and it must be visible to them rather than kept in a back office.
 */

const AMOUNT_COLOURS = {
  debt: "text-debt-amount",
  paid: "text-paid-amount",
  neutral: "text-ink-soft",
} as const;

export function History({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section className="mt-7.5">
      <h2 className="text-md px-0.5 font-semibold">Historique</h2>

      {entries.length === 0 ? (
        <p className="text-ink-soft py-7.5 text-center text-sm">
          Aucune transaction pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2">
          {entries.map((entry) => {
            const line = describeEntry(entry);

            return (
              <li
                key={entry.id}
                className="bg-surface rounded-tile flex items-center justify-between px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-base font-medium">{entryLabel(entry.kind, entry.note)}</p>
                  <p className="text-ink-soft text-label mt-0.5">
                    {formatEntryDate(entry.occurredOn)}
                  </p>
                </div>

                {line.amountLabel && (
                  <p className={`text-md font-semibold ${AMOUNT_COLOURS[line.color]}`}>
                    {line.amountLabel}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
