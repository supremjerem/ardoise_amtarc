import { expect, test } from "@playwright/test";

import { signInAsManager } from "./helpers";

/*
 * The parts of the accessibility work that a unit test cannot reach: they only
 * exist once a real browser is laying out and focusing real elements.
 */

test("the first Tab offers a way past the header", async ({ page }) => {
  await page.goto("/connexion");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skipLink).toBeFocused();
  /* Invisible until focused, which is the one moment it is wanted. */
  await expect(skipLink).toBeVisible();
});

test("large text scales the interface and survives a reload", async ({ page }) => {
  await page.goto("/connexion");

  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

  expect(await rootSize()).toBe("16px");

  await page.getByRole("button", { name: /Grands caractères/ }).click();
  expect(await rootSize()).toBe("20px");

  await page.reload();
  /* Applied before first paint, so the page never flashes at the wrong size. */
  expect(await rootSize()).toBe("20px");

  await page.getByRole("button", { name: /Grands caractères/ }).click();
  expect(await rootSize()).toBe("16px");
});

test("Escape backs out of the keypad without signing anyone in", async ({ page }) => {
  await page.goto("/connexion");

  await page.getByLabel("Rechercher votre nom").fill("Karim");
  await page.getByRole("button", { name: "Karim Haddad" }).click();
  await expect(page.getByText(/Entrez votre code/)).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("heading", { name: /Qui êtes-vous/ })).toBeVisible();
  await expect(page).toHaveURL(/\/connexion$/);
});

test("a dialog keeps the keyboard inside it", async ({ page }) => {
  await signInAsManager(page);
  await page.getByRole("button", { name: "Nouvelle transaction" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  /*
   * `aria-modal` tells a screen reader the page behind is inert, but does
   * nothing to the tab order. Without a trap, focus walks out of the dialog
   * to where the focus ring is hidden under the backdrop.
   */
  for (let press = 0; press < 15; press++) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }

  /* And backwards, which is the direction usually forgotten. */
  for (let press = 0; press < 20; press++) {
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }
});

test("the app declares itself installable", async ({ page }) => {
  await page.goto("/connexion");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);

  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  expect(body.lang).toBe("fr");
  /* Both sizes are required for an installable app. */
  const sizes = body.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});
