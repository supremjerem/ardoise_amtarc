/*
 * The rule that decides whether a login is currently locked out.
 *
 * Pure, and in its own module free of database imports, so it can be tested
 * directly. This is what stands between a four-digit code and an attacker
 * chaining guesses: "it looked right" is not a standard worth applying to it.
 */

/** Window over which failures are counted. */
const WINDOW_MINUTES = 15;

/** Failures tolerated on one device before the first lockout. */
const FAILURES_BEFORE_LOCKOUT = 5;

/** Successive lockout durations in seconds; the last value repeats. */
const LOCKOUT_STEPS_SECONDS = [60, 5 * 60, 15 * 60];

/*
 * A second counter, on the member alone, ignoring the device entirely.
 *
 * The per-device counter is the friendly one: it lets a member who mistypes on
 * their phone keep trying from the club's tablet. Its weakness is that
 * "device" can only ever be inferred from request headers, and headers are
 * written by whoever sends the request. An attacker rotating X-Forwarded-For
 * looked like a new device on every guess and was never locked — which made a
 * four-digit code worth 10,000 requests and nothing more.
 *
 * So failures are also counted per member, whatever they arrive from. The
 * threshold sits far above anything a human produces in a quarter of an hour,
 * and the lock is short: it exists to break a machine chaining guesses, not to
 * punish someone who cannot remember their code.
 */
const MEMBER_FAILURE_LIMIT = 25;
const MEMBER_LOCKOUT_SECONDS = 15 * 60;

export type LockoutState = { locked: false } | { locked: true; secondsRemaining: number };

/**
 * Decides the lockout from failure timestamps, newest first.
 *
 * @param deviceFailures failures for this member from this apparent device
 * @param memberFailures failures for this member from anywhere at all
 */
export function decideLockout(
  deviceFailures: readonly Date[],
  memberFailures: readonly Date[],
  now: Date,
): LockoutState {
  /*
   * Checked first: this is the one an attacker cannot sidestep by changing
   * what their requests claim about themselves.
   */
  if (memberFailures.length >= MEMBER_FAILURE_LIMIT) {
    const remaining = memberFailures[0].getTime() + MEMBER_LOCKOUT_SECONDS * 1000 - now.getTime();

    if (remaining > 0) return { locked: true, secondsRemaining: Math.ceil(remaining / 1000) };
  }

  if (deviceFailures.length < FAILURES_BEFORE_LOCKOUT) return { locked: false };

  /*
   * A step is crossed every FAILURES_BEFORE_LOCKOUT failures:
   * 5 failures -> 1 min, 10 -> 5 min, 15 -> 15 min, and so on.
   */
  const stepsCrossed = Math.floor(deviceFailures.length / FAILURES_BEFORE_LOCKOUT);
  const durationSeconds =
    LOCKOUT_STEPS_SECONDS[Math.min(stepsCrossed - 1, LOCKOUT_STEPS_SECONDS.length - 1)];

  const remaining = deviceFailures[0].getTime() + durationSeconds * 1000 - now.getTime();

  if (remaining <= 0) return { locked: false };

  return { locked: true, secondsRemaining: Math.ceil(remaining / 1000) };
}

/** Formats a lockout duration for display (French UI copy). */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconde${seconds > 1 ? "s" : ""}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

export const LOCKOUT_CONSTANTS = {
  WINDOW_MINUTES,
  FAILURES_BEFORE_LOCKOUT,
  LOCKOUT_STEPS_SECONDS,
  MEMBER_FAILURE_LIMIT,
  MEMBER_LOCKOUT_SECONDS,
} as const;
