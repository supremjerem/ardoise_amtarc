import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

/*
 * The proxy is four lines of logic guarding every URL of the app, and one of
 * them once locked users out of the login screen. Cheap to test, expensive to
 * get wrong.
 */

function request(path: string, { withCookie = false } = {}): NextRequest {
  const req = new NextRequest(new URL(path, "https://ardoise.example"));
  if (withCookie) req.cookies.set("ardoise_session", "whatever-token");
  return req;
}

/** Where the proxy sends this request, or null when it lets it through. */
function destinationOf(req: NextRequest): string | null {
  const response = proxy(req);
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  it("sends a visitor with no cookie to the login screen", () => {
    expect(destinationOf(request("/moi"))).toBe("/connexion");
    expect(destinationOf(request("/caisse"))).toBe("/connexion");
    expect(destinationOf(request("/caisse/membre/abc"))).toBe("/connexion");
    expect(destinationOf(request("/"))).toBe("/connexion");
  });

  it("lets the login screen through without a cookie", () => {
    expect(destinationOf(request("/connexion"))).toBeNull();
  });

  it("lets a cookie holder through to the app", () => {
    expect(destinationOf(request("/moi", { withCookie: true }))).toBeNull();
    expect(destinationOf(request("/caisse", { withCookie: true }))).toBeNull();
  });

  it("never redirects away from the login screen, cookie or not", () => {
    /*
     * The regression this exists for. Redirecting a cookie holder to /moi
     * looks like the symmetrical rule, but the cookie proves nothing: once it
     * is stale the guard on /moi sends them straight back here, and the two
     * bounce until the browser gives up. Whoever holds a dead cookie is
     * precisely who needs this screen.
     */
    expect(destinationOf(request("/connexion", { withCookie: true }))).toBeNull();
  });
});
