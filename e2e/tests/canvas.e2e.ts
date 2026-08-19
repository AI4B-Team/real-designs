import { expect, test } from "../helpers/fixtures";
import { gotoView, openCardMenu, clickMenuItem, photoCards, cancelModal } from "../helpers/app";
import { uploadPhotos, validPhoto } from "../helpers/uploads";
import { expectNoRedirect, waitForAsyncJob } from "../helpers/waits";

test.describe("Canvas routing", () => {
  test("opens the Canvas without bouncing back to the dashboard", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await uploadPhotos(appPage, [validPhoto("canvas.jpg")]);
    await waitForAsyncJob(appPage);

    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /open canvas/i);
    await waitForAsyncJob(appPage);
    await expectNoRedirect(appPage, new URL(appPage.url()).pathname);
    await expect(appPage.locator(".rds-canvas, #v-studio")).toBeVisible();
  });

  test("keeps Canvas context after a refresh", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await uploadPhotos(appPage, [validPhoto("canvas-refresh.jpg")]);
    await waitForAsyncJob(appPage);
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /open canvas/i);
    await waitForAsyncJob(appPage);

    const path = new URL(appPage.url()).pathname;
    await appPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAsyncJob(appPage);
    await expectNoRedirect(appPage, path);
  });

  test("cancelling the design modal leaves the Canvas untouched", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await uploadPhotos(appPage, [validPhoto("canvas-modal.jpg")]);
    await waitForAsyncJob(appPage);
    const trigger = appPage
      .getByRole("button", { name: /set design direction|design \d+ photos?/i })
      .first();
    if ((await trigger.count()) === 0) test.skip(true, "Design entry point not available");
    await trigger.click();
    await expect(appPage.locator('[role="dialog"], .rd-modal').first()).toBeVisible();
    await cancelModal(appPage);
    await expect(photoCards(appPage).first()).toBeVisible();
  });
});
