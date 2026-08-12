import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { members, transactions, type Member } from "@/db/schema";
import { calculateBalance } from "@/lib/balance";
import { requiredPinLength } from "@/lib/pin";

/*
 * Member reads.
 *
 * Kept out of the "use server" action files: every export there is a public
 * network endpoint, whereas these are plain functions called during render.
 */

/** The little a member needs to expose to be picked on the login screen. */
export type LoginMember = {
  id: string;
  name: string;
  avatarColorIndex: number;
  isAdmin: boolean;
  /*
   * How many digits the keypad must collect — four for a member, six for a
   * till manager (see requiredPinLength). Resolved here rather than in the
   * browser: src/lib/pin.ts pulls in Argon2, which has no place in a client
   * bundle, and the rule must not be restated in two languages of truth.
   */
  pinLength: number;
};

/**
 * Active members, for the "Qui êtes-vous ?" step.
 *
 * This list is served to anyone who opens the app — it is what lets a member
 * sign in without typing an identifier, which is the whole point for this
 * audience. So it carries names only: no PIN hash, no email, no phone. The
 * knowledge that someone belongs to the club is not what the PIN protects.
 *
 * Archived members are excluded: someone who left must not still be offered.
 */
export async function listMembersForLogin(): Promise<LoginMember[]> {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      avatarColorIndex: members.avatarColorIndex,
      isAdmin: members.isAdmin,
    })
    .from(members)
    .where(isNull(members.archivedAt));

  return rows
    .map((row) => ({ ...row, pinLength: requiredPinLength(row.isAdmin) }))
    .sort(byFrenchName);
}

/*
 * Sorting happens here rather than in ORDER BY on purpose.
 *
 * A database sorts by its own collation, and under the common "C" locale
 * "Émilie" lands after "Thomas" — the one name someone would never think to
 * scroll for. Rather than depend on how the production server was initialised,
 * the club-sized list is ordered in French here, where the rule is explicit.
 */
const frenchNames = new Intl.Collator("fr", { sensitivity: "base" });

function byFrenchName(a: { name: string }, b: { name: string }): number {
  return frenchNames.compare(a.name, b.name);
}

/* ------------------------------------------------------------------ */
/* Till views                                                          */
/* ------------------------------------------------------------------ */

/** A row of the till's member index. */
export type MemberWithBalance = {
  id: string;
  name: string;
  licenceNumber: string | null;
  avatarColorIndex: number;
  isAdmin: boolean;
  capCents: number;
  balanceCents: number;
};

/**
 * Every active member with their balance, heaviest debt first.
 *
 * The balances are worked out from the entries in `calculateBalance` rather
 * than summed in SQL. That keeps one tested rule as the only place a balance
 * is ever computed — a second implementation in SQL is exactly how a screen
 * ends up disagreeing with the ledger it came from.
 *
 * The cost is reading the club's live entries on each dashboard load. For a
 * club that is thousands of rows, and one query. Should it ever reach the
 * point of hurting, aggregate in SQL — and cover it with a test that both
 * paths agree.
 */
export async function listMembersWithBalances(): Promise<MemberWithBalance[]> {
  const [rows, entries] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        licenceNumber: members.licenceNumber,
        avatarColorIndex: members.avatarColorIndex,
        isAdmin: members.isAdmin,
        capCents: members.capCents,
      })
      .from(members)
      .where(isNull(members.archivedAt)),

    db
      .select({
        memberId: transactions.memberId,
        kind: transactions.kind,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .where(isNull(transactions.voidedAt)),
  ]);

  const byMember = new Map<
    string,
    { kind: (typeof entries)[number]["kind"]; amountCents: number }[]
  >();
  for (const entry of entries) {
    const list = byMember.get(entry.memberId);
    if (list) list.push(entry);
    else byMember.set(entry.memberId, [entry]);
  }

  return rows
    .map((row) => ({
      ...row,
      balanceCents: calculateBalance(byMember.get(row.id) ?? []),
    }))
    .sort((a, b) => b.balanceCents - a.balanceCents || frenchNames.compare(a.name, b.name));
}

/**
 * One member's full record, for the till's detail screen.
 * Returns null when the id matches nothing or an archived member.
 *
 * The id comes straight from the URL, so it is checked before it reaches the
 * database: Postgres raises on a malformed uuid, which would turn a mistyped
 * link into a 500 where the honest answer is "no such member".
 */
export async function readMember(memberId: string): Promise<Member | null> {
  if (!z.uuid().safeParse(memberId).success) return null;

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), isNull(members.archivedAt)))
    .limit(1);

  return member ?? null;
}

/** Names and ids only, to populate the transaction modal's member selector. */
export async function listMemberOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(isNull(members.archivedAt));

  return rows.sort(byFrenchName);
}

/** The till managers, for the settings screen. */
export async function listManagers(): Promise<
  { id: string; name: string; avatarColorIndex: number }[]
> {
  const rows = await db
    .select({ id: members.id, name: members.name, avatarColorIndex: members.avatarColorIndex })
    .from(members)
    .where(and(eq(members.isAdmin, true), isNull(members.archivedAt)));

  return rows.sort(byFrenchName);
}
