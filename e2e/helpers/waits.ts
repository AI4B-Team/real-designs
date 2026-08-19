import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Deterministic waiting helpers. The suite never uses fixed sleeps: every wait
 * is bound to a DOM condition, a network response, or a predicate poll.
 */

/** Waits until `predicate` is true, polling the live page. */
export async function waitFor(
  page: Page,
  predicate: () => boolean | Promise<boolean>,
  message = "condition",
  timeout = 15_000,
): Promise<void> {
  await expect
    .poll(async () => (await predicate()) === true, {
      message,
      timeout,
      intervals: [100, 250, 500],
    })
    .toBe(true);
}

/** Waits for the app shell (sidebar navigation) to be interactive. */
export async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.locator('.side-nav [data-v="dash"]')).toBeVisible({ timeout: 30_000 });
}

/** Waits for an async job surface (spinner/progress/skeleton) to settle. */
export async function waitForAsyncJob(page: Page, timeout = 45_000): Promise<void> {
  const busy = page.locator(
    '[data-busy="1"], .rd-skeleton, .rv-skel, .is-generating, [aria-busy="true"]',
  );
  await expect
    .poll(async () => await busy.count(), { message: "async job to finish", timeout })
    .toBe(0);
}

/** Waits for a locator's count to reach `n`. */
export async function waitForCount(locator: Locator, n: number, timeout = 15_000): Promise<void> {
  await expect.poll(async () => await locator.count(), { timeout }).toBe(n);
}

/** Asserts that the URL path does not change over a network-idle window. */
export async function expectNoRedirect(page: Page, path: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe(path);
}
