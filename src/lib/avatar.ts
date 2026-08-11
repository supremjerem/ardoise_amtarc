/*
 * Avatars.
 *
 * The club has no photo for most members, so an avatar is a pair of initials
 * on a coloured disc. The colour is not derived from the name: it is stored
 * per member (`avatarColorIndex`), so a rename never reshuffles the faces
 * someone has learned to recognise in the list.
 */

/** Must match --color-avatar-0..4 in styles/tokens.css. */
const AVATAR_BACKGROUNDS = [
  "bg-avatar-0",
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
] as const;

export const AVATAR_PALETTE_SIZE = AVATAR_BACKGROUNDS.length;

/**
 * Background class for a stored palette index.
 *
 * The class names above are written out in full on purpose: Tailwind scans
 * source text, so a class built by interpolation would never be generated.
 */
export function avatarBackground(colorIndex: number): string {
  const safe =
    ((Math.trunc(colorIndex) % AVATAR_PALETTE_SIZE) + AVATAR_PALETTE_SIZE) % AVATAR_PALETTE_SIZE;
  return AVATAR_BACKGROUNDS[safe];
}

/**
 * Initials of a name: first letter of the first two words.
 * "Bernard Lefèvre" -> "BL", "Émilie Rousseau" -> "ÉR".
 */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word)[0])
    .slice(0, 2)
    .join("");

  /* A member always has a name, but an empty one must not render a blank disc. */
  return letters ? letters.toUpperCase() : "?";
}
