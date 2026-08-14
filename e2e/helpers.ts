import { execFileSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

import { ADMIN_PIN, MEMBER_PIN } from "../src/db/demo-codes";

/*
 * Shared machinery for the end-to-end suite.
 *
 * The codes come from the seed itself rather than being copied here: a test
 * that fails because someone changed a demo PIN tells you nothing useful.
 */

export { ADMIN_PIN, MEMBER_PIN };

/** Someone who manages the till, and someone who does not. */
export const MANAGER = "Bernard Lefèvre";
export const MEMBER = "Karim Haddad";

/**
 * Puts the database back to the seed.
 *
 * Called before each test that writes. Slower than mocking, and the reason
 * these tests are worth having: the balance a test reads has been through
 * Postgres, the constraints and `calculateBalance`, exactly as it will in the
 * club.
 */
export function reseed(): void {
  execFileSync("pnpm", ["db:seed"], { stdio: "pipe" });
}

/**
 * Signs in through the real screens — search, pick, keypad — rather than by
 * forging a session cookie. Signing in is itself something worth testing on
 * every run, and it is the one path every member uses.
 */
export async function signIn(page: Page, name: string, pin: string): Promise<void> {
  await page.goto("/connexion");

  await page.getByLabel("Rechercher votre nom").fill(name.split(" ")[0]);
  /* The names are fetched from the server as you type. */
  await expect(page.getByRole("button", { name })).toBeVisible();
  await page.getByRole("button", { name }).click();

  await expect(page.getByText(/Entrez votre code/)).toBeVisible();
  await typePin(page, pin);

  /*
   * Wait for the session to actually exist before returning. The last digit
   * only STARTS the sign-in; navigating straight afterwards raced the Server
   * Action and landed back on /connexion with no cookie yet — which read
   * exactly like a broken guard.
   */
  await expect(page).not.toHaveURL(/\/connexion/);
}

/**
 * The app's own alerts.
 *
 * Next.js gives its route announcer `role="alert"` too, so a bare
 * `getByRole("alert")` matches two things on every page and fails as
 * ambiguous rather than telling you anything.
 */
export function alert(page: Page) {
  return page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
}

/** Taps the digits on the keypad, as a member would. */
export async function typePin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

export async function signInAsManager(page: Page): Promise<void> {
  await signIn(page, MANAGER, ADMIN_PIN);
  await expect(page).toHaveURL(/\/caisse$/);
}

export async function signInAsMember(page: Page): Promise<void> {
  await signIn(page, MEMBER, MEMBER_PIN);
  await expect(page).toHaveURL(/\/moi$/);
}
