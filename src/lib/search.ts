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
