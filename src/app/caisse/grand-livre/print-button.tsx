"use client";

/*
 * Printing has to be asked for by the browser itself, so this one button is
 * the only interactive part of an otherwise entirely static document.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-field bg-ink text-surface inline-flex min-h-11 items-center px-4 text-sm font-semibold"
    >
      Imprimer
    </button>
  );
}
