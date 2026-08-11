import "server-only";

import { redirect } from "next/navigation";

import type { Member } from "@/db/schema";

import { readCurrentMember } from "./session";

/*
 * Access guards — the most important layer of the project.
 *
 * RULE: every server page and every Server Action starts with a call to one
 * of these. Access control must never rest on what the interface shows or
 * hides: a member who forges a URL or replays a request has to hit the server.
 *
 * The proxy (proxy.ts) performs an optimistic check only — is a cookie
 * present — to avoid a pointless round trip. It never replaces these
 * functions, which do query the database.
 */

/** The signed-in member, or a redirect to the login screen. */
export async function requireMember(): Promise<Member> {
  const member = await readCurrentMember();
  if (!member) redirect("/connexion");
  return member;
}

/** The signed-in member if they manage the till, otherwise back to their own slate. */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member.isAdmin) {
    /*
     * Redirect to "Mon ardoise" rather than an error page: for an ordinary
     * member, landing here means a bad link, not an attack.
     */
    redirect("/moi");
  }
  return member;
}

/**
 * Grants access to a member's data: either it is themselves, or a till
 * manager. Used everywhere a member id travels through a URL or a form.
 */
export async function requireSelfOrAdmin(memberId: string): Promise<Member> {
  const member = await requireMember();
  if (member.id !== memberId && !member.isAdmin) {
    redirect("/moi");
  }
  return member;
}

/* ------------------------------------------------------------------ */
/* Variants for Server Actions                                         */
/* ------------------------------------------------------------------ */

/*
 * Inside a Server Action a redirect is an awkward response: the client is
 * waiting for a result, not a navigation. These variants throw, and the
 * action turns that into a failure message.
 */

export class AuthorizationError extends Error {
  constructor(message = "Vous n'avez pas les droits pour cette action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** The signed-in member, or an error — for Server Actions. */
export async function requireMemberAction(): Promise<Member> {
  const member = await readCurrentMember();
  if (!member) throw new AuthorizationError("Votre session a expiré, reconnectez-vous.");
  return member;
}

/** The signed-in till manager, or an error — for Server Actions. */
export async function requireAdminAction(): Promise<Member> {
  const member = await requireMemberAction();
  if (!member.isAdmin) {
    throw new AuthorizationError("Seul un responsable de caisse peut effectuer cette action.");
  }
  return member;
}

/* ------------------------------------------------------------------ */
/* HTTP responses for Route Handlers                                   */
/* ------------------------------------------------------------------ */

/*
 * Next.js does expose `unauthorized()` and `forbidden()`, but they sit behind
 * the experimental `authInterrupts` flag. This app has to run for years
 * without maintenance, so we stick to plain HTTP, which will not move.
 */

export type RouteGuardResult = { ok: true; member: Member } | { ok: false; response: Response };

/**
 * Requires a till manager inside a Route Handler (the CSV export, for
 * instance). Returns either the member, or the error response to return as is.
 */
export async function requireAdminRoute(): Promise<RouteGuardResult> {
  const member = await readCurrentMember();

  if (!member) {
    return { ok: false, response: new Response("Connexion requise.", { status: 401 }) };
  }

  if (!member.isAdmin) {
    return {
      ok: false,
      response: new Response("Réservé aux responsables de caisse.", { status: 403 }),
    };
  }

  return { ok: true, member };
}
