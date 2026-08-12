# Ardoise AMTARC

[![CI](https://github.com/supremjerem/ardoise_amtarc/actions/workflows/ci.yml/badge.svg)](https://github.com/supremjerem/ardoise_amtarc/actions/workflows/ci.yml)
[![CodeQL](https://github.com/supremjerem/ardoise_amtarc/actions/workflows/codeql.yml/badge.svg)](https://github.com/supremjerem/ardoise_amtarc/actions/workflows/codeql.yml)

Web app that replaces the paper notebook behind the bar of the AMTARC club: members check what
they owe, till managers record purchases and payments.

<!-- Refresh this whenever a main screen changes shape. Demo data, taken from a production build. -->

![The till dashboard: 105,00 € owed in total, two members over their cap, a search field beside a
"+ Membre" button, and the member list ordered by what each one owes](docs/screenshot.png)

> **Interface language:** the UI is French — the club's members are French speakers. The
> codebase, comments and documentation are English.

## What it does

**For a member**

- See their own balance: owed, settled, or in credit.
- See how close they are to their spending cap, and get a banner when they go over it.
- Read their own history. Nothing else, and nobody else's.

**For a till manager**

- Dashboard: total owed, how many members are over their cap, searchable member list sorted by
  balance.
- Record an expense or a payment in a couple of taps, with configurable quick-price buttons
  ("Bière 3 €", "Café 1 €").
- Manage member records: create, edit, set a per-member cap, promote to till manager.
- Send a reminder, logged in the member's history.
- Print the ledger or export it as CSV.
- Every till action is attributed to a named manager and written to an audit log.

## Stack

| Layer    | Choice                                                     |
| -------- | ---------------------------------------------------------- |
| App      | Next.js 16 (App Router), TypeScript, React 19              |
| Styling  | Tailwind CSS v4, design tokens from the handoff            |
| Database | PostgreSQL + Drizzle ORM, SQL migrations in `drizzle/`     |
| Auth     | PIN hashed with Argon2id, database sessions, rate limiting |
| Tests    | Vitest (business logic), Playwright (end-to-end)           |

Structural decisions are recorded in [`docs/adr/`](docs/adr/) — notably
[why money is stored as integer cents](docs/adr/0002-money-as-integer-cents.md) and
[why nothing is ever hard-deleted](docs/adr/0005-void-and-archive-never-delete.md).

## Getting started

Requirements: Node 24+, pnpm, Docker (for the local database).

```bash
pnpm install
cp .env.example .env.local        # then fill in the two secrets
docker compose up -d              # Postgres on port 5433
pnpm db:migrate                   # create the schema
pnpm db:seed                      # nine demo members from the design handoff
pnpm dev                          # http://localhost:3000
```

Generate the two secrets with `openssl rand -base64 32`.

> `PIN_PEPPER` is load-bearing: it is mixed into every PIN before hashing and never reaches the
> database. Changing or losing it invalidates every existing PIN.

The seed prints the demo codes it created. They are development-only — the seed refuses to run
with `NODE_ENV=production`.

## Scripts

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Development server                        |
| `pnpm build`         | Production build                          |
| `pnpm test`          | Unit tests                                |
| `pnpm test:coverage` | Unit tests with coverage                  |
| `pnpm typecheck`     | TypeScript, no emit                       |
| `pnpm lint`          | ESLint                                    |
| `pnpm format`        | Prettier, write                           |
| `pnpm db:generate`   | Generate a migration from the schema      |
| `pnpm db:migrate`    | Apply pending migrations                  |
| `pnpm db:seed`       | Reset and reseed the development database |
| `pnpm db:studio`     | Browse the database                       |

## Architecture

```
src/
  db/          schema, connection, seed
  lib/         business logic — money, balance, auth, sessions, rate limiting
  app/         routes (French URLs, matching the UI language)
  components/  UI components
  styles/      design tokens
  proxy.ts     optimistic cookie check (was middleware.ts before Next 16)
```

Two rules the codebase depends on:

1. **Money is always integer cents.** `src/lib/money.ts` is the only place allowed to convert
   to or from a decimal representation.
2. **Every server page and Server Action starts with an authorisation guard** from
   `src/lib/auth.ts`. Access control never rests on what the interface shows or hides.

Business logic in `src/lib/balance.ts` and `src/lib/money.ts` imports no framework code, so it
is directly unit-testable and survives a change of stack.

## Roadmap

- [x] Foundations: Next.js, Tailwind, design tokens from the handoff
- [x] Database: schema, migrations, integrity constraints, demo seed
- [x] Business logic: money and balance rules, covered by unit tests
- [x] Authentication: Argon2id PINs, sessions, progressive lockout, access guards
- [x] Login screen: searchable member list and PIN keypad
- [x] Member view: balance, cap gauge, history
- [x] Till view: dashboard, member detail, transaction and member modals
- [x] Settings: default cap, quick-price tariffs, till managers
- [x] Ledger: printable page and CSV export
- [ ] Finishing: PWA, large-text toggle, accessibility pass, Playwright suite
- [ ] Deployment: managed Postgres in the EU, first admin bootstrap script

## Design reference

`design_handoff_ardoise_amtarc/` holds the original brief and an interactive prototype. The
prototype has no backend — it is the visual and behavioural reference, not code to copy. It is
kept in the repository so the app can be compared against it screen by screen over time.
