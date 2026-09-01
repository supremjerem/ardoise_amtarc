"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { members } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireMemberAction } from "@/lib/auth";
import { listMembersForLogin } from "@/lib/members";
import { matchesName } from "@/lib/search";
import { hashPin, validatePin, verifyPin } from "@/lib/pin";
import {
  checkLockout,
  clearAttempts,
  formatWait,
  hashIp,
  purgeOldAttempts,
  recordAttempt,
} from "@/lib/rate-limit";
import {
  createSession,
  destroyMemberSessions,
  destroySession,
  purgeExpiredSessions,
} from "@/lib/session";

/*
 * Sign in, sign out, and changing one's own code.
 *
 * The PIN never leaves the server except to be compared against a hash, and
 * appears in no log.
 *
 * Every export in a "use server" file is a public network endpoint, so this
 * file holds actions only — reads live in the data-access layer.
 */

export type LoginResult =
  { ok: true; isAdmin: boolean } | { ok: false; message: string; locked?: boolean };

/** What the login screen needs about a member it is offering. */
export type LoginCandidate = {
  id: string;
  name: string;
  avatarColorIndex: number;
  pinLength: number;
};

/** Nothing is offered until this much has been typed. */
const MIN_QUERY_LENGTH = 2;

/** A search that matches half the club helps nobody find themselves. */
const MAX_RESULTS = 8;

/**
 * Finds the members whose name matches what has been typed.
 *
 * A read, and yet an action: the login screen has to call it from the browser,
 * and it must remain reachable without a session.
 *
 * It exists so the page can stop shipping the club's roster. It used to render
 * every member's name, id and manager badge into HTML served to anyone, which
 * published the membership list and handed an attacker their targets. Now the
 * names live on the server and only a handful come back, for someone who
 * already knows roughly what they are looking for.
 *
 * This raises the cost of enumeration; it does not make it impossible. Anyone
 * willing to sweep two-letter prefixes can still rebuild the list. What it
 * stops is the roster being one anonymous request away.
 */
export async function searchMembersForLogin(query: string): Promise<LoginCandidate[]> {
  if (typeof query !== "string" || query.trim().length < MIN_QUERY_LENGTH) return [];

  const candidates = await listMembersForLogin();

  return candidates
    .filter((member) => matchesName(member.name, query))
    .slice(0, MAX_RESULTS)
    .map(({ id, name, avatarColorIndex, pinLength }) => ({
      id,
      name,
      avatarColorIndex,
      /*
       * Deliberately still returned: the keypad has to know how many digits to
       * collect. It does reveal that this member manages the till — but only
       * to somebody who already typed their name, rather than to every visitor
       * at once, which is the difference this change is about.
       */
      pinLength,
    }));
}

/** Identifies the device behind the request, for lockout purposes. */
async function deviceFingerprint(): Promise<string> {
  const headerList = await headers();

  /*
   * The LAST entry of x-forwarded-for, not the first.
   *
   * Proxies append to this header, so the leftmost value is whatever the
   * client sent — including a value it invented. Reading it, as this did,
   * handed the lockout key to the attacker: a fresh X-Forwarded-For on every
   * request produced a fresh device, and the failure counter never moved.
   *
   * The rightmost entry is the one the nearest proxy wrote itself, which is
   * the least forgeable value available here. It is still only a hint — a
   * deployment with no proxy in front sees nothing at all — which is why the
   * lockout no longer relies on it alone (see checkLockout).
   */
  const chain = headerList.get("x-forwarded-for")?.split(",") ?? [];
  const nearest = chain.at(-1)?.trim();

  const ip = nearest || headerList.get("x-real-ip")?.trim() || "unknown";
  return hashIp(ip);
}

/**
 * Verifies a member's code and opens a session.
 *
 * The failure message is deliberately identical for a wrong code and for an
 * unknown member: nothing should let the two be told apart.
 */
