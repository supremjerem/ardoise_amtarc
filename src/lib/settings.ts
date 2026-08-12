import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { settings } from "@/db/schema";

/*
 * The club's global settings — a single row, locked to id 1 by a CHECK
 * constraint so a second one can never appear and be silently picked instead.
 */

export type ClubSettings = {
  defaultCapCents: number;
  clubName: string;
};

/* Matches the column defaults, for a database that has not been seeded yet. */
const FALLBACK: ClubSettings = { defaultCapCents: 2500, clubName: "AMTARC" };

/**
 * Reads the settings.
 *
 * Falls back to the defaults rather than throwing: a missing settings row must
 * not take the whole till down, and every screen using it can carry on.
 */
export async function readSettings(): Promise<ClubSettings> {
  const [row] = await db
    .select({ defaultCapCents: settings.defaultCapCents, clubName: settings.clubName })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  return row ?? FALLBACK;
}
