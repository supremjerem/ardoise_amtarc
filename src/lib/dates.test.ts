import { describe, expect, it } from "vitest";

import { formatEntryDate } from "./dates";

describe("formatEntryDate", () => {
  it("formats a business date in French", () => {
    expect(formatEntryDate("2026-08-11")).toBe("11 août 2026");
  });

  it("keeps a leading zero on the day", () => {
    expect(formatEntryDate("2026-08-05")).toBe("05 août 2026");
  });

  it("does not shift the day, whatever the timezone", () => {
    /*
     * The regression this guards: `new Date("2026-01-01")` is UTC midnight,
     * which is 31 December anywhere west of Greenwich.
     */
    expect(formatEntryDate("2026-01-01")).toContain("01");
    expect(formatEntryDate("2026-01-01")).toContain("2026");
    expect(formatEntryDate("2026-12-31")).toContain("31");
    expect(formatEntryDate("2026-12-31")).toContain("2026");
  });

  it("returns the raw value when it is not a date", () => {
    expect(formatEntryDate("")).toBe("");
    expect(formatEntryDate("hier")).toBe("hier");
  });
});
