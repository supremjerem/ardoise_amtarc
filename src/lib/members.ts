import "server-only";

import { isNull } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { requiredPinLength } from "@/lib/pin";

/*
 * Member reads.
 *
 * Kept out of the "use server" action files: every export there is a public
 * network endpoint, whereas these are plain functions called during render.
 */

/** The little a member needs to expose to be picked on the login screen. */
export type LoginMember = {
  id: string;
  name: string;
  avatarColorIndex: number;
  isAdmin: boolean;
  /*
   * How many digits the keypad must collect — four for a member, six for a
   * till manager (see requiredPinLength). Resolved here rather than in the
   * browser: src/lib/pin.ts pulls in Argon2, which has no place in a client
   * bundle, and the rule must not be restated in two languages of truth.
   */
  pinLength: number;
};

/**
 * Active members, for the "Qui êtes-vous ?" step.
 *
 * This list is served to anyone who opens the app — it is what lets a member
 * sign in without typing an identifier, which is the whole point for this
 * audience. So it carries names only: no PIN hash, no email, no phone. The
 * knowledge that someone belongs to the club is not what the PIN protects.
 *
 * Archived members are excluded: someone who left must not still be offered.
 */
export async function listMembersForLogin(): Promise<LoginMember[]> {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      avatarColorIndex: members.avatarColorIndex,
      isAdmin: members.isAdmin,
    })
    .from(members)
    .where(isNull(members.archivedAt));

  return rows
    .map((row) => ({ ...row, pinLength: requiredPinLength(row.isAdmin) }))
    .sort(byFrenchName);
}

/*
 * Sorting happens here rather than in ORDER BY on purpose.
 *
 * A database sorts by its own collation, and under the common "C" locale
 * "Émilie" lands after "Thomas" — the one name someone would never think to
 * scroll for. Rather than depend on how the production server was initialised,
 * the club-sized list is ordered in French here, where the rule is explicit.
 */
const frenchNames = new Intl.Collator("fr", { sensitivity: "base" });

function byFrenchName(a: { name: string }, b: { name: string }): number {
  return frenchNames.compare(a.name, b.name);
}
