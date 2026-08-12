"use client";

import { useMemo, useState } from "react";

import { Avatar } from "@/components/avatar";
import type { LoginMember } from "@/lib/members";
import { matchesName } from "@/lib/search";

/*
 * Step 1 of signing in: "Qui êtes-vous ?".
 *
 * The club can run to dozens of members, and scrolling a long alphabetical
 * list to find yourself is the worst way to start. Typing the first letters of
 * either name narrows it down immediately; the whole list is still there for
 * anyone who would rather just look.
 */

export function MemberPicker({
  members,
  onPick,
}: {
  members: LoginMember[];
  onPick: (member: LoginMember) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => members.filter((member) => matchesName(member.name, query)),
    [members, query],
  );

  if (members.length === 0) {
    return (
      <div className="bg-surface rounded-card shadow-card p-5.5">
        <h2 className="text-ink-muted text-md mb-3.5 font-semibold">Qui êtes-vous&nbsp;?</h2>
        <p className="text-ink-soft text-base">
          Aucun membre n&apos;est encore enregistré. Un responsable de caisse doit créer le premier
          compte.
        </p>
      </div>
    );
  }

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
            /*
             * Once the search has narrowed to a single person, Enter picks
             * them: on a keyboard that turns signing in into one typed word.
             */
            if (event.key === "Enter" && visible.length === 1) {
              event.preventDefault();
              onPick(visible[0]);
            }
          }}
          placeholder="Rechercher votre nom"
          aria-label="Rechercher votre nom"
          /*
           * Deliberately not autofocused: on a phone that throws up the
           * keyboard and hides the very list most people came to tap.
           */
          autoComplete="off"
          className="border-line rounded-field bg-surface text-ink placeholder:text-ink-soft w-full border py-2.75 pr-3.5 pl-10.5 text-base"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-soft px-2.5 py-3 text-base">
          Aucun nom ne correspond à «&nbsp;{query.trim()}&nbsp;».
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visible.map((member) => (
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

      {/* The list shrinks silently for anyone who cannot see it. */}
      <p className="sr-only" aria-live="polite">
        {visible.length} membre{visible.length > 1 ? "s" : ""} dans la liste
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
