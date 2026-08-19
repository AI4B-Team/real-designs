# REAL DESIGNS — End-To-End Tests (Playwright)

Playwright covers browser flows. The existing Vitest unit suite (`npm test`,
`src/**/*.test.ts`) is untouched — Playwright only picks up `e2e/**/*.e2e.ts`.

## Commands

```bash
npm test            # Vitest unit tests
npm run test:e2e    # Playwright, headless
npm run test:e2e:ui # Playwright UI mode (watch, time travel)
npm run test:e2e:report
npm run typecheck
npm run build
```

First run on a fresh machine:

```bash
npx playwright install --with-deps chromium
```

The config starts `npm run dev` automatically (`reuseExistingServer: true`), so
an already-running dev server is reused.

## Environment

| Variable                                                    | Purpose                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `E2E_BASE_URL`                                              | Target app (default `http://localhost:8080`)                    |
| `E2E_EMAIL` / `E2E_PASSWORD`                                | Dedicated test account (never a real customer)                  |
| `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` / `..._STORAGE_KEY` | Pre-minted session, used instead of the login form when present |
| `E2E_REAL_PROVIDER=1`                                       | Skip provider mocks and run the staging smoke test              |
| `E2E_NO_SERVER=1`                                           | Do not boot a dev server (testing a deployed URL)               |

Without credentials the authenticated specs **skip** with a clear reason; the
public auth/marketing specs still run.

## Safety

- Every record created by a run is prefixed with a unique `RUN_ID`, and cleanup
  only deletes rows matching that prefix.
- `assertNonProductionTarget()` throws if a destructive spec is pointed at
  `realdesigns.ai` or the published host.
- Expensive AI generation is mocked at the provider boundary in CI
  (`e2e/helpers/mocks.ts`); only the opt-in `@staging` smoke test spends credits.
- No fixed sleeps: all waiting goes through `e2e/helpers/waits.ts`
  (DOM conditions, polling predicates, network idle).

## Layout

```
e2e/
  helpers/   env, auth, app navigation, uploads, waits, cleanup, mocks, fixtures
  tests/     auth, photos, canvas, builders, sharing, failures, staging smoke
  fixtures/  generated binary fixtures (jpg/png/txt), gitignored
```

## Coverage

Sign in / sign up / password reset entry · valid photo upload · unsupported file
rejection · photo restore after refresh · select and deselect · change room type ·
change project format · apply and reset a per-photo format override · reorder ·
duplicate and replace · remove from project vs delete from Media · open Canvas
without redirect · cancel modals without state loss · start Photo Design · start
Video Builder · transitions preserved across reordering · draft save and reopen ·
presentation link creation and public view · insufficient credits · expired
session · unavailable AI provider.

## CI

`.github/workflows/e2e.yml` runs unit tests, typecheck, build, then Playwright
with mocked AI. Add `E2E_EMAIL` / `E2E_PASSWORD` repository secrets pointing at a
staging test account to enable the authenticated specs. The staging smoke test
runs only when `E2E_REAL_PROVIDER=1` is set for a scheduled/manual job.
