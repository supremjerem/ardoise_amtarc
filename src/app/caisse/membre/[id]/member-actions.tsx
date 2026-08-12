"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { archiveMember } from "@/app/actions/members";
import { sendReminder } from "@/app/actions/transactions";
import { ConfirmDialog } from "@/app/caisse/confirm-dialog";
import { MemberModal, type EditableMember } from "@/app/caisse/member-modal";
import { useToast } from "@/app/caisse/toast";
import { TransactionModal, type TransactionKindChoice } from "@/app/caisse/transaction-modal";
import type { Tariff } from "@/lib/ledger";

/*
 * Everything a till manager can do about one member.
 *
 * The two money buttons open the transaction dialog already pointed at this
 * member and at the right kind, so the common case is two taps and an amount.
 */

export function MemberActions({
  member,
  memberOptions,
  tariffs,
  defaultCapCents,
}: {
  member: EditableMember;
  memberOptions: { id: string; name: string }[];
  tariffs: Tariff[];
  defaultCapCents: number;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [transactionKind, setTransactionKind] = useState<TransactionKindChoice | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [remindPending, startReminder] = useTransition();

  function remind() {
    startReminder(async () => {
      const result = await sendReminder(member.id);
      showToast(result.message);
    });
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setTransactionKind("debit")}
          className="rounded-field bg-debt-strong text-surface py-3.5 text-sm font-semibold"
        >
          + Ajouter une dépense
        </button>
        <button
          type="button"
          onClick={() => setTransactionKind("credit")}
          className="rounded-field bg-paid text-surface py-3.5 text-sm font-semibold"
        >
          ✓ Enregistrer un paiement
        </button>
      </div>

      <div className="mb-6 flex gap-2.5">
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="border-line-strong rounded-field bg-surface text-ink flex-1 border py-3 text-sm font-semibold"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={remind}
          disabled={remindPending}
          className="border-line-strong rounded-field bg-surface text-ink flex-1 border py-3 text-sm font-semibold disabled:opacity-50"
        >
          {remindPending ? "…" : "Envoyer un rappel"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="border-debt-line rounded-field bg-surface text-debt-link border px-4 py-3 text-sm font-semibold"
        >
          Supprimer
        </button>
      </div>

      {transactionKind !== null && (
        <TransactionModal
          onClose={() => setTransactionKind(null)}
          members={memberOptions}
          tariffs={tariffs}
          fixedMemberId={member.id}
          initialKind={transactionKind}
        />
      )}

      {showEdit && (
        <MemberModal
          onClose={() => setShowEdit(false)}
          member={member}
          defaultCapCents={defaultCapCents}
          onRequestDelete={() => {
            /* One dialog at a time: close the form before asking. */
            setShowEdit(false);
            setConfirmingDelete(true);
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          message={`Supprimer ${member.name} ? Son historique reste au grand livre, mais il ou elle n'apparaîtra plus nulle part.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => archiveMember(member.id)}
          /* Their page no longer exists once archived. */
          onDone={() => router.push("/caisse")}
        />
      )}
    </>
  );
}
