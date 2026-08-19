import { expect, test } from "@playwright/test";

test.describe("Authentication entry points", () => {
  test("sign in page renders the email form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByTestId("auth-title")).toHaveText(/sign in/i);
    await expect(page.getByTestId("auth-email")).toBeVisible();
    await expect(page.getByTestId("auth-password")).toBeVisible();
    await expect(page.getByTestId("auth-submit")).toBeEnabled();
  });

  test("can switch to sign up and back", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("auth-mode-toggle").click();
    await expect(page.getByTestId("auth-title")).toHaveText(/create your account/i);
    await expect(page.getByTestId("auth-submit")).toHaveText(/create account/i);
    await page.getByTestId("auth-mode-toggle").click();
    await expect(page.getByTestId("auth-title")).toHaveText(/sign in/i);
  });

  test("password reset entry asks for an email first", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("auth-forgot").click();
    await expect(page.getByTestId("auth-message")).toContainText(/enter your email/i);
  });

  test("password reset accepts an address and reports back", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("auth-email").fill("e2e-reset@realdesigns.test");
    await page.getByTestId("auth-forgot").click();
    await expect(page.getByTestId("auth-message")).toBeVisible();
  });

  test("reset-password route is reachable", async ({ page }) => {
    const response = await page.goto("/reset-password");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("protected app route sends signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });
});
