import type { Page, Route } from "@playwright/test";

/**
 * Provider-boundary mocking.
 *
 * Expensive AI generation is intercepted at the network boundary so CI never
 * spends credits or waits on real model runs. The opt-in staging smoke test
 * simply skips these installers (see `E2E_REAL_PROVIDER=1`).
 */

/** URL fragments that identify an AI generation call. */
const AI_PATTERNS = [
  "**/ai.gateway.lovable.dev/**",
  "**/generativelanguage.googleapis.com/**",
  "**/api.openai.com/**",
  "**/_serverFn/**generate**",
  "**/_serverFn/**render**",
  "**/_serverFn/**video**",
  "**/api/**/generate**",
];

const OK_PAYLOAD = {
  ok: true,
  mocked: true,
  status: "succeeded",
  images: [
    {
      url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    },
  ],
  choices: [{ message: { role: "assistant", content: '{"room_type":"living","confidence":0.98}' } }],
};

async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Installs deterministic, instant AI responses. */
export async function mockAiProvider(page: Page): Promise<void> {
  for (const pattern of AI_PATTERNS) {
    await page.route(pattern, (route) => fulfilJson(route, 200, OK_PAYLOAD));
  }
}

/** Makes every AI call fail like an unavailable provider. */
export async function mockAiProviderUnavailable(page: Page): Promise<void> {
  for (const pattern of AI_PATTERNS) {
    await page.route(pattern, (route) =>
      fulfilJson(route, 503, { error: "AI provider unavailable", retryable: true }),
    );
  }
}

/** Makes credit-consuming calls fail with the insufficient-credits shape. */
export async function mockInsufficientCredits(page: Page): Promise<void> {
  for (const pattern of AI_PATTERNS) {
    await page.route(pattern, (route) =>
      fulfilJson(route, 402, {
        error: "insufficient_credits",
        message: "Not enough credits for this generation.",
        required: 8,
        balance: 1,
      }),
    );
  }
}

/** Makes authenticated backend calls fail as if the session had expired. */
export async function mockExpiredSession(page: Page): Promise<void> {
  await page.route("**/_serverFn/**", (route) =>
    fulfilJson(route, 401, { error: "Unauthorized", message: "Session expired" }),
  );
  await page.route("**/rest/v1/**", (route) =>
    fulfilJson(route, 401, { error: "invalid JWT", message: "Session expired" }),
  );
}
