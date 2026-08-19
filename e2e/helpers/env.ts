/** Shared environment reads for the Playwright suite. */

export const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

/** Dedicated, non-production test account. Never use a real customer login. */
export const TEST_EMAIL = process.env["E2E_EMAIL"] ?? "";
export const TEST_PASSWORD = process.env["E2E_PASSWORD"] ?? "";

/** Optional pre-minted session (Lovable preview sandboxes inject these). */
export const SESSION_JSON = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ?? "";
export const SESSION_STORAGE_KEY = process.env["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"] ?? "";
export const SESSION_COOKIES_JSON = process.env["LOVABLE_BROWSER_SUPABASE_COOKIES_JSON"] ?? "";

/** True when the suite can authenticate at all. */
export const hasCredentials = Boolean(
  (TEST_EMAIL && TEST_PASSWORD) || (SESSION_JSON && SESSION_STORAGE_KEY),
);

/** CI mocks the AI provider by default; opt out for the staging smoke run. */
export const useRealProvider = process.env["E2E_REAL_PROVIDER"] === "1";

/** Unique prefix so every run only ever touches its own records. */
export const RUN_ID = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Guard: destructive specs refuse to run against a production host. */
export function assertNonProductionTarget(): void {
  const host = new URL(BASE_URL).hostname;
  const blocked = ["realdesigns.ai", "www.realdesigns.ai", "real-designs-hub.lovable.app"];
  if (blocked.includes(host) && process.env["E2E_ALLOW_PRODUCTION"] !== "i-know-what-i-am-doing") {
    throw new Error(
      `Refusing to run destructive end-to-end tests against production host "${host}".`,
    );
  }
}
