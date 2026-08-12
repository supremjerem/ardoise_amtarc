"use client";

import { useEffect, useId, useRef } from "react";

/*
 * The shell every till dialog sits in.
 *
 * Closing on a click outside is what the design asks for, and it is only safe
 * because a click on the card itself must not count — hence the guard on the
 * event target rather than a listener on the backdrop alone.
 *
 * There is no `open` prop: callers mount a dialog to open it and unmount it to
 * close it. That way a reopened form starts empty because it is genuinely new,
 * rather than because an effect raced to blank its fields.
 */

/** What the browser will stop on when tabbing, inside a dialog. */
const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  onClose,
  title,
  children,
  width = "normal",
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "normal" | "narrow";
}) {
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  /* Where the focus was before the dialog opened, to put it back after. */
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    /*
     * Focus moves into the dialog so the keyboard and screen readers follow
     * it. The first field is preferred over the card: on a form, that is
     * where someone means to start.
     */
    const firstField = card.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? card.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      /*
       * Keep Tab inside the dialog. `aria-modal` tells a screen reader the
       * rest of the page is inert, but it does nothing to the tab order:
       * without this, tabbing walks out of an open dialog into the page
       * behind it, where the focus ring is invisible under the backdrop and
       * there is no obvious way back.
       */
      if (event.key !== "Tab" || !card.current) return;

      const focusable = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hasAttribute("disabled"),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === card.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    /* The page behind must not scroll under the dialog. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      /* Only a click that both starts and lands on the backdrop closes. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[rgba(43,47,51,0.42)] p-5"
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`animate-modal-in bg-surface rounded-card max-h-[88vh] w-full overflow-auto p-6.5 outline-none ${
          width === "narrow" ? "max-w-85" : "max-w-105"
        }`}
      >
        <h2 id={titleId} className="font-display mb-4.5 text-[1.125rem] font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared form furniture                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3.5 block">
      <span className="text-ink-soft text-label mb-1.5 block font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** The one input style used across every till dialog. */
export const INPUT_CLASS =
  "border-line rounded-input bg-surface text-ink placeholder:text-ink-soft w-full border px-3 py-2.75 text-base";

export function ModalError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-debt mb-3.5 text-sm font-semibold">
      {message}
    </p>
  );
}

export function ModalButtons({
  onCancel,
  submitLabel,
  pending,
}: {
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  return (
    <div className="mt-5.5 flex gap-2.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="border-line rounded-field bg-surface text-ink flex-1 border py-3 text-base font-semibold disabled:opacity-50"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-field bg-ink text-surface flex-1 py-3 text-base font-semibold disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : submitLabel}
      </button>
    </div>
  );
}
