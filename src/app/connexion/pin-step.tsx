"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logIn, type LoginCandidate } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { PinPad } from "@/components/pin-pad";

/*
 * Step 2 of signing in: the code.
 *
 * The pad decides nothing. The code is checked by the `logIn` Server Action,
 * and both the lockout and the session are the server's business.
 */

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

      <PinPad
        pin={pin}
        pinLength={pinLength}
        error={error}
        attempt={attempt}
        busy={busy}
        onPress={press}
        onBackspace={backspace}
        onEscape={onBack}
      />
    </div>
  );
}
