import { expect, test } from "@playwright/test";

import { alert, ADMIN_PIN, MANAGER, MEMBER, MEMBER_PIN, signIn, typePin } from "./helpers";

/*
 * Signing in, and the guards around it.
 *
 * Everything here is a read, so no reseeding is needed — except the lockout,
 * which is why failed attempts are spread across members rather than piled on
 * one.
 */

test.describe("signing in", () => {
  test("a member reaches their own slate", async ({ page }) => {
    await signIn(page, MEMBER, MEMBER_PIN);

    await expect(page).toHaveURL(/\/moi$/);
    await expect(page.getByRole("heading", { level: 1, name: MEMBER })).toBeVisible();
  });

  test("a till manager lands on the till, not on their slate", async ({ page }) => {
    await signIn(page, MANAGER, ADMIN_PIN);

    await expect(page).toHaveURL(/\/caisse$/);
    await expect(page.getByRole("heading", { name: "Caisse du club" })).toBeVisible();
  });

  test("the keypad asks a manager for six digits and a member for four", async ({ page }) => {
    await page.goto("/connexion");

    await page.getByLabel("Rechercher votre nom").fill("Bernard");
    await page.getByRole("button", { name: MANAGER }).click();
    await expect(page.getByText("Entrez votre code à 6 chiffres")).toBeVisible();

    await page.getByRole("button", { name: "← Retour" }).click();
    await page.getByLabel("Rechercher votre nom").fill("Karim");
    await page.getByRole("button", { name: MEMBER }).click();
    await expect(page.getByText("Entrez votre code à 4 chiffres")).toBeVisible();
  });

  test("a wrong code is refused without saying which part was wrong", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Rechercher votre nom").fill("Léa");
    await page.getByRole("button", { name: "Léa Fontaine" }).click();

    await typePin(page, "1111");

    await expect(alert(page)).toHaveText("Code incorrect, réessayez.");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("no name is served until something is typed", async ({ page }) => {
    /*
     * The roster used to be rendered into this page for anyone who opened it.
     * Now it is not in the HTML at all — which is the point of the search.
     */
    const response = await page.goto("/connexion");
    const html = (await response?.text()) ?? "";

    expect(html).not.toContain(MANAGER);
    expect(html).not.toContain(MEMBER);
    await expect(page.getByText(/Tapez au moins deux lettres/)).toBeVisible();
  });

  test("one letter is not enough to list anybody", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Rechercher votre nom").fill("b");

    await expect(page.getByText(/Tapez au moins deux lettres/)).toBeVisible();
    await expect(page.getByRole("button", { name: MANAGER })).toBeHidden();
  });

  test("search matches a surname and ignores accents", async ({ page }) => {
    await page.goto("/connexion");
    const search = page.getByLabel("Rechercher votre nom");

    await search.fill("lef");
    await expect(page.getByRole("button", { name: MANAGER })).toBeVisible();
    await expect(page.getByRole("button", { name: MEMBER })).toBeHidden();

    /* No accent typed, and Émilie still has to be findable. */
    await search.fill("emi");
    await expect(page.getByRole("button", { name: "Émilie Rousseau" })).toBeVisible();

    await search.fill("zzz");
    await expect(page.getByText(/Aucun nom ne correspond/)).toBeVisible();
  });
});

test.describe("guards", () => {
  test("a visitor with no session is sent to the login screen", async ({ page }) => {
    for (const path of ["/", "/moi", "/caisse", "/caisse/reglages", "/caisse/grand-livre"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion$/);
    }
  });

  test("the health check answers without a session", async ({ request }) => {
    /*
     * Public on purpose: redirected to the login screen it would report the
     * app healthy from a 307, which says nothing about the database.
     */
    const response = await request.get("/sante");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("a member cannot reach the till", async ({ page }) => {
    await signIn(page, MEMBER, MEMBER_PIN);

    for (const path of ["/caisse", "/caisse/reglages", "/caisse/grand-livre"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/moi$/);
    }
  });

  test("a stale cookie still leaves the login screen reachable", async ({ page, context }) => {
    /*
     * The regression that cost a browser an error page: the proxy used to send
     * anyone holding a cookie away from /connexion, while the guard on /moi
     * sent anyone without a valid session back to it. A cookie that no longer
     * matches a session satisfied the first and failed the second.
     */
    await context.addCookies([
      {
        name: "ardoise_session",
        value: "a-token-that-matches-no-session",
        url: "http://127.0.0.1:3100",
      },
    ]);

    await page.goto("/moi");

    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole("heading", { name: /Qui êtes-vous/ })).toBeVisible();
  });
});
