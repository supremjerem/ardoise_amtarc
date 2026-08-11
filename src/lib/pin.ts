import { hash, verify } from "@node-rs/argon2";

import { env } from "@/env";

/*
 * PIN hashing.
 *
 * A four-digit PIN is 10 000 combinations: anyone who gets hold of the
 * database exhausts them in seconds, whatever the algorithm. Hashing alone is
 * therefore NOT enough. Three defences stack up:
 *
 *   1. Argon2id — memory-hard, slows every single guess.
 *   2. A secret PEPPER (PIN_PEPPER) that lives in the server configuration
 *      rather than the database, so leaking the database alone does not allow
 *      an offline attack on the PINs.
 *   3. Server-side progressive lockout (src/lib/rate-limit.ts), which makes
 *      an online attack impractical.
 *
 * Defence 3 does the heavy lifting. The other two cover the leaked-database case.
 */

export const MEMBER_PIN_LENGTH = 4;
export const ADMIN_PIN_LENGTH = 6;

/** PIN length required for a given role. */
export function requiredPinLength(isAdmin: boolean): number {
  return isAdmin ? ADMIN_PIN_LENGTH : MEMBER_PIN_LENGTH;
}

export type PinValidation = { ok: true } | { ok: false; message: string };

/**
 * Is this PIN acceptable for the role?
 * Obvious sequences are rejected too: on a screen anyone can see, "1234"
 * amounts to having no code at all.
 *
 * Messages are French because they surface directly in the UI.
 */
export function validatePin(pin: string, isAdmin: boolean): PinValidation {
  const expected = requiredPinLength(isAdmin);

  if (!new RegExp(`^\\d{${expected}}$`).test(pin)) {
    return { ok: false, message: `Le code doit comporter exactement ${expected} chiffres.` };
  }

  if (/^(\d)\1*$/.test(pin)) {
    return { ok: false, message: "Un code fait de chiffres identiques est trop facile à deviner." };
  }

  if (isConsecutiveSequence(pin)) {
    return { ok: false, message: "Évitez une suite de chiffres comme 1234 ou 4321." };
  }

  return { ok: true };
}

function isConsecutiveSequence(pin: string): boolean {
  let ascending = true;
  let descending = true;
  for (let i = 1; i < pin.length; i++) {
    const step = Number(pin[i]) - Number(pin[i - 1]);
    if (step !== 1) ascending = false;
    if (step !== -1) descending = false;
  }
  return ascending || descending;
}

/*
 * Argon2id parameters, deliberately costlier than the defaults: one login per
 * person per month does not suffer from 100 ms of computation, while an
 * offline attack is slowed down considerably.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456, // 19 MiB — OWASP recommendation
  timeCost: 2,
  parallelism: 1,
} as const;

/** Mixes the PIN with the server pepper before hashing. */
function withPepper(pin: string): string {
  return `${pin}:${env.PIN_PEPPER}`;
}

/** Hashes a PIN for storage. Never log or return the clear PIN. */
export function hashPin(pin: string): Promise<string> {
  return hash(withPepper(pin), ARGON2_OPTIONS);
}

/**
 * Verifies a PIN. Never throws: a corrupted hash in the database must mean a
 * refused login, not a 500 error.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, withPepper(pin), ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
