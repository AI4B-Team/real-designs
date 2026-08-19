import { test as base, expect, type Page } from "@playwright/test";

import { authenticate } from "./auth";
import { cleanupRun } from "./cleanup";
import { assertNonProductionTarget, hasCredentials, useRealProvider } from "./env";
import { mockAiProvider } from "./mocks";
import { openApp } from "./app";

type Fixtures = {
  /** Page already signed in as the dedicated test account, on /app. */
  appPage: Page;
};

export const test = base.extend<Fixtures>({
  appPage: async ({ context, page }, use) => {
    assertNonProductionTarget();
    test.skip(
      !hasCredentials,
      "No test account configured. Set E2E_EMAIL and E2E_PASSWORD (see e2e/README.md).",
    );
    if (!useRealProvider) await mockAiProvider(page);
    const ok = await authenticate(context, page);
    test.skip(!ok, "Authentication unavailable for this environment.");
    await openApp(page);
    await use(page);
    await cleanupRun(page).catch(() => undefined);
  },
});

export { expect };
