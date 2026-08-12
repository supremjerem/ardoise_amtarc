"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/avatar";
import { describeBalance } from "@/lib/balance";
import type { Tariff } from "@/lib/ledger";
import type { MemberWithBalance } from "@/lib/members";
import { matchesMember } from "@/lib/search";

import { MemberModal } from "./member-modal";
import { TransactionModal } from "./transaction-modal";

/*
 * The searchable member list, and the two ways to start something from it:
 * "+ Membre", and the floating button for a transaction.
 *
 * Members are ordered by what they owe, heaviest first — the list answers
 * "who should I chase?" before it answers anything else.
 */

const BALANCE_COLOURS = {
  debt: "text-debt",
  credit: "text-credit",
  settled: "text-ink-soft",
} as const;

export function MemberIndex({
  members,
  tariffs,
  defaultCapCents,
}: {
  members: MemberWithBalance[];
  tariffs: Tariff[];
  defaultCapCents: number;
}) {
  const [query, setQuery] = useState("");
  const [showTransaction, setShowTransaction] = useState(false);
  const [showNewMember, setShowNewMember] = useState(false);

  const visible = useMemo(
    () => members.filter((member) => matchesMember(member, query)),
    [members, query],
  );

  const memberOptions = useMemo(
    () =>
      [...members]
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [members],
  );

  return (
    <>
      <div className="mb-4 flex gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un membre…"
          aria-label="Rechercher un membre par nom ou numéro de licence"
          autoComplete="off"
          className="border-line rounded-field bg-surface text-ink placeholder:text-ink-soft min-w-0 flex-1 border px-3.5 py-2.75 text-base"
        />
        <button
          type="button"
          onClick={() => setShowNewMember(true)}
          className="rounded-field bg-ink text-surface shrink-0 px-4 text-sm font-semibold whitespace-nowrap"
        >
          + Membre
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-soft py-7.5 text-center text-sm">
          {members.length === 0 ? "Aucun membre enregistré." : "Aucun membre trouvé."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((member) => {
            const balance = describeBalance(member.balanceCents);

            return (
              <li key={member.id}>
                <Link
                  href={`/caisse/membre/${member.id}`}
                  className="bg-surface hover:bg-hover rounded-tile flex w-full items-center gap-3 px-3.5 py-3 transition-colors"
                >
                  <Avatar name={member.name} colorIndex={member.avatarColorIndex} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{member.name}</span>
                    <span className="text-ink-soft text-label block">
                      {member.licenceNumber ? `Licence ${member.licenceNumber}` : "—"}
                    </span>
                  </span>

                  <span className={`text-md font-semibold ${BALANCE_COLOURS[balance.status]}`}>
                    {balance.amountLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/*
       * Anchored to the content column rather than the viewport edge, so on a
       * wide screen it stays by the list instead of drifting into the margin.
       */}
      <button
        type="button"
        onClick={() => setShowTransaction(true)}
        aria-label="Nouvelle transaction"
        className="bg-accent hover:bg-accent-hover text-surface shadow-float fixed right-[max(1.25rem,calc((100%-47.5rem)/2+1.25rem))] bottom-7 z-40 flex size-14 items-center justify-center rounded-full text-2xl transition-colors"
      >
        <span aria-hidden="true">+</span>
      </button>

      {showTransaction && (
        <TransactionModal
          onClose={() => setShowTransaction(false)}
          members={memberOptions}
          tariffs={tariffs}
        />
      )}

      {showNewMember && (
        <MemberModal onClose={() => setShowNewMember(false)} defaultCapCents={defaultCapCents} />
      )}
    </>
  );
}
