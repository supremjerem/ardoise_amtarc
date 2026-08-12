"use client";

import { useState, useTransition } from "react";

import { recordTransaction } from "@/app/actions/transactions";
import type { Tariff } from "@/lib/ledger";
import { centsToInputValue, formatMoney } from "@/lib/money";

import { Field, INPUT_CLASS, Modal, ModalButtons, ModalError } from "./modal";
import { useToast } from "./toast";

/*
 * Putting a round on the slate, or taking a payment.
 *
 * This is the dialog the club will use most, standing at the bar with one
 * hand: the quick-price buttons fill the amount and the note in a single tap,
 * so the common case never needs the keyboard.
 */

export type TransactionKindChoice = "debit" | "credit";

export function TransactionModal({
  onClose,
  members,
  tariffs,
  fixedMemberId,
  initialKind = "debit",
}: {
  onClose: () => void;
  members: { id: string; name: string }[];
  tariffs: Tariff[];
  /** Set when opened from a member's own screen: the member is not in question. */
  fixedMemberId?: string;
  initialKind?: TransactionKindChoice;
}) {
  const showToast = useToast();
  const [memberId, setMemberId] = useState(fixedMemberId ?? "");
  const [kind, setKind] = useState<TransactionKindChoice>(initialKind);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyTariff(tariff: Tariff) {
    setAmount(centsToInputValue(tariff.amountCents));
    /* Only fills the note while it is untouched, never overwrites typing. */
    setNote((current) => (current.trim() === "" ? tariff.label : current));
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!memberId) {
      setError("Choisissez un membre.");
      return;
    }

    startTransition(async () => {
      const result = await recordTransaction({ memberId, kind, amount, note });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      showToast(result.message);
      onClose();
    });
  }

  const memberName = members.find((member) => member.id === fixedMemberId)?.name;

  return (
    <Modal onClose={onClose} title={kind === "debit" ? "Nouvelle dépense" : "Nouveau paiement"}>
      <form onSubmit={submit}>
        {fixedMemberId ? (
          <p className="text-ink-soft mb-3.5 text-sm">
            Pour <span className="text-ink font-semibold">{memberName}</span>
          </p>
        ) : (
          <Field label="Membre">
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Choisir un membre…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <fieldset className="mb-3.5">
          <legend className="text-ink-soft text-label mb-1.5 font-semibold">Type</legend>
          <div className="flex gap-2">
            <KindButton
              selected={kind === "debit"}
              onClick={() => setKind("debit")}
              selectedClass="border-debt-line bg-debt-bg-strong text-debt-ink-strong"
            >
              Dépense
            </KindButton>
            <KindButton
              selected={kind === "credit"}
              onClick={() => setKind("credit")}
              selectedClass="border-paid bg-paid-bg text-paid-ink"
            >
              Paiement
            </KindButton>
          </div>
        </fieldset>

        {/* Quick prices only make sense for what is being sold. */}
        {kind === "debit" && tariffs.length > 0 && (
          <fieldset className="mb-3.5">
            <legend className="text-ink-soft text-label mb-1.5 font-semibold">Tarifs</legend>
            <div className="flex flex-wrap gap-2">
              {tariffs.map((tariff) => (
                <button
                  key={tariff.id}
                  type="button"
                  onClick={() => applyTariff(tariff)}
                  className="border-line rounded-pill bg-surface hover:bg-hover px-3.5 py-2 text-sm font-semibold transition-colors"
                >
                  {tariff.label}{" "}
                  <span className="text-ink-soft">{formatMoney(tariff.amountCents)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Montant (€)">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            /* `decimal` gives the comma keypad on a phone; `numeric` does not. */
            inputMode="decimal"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Note (optionnel)">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bières, eau…"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <ModalError message={error} />
        <ModalButtons onCancel={onClose} submitLabel="Enregistrer" pending={pending} />
      </form>
    </Modal>
  );
}

function KindButton({
  selected,
  onClick,
  selectedClass,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  selectedClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-input flex-1 border py-2.75 text-sm font-semibold transition-colors ${
        selected ? selectedClass : "border-line bg-surface text-ink-soft hover:bg-hover"
      }`}
    >
      {children}
    </button>
  );
}
