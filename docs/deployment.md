# Deployment

The app is one process and one PostgreSQL database. Nothing else — no queue, no cache, no
object storage. That is the whole point of [ADR 0001](adr/0001-nextjs-fullstack-single-deployable.md).

## The chicken and the egg

A freshly migrated database has **no members**. Nobody can sign in, so nobody can create
anybody: the app cannot bootstrap itself through its own screens.

One command does it, once:

```bash
pnpm bootstrap --name "Prénom Nom" --licence AM1042
```

It creates the first till manager and prints a six-digit code **once**. Nothing stores that
code — only its Argon2 hash reaches the database — so write it down before the terminal
scrolls. Pass `--pin 481507` to choose it instead of having one drawn.

The script **refuses to run once a till manager exists**. From that point on, people are added
from Réglages → Responsables de caisse, where each creation is attributed to whoever made it.
It stays safe to leave in the image: it is a locked door, not an open one.

The exception is deliberate. A club that retired its last manager has no way in again, and
running this is how it recovers.

## What to provision

| Need                | Notes                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| A Node 24 host      | Vercel, a VPS, or the container below. One instance is plenty for a club.  |
| Managed PostgreSQL  | **Hosted in the EU.** See below.                                           |
| A domain with HTTPS | Session cookies are `secure` in production and will not be sent over HTTP. |

### Why the database belongs in the EU

It holds names, e-mail addresses, phone numbers and a record of what each member drinks and
owes. For a French club that is personal data under the GDPR, and keeping it in the EU avoids
a transfer question nobody at the club wants to answer. Scaleway, OVH, Clever Cloud and Neon
all offer EU regions.

## Environment

Three variables, all required — `src/env.ts` refuses to start without them, at boot rather
than at the first login.

| Variable         | What it is                                              |
| ---------------- | ------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string, with TLS in production    |
| `PIN_PEPPER`     | Mixed into every PIN before hashing. **Never changes.** |
| `IP_HASH_SECRET` | Salts the addresses recorded for the lockout counter    |

Generate the two secrets with `openssl rand -base64 32`, store them in the host's secret
manager, and keep a copy somewhere the club will still have in five years.

> **`PIN_PEPPER` is load-bearing.** It lives outside the database precisely so that a stolen
> database cannot be attacked offline. Losing or changing it invalidates **every** member's
> code at once, and the only recovery is to reset all of them by hand.

## First run

```bash
pnpm db:migrate                        # create the schema
pnpm bootstrap --name "Prénom Nom"     # create the first manager, note the code
```

Then open the app, sign in, and add the club from the till.

`pnpm db:seed` is for development only: it **wipes the database** and inserts nine fictional
members whose codes are printed in this repository. It refuses to run against any host but
`localhost`, so pointing it at the club by accident fails loudly instead of destroying the
ledger. `NODE_ENV` is not the guard — it is undefined in an operator's shell, on a server as
much as on a laptop.

## With Docker

```bash
docker build -t ardoise .
docker run -d --name ardoise -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e PIN_PEPPER="…" \
  -e IP_HASH_SECRET="…" \
  ardoise
```

The image runs as a non-root user and carries the migration tooling, so the two commands above
run inside it:

```bash
docker exec ardoise node scripts/migrate.js
docker exec ardoise node scripts/bootstrap.js --name "Prénom Nom"
```

Both are compiled to plain JavaScript at build time, so the image carries no TypeScript
toolchain — only the SQL migrations and those two files.

`/sante` answers `200` only when the database answers too, and is the health check to point a
load balancer or orchestrator at. It is deliberately reachable without signing in, and says
nothing beyond `ok` or `degraded`.

## Upgrades

```bash
git pull && pnpm install && pnpm db:migrate && pnpm build
```

Migrations are additive and run before the new code starts. Nothing in this app hard-deletes a
financial record ([ADR 0005](adr/0005-void-and-archive-never-delete.md)), so a rollback loses
no history — but a migration that adds a column is not undone by checking out the old commit.

## Backups

The ledger **is** the club's accounting. Whatever managed database you pick, turn on automated
daily backups and confirm a restore works before the club depends on it. An untested backup is
a belief, not a backup.

`Réglages → Grand livre → Imprimer / exporter` produces a CSV of every entry, voided ones
included. It is a reasonable thing for the treasurer to keep a copy of each season, and it is
readable without this app ever running again.
