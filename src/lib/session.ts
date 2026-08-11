import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { members, sessions, type Member } from "@/db/schema";
import { isProduction } from "@/env";

/*
 * Sessions.
 *
 * The cookie holds a random 256-bit token; the database stores only its
 * SHA-256. Leaking the database therefore does not allow hijacking a live
 * session — same reasoning as for a password.
 *
 * The lifetime is deliberately long (one year, extended on use): this club's
 * members must not have to retype their code every week. The real risk here
 * is the app being abandoned, not a stolen phone.
 */

const COOKIE_NAME = "ardoise_session";
const LIFETIME_DAYS = 365;
const LIFETIME_MS = LIFETIME_DAYS * 24 * 3600_000;

/** Extend the session when less than half its lifetime remains. */
const RENEWAL_THRESHOLD_MS = LIFETIME_MS / 2;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a session and sets the cookie.
 * Only callable from a Server Action or a Route Handler: cookies cannot be
 * set while a Server Component renders.
 */
export async function createSession(memberId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_MS);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    memberId,
    expiresAt,
    userAgent: userAgent?.slice(0, 255) ?? null,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // unreachable from page JavaScript
    secure: isProduction, // local development runs over http
    sameSite: "lax", // not sent from another site
    path: "/",
    expires: expiresAt,
  });
}

/** Destroys the current session, in the database and in the browser. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  store.delete(COOKIE_NAME);
}

/** Closes every session of a member — after a PIN change, for instance. */
export async function destroyMemberSessions(memberId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.memberId, memberId));
}

/**
 * Reads the current session and returns the signed-in member, or null.
 *
 * Returns null if the member was archived in the meantime: someone removed
 * from the club must not stay signed in with an old, still-valid cookie.
 */
export async function readCurrentMember(): Promise<Member | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);

  const rows = await db
    .select({ member: members, expiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(members, eq(members.id, sessions.memberId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.member.archivedAt) return null;

  await renewIfNeeded(tokenHash, row.expiresAt, row.lastSeenAt);

  return row.member;
}

/**
 * Pushes the expiry back when the session nears its end. We deliberately do
 * not write on every page view: that would be a database write per render for
 * no benefit.
 */
async function renewIfNeeded(tokenHash: string, expiresAt: Date, lastSeenAt: Date): Promise<void> {
  const now = Date.now();
  const remaining = expiresAt.getTime() - now;
  const seenRecently = now - lastSeenAt.getTime() < 3600_000;

  if (remaining > RENEWAL_THRESHOLD_MS && seenRecently) return;

  await db
    .update(sessions)
    .set({ expiresAt: new Date(now + LIFETIME_MS), lastSeenAt: new Date(now) })
    .where(eq(sessions.tokenHash, tokenHash));
}

/** Removes expired sessions. Called opportunistically on login. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
