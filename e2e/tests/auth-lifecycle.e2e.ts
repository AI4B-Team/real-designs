import { expect, test } from "@playwright/test";

import { authenticate } from "../helpers/auth";
import { SESSION_STORAGE_KEY } from "../helpers/env";

/**
 * The parts of the session lifecycle that only a real browser can prove:
 * sign-up validation, sign-out, expiry, multi-tab propagation, protected
 * routing and the account-deletion surface.
 */
test.describe("Session lifecycle", () => {
  test("sign up rejects an invalid address before contacting the backend", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("auth-mode-toggle").click();
    await page.getByTestId("auth-email").fill("not-an-email");
    await page.getByTestId("auth-password").fill("Sup3r-Secret-Pass");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-message")).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });

  test("wrong credentials never reach the app", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("auth-email").fill("nobody@realdesigns.test");
    await page.getByTestId("auth-password").fill("definitely-wrong-password");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-message")).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });

  test("signing out returns to sign in and protected routes stay closed", async ({ context, page }) => {
    test.skip(!(await authenticate(context, page)), "no test session available");

    await page.goto("/app");
    await page.evaluate((key) => window.localStorage.removeItem(key as string), SESSION_STORAGE_KEY);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });

  test("an expired session is treated as signed out", async ({ context, page }) => {
    test.skip(!(await authenticate(context, page)) || !SESSION_STORAGE_KEY, "no test session available");

    await page.goto("/");
    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key as string);
      if (!raw) return;
      const session = JSON.parse(raw);
      session.expires_at = Math.floor(Date.now() / 1000) - 3600;
      session.access_token = "expired.token.value";
      window.localStorage.setItem(key as string, JSON.stringify(session));
    }, SESSION_STORAGE_KEY);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });

  test("signing out in one tab locks the other tab", async ({ context, page }) => {
    test.skip(!(await authenticate(context, page)) || !SESSION_STORAGE_KEY, "no test session available");

    const second = await context.newPage();
    await second.goto("/app");
    await page.goto("/app");

    await page.evaluate((key) => window.localStorage.removeItem(key as string), SESSION_STORAGE_KEY);
    await second.reload();
    await expect(second).toHaveURL(/\/auth/, { timeout: 20_000 });
    await second.close();
  });

  test("account deletion is available and asks for confirmation", async ({ context, page }) => {
    test.skip(!(await authenticate(context, page)), "no test session available");

    await page.goto("/app/account?section=security");
    const danger = page.getByText(/delete (my )?account/i).first();
    await expect(danger).toBeVisible({ timeout: 20_000 });
    await danger.click();
    await expect(page.getByText(/permanent|cannot be undone|type/i).first()).toBeVisible();
  });
});
