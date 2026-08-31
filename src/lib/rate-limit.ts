/*
 * Storing and counting login attempts.
 *
 * The decision itself lives in ./lockout, which has no database imports and is
 * therefore testable; this module only feeds it what the table holds.
 */

import { createHmac } from "node:crypto";

import { and, desc, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { env } from "@/env";

import { decideLockout, LOCKOUT_CONSTANTS, type LockoutState } from "./lockout";

/**
 * Hashes an IP address. We need to count attempts per device, not to know who
 * is behind them: the clear address serves no purpose and would be personal
 * data stored for nothing.
 *
 * An HMAC rather than a bare hash is essential here — the IPv4 space is small
 * enough that a plain hash is reversible by brute force.
 */
export function hashIp(ip: string): string {
  return createHmac("sha256", env.IP_HASH_SECRET).update(ip).digest("hex");
}

/**
 * Is this (member, device) pair currently locked out?
 * Call BEFORE verifying any PIN.
 */
export async function checkLockout(memberId: string, ipHash: string): Promise<LockoutState> {
  const since = new Date(Date.now() - LOCKOUT_CONSTANTS.WINDOW_MINUTES * 60_000);

  const [failures, memberFailures] = await Promise.all([
    db
      .select({ attemptedAt: loginAttempts.attemptedAt })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.memberId, memberId),
          eq(loginAttempts.ipHash, ipHash),
          eq(loginAttempts.succeeded, false),
          gt(loginAttempts.attemptedAt, since),
        ),
      )
      .orderBy(desc(loginAttempts.attemptedAt)),

    /* The same window, this member, every device. */
    db
      .select({ attemptedAt: loginAttempts.attemptedAt })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.memberId, memberId),
          eq(loginAttempts.succeeded, false),
          gt(loginAttempts.attemptedAt, since),
        ),
      )
      .orderBy(desc(loginAttempts.attemptedAt)),
  ]);

  return decideLockout(
    failures.map((failure) => failure.attemptedAt),
    memberFailures.map((failure) => failure.attemptedAt),
    new Date(),
  );
}

/** Records an attempt, successful or not. */
export async function recordAttempt(
  memberId: string,
  ipHash: string,
  succeeded: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({ memberId, ipHash, succeeded });
}

/**
 * Wipes the failure history after a successful login: someone who mistypes
 * twice then gets it right should not stay one slip away from a lockout.
 */
export async function clearAttempts(memberId: string): Promise<void> {
  /*
   * Every device, not just the one that succeeded. Whoever holds the code has
   * just proved it, and leaving the member-wide counter standing would lock
   * them out of their next login for something an attacker did to them.
   */
  await db.delete(loginAttempts).where(eq(loginAttempts.memberId, memberId));
}

/**
 * Purges old attempts. Called opportunistically on login: the table must not
 * grow forever, and this club has no scheduled job to run.
 */
export async function purgeOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, cutoff));
}

/* Re-exported so callers have one import for anything lockout-related. */
export { decideLockout, formatWait, LOCKOUT_CONSTANTS, type LockoutState } from "./lockout";
