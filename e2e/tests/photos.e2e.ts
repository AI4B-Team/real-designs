import { expect, test } from "../helpers/fixtures";
import { gotoView, openCardMenu, clickMenuItem, photoCards, cancelModal } from "../helpers/app";
import { unsupportedFile, uploadPhotos, validPhoto, validPhotoPng } from "../helpers/uploads";
import { waitForAsyncJob } from "../helpers/waits";

test.describe("Photo management", () => {
  test.beforeEach(async ({ appPage }) => {
    await gotoView(appPage, "studio");
  });

  test("uploads valid photos", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto(), validPhotoPng()]);
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBeGreaterThan(0);
  });

  test("rejects an unsupported file type", async ({ appPage }) => {
    await uploadPhotos(appPage, [unsupportedFile()]);
    await expect(
      appPage.getByText(/unsupported|not supported|jpg|png|webp|heic/i).first(),
    ).toBeVisible();
  });

  test("restores uploaded photos after a refresh", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto("persist.jpg")]);
    await waitForAsyncJob(appPage);
    const before = await photoCards(appPage).count();
    await appPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before);
  });

  test("selects and deselects a photo", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto(), validPhotoPng()]);
    await waitForAsyncJob(appPage);
    const card = photoCards(appPage).first();
    await card.click();
    await expect(card).toHaveClass(/on|sel|is-selected/);
    await card.click();
    await expect(card).not.toHaveClass(/\bsel\b|is-selected/);
  });

  test("changes the room type of a photo", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const card = photoCards(appPage).first();
    const menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /change room type/i);
    const dialog = appPage.locator('[role="dialog"], .rd-modal').first();
    await expect(dialog).toBeVisible();
    await dialog.getByText(/kitchen/i).first().click();
    await expect(card).toContainText(/kitchen/i);
  });

  test("changes the project photo format", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const square = appPage.getByRole("button", { name: /square 1:1|1:1/i }).first();
    await square.click();
    await expect(square).toHaveClass(/on|active|is-selected/);
  });

  test("applies and resets an individual format override", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const card = photoCards(appPage).first();
    let menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /override format/i);
    const dialog = appPage.locator('[role="dialog"], .rd-modal').first();
    await expect(dialog).toContainText(/override photo format/i);
    await dialog.getByText(/portrait 9:16/i).first().click();
    await dialog.getByRole("button", { name: /^save/i }).click();
    await expect(dialog).toBeHidden();

    menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /override format/i);
    await appPage.getByRole("button", { name: /reset to project format/i }).click();
    await expect(appPage.locator('[role="dialog"], .rd-modal').first()).toBeHidden();
  });

  test("reorders photos", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto("a.jpg"), validPhotoPng("b.png")]);
    await waitForAsyncJob(appPage);
    const cards = photoCards(appPage);
    const firstKey = await cards.first().getAttribute("data-photo-key");
    await cards.nth(1).dragTo(cards.first());
    await expect
      .poll(async () => await cards.first().getAttribute("data-photo-key"))
      .not.toBe(firstKey);
  });

  test("duplicates a photo", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const before = await photoCards(appPage).count();
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /duplicate/i);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before + 1);
  });

  test("replaces a photo", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const card = photoCards(appPage).first();
    const menu = await openCardMenu(appPage, card);
    const chooser = appPage.waitForEvent("filechooser");
    await clickMenuItem(menu, /^replace/i);
    await (await chooser).setFiles(validPhotoPng("replacement.png"));
    await waitForAsyncJob(appPage);
    await expect(card).toBeVisible();
  });

  test("remove from project keeps the asset in Media, delete removes it", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto("keep.jpg")]);
    await waitForAsyncJob(appPage);
    const before = await photoCards(appPage).count();

    let menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /remove from project/i);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before - 1);

    await gotoView(appPage, "media");
    await expect(appPage.locator("#v-media")).toContainText(/keep|photo|media/i);

    const mediaCard = appPage.locator(".rd-media-card, .mlib-card, [data-media-id]").first();
    if ((await mediaCard.count()) > 0) {
      menu = await openCardMenu(appPage, mediaCard);
      await clickMenuItem(menu, /delete from media/i);
      const confirm = appPage.getByRole("button", { name: /delete/i }).last();
      if (await confirm.isVisible()) await confirm.click();
    }
  });

  test("cancelling a modal preserves state", async ({ appPage }) => {
    await uploadPhotos(appPage, [validPhoto()]);
    await waitForAsyncJob(appPage);
    const count = await photoCards(appPage).count();
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /change room type/i);
    await cancelModal(appPage);
    await expect(photoCards(appPage)).toHaveCount(count);
  });
});
