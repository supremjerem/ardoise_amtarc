import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

/*
 * Who did what, and when.
 *
 * The table was designed for this from the start and nothing had ever written
 * to it — the README promised an audit log that did not exist. Entries on the
 * ledger already carry `createdBy` and `voidedBy`, so money was traceable;
 * what left no trace at all was everything around it. Who promoted somebody to
 * till manager, who changed a member's code, who retired an account: precisely
 * the questions a club asks when something looks wrong, and precisely the ones
 * nothing could answer.
 *
 * NEVER put a PIN, a hash or a secret in `payload`. It is written to answer
 * "what changed", not "what was it changed to" when the value is a credential.
 */

export type AuditEntry = {
  /** The signed-in manager who performed it. */
  actorId: string;
  /** "member.create", "settings.update"… as named in the schema. */
  action: string;
  entity: "member" | "transaction" | "tariff" | "settings";
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Records an entry, best effort.
 *
 * A failure here is logged and swallowed rather than propagated. The choice is
 * deliberate and worth stating: refusing a payment because its audit row would
 * not insert leaves the club unable to work, and the money movement itself is
 * already recorded on the ledger with its author. A gap in this table is a
 * gap in the story, not in the accounts.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      payload: entry.payload ?? null,
    });
  } catch (error) {
    console.error("Audit entry could not be written:", entry.action, error);
  }
}
