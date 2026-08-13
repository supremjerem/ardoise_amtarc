/*
 * The codes the development seed gives its demo accounts.
 *
 * They live in their own module, free of imports and side effects, because
 * two very different things need them: the seed that hashes them, and the
 * end-to-end suite that signs in with them. Importing seed.ts to read them
 * would run the seed and call process.exit — it is a script, not a library.
 *
 * These are development-only. The seed refuses to run with
 * NODE_ENV=production, and a real deployment sets its own codes.
 */

/** Six digits, because a till manager's code opens every member's record. */
export const ADMIN_PIN = "480215";

/** Four digits, the length an ordinary member is asked for. */
export const MEMBER_PIN = "7391";
