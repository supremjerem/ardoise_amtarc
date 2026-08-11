# 5. Void and archive, never hard-delete financial records

- Status: accepted
- Date: 2026-08-11

## Context

The prototype deletes outright: a transaction row has a ✕, and a member can be removed with a
confirmation reading "Supprimer définitivement ce membre et tout son historique ?".

Several named till managers share responsibility for the same money. When a balance is
disputed weeks later, "who recorded this, and who removed it?" has to be answerable. A
destructive delete makes that impossible, and one mistaken tap silently rewrites what someone
owes.

## Decision

- **Transactions are voided, not deleted**: `voided_at` and `voided_by` are set. The row
  leaves the display and the balance calculation, and stays in the ledger and the audit log.
- **Members with history are archived**: `archived_at` is set. They disappear from lists and
  from the login screen; their entries remain for the accounts.
- **Members with no transactions can be hard-deleted** — nothing accounting-related is lost.
- Every till action is written to `audit_log` with its actor.

## Consequences

- The confirmation copy tells the truth ("history is kept for the accounts") instead of
  promising a permanent deletion that does not happen.
- Every balance query must filter on `voided_at IS NULL`; every member listing on
  `archived_at IS NULL`. This is centralised in the data-access layer, and the balance rule is
  covered by unit tests.
- The ledger grows monotonically. At this club's volume that is irrelevant.
- GDPR: a genuine erasure request is handled by anonymising the member row while keeping the
  accounting entries, rather than by deleting the history. Not implemented yet — the club has
  no such request today, and building it speculatively would be guesswork.
