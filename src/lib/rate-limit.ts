import { createHmac } from "node:crypto";

import { and, desc, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { env } from "@/env";

/*
 * Progressive lockout on login attempts.
 *
 * This is the PIN's main defence: a four-digit code only holds up if an
 * attacker cannot chain guesses. The lock is keyed on (member, device) —
 * locking an IP alone would punish the whole club behind the same wifi, and
 * locking a member alone would let an attacker sweep the other accounts.
 */

/** Window over which failures are counted. */
const WINDOW_MINUTES = 15;

/** Failures tolerated before the first lockout. */
const FAILURES_BEFORE_LOCKOUT = 5;

/** Successive lockout durations in seconds; the last value repeats. */
const LOCKOUT_STEPS_SECONDS = [60, 5 * 60, 15 * 60];

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

export type LockoutState = { locked: false } | { locked: true; secondsRemaining: number };

/**
 * Is this (member, device) pair currently locked out?
 * Call BEFORE verifying any PIN.
 */
export async function checkLockout(memberId: string, ipHash: string): Promise<LockoutState> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const failures = await db
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
    .orderBy(desc(loginAttempts.attemptedAt));

  if (failures.length < FAILURES_BEFORE_LOCKOUT) return { locked: false };

  /*
   * A step is crossed every FAILURES_BEFORE_LOCKOUT failures:
   * 5 failures -> 1 min, 10 -> 5 min, 15 -> 15 min, and so on.
   */
  const stepsCrossed = Math.floor(failures.length / FAILURES_BEFORE_LOCKOUT);
  const durationSeconds =
    LOCKOUT_STEPS_SECONDS[Math.min(stepsCrossed - 1, LOCKOUT_STEPS_SECONDS.length - 1)];

  const lastFailure = failures[0].attemptedAt.getTime();
  const remaining = lastFailure + durationSeconds * 1000 - Date.now();

  if (remaining <= 0) return { locked: false };

  return { locked: true, secondsRemaining: Math.ceil(remaining / 1000) };
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
export async function clearAttempts(memberId: string, ipHash: string): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.memberId, memberId), eq(loginAttempts.ipHash, ipHash)));
}

/**
 * Purges old attempts. Called opportunistically on login: the table must not
 * grow forever, and this club has no scheduled job to run.
 */
export async function purgeOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, cutoff));
}

/** Formats a lockout duration for display (French UI copy). */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconde${seconds > 1 ? "s" : ""}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/** Re-exported for tests and message copy. */
export const LOCKOUT_CONSTANTS = {
  WINDOW_MINUTES,
  FAILURES_BEFORE_LOCKOUT,
  LOCKOUT_STEPS_SECONDS,
} as const;
