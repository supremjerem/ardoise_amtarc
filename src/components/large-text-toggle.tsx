"use client";

import { useSyncExternalStore } from "react";

import { LARGE_TEXT_CLASS, LARGE_TEXT_KEY } from "@/lib/large-text";

/*
 * "Grands caractères": scales the whole interface by a quarter.
 *
 * The mechanism already existed — every size in the app is in rem, and
 * layout.tsx applies the preference before first paint so the page never
 * flashes at the wrong size. What was missing was any way to switch it on,
 * which made an accessibility feature nobody could reach.
 *
 * It is a preference of the DEVICE, not of the account: the club's shared
 * phone behind the bar should stay large whoever is signed in, and someone
 * who needs it needs it before they have signed in at all.
 *
 * The state of record is the class on <html>, not a React state — the boot
 * script sets it before React exists. `useSyncExternalStore` reads from there
 * instead of copying it, which also keeps two open tabs in agreement.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  /* Fires in the OTHER tabs when one of them writes the preference. */
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isEnabled(): boolean {
  return document.documentElement.classList.contains(LARGE_TEXT_CLASS);
}

/** Server-rendered markup cannot know what this browser stored. */
function isEnabledOnServer(): boolean {
  return false;
}

export function LargeTextToggle() {
  const enabled = useSyncExternalStore(subscribe, isEnabled, isEnabledOnServer);

  function toggle() {
    const next = !enabled;
    document.documentElement.classList.toggle(LARGE_TEXT_CLASS, next);

    try {
      if (next) localStorage.setItem(LARGE_TEXT_KEY, "1");
      else localStorage.removeItem(LARGE_TEXT_KEY);
    } catch {
      /* Private browsing can refuse storage; the size still changes now. */
    }

    /* The class changed outside React, so React has to be told. */
    listeners.forEach((notify) => notify());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className="text-ink-soft hover:text-ink inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold transition-colors"
    >
      <span aria-hidden="true" className="text-ink-faint font-display leading-none">
        <span className="text-[0.75em]">A</span>
        <span className="text-[1.15em]">A</span>
      </span>
      Grands caractères
    </button>
  );
}
