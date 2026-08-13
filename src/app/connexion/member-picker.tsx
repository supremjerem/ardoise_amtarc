"use client";

import { useEffect, useState, useTransition } from "react";

import { searchMembersForLogin, type LoginCandidate } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";

/*
 * Step 1 of signing in: "Qui êtes-vous ?".
 *
 * The names are NOT in this page. They are asked for as you type, and only a
 * handful come back. The screen used to render the whole club — every name,
 * id and manager badge — into HTML served to anyone who opened the site, which
 * published the membership list and told an attacker which accounts were
 * privileged. Typing two letters is a small price for not doing that.
 *
 * It costs the "just scroll and tap" gesture the handoff drew. At a club of
 * fifty that gesture had already stopped working, which is why the search was
 * added in the first place.
 */

/** Matches MIN_QUERY_LENGTH in the action; repeated here to explain the copy. */
const MIN_QUERY_LENGTH = 2;

/** Long enough to stop searching on every keystroke, short enough to feel live. */
const DEBOUNCE_MS = 200;

export function MemberPicker({ onPick }: { onPick: (member: LoginCandidate) => void }) {
  const [query, setQuery] = useState("");
  /*
   * The answer is stored WITH the question it answers. Deriving what to show
   * from that comparison means nothing has to be cleared when the query
   * changes — an old result simply stops matching, and stale names never flash
   * under a search that has moved on.
   */
  const [found, setFound] = useState<{ query: string; members: LoginCandidate[] } | null>(null);
  const [, startTransition] = useTransition();

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;
  const settled = !tooShort && found?.query === trimmed;
  const results = settled ? found.members : [];

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        setFound({ query: trimmed, members: await searchMembersForLogin(trimmed) });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, tooShort]);

  return (
    <div className="bg-surface rounded-card shadow-card p-5.5">
      <h2 className="text-ink-muted text-md mb-3.5 font-semibold">Qui êtes-vous&nbsp;?</h2>

      <div className="relative mb-3">
        <span className="text-ink-faint pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <MagnifierIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            /* One name left: Enter takes it, so a keyboard needs no mouse. */
            if (event.key === "Enter" && results.length === 1) {
              event.preventDefault();
              onPick(results[0]);
            }
          }}
          placeholder="Tapez les premières lettres de votre nom"
          aria-label="Rechercher votre nom"
          /*
           * Deliberately not autofocused: on a phone that throws up the
           * keyboard before anyone has read the screen.
           */
          autoComplete="off"
          className="border-line rounded-field bg-surface text-ink placeholder:text-ink-soft w-full border py-2.75 pr-3.5 pl-10.5 text-base"
        />
      </div>

      {results.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => onPick(member)}
                className="hover:bg-hover rounded-field flex w-full items-center gap-3 px-2.5 py-2.75 text-left transition-colors"
              >
                <Avatar name={member.name} colorIndex={member.avatarColorIndex} />
                <span className="text-md min-w-0 flex-1 font-semibold">{member.name}</span>
                {/*
                 * No "Responsable" badge here any more. Who holds the till is
                 * not something a login screen owes a stranger.
                 */}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft px-2.5 py-3 text-base">
          {tooShort
            ? "Tapez au moins deux lettres de votre prénom ou de votre nom."
            : settled
              ? `Aucun nom ne correspond à « ${trimmed} ».`
              : "Recherche…"}
        </p>
      )}

      {/* The list changes under someone who cannot see it. */}
      <p className="sr-only" aria-live="polite">
        {results.length} nom{results.length > 1 ? "s" : ""} proposé
        {results.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/*
 * Drawn rather than taken from an icon library, as the handoff asks. An emoji
 * magnifier would render as a different picture on every platform.
 */
function MagnifierIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  );
}
