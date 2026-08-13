import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, sql as connection } from "@/db";

/*
 * Applies pending migrations, using drizzle-orm's own migrator rather than the
 * drizzle-kit CLI.
 *
 * drizzle-kit is a development tool: it pulls in esbuild and a compiler, none
 * of which belongs in a production image. The migrator is part of the runtime
 * library the app already ships, so this runs anywhere the app itself runs.
 *
 * `pnpm db:migrate` still uses the CLI locally, where generating migrations
 * and applying them go together.
 */

async function run(): Promise<void> {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("\n  ✓ Migrations à jour.\n");
}

run()
  .then(() => connection.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Échec des migrations :", error);
    await connection.end();
    process.exit(1);
  });
