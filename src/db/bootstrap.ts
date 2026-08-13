import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";

import { count, eq, isNull, and } from "drizzle-orm";

import { db, sql as connection } from "@/db";
import { members, settings } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { ADMIN_PIN_LENGTH, hashPin, validatePin } from "@/lib/pin";

/*
 * The way into a brand-new club.
 *
 * A freshly migrated database has no members. Nobody can sign in, so nobody
 * can create anybody — the app cannot bootstrap itself through its own
 * screens. This script is the one and only way in, run once, from a terminal
 * with access to the database.
 *
 * Unlike the seed, this one is MEANT to run in production. It is also the only
 * script that writes a member without a signed-in manager behind it, which is
 * why it refuses to do so once a manager exists: from that point on, adding
 * people is the club's business, through the interface, with an audit trail.
 *
 *   pnpm bootstrap --name "Bernard Lefèvre"
 *   pnpm bootstrap --name "Bernard Lefèvre" --licence AM1042 --pin 480215
 */

const DEFAULT_CAP_CENTS = 2500;

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

/**
 * A code nobody chose, for when none was given.
 *
 * `randomInt` is drawn from the same source as the session tokens, not
 * `Math.random` — this opens the till. Sequences and repeated digits are
 * rejected by the same policy the interface applies, so the loop simply keeps
 * drawing until it produces one the club would have been allowed to pick.
 */
function generatePin(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let pin = "";
    for (let digit = 0; digit < ADMIN_PIN_LENGTH; digit++) pin += randomInt(10);
    if (validatePin(pin, true).ok) return pin;
  }
  fail("Impossible de générer un code. Fournissez-en un avec --pin.");
}

async function bootstrap(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      licence: { type: "string" },
      pin: { type: "string" },
    },
  });

  const name = values.name?.trim();
  if (!name) {
    fail('Indiquez le nom du responsable : pnpm bootstrap --name "Prénom Nom"');
  }

  /*
   * The guard that makes this safe to leave in the image. Archived members do
   * not count: a club that retired its only manager is back to having no way
   * in, and that is exactly when this is needed again.
   */
  const [{ managers }] = await db
    .select({ managers: count() })
    .from(members)
    .where(and(eq(members.isAdmin, true), isNull(members.archivedAt)));

  if (managers > 0) {
    fail(
      `Ce club a déjà ${managers} responsable(s) de caisse.\n` +
        "    Ajoutez les suivants depuis Réglages → Responsables de caisse,\n" +
        "    pour que chaque création soit tracée.",
    );
  }

  const pin = values.pin?.trim() || generatePin();
  const check = validatePin(pin, true);
  if (!check.ok) fail(check.message);

  /*
   * The settings row is created here rather than by a migration: it carries a
   * value the club chooses, not schema.
   */
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  const [row] = await db
    .select({ defaultCapCents: settings.defaultCapCents })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const capCents = row?.defaultCapCents ?? DEFAULT_CAP_CENTS;

  await db.insert(members).values({
    name,
    licenceNumber: values.licence?.trim() || null,
    isAdmin: true,
    pinHash: await hashPin(pin),
    capCents,
    avatarColorIndex: 0,
  });

  console.log(`\n  ✓ ${name} est responsable de caisse.`);
  console.log(`    Plafond par défaut du club : ${formatMoney(capCents)}\n`);

  if (!values.pin) {
    /*
     * Printed once and stored nowhere — only its Argon2 hash reaches the
     * database. If this scrolls past unread, the only remedy is to run this
     * script again on an empty club.
     */
    console.log(`    Code à ${ADMIN_PIN_LENGTH} chiffres : ${pin}`);
    console.log("    Notez-le maintenant : il n'est affiché qu'une fois.\n");
  }

  console.log("    Connectez-vous, puis ajoutez les membres depuis la caisse.\n");
}

bootstrap()
  .then(() => connection.end())
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(async (error) => {
    /* fail() has already explained itself; anything else has not. */
    if (process.exitCode !== 1) console.error("Échec de l'amorçage :", error);
    await connection.end();
    process.exit(1);
  });
