"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/action-result";

import { Modal, ModalError } from "./modal";
import { useToast } from "./toast";

/*
 * "Are you sure?" — asked before anything that cannot be undone with a tap.
 *
 * The confirming button is the only red one in the interface, so the
 * destructive choice never looks like the safe one.
 */

export function ConfirmDialog({
  message,
  confirmLabel = "Confirmer",
  onCancel,
  onConfirm,
  onDone,
}: {
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const showToast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();

      if (!result.ok) {
        setError(result.message);
        return;
      }

      showToast(result.message);
      onDone?.();
      onCancel();
    });
  }

  return (
    <Modal onClose={onCancel} title="Confirmation" width="narrow">
      <p className="text-md mb-5.5 leading-relaxed font-medium">{message}</p>

      <ModalError message={error} />

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="border-line rounded-field bg-surface text-ink flex-1 border py-2.75 text-base font-semibold disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-field bg-debt text-surface flex-1 py-2.75 text-base font-semibold disabled:opacity-50"
        >
          {pending ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
