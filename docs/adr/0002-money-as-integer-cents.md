# 2. Represent money as integer cents

- Status: accepted
- Date: 2026-08-11

## Context

The app tracks real debts between club members. Balances must be exact: the check "is this
account settled?" has to be trustworthy, because it drives what a member is told they owe.

Binary floating point cannot represent 0.10 exactly, and the error accumulates over
successive additions. The prototype hit this and papered over it with a tolerance window:

```js
// design_reference.html:497
if (balance > 0.001) return { status: "À régler" };
if (balance < -0.001) return { status: "Avoir en votre faveur" };
```

That epsilon has no business meaning — nobody owes a thousandth of a euro — and it leaks:
enough additions and the drift exceeds the threshold.

## Decision

Store and manipulate every amount as an **integer number of cents**. `3.30 €` is `330`.
Conversion to and from a decimal representation happens only in `src/lib/money.ts`, at the
display and input boundaries.

## Alternatives considered

**Postgres `NUMERIC` + `decimal.js`.** Equally exact, and what a Java or .NET codebase would
do. Rejected because JavaScript has no native decimal type: values crossing out of the
database become floats again unless a library is used rigorously everywhere. Drizzle returns
`NUMERIC` as a _string_ precisely for this reason. More moving parts for the same result.

**Plain floats.** Rejected — this is the defect described above.

## Consequences

- JavaScript integers are exact to 2^53, roughly 90 trillion euros. Not a constraint here.
- Comparisons are exact: `balance === 0` needs no tolerance window.
- The app only adds and subtracts hand-entered amounts — no division, no percentages — so
  rounding policy never arises. If a "split the round" feature is ever added, that decision
  will need making explicitly.
- Every new money column must be named `*_cents` and typed `integer`, and every read path
  must go through `money.ts` to render.
