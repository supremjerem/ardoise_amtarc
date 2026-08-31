"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logIn, type LoginCandidate } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";

/*
 * Step 2 of signing in: the code.
 *
 * The pad decides nothing. The code is checked by the `logIn` Server Action,
 * and both the lockout and the session are the server's business.
 */

/** Keys of the pad, in reading order. `null` is the gap left of the zero. */
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0"] as const;

export function PinStep({ member, onBack }: { member: LoginCandidate; onBack: () => void }) {
  const router = useRouter();
  /* Four digits for a member, six for a till manager — decided server-side. */
  const pinLength = member.pinLength;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  /* Bumped on every failure, to restart the shake animation. */
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();

  /*
   * Stays true from a correct code until the next screen paints, so the pad
   * cannot be used again during the navigation.
   */
  const [isLeaving, setIsLeaving] = useState(false);
  const busy = isPending || isLeaving;

  const submit = useCallback(
    (code: string) => {
      startTransition(async () => {
        const result = await logIn(member.id, code);

        if (result.ok) {
          setIsLeaving(true);
          router.push(result.isAdmin ? "/caisse" : "/moi");
          return;
        }

        setPin("");
        setError(result.message);
        setAttempt((n) => n + 1);
      });
    },
    [member.id, router],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || pin.length >= pinLength) return;

      const next = pin + digit;
      setPin(next);
      setError("");

      /* Validated on the last digit: no "Valider" button to hunt for. */
      if (next.length === pinLength) submit(next);
    },
    [busy, pin, pinLength, submit],
  );

  const backspace = useCallback(() => {
    if (busy) return;
    setPin((current) => current.slice(0, -1));
    setError("");
  }, [busy]);

  /* A physical keyboard is the fastest way in on a desktop — let it work. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") {
        press(event.key);
      } else if (event.key === "Backspace") {
        backspace();
      } else if (event.key === "Escape") {
        onBack();
      } else {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press, backspace, onBack]);

  return (
    <div className="bg-surface rounded-card shadow-card flex flex-col items-center px-5.5 py-7">
      <button
        type="button"
        onClick={onBack}
        className="text-ink-soft self-start pb-4.5 text-base font-semibold"
      >
        ← Retour
      </button>

      <Avatar name={member.name} colorIndex={member.avatarColorIndex} size="lg" />
      <p className="mt-2.5 mb-5.5 text-lg font-semibold">{member.name}</p>

      <p id="pin-instructions" className="text-ink-soft mb-3.5 text-sm">
        Entrez votre code à {pinLength} chiffres
      </p>

      <div
        key={attempt}
        className={`mb-6.5 flex gap-3.5 ${error ? "animate-shake" : ""}`}
        aria-hidden="true"
      >
        {Array.from({ length: pinLength }, (_, index) => (
          <span
            key={index}
            className={`size-3.5 rounded-full transition-colors ${
              index < pin.length ? "bg-ink" : "bg-line"
            }`}
          />
        ))}
      </div>

      {/* Spoken to a screen reader, which cannot see the dots above. */}
      <p className="sr-only" aria-live="polite">
        {pin.length} chiffre{pin.length > 1 ? "s" : ""} sur {pinLength}
      </p>

      {error && (
        <p role="alert" className="text-debt -mt-2.5 mb-4 text-sm font-semibold">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {PAD_KEYS.map((key, index) =>
          key === null ? (
            <span key={`gap-${index}`} />
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={busy}
              aria-describedby="pin-instructions"
              className="border-key-border bg-surface text-ink hover:bg-hover active:bg-track size-16 rounded-full border text-xl font-semibold transition-colors disabled:opacity-50"
            >
              {key}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={backspace}
          disabled={busy}
          className="text-ink-soft size-16 rounded-full text-lg disabled:opacity-50"
        >
          <span aria-hidden="true">⌫</span>
          <span className="sr-only">Effacer le dernier chiffre</span>
        </button>
      </div>
    </div>
  );
}
