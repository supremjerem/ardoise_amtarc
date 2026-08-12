"use client";

import { useState } from "react";

import { voidTransaction } from "@/app/actions/transactions";
import { ConfirmDialog } from "@/app/caisse/confirm-dialog";
import { describeEntry, entryLabel } from "@/lib/balance";
import { formatEntryDate } from "@/lib/dates";
import type { LedgerEntry } from "@/lib/ledger";

/*
 * The member's history as the till sees it: the same lines the member reads,
 * plus the means to undo one.
 *
 * "Annuler" rather than "supprimer" throughout — the entry is voided, not
 * destroyed, and the wording should not promise otherwise.
 */

const AMOUNT_COLOURS = {
  debt: "text-debt-amount",
  paid: "text-paid-amount",
  neutral: "text-ink-soft",
} as const;

export function TillHistory({ entries }: { entries: LedgerEntry[] }) {
  const [voiding, setVoiding] = useState<LedgerEntry | null>(null);

  return (
    <section>
      <h2 className="text-md mb-2.5 px-0.5 font-semibold">Historique</h2>

      {entries.length === 0 ? (
        <p className="text-ink-softer py-7.5 text-center text-sm">
          Aucune transaction pour ce membre.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const line = describeEntry(entry);

            return (
              <li
                key={entry.id}
                className="bg-surface rounded-tile flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-base font-medium">{entryLabel(entry.kind, entry.note)}</p>
                  <p className="text-ink-soft text-label mt-0.5">
                    {formatEntryDate(entry.occurredOn)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {line.amountLabel && (
                    <p className={`text-md font-semibold ${AMOUNT_COLOURS[line.color]}`}>
                      {line.amountLabel}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setVoiding(entry)}
                    className="text-ink-faint hover:text-debt-link px-1 text-base transition-colors"
                  >
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">
                      Annuler l&apos;écriture « {entryLabel(entry.kind, entry.note)} » du{" "}
                      {formatEntryDate(entry.occurredOn)}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {voiding && (
        <ConfirmDialog
          message={`Annuler « ${entryLabel(voiding.kind, voiding.note)} » du ${formatEntryDate(voiding.occurredOn)} ? L'écriture quitte le solde mais reste au grand livre.`}
          confirmLabel="Annuler l'écriture"
          onCancel={() => setVoiding(null)}
          onConfirm={() => voidTransaction(voiding.id)}
        />
      )}
    </section>
  );
}
