# 3. PostgreSQL with Drizzle ORM

- Status: accepted
- Date: 2026-08-11

## Context

Balances and history must outlive any single browser or device — the prototype's only real
weakness was storing everything in `localStorage`. We need a real database, and one that does
not lock the club into a single hosting provider.

Scale is tiny: tens of members, a handful of entries a day, a decade of history measured in
megabytes.

## Decision

**PostgreSQL** as the database, **Drizzle ORM** as the access layer, with SQL migrations
committed to the repository.

## Consequences

- Standard Postgres, no provider-specific extension: the same schema runs on a managed
  provider, a VPS, or the local Docker container in `docker-compose.yml`.
- Drizzle keeps the schema readable in TypeScript and generates versioned SQL migrations.
  No code generation step, no native binary to install in CI.
- Integrity constraints live in the database (`CHECK` on amounts, the settings singleton, the
  void-consistency rule), not only in application code. A bad row introduced by a script or a
  manual fix cannot silently corrupt balances.
- Prepared statements are disabled in the client, because managed providers front the database
  with a pooler that does not support them in transaction mode. This costs nothing at our
  query volume and keeps the configuration portable.
- SQLite would also have fit the volume, but Postgres removes the question of concurrent
  writes entirely and is what every candidate host offers.
