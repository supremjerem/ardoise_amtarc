import type { Metadata } from "next";
import Link from "next/link";

import { logOut } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/auth";
import { countOverCap, totalOwed } from "@/lib/balance";
import { listActiveTariffs } from "@/lib/ledger";
import { listMembersWithBalances } from "@/lib/members";
import { formatMoney } from "@/lib/money";
import { readSettings } from "@/lib/settings";

import { MemberIndex } from "./member-index";

export const metadata: Metadata = {
  title: "Caisse du club — L'ardoise du club",
};

/*
 * The till dashboard: what the club is owed, who is over their cap, and the
 * way in to every member.
 */
export default async function Page() {
  await requireAdmin();

  const [membersWithBalances, tariffs, settings] = await Promise.all([
    listMembersWithBalances(),
    listActiveTariffs(),
    readSettings(),
  ]);

  const owed = totalOwed(membersWithBalances);
  const overCap = countOverCap(membersWithBalances);

  return (
    <main id="contenu" className="flex w-full max-w-190 flex-col px-5 pb-25">
      <header className="flex items-center justify-between gap-3 px-0.5 pt-6 pb-4.5">
        <div>
          <p className="font-display text-brand-letters text-label font-bold tracking-[0.16em]">
            {settings.clubName}
          </p>
          <h1 className="font-display mt-0.5 text-xl font-semibold">Caisse du club</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/moi"
            className="bg-chip hover:bg-chip-hover text-ink rounded-pill text-label inline-flex min-h-11 items-center px-3.5 py-2.25 font-semibold transition-colors"
          >
            Mon ardoise
          </Link>

          <Link
            href="/caisse/reglages"
            className="text-ink-soft text-label inline-flex min-h-11 items-center px-1.5 py-2.25 font-semibold"
          >
            Réglages
          </Link>

          <form action={logOut}>
            <button type="submit" className="text-ink-soft text-label px-1.5 py-2.25 font-semibold">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="mb-4.5 flex gap-3">
        <Stat label="Total dû" value={formatMoney(owed)} />
        <Stat
          label="Au-dessus du plafond"
          value={String(overCap)}
          /* Only coloured when there is actually something to chase. */
          valueClass={overCap > 0 ? "text-debt" : undefined}
        />
      </div>

      <MemberIndex
        members={membersWithBalances}
        tariffs={tariffs}
        defaultCapCents={settings.defaultCapCents}
      />
    </main>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-surface rounded-tile flex-1 px-4.5 py-4">
      <p className="text-ink-soft text-label font-semibold">{label}</p>
      <p className={`font-display mt-1 text-xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
