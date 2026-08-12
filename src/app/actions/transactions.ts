"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { members, transactions } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { requireAdminAction } from "@/lib/auth";
import { MAX_AMOUNT_CENTS, parseMoney } from "@/lib/money";

/*
 * Till entries: putting a round on the slate, taking a payment, sending a
 * reminder, and undoing any of it.
 *
 * Every export here is a public network endpoint. Each one therefore starts
 * by proving the caller manages the till — the interface hiding a button is
 * not a permission.
 */

/** Rejects an id that is not a uuid before it ever reaches the database. */
const memberId = z.uuid({ message: "Membre introuvable." });

const transactionInput = z.object({
  memberId,
  kind: z.enum(["debit", "credit"], { message: "Choisissez une dépense ou un paiement." }),
  /* Typed by hand behind the bar: "3,50", "3.5", "3,50 €" all have to work. */
  amount: z.string(),
  note: z.string().max(120, "La note est trop longue.").optional(),
});

/** Today, as the business date "YYYY-MM-DD" in the club's own timezone. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Records an expense or a payment against a member.
 *
 * The amount is re-parsed and re-checked here even though the form already
 * did: a request can arrive without ever passing through the form.
 */
export async function recordTransaction(input: {
  memberId: string;
  kind: "debit" | "credit";
  amount: string;
  note?: string;
}): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const amountCents = parseMoney(parsed.data.amount);
  if (amountCents === null) {
    return { ok: false, message: "Montant invalide. Exemple : 3,50" };
  }
  if (amountCents === 0) {
    return { ok: false, message: "Le montant doit être supérieur à zéro." };
  }
  if (amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, message: "Ce montant paraît trop élevé, vérifiez la saisie." };
  }

  /* The member has to exist and still be in the club. */
  const [member] = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.id, parsed.data.memberId), isNull(members.archivedAt)))
    .limit(1);

  if (!member) return { ok: false, message: "Membre introuvable." };

  await db.insert(transactions).values({
    memberId: member.id,
    kind: parsed.data.kind,
    amountCents,
    note: parsed.data.note?.trim() || null,
    occurredOn: today(),
    createdBy: manager.id,
  });

  revalidateTill(member.id);

  return {
    ok: true,
    message:
      parsed.data.kind === "debit"
        ? `Dépense enregistrée pour ${member.name}.`
        : `Paiement enregistré pour ${member.name}.`,
  };
}

/**
 * Logs that a member was asked to settle up.
 *
 * Carries no amount and never moves the balance — it is a trace, so that
 * "have we already chased them?" has an answer, visible to the member too.
 */
export async function sendReminder(targetMemberId: string): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const parsed = memberId.safeParse(targetMemberId);
  if (!parsed.success) return { ok: false, message: "Membre introuvable." };

  const [member] = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.id, parsed.data), isNull(members.archivedAt)))
    .limit(1);

  if (!member) return { ok: false, message: "Membre introuvable." };

  await db.insert(transactions).values({
    memberId: member.id,
    kind: "reminder",
    amountCents: 0,
    note: "Rappel envoyé",
    occurredOn: today(),
    createdBy: manager.id,
  });

  revalidateTill(member.id);

  return { ok: true, message: `Rappel enregistré pour ${member.name}.` };
}

/**
 * Voids an entry keyed in by mistake.
 *
 * The row is not deleted: it leaves the balance and the history but stays in
 * the ledger, stamped with who voided it and when (docs/adr/0005). Voiding
 * twice is refused rather than silently overwriting the first record of it.
 */
export async function voidTransaction(transactionId: string): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const parsed = z.uuid().safeParse(transactionId);
  if (!parsed.success) return { ok: false, message: "Écriture introuvable." };

  const [entry] = await db
    .select({ id: transactions.id, memberId: transactions.memberId })
    .from(transactions)
    .where(and(eq(transactions.id, parsed.data), isNull(transactions.voidedAt)))
    .limit(1);

  if (!entry) return { ok: false, message: "Cette écriture a déjà été annulée." };

  await db
    .update(transactions)
    .set({ voidedAt: new Date(), voidedBy: manager.id })
    .where(eq(transactions.id, entry.id));

  revalidateTill(entry.memberId);

  return { ok: true, message: "Écriture annulée." };
}

/** Refreshes every screen a balance appears on. */
function revalidateTill(changedMemberId: string): void {
  revalidatePath("/caisse");
  revalidatePath(`/caisse/membre/${changedMemberId}`);
  revalidatePath("/moi");
}
