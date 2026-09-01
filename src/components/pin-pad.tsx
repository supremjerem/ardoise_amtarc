"use client";

import { useEffect } from "react";

/*
 * The numeric keypad every PIN is entered on — signing in, and now changing
 * one's own code. Extracted from the login flow so both share the one
 * implementation of the dots, the shake, and the physical-keyboard bridge.
 */

/** Keys of the pad, in reading order. `null` is the gap left of the zero. */
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0"] as const;

export function PinPad({
  pin,
  pinLength,
  error,
  attempt,
  busy,
  onPress,
  onBackspace,
  onEscape,
}: {
  pin: string;
  pinLength: number;
  /** Empty string when there is nothing to report. */
  error: string;
  /** Bumped by the caller on every failure, to restart the shake animation. */
  attempt: number;
  busy: boolean;
  onPress: (digit: string) => void;
  onBackspace: () => void;
  /** Omit where Escape has no meaning, e.g. inside a Modal that already closes on it. */
  onEscape?: () => void;
}) {
  /* A physical keyboard is the fastest way in on a desktop — let it work. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") {
        onPress(event.key);
      } else if (event.key === "Backspace") {
        onBackspace();
      } else if (event.key === "Escape" && onEscape) {
        onEscape();
      } else {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPress, onBackspace, onEscape]);

  return (
    <>
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
              onClick={() => onPress(key)}
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
          onClick={onBackspace}
          disabled={busy}
          className="text-ink-soft size-16 rounded-full text-lg disabled:opacity-50"
        >
          <span aria-hidden="true">⌫</span>
          <span className="sr-only">Effacer le dernier chiffre</span>
        </button>
      </div>
    </>
  );
}
