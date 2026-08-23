# REAL DESIGNS — Test Baseline (Phase 0A)

Captured before any remediation work. This file records what the suite proves
**today**, so later phases can show they changed nothing they did not intend to.

## Suite status

| Suite | Command | Result |
| --- | --- | --- |
| Unit / logic (Vitest) | `npm test` | 92 files, **1003 passed**, 5 skipped |
| Characterization (Vitest) | `npx vitest run src/lib/__tests__/characterization.test.ts` | **33 passed** |
| Browser flows (Playwright) | `npm run test:e2e` | Public specs run; authenticated specs skip without `E2E_EMAIL`/`E2E_PASSWORD` |
| Types | `npm run typecheck` | clean |

## Characterization coverage

`src/lib/__tests__/characterization.test.ts` pins current behavior — including
behavior that is arguably wrong — for the 16 required workflows:

1. **Auth and protected routes** — canvas leaves on `unauthorized`, stays on
   `network-error`; `errorActions` offers Retry/Back only for a network error
   and an empty list for a missing design.
2. **Studio intake** — photo/room blockers and upload-state constraints.
3. **Uploads** — bulk credit is 1 per photo; upload failures keep the image.
4. **Explore → Studio handoff** — canonical `DesignDraft` carries the chosen
   style into Prepare Photos.
5. **Design model defaults** — "Original" output ratio until explicitly set.
6. **Review step** — global plus per-photo instructions merge.
7. **Credits** — 1 design / 3 scope / 6 plan / 40 video; Free plan uses the
   daily allowance path, not the credit balance.
8. **Generation jobs** — batch creation is idempotent per key.
9. **Refresh during generation** — a job left in flight by a closed page is
   restored as an interrupted failure with Retry, never silently restarted
   (cancellation is intentionally unsupported).
10. **Version persistence** — `markSaved` stores `{ path, versionId }` and
    marks the output `saved`.
11. **Photo Editor** — edited pixels feed generation only when editing a source
    photo; a generated image still generates from the original.
12. **Presentation publish** — readiness, empty-message and
    recipient-unavailable states.
13–16. **Suppressed features** — Budget/checkout/white-label are hidden both in
    `featureState` and stripped from markup by `gateFeatureMarkup` before it
    reaches the DOM.

## Selectors

No new `data-testid` attributes were required. The imperative shell already
exposes stable ids used by the e2e suite (`#v-studio`, `#rdwStage`, `#v-dash`,
`#tree`, …) and the auth page already carries `data-testid` anchors
(`auth-form`, `auth-email`, `auth-password`, `auth-submit`, `auth-google`).
Future phases must preserve those ids or update the specs in the same change.

## Non-destructive confirmation

- Every Playwright record is prefixed with a per-run `RUN_ID`; `cleanupRun`
  deletes only rows matching that prefix (`e2e/helpers/env.ts`,
  `e2e/helpers/cleanup.ts`).
- `assertNonProductionTarget()` throws if a destructive spec targets
  `realdesigns.ai` or the published host.
- AI generation is mocked at the provider boundary unless
  `E2E_REAL_PROVIDER=1`, so the baseline run spends no credits.
- The Vitest suites are pure logic plus JSDOM; they perform no network or
  database access.

## Phase 0B update

- 93 test files, **1015 unit tests passing**, 5 skipped (was 1003 passing at Phase 0A).
- New: `src/lib/__tests__/generation-run.test.ts` (12 tests) pins the generation
  transaction — one charge per request, replay of a repeated request, one refund
  per failure, retry-after-failure, refusal before any charge, concurrent
  duplicate handling, and batch item outcomes.
- Typecheck clean (`tsgo --noEmit`).
