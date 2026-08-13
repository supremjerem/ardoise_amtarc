import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests.
 *
 * These run against a real build, a real Postgres and the real seed — the
 * point of them is to catch what unit tests structurally cannot: a guard that
 * does not guard, a form that never submits, a redirect loop between two
 * screens that each behave correctly on their own.
 *
 * ONE WORKER, on purpose. The suite writes to a shared database and reseeds
 * between tests to stay isolated. Parallel workers would reseed underneath
 * each other, and a suite that fails at random teaches nobody anything.
 */

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  /* A club-sized suite: correctness over wall-clock. */
  workers: 1,
  fullyParallel: false,
  /* A test that only passes on the second attempt is a broken test. */
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    /* Kept only for failures — enough to see what the screen looked like. */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      /*
       * The club signs in on phones. A layout that only works at desktop
       * width would pass every other check in this repository.
       */
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    /*
     * The production build, not `next dev`: the dev server tolerates things
     * production does not, and this is the code that will actually run.
     *
     * CI has already built by the time it gets here, so it only starts.
     */
    command: process.env.CI
      ? `pnpm start --port ${PORT}`
      : `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
