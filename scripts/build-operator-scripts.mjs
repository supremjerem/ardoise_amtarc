import { build } from "esbuild";

/*
 * Compiles the two commands an operator runs against the database — applying
 * migrations, and creating the club's first till manager — into plain
 * JavaScript.
 *
 * Why bundle them at all: the production image has no TypeScript toolchain,
 * and dragging `tsx` and `drizzle-kit` into it would mean carrying a compiler
 * and its transitive tree to run two scripts a club uses once. Bundling turns
 * each into a single file the standalone Node runtime can execute directly.
 *
 * Run by the Dockerfile. Locally the same commands go through `tsx`, where the
 * source is right there and a build step would only be in the way.
 */

await build({
  entryPoints: ["src/db/migrate.ts", "src/db/bootstrap.ts"],
  outdir: "scripts-dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  /*
   * Argon2 is a native module: bundling it would inline a JavaScript wrapper
   * around a binary that is not there. The standalone output already carries
   * it, so it is resolved at runtime instead.
   */
  external: ["@node-rs/argon2"],
  /* esbuild reads the `@/*` aliases from tsconfig.json on its own. */
  logLevel: "warning",
});
