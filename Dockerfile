# The app as one container, from the standalone build promised in ADR 0001.
#
# Debian slim rather than Alpine: @node-rs/argon2 is a native module, and glibc
# spares the club a musl-specific binary problem the day it upgrades Node.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# next build reads the environment through src/env.ts, which refuses to start
# without these three. The values below are placeholders — nothing here is
# baked into the output, and the real ones arrive at run time.
#
# Scoped to this RUN rather than set with ENV: an ENV persists in the image's
# metadata, and a variable named like a secret should never linger there even
# when its value is a decoy.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    PIN_PEPPER="build-only-placeholder-of-at-least-32-chars" \
    IP_HASH_SECRET="build-only-placeholder-of-at-least-32-chars" \
    pnpm build

# The two commands an operator runs against the database, compiled to plain
# JavaScript so the image needs no TypeScript toolchain at all.
RUN node scripts/build-operator-scripts.mjs

# ---- runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Never root. A club's ledger is not worth a container escape.
RUN groupadd --system --gid 1001 ardoise \
  && useradd --system --uid 1001 --gid ardoise ardoise

# The standalone server carries only the dependencies it actually reached.
COPY --from=build --chown=ardoise:ardoise /app/.next/standalone ./
COPY --from=build --chown=ardoise:ardoise /app/.next/static ./.next/static
COPY --from=build --chown=ardoise:ardoise /app/public ./public

# The SQL migrations, and the two operator commands compiled above.
COPY --from=build --chown=ardoise:ardoise /app/drizzle ./drizzle
COPY --from=build --chown=ardoise:ardoise /app/scripts-dist ./scripts

USER ardoise
EXPOSE 3000

# Answers only once the database answers too — see src/app/sante/route.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
