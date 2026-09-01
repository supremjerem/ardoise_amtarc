"use client";

import { useCallback, useState, useTransition } from "react";

import { changeMyPin, checkCurrentPin } from "@/app/actions/auth";
import { Modal } from "@/app/caisse/modal";
import { PinPad } from "@/components/pin-pad";

/*
 * Self-service code change — the counterpart, for an ordinary member, to a
 * manager resetting a code from the till. Three codes typed in sequence on
 * the same pad used to sign in: the current one, the new one, and it again to
 * catch a slip before it locks the member out of their own account.
 */

type Step = "current" | "new" | "confirm";

const STEP_INSTRUCTIONS: Record<Step, string> = {
  current: "Entrez votre code actuel",
  new: "Choisissez un nouveau code",
  confirm: "Retapez le nouveau code",
};

export function ChangePinButton({ pinLength }: { pinLength: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-soft text-label px-1.5 py-2.25 font-semibold"
      >
        Changer mon code
      </button>

      {open && <ChangePinModal pinLength={pinLength} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangePinModal({ pinLength, onClose }: { pinLength: number; onClose: () => void }) {
  const [step, setStep] = useState<Step>("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const busy = isPending;

  /** Back to the first code, with a message explaining why. */
  const restart = useCallback((message: string) => {
    setStep("current");
    setCurrentPin("");
    setNewPin("");
    setPin("");
    setError(message);
    setAttempt((n) => n + 1);
  }, []);

  const submit = useCallback(
    (finalNewPin: string) => {
      startTransition(async () => {
        const result = await changeMyPin(currentPin, finalNewPin);

        if (result.ok) {
          setSuccess(true);
          setError("");
          return;
        }

        restart(result.message);
      });
    },
    [currentPin, restart],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || pin.length >= pinLength) return;

      const next = pin + digit;
      setPin(next);
      setError("");

      if (next.length !== pinLength) return;

      if (step === "current") {
        startTransition(async () => {
          const result = await checkCurrentPin(next);
          if (!result.ok) {
            restart(result.message);
            return;
          }
          setCurrentPin(next);
          setPin("");
          setStep("new");
        });
        return;
      }

      if (step === "new") {
        setNewPin(next);
        setPin("");
        setStep("confirm");
        return;
      }

      /* step === "confirm" */
      if (next !== newPin) {
        restart("Les deux codes ne correspondent pas.");
        return;
      }

      submit(next);
    },
    [busy, pin, pinLength, step, newPin, submit, restart],
  );

  const backspace = useCallback(() => {
    if (busy) return;
    setPin((current) => current.slice(0, -1));
    setError("");
  }, [busy]);

  if (success) {
    return (
      <Modal title="Code modifié" onClose={onClose} width="narrow">
        <p className="text-ink-soft mb-5.5 text-sm">Votre nouveau code est actif dès maintenant.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-field bg-ink text-surface w-full py-3 text-base font-semibold"
        >
          Fermer
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Changer mon code" onClose={onClose} width="narrow">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-ink-soft self-start pb-3.5 text-base font-semibold disabled:opacity-50"
        >
          ← Annuler
        </button>

        <p id="pin-instructions" className="text-ink-soft mb-3.5 text-sm">
          {STEP_INSTRUCTIONS[step]}
        </p>

        <PinPad
          pin={pin}
          pinLength={pinLength}
          error={error}
          attempt={attempt}
          busy={busy}
          onPress={press}
          onBackspace={backspace}
        />
      </div>
    </Modal>
  );
}
