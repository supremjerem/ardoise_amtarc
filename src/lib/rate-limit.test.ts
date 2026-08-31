import { describe, expect, it } from "vitest";

import { decideLockout, LOCKOUT_CONSTANTS } from "./lockout";

const { FAILURES_BEFORE_LOCKOUT, MEMBER_FAILURE_LIMIT } = LOCKOUT_CONSTANTS;

const NOW = new Date("2026-08-13T12:00:00Z");

/** `count` failures, the most recent `secondsAgo` before NOW, newest first. */
function failures(count: number, secondsAgo = 0): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(NOW.getTime() - (secondsAgo + i) * 1000));
}

describe("decideLockout — one device", () => {
  it("lets an honest mistake through", () => {
    expect(decideLockout(failures(FAILURES_BEFORE_LOCKOUT - 1), [], NOW).locked).toBe(false);
  });

  it("locks on the fifth failure", () => {
    expect(decideLockout(failures(FAILURES_BEFORE_LOCKOUT), [], NOW).locked).toBe(true);
  });

  it("lengthens the wait as failures pile up", () => {
    const first = decideLockout(failures(5), [], NOW);
    const second = decideLockout(failures(10), [], NOW);
    const third = decideLockout(failures(15), [], NOW);

    expect(first.locked && second.locked && third.locked).toBe(true);
    if (!first.locked || !second.locked || !third.locked) return;
    expect(second.secondsRemaining).toBeGreaterThan(first.secondsRemaining);
    expect(third.secondsRemaining).toBeGreaterThan(second.secondsRemaining);
  });

  it("releases once the wait has elapsed", () => {
    /* Five failures buy a minute; these are two minutes old. */
    expect(decideLockout(failures(5, 120), [], NOW).locked).toBe(false);
  });
});

describe("decideLockout — the member, whatever the device", () => {
  /*
   * The regression this exists for. The device is inferred from
   * X-Forwarded-For, which the client writes: an attacker rotating it looked
   * like a new device on every guess, so the per-device counter never moved
   * and a four-digit code was worth 10,000 requests. The member-wide counter
   * is the one they cannot talk their way out of.
   */
  it("locks a spread-out attack that never repeats a device", () => {
    const spread = decideLockout([], failures(MEMBER_FAILURE_LIMIT), NOW);

    expect(spread.locked).toBe(true);
  });

  it("still allows a genuinely forgetful member", () => {
    /* Well past the per-device threshold, nowhere near the member-wide one. */
    const forgetful = decideLockout([], failures(FAILURES_BEFORE_LOCKOUT + 2), NOW);

    expect(forgetful.locked).toBe(false);
  });

  it("releases once its own wait has elapsed", () => {
    const old = decideLockout([], failures(MEMBER_FAILURE_LIMIT, 16 * 60), NOW);

    expect(old.locked).toBe(false);
  });

  it("takes precedence over a device that looks innocent", () => {
    const state = decideLockout(failures(1), failures(MEMBER_FAILURE_LIMIT), NOW);

    expect(state.locked).toBe(true);
  });
});
