/*
 * How long a code has to be, by role.
 *
 * Split out from src/lib/pin.ts so the browser can ask the question without
 * dragging Argon2 into the bundle: the login keypad and the member dialog both
 * need the answer, and it must not be restated in two places.
 *
 * A till manager's code is longer because it is worth more: it opens every
 * member's record and can move money on the ledger.
 */

export const MEMBER_PIN_LENGTH = 4;
export const ADMIN_PIN_LENGTH = 6;

/** PIN length required for a given role. */
export function requiredPinLength(isAdmin: boolean): number {
  return isAdmin ? ADMIN_PIN_LENGTH : MEMBER_PIN_LENGTH;
}
