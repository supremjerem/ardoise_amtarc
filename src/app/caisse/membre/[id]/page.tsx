import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { requireAdmin } from "@/lib/auth";
import { calculateBalance, describeBalance, isOverCap } from "@/lib/balance";
import { listActiveTariffs, readMemberHistory } from "@/lib/ledger";
import { listMemberOptions, readMember } from "@/lib/members";
import { formatMoney } from "@/lib/money";
import { readSettings } from "@/lib/settings";

import { MemberActions } from "./member-actions";
import { TillHistory } from "./till-history";

export const metadata: Metadata = {
  title: "Fiche membre — Caisse du club",
};

const AMOUNT_COLOURS = {
  debt: "text-debt",
  credit: "text-credit",
  settled: "text-paid",
} as const;

/*
 * A member's record, as the till sees it: everything about them, everything
 * they owe, and every action that can be taken on their behalf.
 */
export default async function Page({ params }: PageProps<"/caisse/membre/[id]">) {
  await requireAdmin();

  const { id } = await params;
  const member = await readMember(id);
  /* An unknown or archived id is a 404, not an empty page. */
  if (!member) notFound();

  const [entries, tariffs, options, settings] = await Promise.all([
    readMemberHistory(member.id),
    listActiveTariffs(),
    listMemberOptions(),
    readSettings(),
  ]);

  const balanceCents = calculateBalance(entries);
  const balance = describeBalance(balanceCents);

  return (
    <main id="contenu" className="flex w-full max-w-190 flex-col px-5 pb-25">
      <header className="flex items-center gap-2.5 px-0.5 pt-6 pb-4.5">
        <Link
          href="/caisse"
          aria-label="Retour à la caisse"
          className="text-ink-soft inline-flex min-h-11 items-center px-1 text-xl"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{member.name}</h1>
      </header>

      <section className="bg-surface rounded-card mb-3.5 p-5.5">
        <div className="mb-4.5 flex items-center gap-3.5">
          <Avatar name={member.name} colorIndex={member.avatarColorIndex} size="lg" />
          <div className="text-ink-soft min-w-0 text-sm">
            <p>{member.licenceNumber ? `Licence ${member.licenceNumber}` : "Sans licence"}</p>
            <p className="mt-0.5 truncate">{member.email ?? "—"}</p>
            <p className="mt-0.5">{member.phone ?? "—"}</p>
          </div>
        </div>

        <div className="border-line-soft border-t pt-3.5 text-center">
          <h2 className="text-ink-soft text-label font-semibold tracking-[0.5px] uppercase">
            Solde
          </h2>
          <p
            className={`font-display text-amount-sm mt-1.5 font-bold ${AMOUNT_COLOURS[balance.status]}`}
          >
            {balance.amountLabel}
          </p>
          <p className="text-ink-soft text-label mt-1.5">
            Plafond&nbsp;: {formatMoney(member.capCents)}
          </p>
        </div>
      </section>

      {isOverCap(balanceCents, member.capCents) && (
        <p className="bg-debt-bg text-debt-ink rounded-tile mb-3.5 px-4 py-3.5 text-sm font-medium">
          {member.name} a dépassé son plafond de {formatMoney(member.capCents)}.
        </p>
      )}

      <MemberActions
        member={{
          id: member.id,
          name: member.name,
          licenceNumber: member.licenceNumber,
          email: member.email,
          phone: member.phone,
          capCents: member.capCents,
          isAdmin: member.isAdmin,
        }}
        memberOptions={options}
        tariffs={tariffs}
        defaultCapCents={settings.defaultCapCents}
      />

      <TillHistory entries={entries} />
    </main>
  );
}
