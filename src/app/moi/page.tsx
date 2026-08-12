import type { Metadata } from "next";
import Link from "next/link";

import { logOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { LargeTextToggle } from "@/components/large-text-toggle";
import { requireMember } from "@/lib/auth";
import { calculateBalance } from "@/lib/balance";
import { readMemberHistory } from "@/lib/ledger";

import { BalanceCard, CapAlert } from "./balance-card";
import { History } from "./history";

export const metadata: Metadata = {
  title: "Mon ardoise — L'ardoise du club",
};

/*
 * "Mon ardoise" — what a member sees of their own account, and the only screen
 * most of them will ever open.
 *
 * A till manager lands on the till instead, but reaches this same page through
 * "Mon ardoise": they are a member too, with their own slate.
 */
export default async function Page() {
  const member = await requireMember();
  const entries = await readMemberHistory(member.id);
  const balanceCents = calculateBalance(entries);

  return (
    <main id="contenu" className="flex w-full max-w-115 flex-col px-5 pb-25">
      <header className="flex items-center justify-between px-0.5 pt-6 pb-4.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={member.name} colorIndex={member.avatarColorIndex} size="sm" />
          <div className="min-w-0">
            {/*
             * The page had no h1 at all: its only headings were "À régler"
             * and "Historique", so a screen reader announced the sections of
             * a page with no name. The member's name is what this page is.
             */}
            <h1 className="text-md truncate font-semibold">{member.name}</h1>
            {member.licenceNumber && (
              <p className="text-ink-soft text-label">Licence {member.licenceNumber}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {member.isAdmin && (
            <Link
              href="/caisse"
              /* min-h matches the global touch target: the rule next to it
                 only reaches <button>, and these two must line up. */
              className="bg-chip hover:bg-chip-hover text-ink rounded-pill text-label inline-flex min-h-11 items-center px-3.5 py-2.25 font-semibold transition-colors"
            >
              Vue caisse
            </Link>
          )}

          <form action={logOut}>
            <button type="submit" className="text-ink-soft text-label px-1.5 py-2.25 font-semibold">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <BalanceCard balanceCents={balanceCents} capCents={member.capCents} />
      <CapAlert balanceCents={balanceCents} capCents={member.capCents} />
      <History entries={entries} />

      <div className="mt-7 flex justify-center">
        <LargeTextToggle />
      </div>
    </main>
  );
}
