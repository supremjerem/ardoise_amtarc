import { sql } from "@/db";

/*
 * Health check, for whatever is watching the container.
 *
 * It touches the database on purpose. A process that answers while its
 * database is unreachable is worse than one that admits it is down: the host
 * would keep routing members to a page that cannot show them a balance.
 *
 * Public — proxy.ts lets it through. It says nothing a stranger could use:
 * no version, no hostname, no error detail.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await sql`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
