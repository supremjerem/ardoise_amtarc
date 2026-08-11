"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logIn } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import type { LoginMember } from "@/lib/members";

/*
 * Signing in, in two steps: pick your name, then type your code.
 *
 * No identifier to remember and no keyboard to fight with — the whole point
 * for an audience that mostly signs in on a phone, standing at the bar.
 *
 * The state machine lives on the client so the two steps swap instantly, but
 * it decides nothing: the code is checked by the `logIn` Server Action, and
 * both the lockout and the session are the server's business.
 */

/** Keys of the pad, in reading order. `null` is the gap left of the zero. */
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0"] as const;

export function LoginFlow({ members }: { members: LoginMember[] }) {
  const [selected, setSelected] = useState<LoginMember | null>(null);

  if (!selected) {
    return <MemberPicker members={members} onPick={setSelected} />;
  }

  return (
    <PinStep
      /* Remount on a change of member: no stale digits, no stale error. */
      key={selected.id}
      member={selected}
      onBack={() => setSelected(null)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — "Qui êtes-vous ?"                                          */
/* ------------------------------------------------------------------ */

function MemberPicker({
  members,
  onPick,
}: {
  members: LoginMember[];
  onPick: (member: LoginMember) => void;
}) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5.5">
      <h2 className="text-ink-muted text-md mb-3.5 font-semibold">Qui êtes-vous&nbsp;?</h2>

      {members.length === 0 ? (
        <p className="text-ink-softer text-base">
          Aucun membre n&apos;est encore enregistré. Un responsable de caisse doit créer le premier
          compte.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {members.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => onPick(member)}
                className="hover:bg-hover rounded-field flex w-full items-center gap-3 px-2.5 py-2.75 text-left transition-colors"
              >
                <Avatar name={member.name} colorIndex={member.avatarColorIndex} />
                <span className="text-md min-w-0 flex-1 font-semibold">{member.name}</span>
                {member.isAdmin && (
                  <span className="bg-accent-bg text-accent-ink rounded-pill shrink-0 px-2.25 py-1 text-[0.6875rem] font-semibold">
                    Responsable
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — the code                                                   */
/* ------------------------------------------------------------------ */

function PinStep({ member, onBack }: { member: LoginMember; onBack: () => void }) {
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
