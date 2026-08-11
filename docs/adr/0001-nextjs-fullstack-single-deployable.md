# 1. Next.js App Router as a single deployable

- Status: accepted
- Date: 2026-08-11

## Context

The club needs a web app usable from a phone browser with no native install, plus a real
backend and database. The people maintaining it are volunteers; in two years nobody will be
actively looking after it. Whatever we pick has to survive neglect.

A separate SPA and API would mean two deployments, two sets of dependencies, CORS, and a
second thing to keep alive. The app itself is small: five screens, one entity graph.

## Decision

Use **Next.js 16 (App Router) with TypeScript** as a single fullstack project. Mutations go
through Server Actions; reads happen in Server Components via a data-access layer.

Build with `output: "standalone"` from day one, and depend on no provider-specific service.

## Consequences

- One repository, one build, one deployment target.
- No hand-written REST layer for internal screens; a Route Handler is added only where an
  actual HTTP contract is needed (the CSV export).
- Server Actions are public endpoints by definition, so every one of them must re-check
  authorisation server-side. This is enforced through `src/lib/auth.ts`.
- Hosting stays swappable: Vercel today, a VPS or container tomorrow, without a rewrite.
- We accept coupling to one framework's conventions. Business logic (`src/lib/balance.ts`,
  `src/lib/money.ts`) is kept free of framework imports so it stays portable and unit-testable.
