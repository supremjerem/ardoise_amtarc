import { describe, expect, it } from "vitest";

import { centsToCsv, centsToInputValue, formatMoney, MAX_AMOUNT_CENTS, parseMoney } from "./money";

/*
 * Built from code points on purpose. A literal non-breaking space looks
 * exactly like an ordinary one in an editor, and telling them apart is the
 * whole point of these assertions — this caught a real bug where formatMoney
 * shipped a plain space.
 */
const NBSP = String.fromCharCode(0x00a0); // non-breaking space
const SPACE = String.fromCharCode(0x0020); // ordinary space
const MINUS = String.fromCharCode(0x2212); // typographic minus

describe("formatMoney", () => {
  it("should always render two decimals with a French comma", () => {
    expect(formatMoney(1250)).toBe(`12,50${NBSP}€`);
    expect(formatMoney(300)).toBe(`3,00${NBSP}€`);
    expect(formatMoney(5)).toBe(`0,05${NBSP}€`);
    expect(formatMoney(0)).toBe(`0,00${NBSP}€`);
  });

  it("should separate amount and symbol with a non-breaking space", () => {
    // The euro sign must never wrap onto its own line.
    expect(formatMoney(1250)).toContain(NBSP);
    expect(formatMoney(1250)).not.toContain(SPACE);
  });

  it("should use a typographic minus sign for credits", () => {
    expect(formatMoney(-450)).toBe(`${MINUS}4,50${NBSP}€`);
  });

  it("should handle large amounts without loss", () => {
    expect(formatMoney(1_000_000)).toBe(`10000,00${NBSP}€`);
  });
});

describe("parseMoney", () => {
  it("should accept a comma as well as a dot", () => {
    expect(parseMoney("3,30")).toBe(330);
    expect(parseMoney("3.30")).toBe(330);
  });

  it("should accept a whole amount with no decimals", () => {
    expect(parseMoney("3")).toBe(300);
    expect(parseMoney("12")).toBe(1200);
  });

  it("should pad a single decimal digit", () => {
    // "3,5" typed quickly at the bar means 3.50 EUR, not 3.05 EUR.
    expect(parseMoney("3,5")).toBe(350);
  });

  it("should tolerate spaces and a stray euro sign", () => {
    expect(parseMoney(" 3,30 € ")).toBe(330);
    expect(parseMoney("3 , 30")).toBe(330);
  });

  it("should reject anything that is not an amount", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("3,333")).toBeNull(); // three decimals is not a euro amount
    expect(parseMoney("-5")).toBeNull(); // the sign comes from the entry kind
    expect(parseMoney("3,")).toBeNull();
    expect(parseMoney(",")).toBeNull();
  });

  it("should reject amounts above the entry ceiling", () => {
    expect(parseMoney("10000")).toBe(MAX_AMOUNT_CENTS);
    expect(parseMoney("10000,01")).toBeNull();
  });

  it("should round-trip exactly on the values that trap floating point", () => {
    // 0.10 and 0.70 are precisely the values binary floating point rounds off.
    for (const input of ["0,10", "0,20", "0,70", "1,10", "3,30", "5,55"]) {
      const cents = parseMoney(input);
      expect(cents).not.toBeNull();
      expect(formatMoney(cents!)).toBe(`${input}${NBSP}€`);
    }
  });
});

describe("output conversions", () => {
  it("should produce an HTML input value with a decimal dot", () => {
    expect(centsToInputValue(1250)).toBe("12.50");
    expect(centsToInputValue(5)).toBe("0.05");
  });

  it("should produce a bare French-formatted CSV amount", () => {
    expect(centsToCsv(1250)).toBe("12,50");
    expect(centsToCsv(-450)).toBe("-4,50");
    expect(centsToCsv(0)).toBe("0,00");
  });
});
