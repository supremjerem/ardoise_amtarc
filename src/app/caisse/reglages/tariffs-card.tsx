"use client";

import { useState, useTransition } from "react";

import { createTariff, retireTariff, updateTariff } from "@/app/actions/settings";
import { ConfirmDialog } from "@/app/caisse/confirm-dialog";
import { Field, INPUT_CLASS, Modal, ModalButtons, ModalError } from "@/app/caisse/modal";
import { useToast } from "@/app/caisse/toast";
import type { Tariff } from "@/lib/ledger";
import { centsToInputValue, formatMoney } from "@/lib/money";

import { AddButton, SettingsCard } from "./settings-card";

/*
 * The quick-price buttons offered in the transaction dialog.
 *
 * These are what make recording a round one tap instead of a typed amount, so
 * the club has to be able to keep them in step with its own prices without
 * anyone touching the database.
 */

export function TariffsCard({ tariffs }: { tariffs: Tariff[] }) {
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<Tariff | null>(null);

  return (
    <SettingsCard
      title="Tarifs rapides"
      description="Les boutons proposés au moment d'enregistrer une dépense."
      action={<AddButton onClick={() => setCreating(true)} label="Ajouter un tarif" />}
    >
      {tariffs.length === 0 ? (
        <p className="text-ink-soft py-4 text-center text-sm">
          Aucun tarif. Les montants devront être saisis à la main.
        </p>
      ) : (
        <ul className="flex flex-col">
          {tariffs.map((tariff) => (
            <li
              key={tariff.id}
              className="border-line-soft flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-base font-medium">{tariff.label}</span>
              <span className="text-ink-soft text-base">{formatMoney(tariff.amountCents)}</span>

              <button
                type="button"
                onClick={() => setEditing(tariff)}
                className="text-accent-ink text-label px-1.5 font-semibold"
              >
                Modifier
                <span className="sr-only"> le tarif {tariff.label}</span>
              </button>
              <button
                type="button"
                onClick={() => setRetiring(tariff)}
                className="text-debt-link text-label px-1.5 font-semibold"
              >
                Retirer
                <span className="sr-only"> le tarif {tariff.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && <TariffModal onClose={() => setCreating(false)} />}
      {editing && <TariffModal tariff={editing} onClose={() => setEditing(null)} />}

      {retiring && (
        <ConfirmDialog
          message={`Retirer « ${retiring.label} » des tarifs rapides ? Les dépenses déjà enregistrées avec ce tarif ne changent pas.`}
          confirmLabel="Retirer"
          onCancel={() => setRetiring(null)}
          onConfirm={() => retireTariff(retiring.id)}
        />
      )}
    </SettingsCard>
  );
}

function TariffModal({ tariff, onClose }: { tariff?: Tariff; onClose: () => void }) {
  const showToast = useToast();
  const [label, setLabel] = useState(tariff?.label ?? "");
  const [amount, setAmount] = useState(tariff ? centsToInputValue(tariff.amountCents) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = tariff
        ? await updateTariff(tariff.id, { label, amount })
        : await createTariff({ label, amount });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      showToast(result.message);
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} title={tariff ? "Modifier le tarif" : "Nouveau tarif"} width="narrow">
      <form onSubmit={submit}>
        <Field label="Nom">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bière"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Montant (€)">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="3,00"
            inputMode="decimal"
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
