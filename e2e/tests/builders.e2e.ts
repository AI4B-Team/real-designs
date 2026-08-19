import { expect, test } from "../helpers/fixtures";
import { chooseDoor, gotoView, openModal, photoCards } from "../helpers/app";
import { uploadPhotos, validPhoto, validPhotoPng } from "../helpers/uploads";
import { waitForAsyncJob } from "../helpers/waits";

test.describe("Builder workflows", () => {
  test("starts a Photo Design flow", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await chooseDoor(appPage, "design");
    await uploadPhotos(appPage, [validPhoto("design.jpg")]);
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBeGreaterThan(0);

    const cta = appPage
      .getByRole("button", {
        name: /set design direction|next: design direction|design \d+ photos?/i,
      })
      .first();
    await expect(cta).toBeVisible();
    await cta.click();
    const dialog = openModal(appPage);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/style|design/i);
  });

  test("starts a Video Builder flow", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await chooseDoor(appPage, "video");
    await uploadPhotos(appPage, [validPhoto("scene-a.jpg"), validPhotoPng("scene-b.png")]);
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBeGreaterThan(0);
  });

  test("preserves transitions when scenes are reordered", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await chooseDoor(appPage, "video");
    await uploadPhotos(appPage, [validPhoto("t-a.jpg"), validPhotoPng("t-b.png")]);
    await waitForAsyncJob(appPage);

    const connectors = appPage.locator(".rv-conn, [data-transition], [data-conn]");
    if ((await connectors.count()) === 0) test.skip(true, "No transition controls rendered");
    const before = await connectors.count();

    const cards = photoCards(appPage);
    await cards.nth(1).dragTo(cards.first());
    await expect.poll(async () => await connectors.count()).toBe(before);
  });

  test("saves and reopens a draft", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await chooseDoor(appPage, "design");
    await uploadPhotos(appPage, [validPhoto("draft.jpg")]);
    await waitForAsyncJob(appPage);
    const count = await photoCards(appPage).count();

    await gotoView(appPage, "dash");
    await gotoView(appPage, "studio");
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(count);
  });
});
