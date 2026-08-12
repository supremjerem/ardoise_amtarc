import { describe, expect, it } from "vitest";

import { sanitizeForSpreadsheet, toCsv, UTF8_BOM } from "./csv";

describe("toCsv", () => {
  it("separates columns with a semicolon, not a comma", () => {
    /*
     * The regression that matters: amounts are written "12,50" in French, so
     * a comma-separated file splits every amount across two columns.
     */
    const csv = toCsv([
      ["Membre", "Montant"],
      ["Karim Haddad", "12,50"],
    ]);
    expect(csv).toContain("Karim Haddad;12,50");
    expect(csv).not.toContain("Karim Haddad,12,50");
  });

  it("starts with a byte order mark so Excel reads UTF-8", () => {
    expect(toCsv([["Émilie"]]).startsWith(UTF8_BOM)).toBe(true);
  });

  it("ends every line with CRLF", () => {
    expect(toCsv([["a"], ["b"]])).toBe(`${UTF8_BOM}a\r\nb\r\n`);
  });

  it("quotes a value containing the separator", () => {
    expect(toCsv([["Bières; chips"]])).toContain('"Bières; chips"');
  });

  it("doubles quotes inside a quoted value", () => {
    expect(toCsv([['Il a dit "merci"']])).toContain('"Il a dit ""merci"""');
  });

  it("quotes a value containing a line break", () => {
    expect(toCsv([["deux\nlignes"]])).toContain('"deux\nlignes"');
  });

  it("leaves an ordinary value alone", () => {
    expect(toCsv([["Bière"]])).toBe(`${UTF8_BOM}Bière\r\n`);
  });
});

describe("sanitizeForSpreadsheet", () => {
  it("defuses a value a spreadsheet would run as a formula", () => {
    expect(sanitizeForSpreadsheet("=1+1")).toBe("'=1+1");
    expect(sanitizeForSpreadsheet("+33 6 12 34 56 78")).toBe("'+33 6 12 34 56 78");
    expect(sanitizeForSpreadsheet("@import")).toBe("'@import");
    expect(sanitizeForSpreadsheet("-cmd")).toBe("'-cmd");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeForSpreadsheet("Bières")).toBe("Bières");
    expect(sanitizeForSpreadsheet("Règlement espèces")).toBe("Règlement espèces");
    expect(sanitizeForSpreadsheet("")).toBe("");
  });
});
