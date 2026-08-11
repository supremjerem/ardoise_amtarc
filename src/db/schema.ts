import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * All money columns are INTEGER CENTS (`_cents`).
 * Never a floating-point number for money: see src/lib/money.ts.
 */

export const transactionKind = pgEnum("transaction_kind", [
  "debit", // bar purchase — increases the debt
  "credit", // payment received — decreases the debt
  "reminder", // reminder sent — amount 0, never affects the balance
]);

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    licenceNumber: text("licence_number"),
    email: text("email"),
    phone: text("phone"),
    photoUrl: text("photo_url"),

    /* Till manager: sees every member, records transactions. */
    isAdmin: boolean("is_admin").notNull().default(false),

    /* Argon2id hash of the PIN. The clear PIN is never stored nor logged. */
    pinHash: text("pin_hash").notNull(),

    /* Per-member debt ceiling, above which the alert fires. */
    capCents: integer("cap_cents").notNull(),

    /* Index into the avatar palette (five hues, rotating). */
    avatarColorIndex: integer("avatar_color_index").notNull().default(0),

    /*
     * Archive rather than delete as soon as a member has history: accounting
     * entries are not destroyed. See the member deletion action.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* The login screen lists active members by name. */
    index("members_active_idx").on(t.archivedAt, t.name),
    /* A negative cap is meaningless and would break the progress bar. */
    check("members_cap_non_negative", sql`${t.capCents} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Transactions — the ledger                                           */
/* ------------------------------------------------------------------ */

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    kind: transactionKind("kind").notNull(),

    /* Always positive: the sign is carried by `kind`, never by the amount. */
    amountCents: integer("amount_cents").notNull(),

    note: text("note"),

    /* Business date of the entry, distinct from when it was keyed in. */
    occurredOn: date("occurred_on").notNull(),

    /* Traceability: which till manager recorded this entry. */
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    /*
     * Voiding instead of deleting: the row leaves the display and the balance
     * calculation, but stays in the ledger and the audit trail.
     */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => members.id, { onDelete: "set null" }),
  },
  (t) => [
    /* Dominant query: one member's history, newest first. */
    index("transactions_by_member_idx").on(t.memberId, t.occurredOn.desc()),
    /* The balance calculation only scans live entries. */
    index("transactions_live_idx").on(t.memberId, t.voidedAt),

    /*
     * Integrity guards. They live in the database and not only in the code:
     * a bad entry introduced by a script or a manual fix would silently
     * corrupt every balance.
     */
    check("transactions_amount_non_negative", sql`${t.amountCents} >= 0`),
    /* A reminder is a trace, never a movement of money. */
    check(
      "transactions_reminder_has_no_amount",
      sql`${t.kind} <> 'reminder' OR ${t.amountCents} = 0`,
    ),
    /*
     * A voiding author implies a voiding date. Deliberately not the converse:
     * `voided_by` becomes NULL if that manager is ever deleted, whereas the
     * voiding itself remains a fact.
     */
    check("transactions_void_consistency", sql`${t.voidedBy} IS NULL OR ${t.voidedAt} IS NOT NULL`),
  ],
);

/* ------------------------------------------------------------------ */
/* Tariffs — quick-entry buttons behind the bar                        */
/* ------------------------------------------------------------------ */

export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(), // "Bière", "Café"…
    amountCents: integer("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [check("tariffs_amount_positive", sql`${t.amountCents} > 0`)],
);

/* ------------------------------------------------------------------ */
/* Global settings — a single row                                      */
/* ------------------------------------------------------------------ */

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    defaultCapCents: integer("default_cap_cents").notNull().default(2500),
    clubName: text("club_name").notNull().default("AMTARC"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * Singleton lock: only the row with id 1 is allowed. Without it a second
     * settings row would go unnoticed and the app would read one or the other.
     */
    check("settings_single_row", sql`${t.id} = 1`),
    check("settings_cap_non_negative", sql`${t.defaultCapCents} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    /*
     * SHA-256 of the session token. The token itself lives only in the
     * member's cookie, so a database leak does not allow impersonating
     * a live session.
     */
    tokenHash: text("token_hash").primaryKey(),

    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_by_member_idx").on(t.memberId)],
);

/* ------------------------------------------------------------------ */
/* Login attempts — basis for progressive lockout                      */
/* ------------------------------------------------------------------ */

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    /* Hashed IP: we need to count, not to know who is behind it. */
    ipHash: text("ip_hash").notNull(),
    succeeded: boolean("succeeded").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_window_idx").on(t.memberId, t.ipHash, t.attemptedAt.desc())],
);

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => members.id, { onDelete: "set null" }),
    /* "transaction.create", "member.archive", "settings.update"… */
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    /* Human-readable detail of the action — never a PIN, never a secret. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_recent_idx").on(t.createdAt.desc())],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const membersRelations = relations(members, ({ many }) => ({
  transactions: many(transactions, { relationName: "memberTransactions" }),
  sessions: many(sessions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  member: one(members, {
    fields: [transactions.memberId],
    references: [members.id],
    relationName: "memberTransactions",
  }),
  author: one(members, {
    fields: [transactions.createdBy],
    references: [members.id],
    relationName: "recordedTransactions",
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  member: one(members, { fields: [sessions.memberId], references: [members.id] }),
}));

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Tariff = typeof tariffs.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type TransactionKind = (typeof transactionKind.enumValues)[number];