export async function logIn(memberId: string, pin: string): Promise<LoginResult> {
  const ipHash = await deviceFingerprint();

  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);

  if (!member || member.archivedAt) {
    return { ok: false, message: "Code incorrect, réessayez." };
  }

  const lockout = await checkLockout(member.id, ipHash);
  if (lockout.locked) {
    return {
      ok: false,
      locked: true,
      message: `Trop d'essais. Réessayez dans ${formatWait(lockout.secondsRemaining)}.`,
    };
  }

  const correct = await verifyPin(pin, member.pinHash);

  if (!correct) {
    await recordAttempt(member.id, ipHash, false);

    /* This very failure may have tripped the lock. */
    const after = await checkLockout(member.id, ipHash);
    if (after.locked) {
      return {
        ok: false,
        locked: true,
        message: `Trop d'essais. Réessayez dans ${formatWait(after.secondsRemaining)}.`,
      };
    }

    return { ok: false, message: "Code incorrect, réessayez." };
  }

  const headerList = await headers();
  await recordAttempt(member.id, ipHash, true);
  await clearAttempts(member.id);
  await createSession(member.id, headerList.get("user-agent"));

  /*
   * Opportunistic housekeeping: the club has no scheduled job, and a login is
   * the ideal moment — rare, and off the critical path.
   */
  void purgeExpiredSessions().catch(() => {});
  void purgeOldAttempts().catch(() => {});

  return { ok: true, isAdmin: member.isAdmin };
}

/** Closes the session and returns to the login screen. */
export async function logOut(): Promise<void> {
  await destroySession();
  redirect("/connexion");
}

export type ChangePinResult =
  { ok: true; message: string } | { ok: false; message: string; locked?: boolean };

/**
 * Checks a code against a member's own, through the same lockout as a login:
 * a year-long session left open on an unlocked phone must not be enough, on
 * its own, for whoever picks it up to brute-force their way to a code they
 * do not know. Returns null on a match, a failure to report otherwise.
 */
async function verifyOwnPin(
  member: { id: string; pinHash: string },
  pin: string,
): Promise<ChangePinResult | null> {
  const ipHash = await deviceFingerprint();

  const lockout = await checkLockout(member.id, ipHash);
  if (lockout.locked) {
    return {
      ok: false,
      locked: true,
      message: `Trop d'essais. Réessayez dans ${formatWait(lockout.secondsRemaining)}.`,
    };
  }

  const correct = await verifyPin(pin, member.pinHash);

  if (!correct) {
    await recordAttempt(member.id, ipHash, false);

    const after = await checkLockout(member.id, ipHash);
    if (after.locked) {
      return {
        ok: false,
        locked: true,
        message: `Trop d'essais. Réessayez dans ${formatWait(after.secondsRemaining)}.`,
      };
    }

    return { ok: false, message: "Code actuel incorrect." };
  }

  await recordAttempt(member.id, ipHash, true);
  await clearAttempts(member.id);
  return null;
}

/**
 * Confirms the signed-in member's current code, before the interface offers
 * them a new one — telling them the old one was wrong before asking them to
 * also pick and confirm a new one would be a poor trade for one round trip.
 */
export async function checkCurrentPin(pin: string): Promise<ChangePinResult> {
  const member = await requireMemberAction();
  const failure = await verifyOwnPin(member, pin);
  return failure ?? { ok: true, message: "" };
}

/**
 * Lets a signed-in member set their own code — the self-service counterpart
 * to a manager resetting it for them from the till. Re-checks the current
 * code rather than trusting the interface already did: nothing reaches this
 * far on the strength of a client-side claim.
 */
export async function changeMyPin(currentPin: string, newPin: string): Promise<ChangePinResult> {
  const member = await requireMemberAction();

  const failure = await verifyOwnPin(member, currentPin);
  if (failure) return failure;

  const pinCheck = validatePin(newPin, member.isAdmin);
  if (!pinCheck.ok) return { ok: false, message: pinCheck.message };

  if (newPin === currentPin) {
    return { ok: false, message: "Choisissez un code différent de l'actuel." };
  }

  await db
    .update(members)
    .set({ pinHash: await hashPin(newPin), updatedAt: new Date() })
    .where(eq(members.id, member.id));

  /*
   * Every session closes, this one included — the same rule a manager's reset
   * follows. A fresh one is opened immediately so the member is not asked to
   * sign back in with the code they just chose.
   */
  await destroyMemberSessions(member.id);
  const headerList = await headers();
  await createSession(member.id, headerList.get("user-agent"));

  await recordAudit({
    actorId: member.id,
    action: "member.pin-change-self",
    entity: "member",
    entityId: member.id,
  });

  revalidatePath("/moi");
  revalidatePath("/caisse");

  return { ok: true, message: "Code modifié." };
}
