import type { BrowserContext, Page } from "@playwright/test";

import {
  BASE_URL,
  SESSION_COOKIES_JSON,
  SESSION_JSON,
  SESSION_STORAGE_KEY,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "./env";

/**
 * Restores a pre-minted backend session, if one is available in the
 * environment. Returns true when a session was written.
 */
export async function restoreSession(context: BrowserContext, page: Page): Promise<boolean> {
  if (!SESSION_JSON || !SESSION_STORAGE_KEY) return false;

  if (SESSION_COOKIES_JSON) {
    try {
      const cookies = JSON.parse(SESSION_COOKIES_JSON) as Array<Record<string, unknown>>;
      await context.addCookies(
        cookies.map((c) => ({ ...c, url: BASE_URL })) as Parameters<
          BrowserContext["addCookies"]
        >[0],
      );
    } catch {
      /* cookie restore is best-effort; localStorage below is the SPA path */
    }
  }

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [SESSION_STORAGE_KEY, SESSION_JSON],
  );
  return true;
}

/** Signs in through the real form using the dedicated test account. */
export async function signInWithPassword(
  page: Page,
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByTestId("auth-submit").click(),
  ]);
}

/**
 * Puts the browser into an authenticated state by whichever mechanism is
 * configured. Returns false when the run has no credentials at all.
 */
export async function authenticate(context: BrowserContext, page: Page): Promise<boolean> {
  if (await restoreSession(context, page)) return true;
  if (!TEST_EMAIL || !TEST_PASSWORD) return false;
  await signInWithPassword(page);
  return true;
}

/** Clears the stored session to simulate an expired/invalid session. */
export async function expireSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-")) window.localStorage.removeItem(key);
    }
  });
  await page.context().clearCookies();
}
