/*
 * The "grands caractères" preference, named in one place.
 *
 * Two things have to agree on these strings: the toggle that writes them, and
 * the script in layout.tsx that reads them before first paint. Spelling one of
 * them differently would not fail a build — it would simply stop the
 * preference from surviving a reload, which is exactly the sort of bug nobody
 * notices until an actual member complains.
 */

export const LARGE_TEXT_KEY = "ardoise:large-text";
export const LARGE_TEXT_CLASS = "large-text";
