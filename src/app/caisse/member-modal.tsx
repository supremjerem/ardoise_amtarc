"use client";

import { useState, useTransition } from "react";

import { createMember, updateMember } from "@/app/actions/members";
import { centsToInputValue } from "@/lib/money";
import { requiredPinLength } from "@/lib/pin-length";

import { Field, INPUT_CLASS, Modal, ModalButtons, ModalError } from "./modal";
import { useToast } from "./toast";

/*
 * Creating a member, or editing one.
 *
 * The code is the only field that behaves differently between the two: on
 * creation it must be set, on edit it is left blank to keep the current one —
 * a manager should not have to know somebody's code to correct their phone
 * number.
 */

export type EditableMember = {
  id: string;
  name: string;
  licenceNumber: string | null;
  email: string | null;
  phone: string | null;
  capCents: number;
  isAdmin: boolean;
};

export function MemberModal({
  onClose,
  member,
  defaultCapCents,
  onRequestDelete,
}: {
  onClose: () => void;
  /** Absent when creating. */
  member?: EditableMember;
  defaultCapCents: number;
  onRequestDelete?: () => void;
}) {
  const showToast = useToast();
  const [name, setName] = useState(member?.name ?? "");
  const [licenceNumber, setLicenceNumber] = useState(member?.licenceNumber ?? "");
  const [cap, setCap] = useState(centsToInputValue(member?.capCents ?? defaultCapCents));
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [isAdmin, setIsAdmin] = useState(member?.isAdmin ?? false);
  /* Blank on edit means "keep the current code". */
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pinDigits = requiredPinLength(isAdmin);
  const roleChanged = member ? member.isAdmin !== isAdmin : false;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input = { name, licenceNumber, email, phone, cap, isAdmin, pin };

    startTransition(async () => {
      const result = member ? await updateMember(member.id, input) : await createMember(input);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      showToast(result.message);
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} title={member ? "Modifier le membre" : "Nouveau membre"}>
      <form onSubmit={submit}>
        <Field label="Nom complet">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Prénom Nom"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="flex gap-2.5">
          <div className="flex-1">
            <Field label="N° licence">
              <input
                value={licenceNumber}
                onChange={(event) => setLicenceNumber(event.target.value)}
                placeholder="AM1234"
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Plafond (€)">
              <input
                value={cap}
                onChange={(event) => setCap(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemple.fr"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Téléphone">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="06 00 00 00 00"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="bg-subtle rounded-field mb-3.5 flex items-center justify-between px-3.5 py-3">
          <span className="text-sm font-semibold">Responsable de caisse</span>
          <button
            type="button"
            role="switch"
            aria-checked={isAdmin}
            onClick={() => setIsAdmin((current) => !current)}
            className={`relative h-6.5 w-11 shrink-0 rounded-full transition-colors ${
              isAdmin ? "bg-accent-on" : "bg-line-strong"
            }`}
          >
            <span className="sr-only">Responsable de caisse</span>
            <span
              aria-hidden="true"
              className={`bg-surface absolute top-0.75 size-5 rounded-full transition-[left] ${
                isAdmin ? "left-5.5" : "left-0.75"
              }`}
            />
          </button>
        </div>

        <Field label={`Code PIN (${pinDigits} chiffres)`}>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder={member ? "Laisser vide pour ne pas changer" : `${pinDigits} chiffres`}
            className={INPUT_CLASS}
          />
        </Field>

        {/*
         * Changing role changes the length of code required, so the old one
         * cannot carry over. Said before the save fails, not after — and
         * dropped once the server has said it, rather than saying it twice.
         */}
        {roleChanged && !pin && !error && (
          <p className="text-ink-soft mb-3.5 text-sm">
            Ce changement de rôle demande un nouveau code à {pinDigits} chiffres.
          </p>
        )}

        <ModalError message={error} />
        <ModalButtons onCancel={onClose} submitLabel="Enregistrer" pending={pending} />

        {member && onRequestDelete && (
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={pending}
            className="text-debt-link w-full pt-3.5 text-sm font-semibold disabled:opacity-50"
          >
            Supprimer ce membre
          </button>
        )}
      </form>
    </Modal>
  );
}
