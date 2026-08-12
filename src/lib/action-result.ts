/*
 * What a Server Action tells the interface.
 *
 * Kept out of the "use server" files on purpose: every export there is a
 * public network endpoint, and this is a shared type, not an endpoint.
 *
 * Actions return a result rather than throwing. A failure behind the bar is
 * ordinary — a mistyped amount, a member already removed — and deserves a
 * sentence in the interface, not an error page. The messages are French
 * because they are read as they are.
 */
export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
