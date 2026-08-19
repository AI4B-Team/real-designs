import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright end-to-end config for REAL DESIGNS.
 *
 * Vitest unit tests (`npm test`) keep the `*.test.ts` suffix and live in `src/`.
 * Playwright specs use the `*.e2e.ts` suffix and live in `e2e/`, so the two
 * runners never pick up each other's files.
 */
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";
const isCI = !!process.env["CI"];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "./e2e/.artifacts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env["E2E_NO_SERVER"]
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
