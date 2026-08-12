"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/*
 * The little message that confirms a till action landed.
 *
 * Behind the bar an action has to be acknowledged out loud: the manager taps
 * "Enregistrer", looks away, and needs to know it went through without
 * re-reading the whole screen.
 */

const VISIBLE_MS = 2500;

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside a ToastProvider.");
  return show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  /* Bumped per message so two identical ones still replay the animation. */
  const [sequence, setSequence] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((next) => {
    setMessage(next);
    setSequence((n) => n + 1);
  }, []);

  useEffect(() => {
    if (message === null) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, sequence]);

  return (
    <ToastContext.Provider value={show}>
      {children}

      {/*
       * The live region exists at all times, empty when there is nothing to
       * say: a region that appears along with its text is announced
       * unreliably by screen readers.
       */}
      <div aria-live="polite" role="status">
        {message && (
          <p
            key={sequence}
            className="animate-toast-in shadow-float bg-ink text-surface rounded-pill fixed bottom-6 left-1/2 z-70 -translate-x-1/2 px-5 py-3 text-sm font-medium"
          >
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
