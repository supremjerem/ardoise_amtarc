"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { members } from "@/db/schema";
import { verifyPin } from "@/lib/pin";
import {
  checkLockout,
  clearAttempts,
  formatWait,
  hashIp,
  purgeOldAttempts,
  recordAttempt,
} from "@/lib/rate-limit";
import { createSession, destroySession, purgeExpiredSessions } from "@/lib/session";

/*
 * Sign in and sign out.
 *
 * The PIN never leaves the server except to be compared against a hash, and
 * appears in no log.
 *
 * Every export in a "use server" file is a public network endpoint, so this
 * file holds actions only — reads live in the data-access layer.
 */

export type LoginResult =
  { ok: true; isAdmin: boolean } | { ok: false; message: string; locked?: boolean };

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
