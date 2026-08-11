import { describe, expect, it } from "vitest";

import {
  type BalanceEntry,
  calculateBalance,
  capPercentage,
  countOverCap,
  describeBalance,
  describeEntry,
  isOverCap,
  totalOwed,
} from "./balance";

const debit = (cents: number, extra: Partial<BalanceEntry> = {}): BalanceEntry => ({
  kind: "debit",
  amountCents: cents,
  ...extra,
});

const credit = (cents: number, extra: Partial<BalanceEntry> = {}): BalanceEntry => ({
  kind: "credit",
  amountCents: cents,
  ...extra,
});

const reminder = (): BalanceEntry => ({ kind: "reminder", amountCents: 0 });

describe("calculateBalance", () => {
  it("should be zero with no entries", () => {
    expect(calculateBalance([])).toBe(0);
  });

  it("should add debits and subtract credits", () => {
    expect(calculateBalance([debit(800), credit(300)])).toBe(500);
  });

  it("should ignore reminders", () => {
    // A reminder is a trace, not an accounting entry.
    expect(calculateBalance([debit(800), reminder(), reminder()])).toBe(800);
  });

  it("should ignore voided entries", () => {
    const entries = [debit(800), debit(500, { voidedAt: new Date() })];
    expect(calculateBalance(entries)).toBe(800);
  });

  it("should accept a voided timestamp given as a string", () => {
    // Postgres may return a serialized timestamp depending on the read path.
    expect(calculateBalance([debit(800, { voidedAt: "2026-08-01T10:00:00Z" })])).toBe(0);
  });

  it("should go negative when the member paid ahead", () => {
    expect(calculateBalance([debit(500), credit(800)])).toBe(-300);
  });

  it("should stay exact where floating point drifts", () => {
    // Ten coffees at 0.10 EUR: in floating point the sum is 0.9999999999999999.
    const tenCoffees = Array.from({ length: 10 }, () => debit(10));
    expect(calculateBalance(tenCoffees)).toBe(100);

    // The member settles exactly what they owe: the balance lands on zero.
    const purchases = [330, 110, 220, 440, 115, 70, 550, 235];
    const entries = [...purchases.map((cents) => debit(cents)), credit(2070)];
    expect(calculateBalance(entries)).toBe(0);
    expect(describeBalance(calculateBalance(entries)).status).toBe("settled");
  });
});

describe("describeBalance", () => {
  it("should describe a debt", () => {
    const info = describeBalance(1250);
    expect(info.status).toBe("debt");
    expect(info.statusLabel).toBe("À régler");
    expect(info.color).toBe("debt");
  });

  it("should describe a settled account", () => {
    const info = describeBalance(0);
    expect(info.status).toBe("settled");
    expect(info.statusLabel).toBe("Compte à jour");
    expect(info.color).toBe("paid");
  });

  it("should describe credit without showing a negative sign", () => {
    const info = describeBalance(-450);
    expect(info.status).toBe("credit");
    expect(info.statusLabel).toBe("Avoir en votre faveur");
    expect(info.amountLabel).toContain("Avoir");
    expect(info.amountLabel).not.toContain("−");
    expect(info.color).toBe("credit");
  });

  it("should switch status at the cent", () => {
    expect(describeBalance(1).status).toBe("debt");
    expect(describeBalance(0).status).toBe("settled");
    expect(describeBalance(-1).status).toBe("credit");
  });
});

describe("spending cap", () => {
  it("should trigger strictly above the cap, not at equality", () => {
    expect(isOverCap(2500, 2500)).toBe(false);
    expect(isOverCap(2501, 2500)).toBe(true);
    expect(isOverCap(2499, 2500)).toBe(false);
  });

  it("should compute the progress-bar fill", () => {
    expect(capPercentage(1250, 2500)).toBe(50);
    expect(capPercentage(0, 2500)).toBe(0);
  });

  it("should clamp the bar at 100 percent even far above the cap", () => {
    expect(capPercentage(9000, 2500)).toBe(100);
  });

  it("should show an empty bar for a credit balance", () => {
    expect(capPercentage(-500, 2500)).toBe(0);
  });

  it("should not divide by a zero cap", () => {
    expect(capPercentage(1250, 0)).toBe(0);
  });
});

describe("dashboard aggregates", () => {
  const members = [
    { balanceCents: 2100, capCents: 2500 }, // under their cap
    { balanceCents: 2900, capCents: 2500 }, // over
    { balanceCents: -400, capCents: 2500 }, // in credit
    { balanceCents: 0, capCents: 2500 }, // settled
  ];

  it("should count only positive balances in the total owed", () => {
    // The 4 EUR of credit must not reduce what others owe:
    // the till still has 50 EUR to collect.
    expect(totalOwed(members)).toBe(5000);
  });

  it("should count members over their cap", () => {
    expect(countOverCap(members)).toBe(1);
  });

  it("should respect each member's own cap", () => {
    const withDifferentCaps = [
      { balanceCents: 2100, capCents: 2000 }, // over THEIR cap
      { balanceCents: 2100, capCents: 3000 }, // under theirs
    ];
    expect(countOverCap(withDifferentCaps)).toBe(1);
  });
});

describe("describeEntry", () => {
  it("should prefix a debit with a plus sign", () => {
    const line = describeEntry(debit(800));
    expect(line.amountLabel.startsWith("+")).toBe(true);
    expect(line.color).toBe("debt");
  });

  it("should prefix a credit with a minus sign", () => {
    const line = describeEntry(credit(800));
    expect(line.amountLabel.startsWith("−")).toBe(true);
    expect(line.color).toBe("paid");
  });

  it("should show no amount on a reminder", () => {
    expect(describeEntry(reminder()).amountLabel).toBe("");
  });
});
