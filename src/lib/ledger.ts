import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { transactions, type TransactionKind } from "@/db/schema";

/*
 * Ledger reads.
 *
 * Voided entries are left out. They stay in the database for the audit trail
 * (see docs/adr/0005), but a member looking at their own slate should see what
 * they owe, not a struck-through record of the till manager's typing mistakes.
 */

export type LedgerEntry = {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  note: string | null;
  /** Business date, as "YYYY-MM-DD" — see src/lib/dates.ts. */
  occurredOn: string;
};

/**
 * One member's live entries, newest first.
 *
 * The balance is computed from these rows rather than summed in SQL: a member
 * has tens of entries, not millions, and it keeps a single tested rule
 * (`calculateBalance`) as the only place a balance is ever worked out.
 */
export async function readMemberHistory(memberId: string): Promise<LedgerEntry[]> {
  return (
    db
      .select({
        id: transactions.id,
        kind: transactions.kind,
        amountCents: transactions.amountCents,
        note: transactions.note,
        occurredOn: transactions.occurredOn,
      })
      .from(transactions)
      .where(and(eq(transactions.memberId, memberId), isNull(transactions.voidedAt)))
      /* Same-day entries keep the order they were keyed in, newest first. */
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
  );
}
