import { expect, test } from "../helpers/fixtures";
import { gotoView, photoCards } from "../helpers/app";
import { useRealProvider } from "../helpers/env";
import { uploadPhotos, validPhoto } from "../helpers/uploads";
import { waitForAsyncJob } from "../helpers/waits";

/**
 * Opt-in smoke test that hits the REAL AI provider. It is skipped unless
 * `E2E_REAL_PROVIDER=1` and should only ever point at staging:
 *
 *   E2E_REAL_PROVIDER=1 E2E_BASE_URL=https://staging.example npm run test:e2e -- --grep @staging
 */
test.describe("@staging real provider smoke", () => {
  test.skip(!useRealProvider, "Set E2E_REAL_PROVIDER=1 to run the staging smoke test.");
  test.setTimeout(180_000);

  test("generates one design end to end", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await uploadPhotos(appPage, [validPhoto("smoke.jpg")]);
    await waitForAsyncJob(appPage);
    await photoCards(appPage).first().click();

    const cta = appPage
      .getByRole("button", { name: /set design direction|design \d+ photos?/i })
      .first();
    await cta.click();
    const generate = appPage.getByRole("button", { name: /generate/i }).last();
    await generate.click();
    await waitForAsyncJob(appPage, 170_000);
    await expect(appPage.locator("img[src]").first()).toBeVisible();
  });
});
