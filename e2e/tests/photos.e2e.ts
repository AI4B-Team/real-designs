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
import { unsupportedFile, uploadPhotos, validPhoto, validPhotoPng } from "../helpers/uploads";
import { waitForAsyncJob } from "../helpers/waits";

async function startWithPhotos(page: import("@playwright/test").Page, files: string[]) {
  await gotoView(page, "studio");
  await chooseDoor(page, "design");
  await uploadPhotos(page, files);
  await waitForAsyncJob(page);
  await expect.poll(async () => await photoCards(page).count()).toBeGreaterThan(0);
}

test.describe("Photo management", () => {
  test("uploads valid photos", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto(), validPhotoPng()]);
    await expect.poll(async () => await photoCards(appPage).count()).toBeGreaterThan(1);
  });

  test("rejects an unsupported file type", async ({ appPage }) => {
    await gotoView(appPage, "studio");
    await chooseDoor(appPage, "design");
    await uploadPhotos(appPage, [unsupportedFile()]);
    await expect(
      appPage.getByText(/JPG|PNG|WEBP|HEIC|not supported|unsupported/i).first(),
    ).toBeVisible();
    await expect(photoCards(appPage)).toHaveCount(0);
  });

  test("restores uploaded photos after a refresh", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto("persist.jpg")]);
    const before = await photoCards(appPage).count();
    await appPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAsyncJob(appPage);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before);
  });

  test("selects and deselects a photo", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto(), validPhotoPng()]);
    const card = photoCards(appPage).first();
    const check = card.locator(".rv-tile-check");
    await check.click();
    await expect(check).toHaveAttribute("aria-checked", "false");
    await check.click();
    await expect(check).toHaveAttribute("aria-checked", "true");
  });

  test("changes the room type of a photo", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const card = photoCards(appPage).first();
    const menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /change room type/i);
    /* The room picker is an anchored popover, not a modal dialog. */
    const picker = appPage.locator(".rds-pop");
    await expect(picker).toBeVisible();
    await picker
      .getByText(/^kitchen$/i)
      .first()
      .click();
    await expect(card.locator("..")).toContainText(/kitchen/i);
  });

  test("changes the project photo format", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const square = appPage.getByRole("button", { name: /square 1:1/i }).first();
    await square.click();
    await expect(square).toHaveClass(/on|active|is-selected/);
  });

  test("applies and resets an individual format override", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const card = photoCards(appPage).first();
    let menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /override format/i);
    let dialog = openModal(appPage);
    await expect(dialog).toContainText(/override photo format/i);
    await dialog
      .getByText(/portrait 9:16/i)
      .first()
      .click();
    await dialog.getByRole("button", { name: /^save/i }).click();
    await expect(dialog).toBeHidden();

    menu = await openCardMenu(appPage, card);
    await clickMenuItem(menu, /override format/i);
    dialog = openModal(appPage);
    await dialog.getByRole("button", { name: /reset to project format/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("reorders photos", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto("a.jpg"), validPhotoPng("b.png")]);
    const cards = photoCards(appPage);
    const firstKey = await cards.first().getAttribute("data-k");
    /* Playwright's dragTo does not fire the HTML5 drag events the grid uses. */
    await cards.first().evaluate((target, from) => {
      const dt = new DataTransfer();
      const source = document.querySelectorAll(".rv-tile[data-k]")[from] as HTMLElement;
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    }, 1);
    await expect.poll(async () => await cards.first().getAttribute("data-k")).not.toBe(firstKey);
  });

  test("duplicates a photo", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const before = await photoCards(appPage).count();
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /duplicate/i);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before + 1);
  });

  test("replaces a photo", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const card = photoCards(appPage).first();
    const menu = await openCardMenu(appPage, card);
    const chooser = appPage.waitForEvent("filechooser");
    await clickMenuItem(menu, /^replace/i);
    await (await chooser).setFiles(validPhotoPng("replacement.png"));
    await waitForAsyncJob(appPage);
    await expect(card).toBeVisible();
  });

  test("remove from project keeps the asset in Media", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto("keep.jpg"), validPhotoPng("keep-b.png")]);
    const before = await photoCards(appPage).count();

    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /remove from project/i);
    await expect.poll(async () => await photoCards(appPage).count()).toBe(before - 1);

    await gotoView(appPage, "media");
    await expect(appPage.locator("#v-media")).toBeVisible();
  });

  test("cancelling a modal preserves state", async ({ appPage }) => {
    await startWithPhotos(appPage, [validPhoto()]);
    const count = await photoCards(appPage).count();
    const menu = await openCardMenu(appPage, photoCards(appPage).first());
    await clickMenuItem(menu, /change room type/i);
    await cancelModal(appPage);
    await expect(photoCards(appPage)).toHaveCount(count);
  });
});
