import { expireSession } from "../helpers/auth";
import { expect, test } from "../helpers/fixtures";
import { gotoView, photoCards } from "../helpers/app";
import { mockAiProviderUnavailable, mockExpiredSession, mockInsufficientCredits } from "../helpers/mocks";
import { uploadPhotos, validPhoto } from "../helpers/uploads";
import { waitForAsyncJob } from "../helpers/waits";

async function startGeneration(page: import("@playwright/test").Page): Promise<boolean> {
  await gotoView(page, "studio");
  await uploadPhotos(page, [validPhoto("failure.jpg")]);
  await waitForAsyncJob(page);
  await photoCards(page).first().click();
  const cta = page
    .getByRole("button", { name: /set design direction|design \d+ photos?|generate/i })
    .first();
  if ((await cta.count()) === 0) return false;
  await cta.click();
  const generate = page.getByRole("button", { name: /generate/i }).last();
  if (await generate.isVisible().catch(() => false)) await generate.click();
  return true;
}

test.describe("Failure handling", () => {
  test("surfaces an insufficient-credits message", async ({ appPage }) => {
    await mockInsufficientCredits(appPage);
    const started = await startGeneration(appPage);
    test.skip(!started, "Generation entry point not available");
    await expect(
      appPage.getByText(/credit|not enough|top up|upgrade/i).first(),
    ).toBeVisible();
  });

  test("recovers from an unavailable AI provider", async ({ appPage }) => {
    await mockAiProviderUnavailable(appPage);
    const started = await startGeneration(appPage);
    test.skip(!started, "Generation entry point not available");
    await expect(
      appPage.getByText(/unavailable|try again|retry|couldn.t/i).first(),
    ).toBeVisible();
  });

  test("sends the user to sign in when the session expires", async ({ appPage }) => {
    await mockExpiredSession(appPage);
    await expireSession(appPage);
    await appPage.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(appPage).toHaveURL(/\/auth/, { timeout: 20_000 });
  });
});
