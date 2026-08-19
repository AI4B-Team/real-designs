import { expect, test } from "../helpers/fixtures";
import { gotoView, testName } from "../helpers/app";
import { waitForAsyncJob } from "../helpers/waits";

test.describe("Presentations", () => {
  test("creates a presentation and opens its public link", async ({ appPage, context }) => {
    await gotoView(appPage, "present");
    const create = appPage
      .getByRole("button", { name: /new presentation|create presentation|create/i })
      .first();
    if ((await create.count()) === 0) test.skip(true, "Presentation creation not available");
    await create.click();

    const nameField = appPage.locator('[role="dialog"] input, .rd-modal input').first();
    if ((await nameField.count()) > 0) await nameField.fill(testName("Presentation"));
    const confirm = appPage.getByRole("button", { name: /create|save|generate link/i }).last();
    await confirm.click();
    await waitForAsyncJob(appPage);

    const link = appPage.locator('a[href*="/p/"], [data-share-url]').first();
    await expect(link).toBeVisible();
    const href =
      (await link.getAttribute("href")) ?? (await link.getAttribute("data-share-url")) ?? "";
    expect(href).toContain("/p/");

    const viewer = await context.newPage();
    const response = await viewer.goto(href, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(viewer.locator("body")).toContainText(/real designs|presentation|design/i);
    await viewer.close();
  });
});
