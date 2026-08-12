import type { TransactionKind } from "@/db/schema";

import { formatMoney, formatMoneyAbsolute } from "./money";

/*
 * Balance calculation.
 *
 * A member's balance = sum(debits) - sum(credits), over live entries only.
 * A reminder (amount 0) never takes part in the calculation.
 *
 * A POSITIVE balance is a debt towards the club.
 * A NEGATIVE balance is credit in the member's favour.
 *
 * Everything is in integer cents, so comparisons are exact and need no
 * tolerance window (the prototype had to allow an epsilon of 0.001 EUR to
 * hide floating-point drift — see design_reference.html:497).
 */

export type BalanceEntry = {
  kind: TransactionKind;
  amountCents: number;
  voidedAt?: Date | string | null;
};

/** Does this entry take part in the balance? */
export function countsTowardBalance(entry: BalanceEntry): boolean {
  if (entry.voidedAt) return false;
  return entry.kind === "debit" || entry.kind === "credit";
}

/** Signed contribution of a single entry, in cents. */
export function balanceContribution(entry: BalanceEntry): number {
  if (!countsTowardBalance(entry)) return 0;
  return entry.kind === "debit" ? entry.amountCents : -entry.amountCents;
}

/** A member's balance from their entries, in cents. */
export function calculateBalance(entries: readonly BalanceEntry[]): number {
  return entries.reduce((total, entry) => total + balanceContribution(entry), 0);
}

/* ------------------------------------------------------------------ */
/* Balance status                                                      */
/* ------------------------------------------------------------------ */

export type BalanceStatus = "debt" | "settled" | "credit";

export type BalanceInfo = {
  status: BalanceStatus;
  /** Status caption, exactly as shown to the member (French UI copy). */
  statusLabel: string;
  /** Formatted amount, ready to display ("12,50 €", "Avoir 4,00 €"). */
  amountLabel: string;
  /** Design token name to colour the amount with. */
  color: "debt" | "paid" | "credit";
};

/**
 * Describes a balance for display. The three cases come from the prototype:
 * "À régler", "Compte à jour", "Avoir en votre faveur".
 */
export function describeBalance(balanceCents: number): BalanceInfo {
  if (balanceCents > 0) {
    return {
      status: "debt",
      statusLabel: "À régler",
      amountLabel: formatMoney(balanceCents),
      color: "debt",
    };
  }
  if (balanceCents < 0) {
    return {
      status: "credit",
      statusLabel: "Avoir en votre faveur",
      amountLabel: `Avoir ${formatMoneyAbsolute(balanceCents)}`,
      color: "credit",
    };
  }
  return {
    status: "settled",
    statusLabel: "Compte à jour",
    amountLabel: formatMoney(0),
    color: "paid",
  };
}

/* ------------------------------------------------------------------ */
/* Spending cap                                                        */
/* ------------------------------------------------------------------ */

/** Is the member over their cap? Strictly above, as in the prototype. */
export function isOverCap(balanceCents: number, capCents: number): boolean {
  return balanceCents > capCents;
}

/**
 * Progress-bar fill as a whole percentage, clamped to [0, 100].
 * Credit shows an empty bar rather than a negative one.
 */
export function capPercentage(balanceCents: number, capCents: number): number {
  if (capCents <= 0) return 0;
  const raw = Math.round((balanceCents / capCents) * 100);
  return Math.min(100, Math.max(0, raw));
}

/* ------------------------------------------------------------------ */
/* Dashboard aggregates                                                */
/* ------------------------------------------------------------------ */

export type MemberBalance = { balanceCents: number; capCents: number };

/**
 * "Total dû": the sum of POSITIVE balances only.
 * One member's credit does not offset another's debt — this figure answers
 * "how much is the till still owed?".
 */
export function totalOwed(members: readonly MemberBalance[]): number {
  return members.reduce((total, member) => total + Math.max(0, member.balanceCents), 0);
}

/** How many members are over their own cap. */
export function countOverCap(members: readonly MemberBalance[]): number {
  return members.filter((member) => isOverCap(member.balanceCents, member.capCents)).length;
}

/* ------------------------------------------------------------------ */
/* History line rendering                                              */
/* ------------------------------------------------------------------ */

export type HistoryLine = {
  /** "+8,00 €", "−8,00 €", or empty for a reminder. */
  amountLabel: string;
  color: "debt" | "paid" | "neutral";
};

/**
 * Wording of a history line.
 *
 * The note is what the till manager typed ("Bières", "Règlement espèces"), so
 * it wins whenever there is one. A blank note still has to read as something:
 * an undated, unlabelled line in one's own account is unsettling.
 */
export function entryLabel(kind: TransactionKind, note: string | null): string {
  const written = note?.trim();
  if (written) return written;

  if (kind === "debit") return "Dépense";
  if (kind === "credit") return "Paiement reçu";
  return "Rappel envoyé";
}

/** Signed amount of a history line, with its colour. */
export function describeEntry(entry: BalanceEntry): HistoryLine {
  if (entry.kind === "debit") {
    return { amountLabel: `+${formatMoney(entry.amountCents)}`, color: "debt" };
  }
  if (entry.kind === "credit") {
    return { amountLabel: `−${formatMoney(entry.amountCents)}`, color: "paid" };
  }
  return { amountLabel: "", color: "neutral" };
}
