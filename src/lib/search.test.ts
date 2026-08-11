import { describe, expect, it } from "vitest";

import { matchesName, normalizeForSearch } from "./search";

describe("normalizeForSearch", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeForSearch("Émilie")).toBe("emilie");
    expect(normalizeForSearch("Lefèvre")).toBe("lefevre");
    expect(normalizeForSearch("FRANÇOIS")).toBe("francois");
  });
});

describe("matchesName", () => {
  it("matches the start of the first name", () => {
    expect(matchesName("Bernard Lefèvre", "ber")).toBe(true);
  });

  it("matches the start of the surname", () => {
    expect(matchesName("Bernard Lefèvre", "lef")).toBe(true);
  });

  it("matches on both at once", () => {
    expect(matchesName("Bernard Lefèvre", "ber lef")).toBe(true);
    expect(matchesName("Bernard Lefèvre", "lef ber")).toBe(true);
  });

  it("ignores accents in either direction", () => {
    expect(matchesName("Émilie Rousseau", "emi")).toBe(true);
    expect(matchesName("Emilie Rousseau", "émi")).toBe(true);
    expect(matchesName("Bernard Lefèvre", "lefev")).toBe(true);
  });

  it("ignores case", () => {
    expect(matchesName("Karim Haddad", "KAR")).toBe(true);
  });

  it("finds a name across a hyphen or an apostrophe", () => {
    expect(matchesName("Jean-Pierre Dupont", "pierre")).toBe(true);
    expect(matchesName("Charles D'Artagnan", "artagnan")).toBe(true);
  });

  it("matches the start of a word, not its middle", () => {
    /* Otherwise "ar" would return half the club and help nobody. */
    expect(matchesName("Bernard Lefèvre", "rnard")).toBe(false);
  });

  it("rejects a name that matches only one of two words typed", () => {
    expect(matchesName("Bernard Lefèvre", "ber dupont")).toBe(false);
  });

  it("shows everyone when nothing has been typed", () => {
    expect(matchesName("Bernard Lefèvre", "")).toBe(true);
    expect(matchesName("Bernard Lefèvre", "   ")).toBe(true);
  });
});
