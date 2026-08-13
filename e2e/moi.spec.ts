import { expect, test } from "@playwright/test";

import { alert, MEMBER, signInAsMember } from "./helpers";

/*
 * What a member sees of their own account, and the two things the interface
 * must never get wrong about it: the figure, and who else can read it.
 */

test("a member sees their balance, their cap and the alert above it", async ({ page }) => {
  await signInAsMember(page);

  await expect(page.getByRole("heading", { level: 1, name: MEMBER })).toBeVisible();
  await expect(page.getByRole("heading", { name: "À régler" })).toBeVisible();
  await expect(page.getByText("29,00 €")).toBeVisible();
  await expect(page.getByText("Votre plafond : 20,00 €")).toBeVisible();

  /* 29,00 against a 20,00 cap, so the banner has to be there. */
  await expect(alert(page)).toContainText("Vous avez dépassé votre plafond");

  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByText("Repas + boissons")).toBeVisible();
});

test("a member sees nobody else's history", async ({ page }) => {
  await signInAsMember(page);

  await expect(page.getByText("Bernard Lefèvre")).toBeHidden();
  await expect(page.getByText("Règlement espèces")).toBeHidden();
});

test("an ordinary member is offered no way into the till", async ({ page }) => {
  await signInAsMember(page);

  await expect(page.getByRole("link", { name: "Vue caisse" })).toBeHidden();
});

test("a till manager can cross to their own slate and back", async ({ page }) => {
  const { signInAsManager } = await import("./helpers");
  await signInAsManager(page);

  await page.getByRole("link", { name: "Mon ardoise" }).click();
  await expect(page).toHaveURL(/\/moi$/);

  await page.getByRole("link", { name: "Vue caisse" }).click();
  await expect(page).toHaveURL(/\/caisse$/);
});

test("signing out ends the session for good", async ({ page }) => {
  await signInAsMember(page);

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  /* Going back must not resurrect the page from the browser cache. */
  await page.goto("/moi");
  await expect(page).toHaveURL(/\/connexion$/);
});
