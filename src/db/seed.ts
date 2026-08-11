/*
 * Development seed data.
 *
 * Mirrors the nine fictional members of the prototype (design_reference.html)
 * so the app can be compared with the reference screen by screen.
 *
 *   pnpm db:seed
 *
 * Refuses to run in production: these accounts have well-known PINs.
 */

import { sql } from "drizzle-orm";

import { db, sql as connection } from "@/db";
import { members, settings, tariffs, transactions } from "@/db/schema";
import { env } from "@/env";
import { hashPin } from "@/lib/pin";

if (env.NODE_ENV === "production") {
  throw new Error("The demo seed must never run in production.");
}

/* Demo PINs — six digits for till managers, four for members. */
const ADMIN_PIN = "480215";
const MEMBER_PIN = "7391";

type DemoMember = {
  name: string;
  licenceNumber: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  capEuros: number;
  entries: Array<{ kind: "debit" | "credit"; euros: number; note: string; date: string }>;
};

const DEMO_MEMBERS: DemoMember[] = [
  {
    name: "Bernard Lefèvre",
    licenceNumber: "AM1042",
    email: "bernard.lefevre@amtarc.fr",
    phone: "06 12 34 56 78",
    isAdmin: true,
    capEuros: 30,
    entries: [
      { kind: "debit", euros: 8, note: "Bières", date: "2026-07-15" },
      { kind: "credit", euros: 8, note: "Règlement espèces", date: "2026-07-16" },
    ],
  },
  {
    name: "Nathalie Petit",
    licenceNumber: "AM1077",
    email: "nathalie.petit@amtarc.fr",
    phone: "06 23 45 67 89",
    isAdmin: true,
    capEuros: 30,
    entries: [{ kind: "debit", euros: 5, note: "Eau + café", date: "2026-08-02" }],
  },
  {
    name: "Julien Marchand",
    licenceNumber: "AM2210",
    email: "julien.marchand@mail.fr",
    phone: "06 34 56 78 90",
    isAdmin: false,
    capEuros: 25,
    entries: [
      { kind: "debit", euros: 12, note: "Bières x2", date: "2026-07-10" },
      { kind: "debit", euros: 9, note: "Sandwich + soda", date: "2026-07-24" },
    ],
  },
  {
    name: "Sophie Dubois",
    licenceNumber: "AM2287",
    email: "sophie.dubois@mail.fr",
    phone: "06 45 67 89 01",
    isAdmin: false,
    capEuros: 25,
    entries: [{ kind: "debit", euros: 6, note: "Eau gazeuse", date: "2026-08-05" }],
  },
  {
    name: "Karim Haddad",
    licenceNumber: "AM2299",
    email: "karim.haddad@mail.fr",
    phone: "06 56 78 90 12",
    isAdmin: false,
    capEuros: 20,
    entries: [
      { kind: "debit", euros: 15, note: "Bières", date: "2026-07-01" },
      { kind: "debit", euros: 14, note: "Repas + boissons", date: "2026-08-01" },
    ],
  },
  {
    name: "Émilie Rousseau",
    licenceNumber: "AM2305",
    email: "emilie.rousseau@mail.fr",
    phone: "06 67 89 01 23",
    isAdmin: false,
    capEuros: 25,
    entries: [
      { kind: "debit", euros: 10, note: "Boissons", date: "2026-06-20" },
      { kind: "credit", euros: 10, note: "Règlement espèces", date: "2026-06-25" },
    ],
  },
  {
    name: "Thomas Girard",
    licenceNumber: "AM2318",
    email: "thomas.girard@mail.fr",
    phone: "06 78 90 12 34",
    isAdmin: false,
    capEuros: 25,
    entries: [{ kind: "debit", euros: 18, note: "Tournée équipe", date: "2026-08-08" }],
  },
  {
    name: "Léa Fontaine",
    licenceNumber: "AM2340",
    email: "lea.fontaine@mail.fr",
    phone: "06 89 01 23 45",
    isAdmin: false,
    capEuros: 25,
    entries: [],
  },
  {
    name: "Marc Bellamy",
    licenceNumber: "AM2355",
    email: "marc.bellamy@mail.fr",
    phone: "06 90 12 34 56",
    isAdmin: false,
    capEuros: 25,
    entries: [
      { kind: "debit", euros: 30, note: "Anniversaire du club", date: "2026-07-28" },
      { kind: "credit", euros: 4, note: "Acompte espèces", date: "2026-08-03" },
    ],
  },
];

/* Bar prices behind the quick-entry buttons. Labels are French UI copy. */
const DEMO_TARIFFS = [
  { label: "Café", amountCents: 100, sortOrder: 0 },
  { label: "Eau", amountCents: 150, sortOrder: 1 },
  { label: "Soda", amountCents: 200, sortOrder: 2 },
  { label: "Bière", amountCents: 300, sortOrder: 3 },
  { label: "Sandwich", amountCents: 450, sortOrder: 4 },
];

async function seed() {
  console.log("Resetting data…");

  /*
   * TRUNCATE rather than DELETE: clears every table at once while respecting
   * foreign keys, with no need to order the deletions.
   */
  await db.execute(
    sql`TRUNCATE TABLE transactions, sessions, login_attempts, audit_log, tariffs, members, settings RESTART IDENTITY CASCADE`,
  );

  await db.insert(settings).values({ id: 1, defaultCapCents: 2500, clubName: "AMTARC" });
  await db.insert(tariffs).values(DEMO_TARIFFS);

  /* Both hashes are computed once: Argon2 is deliberately slow. */
  const [adminHash, memberHash] = await Promise.all([hashPin(ADMIN_PIN), hashPin(MEMBER_PIN)]);

  const memberRows = DEMO_MEMBERS.map((member, index) => ({
    name: member.name,
    licenceNumber: member.licenceNumber,
    email: member.email,
    phone: member.phone,
    isAdmin: member.isAdmin,
    pinHash: member.isAdmin ? adminHash : memberHash,
    capCents: member.capEuros * 100,
    avatarColorIndex: index % 5,
  }));

  const inserted = await db
    .insert(members)
    .values(memberRows)
    .returning({ id: members.id, name: members.name });

  const idByName = new Map(inserted.map((member) => [member.name, member.id]));
  /* Demo entries are attributed to the first till manager. */
  const adminId = idByName.get("Bernard Lefèvre")!;

  const entryRows = DEMO_MEMBERS.flatMap((member) =>
    member.entries.map((entry) => ({
      memberId: idByName.get(member.name)!,
      kind: entry.kind,
      amountCents: entry.euros * 100,
      note: entry.note,
      occurredOn: entry.date,
      createdBy: adminId,
    })),
  );

  await db.insert(transactions).values(entryRows);

  console.log(
    `\n✓ ${inserted.length} members, ${entryRows.length} entries, ${DEMO_TARIFFS.length} tariffs.\n`,
  );
  console.log("Demo accounts:");
  console.log(`  Till manager (Bernard Lefèvre, Nathalie Petit) — code ${ADMIN_PIN}`);
  console.log(`  Member (everyone else)                         — code ${MEMBER_PIN}\n`);
}

seed()
  .then(() => connection.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await connection.end();
    process.exit(1);
  });
