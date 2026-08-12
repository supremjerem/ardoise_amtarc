import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { members, tariffs, transactions, type TransactionKind } from "@/db/schema";

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

/** A quick-price button behind the bar: "Bière — 3,00 €". */
export type Tariff = {
  id: string;
  label: string;
  amountCents: number;
};

/**
 * The quick-price buttons, in the order the club arranged them.
 *
 * Inactive ones are left out rather than deleted: a tariff that stops being
 * sold should not rewrite the entries that used it.
 */
export async function listActiveTariffs(): Promise<Tariff[]> {
  return db
    .select({ id: tariffs.id, label: tariffs.label, amountCents: tariffs.amountCents })
    .from(tariffs)
    .where(eq(tariffs.isActive, true))
    .orderBy(asc(tariffs.sortOrder), asc(tariffs.label));
}

/* ------------------------------------------------------------------ */
/* The ledger as a whole                                               */
/* ------------------------------------------------------------------ */

/** One line of the club's full ledger, whoever it belongs to. */
export type LedgerRow = {
  id: string;
  memberName: string;
  licenceNumber: string | null;
  kind: TransactionKind;
  amountCents: number;
  note: string | null;
  occurredOn: string;
  recordedBy: string | null;
  voidedAt: Date | null;
};

/**
 * Every entry the club has ever recorded, newest first.
 *
 * Voided entries are INCLUDED here, unlike everywhere else in the app. This is
 * the accounting record: a printout or an export that quietly omitted the
 * corrections would not be the ledger, it would be a summary of it. Each line
 * carries who recorded it and whether it was later voided, so the document
 * answers "what happened, and who did it?" on its own.
 *
 * Archived members keep their lines: their history is why they are archived
 * rather than deleted.
 */
export async function readFullLedger(): Promise<LedgerRow[]> {
  const author = alias(members, "author");

  return db
    .select({
      id: transactions.id,
      memberName: members.name,
      licenceNumber: members.licenceNumber,
      kind: transactions.kind,
      amountCents: transactions.amountCents,
      note: transactions.note,
      occurredOn: transactions.occurredOn,
      recordedBy: author.name,
      voidedAt: transactions.voidedAt,
    })
    .from(transactions)
    .innerJoin(members, eq(members.id, transactions.memberId))
    .leftJoin(author, eq(author.id, transactions.createdBy))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));
}
