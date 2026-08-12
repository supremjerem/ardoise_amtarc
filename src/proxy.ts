import { NextResponse, type NextRequest } from "next/server";

/*
 * OPTIMISTIC check for the presence of a session cookie.
 *
 * It proves nothing: the cookie may be expired, revoked, or fabricated. Its
 * only job is to avoid rendering a page for nobody when clearly no one is
 * signed in. The real check happens in src/lib/auth.ts, server-side, against
 * the database.
 *
 * (This file was middleware.ts up to Next.js 15; renamed proxy.ts in 16.)
 */

const SESSION_COOKIE = "ardoise_session";

/** Paths reachable without being signed in. */
const PUBLIC_PATHS = ["/connexion"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasCookie && !isPublic) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  /*
   * Deliberately NOT the mirror image of the rule above.
   *
   * Sending anyone holding a cookie away from /connexion looks symmetrical
   * and is a trap: the cookie proves nothing. Once it is stale — an expired
   * session, a code changed by a manager, a member archived, all of which
   * close sessions server-side — the proxy sends them to /moi, the guard
   * there finds no session and sends them back, and the browser gives up
   * with a redirect loop. Being locked out by an old cookie is exactly the
   * moment someone needs the login screen.
   *
   * Whether a signed-in visitor should skip the login screen is decided by
   * /connexion itself, where the session can actually be read.
   */
  return NextResponse.next();
}

export const config = {
  /*
   * Without a matcher the proxy would also run on static assets and block
   * CSS and fonts before the login screen ever renders.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)"],
};
