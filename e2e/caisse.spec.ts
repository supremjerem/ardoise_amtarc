import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { alert, MEMBER, reseed, signInAsManager } from "./helpers";

/*
 * The till's actions, each one writing to the database.
 *
 * Reseeded before every test: these assert on exact amounts, and an amount is
 * only meaningful against a known starting point.
 */

test.beforeEach(() => {
  reseed();
});

test("recording an expense moves the member's balance and the club total", async ({ page }) => {
  await signInAsManager(page);

  await expect(page.getByText("105,00 €")).toBeVisible();

  await page.getByRole("button", { name: "Nouvelle transaction" }).click();
  await page.getByLabel("Membre", { exact: true }).selectOption({ label: MEMBER });

  /* One tap fills both the amount and the note — the point of the tariffs. */
  await page.getByRole("button", { name: /Bière/ }).click();
  await expect(page.getByLabel("Montant (€)")).toHaveValue("3.00");

  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByRole("status")).toContainText(`Dépense enregistrée pour ${MEMBER}`);
  /* 29,00 owed before, 105,00 across the club. */
  await expect(page.getByText("32,00 €")).toBeVisible();
  await expect(page.getByText("108,00 €")).toBeVisible();
});

test("a payment reduces what is owed", async ({ page }) => {
  await signInAsManager(page);

  await page.getByRole("link", { name: new RegExp(MEMBER) }).click();
  await expect(page.getByRole("heading", { level: 1, name: MEMBER })).toBeVisible();

  await page.getByRole("button", { name: "✓ Enregistrer un paiement" }).click();
  await page.getByLabel("Montant (€)").fill("9,00");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByRole("status")).toContainText("Paiement enregistré");
  await expect(page.getByText("20,00 €").first()).toBeVisible();
});

test("an amount that is not a number is refused", async ({ page }) => {
  await signInAsManager(page);

  await page.getByRole("button", { name: "Nouvelle transaction" }).click();
  await page.getByLabel("Membre", { exact: true }).selectOption({ label: MEMBER });
  await page.getByLabel("Montant (€)").fill("beaucoup");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(alert(page)).toContainText("Montant invalide");
  /* The dialog stays open so the typo can be corrected in place. */
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("voiding an entry takes it out of the balance but not out of the ledger", async ({ page }) => {
  await signInAsManager(page);

  await page.getByRole("link", { name: new RegExp(MEMBER) }).click();
  await page.getByRole("button", { name: /Annuler l'écriture « Repas \+ boissons »/ }).click();
  await page.getByRole("button", { name: "Annuler l'écriture", exact: true }).click();

  await expect(page.getByRole("status")).toContainText("Écriture annulée");
  /* 29,00 less the 14,00 that was voided. */
  await expect(page.getByText("15,00 €").first()).toBeVisible();

  /* Gone from the member's history… */
  await expect(page.getByText("Repas + boissons")).toBeHidden();

  /* …and still in the ledger, marked, because it is an accounting record. */
  await page.goto("/caisse/grand-livre");
  await expect(page.getByText("Repas + boissons")).toBeVisible();
  await expect(page.getByText("(annulée)")).toBeVisible();
});

test("the club cannot be left without a till manager", async ({ page }) => {
  await signInAsManager(page);

  /* Demote the only other manager, leaving the signed-in one alone. */
  await page.getByRole("link", { name: /Nathalie Petit/ }).click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByRole("switch", { name: "Responsable de caisse" }).click();
  await page.getByLabel(/Code PIN/).fill("7391");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("a été modifié");

  /* Now try to demote the last one. */
  await page.goto("/caisse/reglages");
  await page.getByRole("link", { name: /Bernard Lefèvre/ }).click();
  /* Wait for the record to open: /caisse/reglages has "Modifier" buttons too. */
  await expect(page.getByRole("heading", { level: 1, name: "Bernard Lefèvre" })).toBeVisible();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.getByRole("switch", { name: "Responsable de caisse" }).click();
  await page.getByLabel(/Code PIN/).fill("7391");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(alert(page)).toContainText("Il doit rester au moins un responsable de caisse");
});

test("nobody can delete their own account", async ({ page }) => {
  await signInAsManager(page);

  await page.getByRole("link", { name: /Bernard Lefèvre/ }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).last().click();

  await expect(alert(page)).toContainText("Vous ne pouvez pas supprimer votre propre compte");
});

test("the default cap applies to the next member, not to existing ones", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/caisse/reglages");

  await page.getByLabel("Plafond par défaut en euros").fill("40");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plafond par défaut enregistré");

  /* The new member dialog opens on the new figure… */
  await page.goto("/caisse");
  await page.getByRole("button", { name: "+ Membre" }).click();
  await expect(page.getByLabel("Plafond (€)")).toHaveValue("40.00");
  await page.getByRole("button", { name: "Annuler" }).click();

  /* …while somebody already in the club keeps theirs. */
  await page.getByRole("link", { name: new RegExp(MEMBER) }).click();
  await expect(page.getByText("Plafond : 20,00 €")).toBeVisible();
});

test("the ledger exports as a spreadsheet a French Excel can open", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/caisse/grand-livre");

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exporter en CSV" }).click(),
  ]).then(([file]) => file);

  expect(download.suggestedFilename()).toMatch(/^grand-livre-\d{4}-\d{2}-\d{2}\.csv$/);

  const csv = readFileSync(await download.path(), "utf8");

  /* Without the byte order mark Excel mangles every accented name. */
  expect(csv.startsWith("﻿")).toBe(true);
  /* Semicolons, or "12,50" would be split across two columns. */
  expect(csv).toContain("Date;Membre;Licence;Type;Libellé;Montant;Enregistré par;Annulée");
  expect(csv).toContain("Karim Haddad");
  /* A payment keeps its sign so the column adds up. */
  expect(csv).toMatch(/;-\d+,\d{2};/);
});
