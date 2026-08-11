import { describe, expect, it } from "vitest";

import { AVATAR_PALETTE_SIZE, avatarBackground, initialsOf } from "./avatar";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Bernard Lefèvre")).toBe("BL");
    expect(initialsOf("Jean Pierre Dupont")).toBe("JP");
  });

  it("keeps accented letters", () => {
    expect(initialsOf("Émilie Rousseau")).toBe("ÉR");
  });

  it("copes with a single name", () => {
    expect(initialsOf("Karim")).toBe("K");
  });

  it("ignores stray whitespace", () => {
    expect(initialsOf("  Sophie   Dubois ")).toBe("SD");
  });

  it("never renders a blank disc", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarBackground", () => {
  it("maps each palette index to its own class", () => {
    const classes = Array.from({ length: AVATAR_PALETTE_SIZE }, (_, i) => avatarBackground(i));
    expect(new Set(classes).size).toBe(AVATAR_PALETTE_SIZE);
  });

  it("wraps around rather than returning undefined", () => {
    expect(avatarBackground(AVATAR_PALETTE_SIZE)).toBe(avatarBackground(0));
    expect(avatarBackground(-1)).toBe(avatarBackground(AVATAR_PALETTE_SIZE - 1));
  });
});
