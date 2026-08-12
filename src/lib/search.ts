/*
 * Searching for a person by name.
 *
 * Framework-free so it can be unit-tested and reused: the login screen filters
 * the member list with it, and the till dashboard will do the same.
 */

/**
 * Lowercases and strips accents.
 *
 * Nobody hunts for the "é" key on a phone to find themselves, so "emilie" has
 * to match "Émilie". Normalising to NFD splits a letter from its accent, which
 * can then be dropped.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Splits a name into searchable words.
 *
 * Anything that is not a letter or a digit separates: "Jean-Pierre" has to be
 * findable by typing "pierre", and "D'Artagnan" by typing "artagnan".
 */
function wordsOf(text: string): string[] {
  return normalizeForSearch(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Does this name match what has been typed?
 *
 * Every word typed must begin one of the words of the name — which is how
 * people actually search for themselves: first name, or surname, or the start
 * of both. An empty query matches everything.
 */
export function matchesName(name: string, query: string): boolean {
  const typed = wordsOf(query);
  if (typed.length === 0) return true;

  const words = wordsOf(name);
  return typed.every((token) => words.some((word) => word.startsWith(token)));
}

/**
 * Same, plus the licence number — what the till searches on.
 *
 * A licence matches on any part of it, not just its start: the number is
 * written "AM2299" but people read out and type the digits alone.
 */
export function matchesMember(
  member: { name: string; licenceNumber: string | null },
  query: string,
): boolean {
  if (matchesName(member.name, query)) return true;
  if (!member.licenceNumber) return false;

  const typed = normalizeForSearch(query).trim();
  return typed.length > 0 && normalizeForSearch(member.licenceNumber).includes(typed);
}
