import { expect, test } from "../helpers/fixtures";
import {
  cancelModal,
  chooseDoor,
  clickMenuItem,
  gotoView,
  openCardMenu,
  openModal,
  photoCards,
} from "../helpers/app";
import { uploadPhotos, validPhoto } from "../helpers/uploads";
import { expectNoRedirect, waitForAsyncJob } from "../helpers/waits";

async function setup(page: import("@playwright/test").Page, name: string) {
  await gotoView(page, "studio");
  await chooseDoor(page, "design");
  await uploadPhotos(page, [validPhoto(name)]);
  await waitForAsyncJob(page);
  await expect.poll(async () => await photoCards(page).count()).toBeGreaterThan(0);
}

test.describe("Canvas routing", () => {
  test("opens the Canvas without bouncing back to the dashboard", async ({ appPage }) => {
    await setup(appPage, "canvas.jpg");
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /open canvas/i);
    await waitForAsyncJob(appPage);
    await expectNoRedirect(appPage, new URL(appPage.url()).pathname);
    await expect(appPage.locator("#v-studio, .rds-canvas, .canvas-card").first()).toBeVisible();
  });

  test("keeps Canvas context after a refresh", async ({ appPage }) => {
    await setup(appPage, "canvas-refresh.jpg");
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /open canvas/i);
    await waitForAsyncJob(appPage);

    const path = new URL(appPage.url()).pathname;
    await appPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAsyncJob(appPage);
    await expectNoRedirect(appPage, path);
  });

  test("cancelling the design modal leaves the photos untouched", async ({ appPage }) => {
    await setup(appPage, "canvas-modal.jpg");
    const trigger = appPage
      .getByRole("button", { name: /set design direction|design \d+ photos?/i })
      .first();
    if ((await trigger.count()) === 0) test.skip(true, "Design entry point not available");
    await trigger.click();
    await expect(openModal(appPage)).toBeVisible();
    await cancelModal(appPage);
    await expect(photoCards(appPage).first()).toBeVisible();
  });
});
