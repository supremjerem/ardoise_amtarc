# 4. PIN authentication, hardened server-side

- Status: accepted
- Date: 2026-08-11

## Context

Members are mostly older people with limited appetite for technology. The prototype used a
four-digit PIN with no backend — fine as a demo, not as authentication. But the interaction it
proposed (pick your name, tap four digits, no submit button) is genuinely the right one for
this audience: any friction here means the app simply goes unused.

Meanwhile the app tracks money, and till managers can see and modify everyone's balance.

## Decision

Keep the PIN interaction. Harden everything behind it:

- **Argon2id** hashing, never a stored or logged clear PIN.
- A **server-side pepper** (`PIN_PEPPER`) that never reaches the database.
- **Progressive lockout** keyed on (member, device): 5 failures → 1 min, then 5 min, then 15.
- **Six-digit PINs required for till managers**, four for ordinary members.
- Obvious codes (`1111`, `1234`) rejected at entry.
- Session cookie: `httpOnly`, `secure` in production, `sameSite=lax`, one year, rolling.

## Alternatives considered

**Email magic links.** More secure, and rejected: requiring members to check email on a phone
to see their bar tab is the single most likely reason for the app to go unused. Many recorded
addresses will also be wrong or absent.

**Passwords for admins, PINs for members.** Genuinely safer, but two login journeys to build,
explain and support. Revisit if the club grows or an incident occurs.

## Consequences

- A four-digit PIN is only 10 000 combinations, so the lockout — not the hash — is what
  actually protects an account. It must never be bypassed or weakened.
- The pepper is operationally load-bearing: changing or losing it invalidates every PIN.
  This is documented in `.env.example` and the README.
- The login screen lists every member by name, which is public information within a small
  club, and is the price of the low-friction journey. Lockout limits how exploitable it is.
- Sessions last a year, so `readCurrentMember()` re-checks on every request that the member
  has not been archived since.
