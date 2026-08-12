# 6. Avatars are initials, with no photo upload

- Status: accepted
- Date: 2026-08-12

## Context

The design handoff shows a photo control in the member dialog, and `members.photo_url` exists
in the schema. Nothing writes to it.

Storing an image is not a UI decision. It commits the project to somewhere to put bytes, a
backup story for them, and a way to serve them — none of which the app currently needs, since
it has no other binary data at all.

The handoff also states the fallback as the normal case:

> Aucune image externe : avatars = initiales sur fond de couleur.

The nine seeded members have no photo. A club of this size recognises each other by name.

## Decision

Avatars are **initials on a coloured disc**, everywhere and always. No photo upload is built.

`members.photo_url` stays in the schema, unused, rather than being dropped in a migration.

## Alternatives considered

**Base64 in the database.** Simplest to build and backed up with everything else. Rejected:
it inflates every member row, and `readMember` is on the path of every till screen — the
dashboard would carry a megabyte of images to render a list of names.

**The server's filesystem.** Also simple. Rejected: it assumes durable local disk, which a
managed host may not give (see ADR 0001), and it splits the backup into two things that must
be restored together to be consistent.

**Object storage (S3, R2).** The correct answer for a project that needs images. Rejected as
disproportionate here: another service, another set of credentials to rotate, and a running
cost, for decoration on a screen whose job is to show a balance.

## Consequences

- `src/lib/avatar.ts` is the single source of an avatar, and `avatar_color_index` is stored
  per member so a rename never reshuffles the faces people have learned to recognise.
- The member dialog has no photo field. That is a deliberate departure from the handoff, and
  the only one.
- `photo_url` remains a dormant column. It is kept because dropping and re-adding a column is
  more churn than leaving it, and because it names the extension point should this be
  revisited. **Anything reading it must treat it as always null.**
- Revisiting this means picking a storage backend first, and replacing this ADR rather than
  quietly writing to the column.
