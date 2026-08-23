# Part 7 — Tests, CSS/Layout, Performance, Accessibility, Error Handling, Dead Code

Scope: `src/**`, `e2e/**`, `src/styles/**`, `src/content/**`. All findings below are read-only observations from static inspection and one full `vitest run`. No source, tests, or data were modified.

---

## (a) Test-suite audit

### Inventory & classification

Ran: `bunx vitest run --reporter=dot` (full log at `/tmp/exec-logs/2925bb0d-…log`).

```
Test Files  91 passed (91)
Tests       965 passed | 5 skipped (970)
Duration    24.74s (transform 76s, import 103s — see Perf section)
```

- **91 vitest files**, almost entirely under `src/lib/**` and `src/content/*.test.ts`, `src/features/app-shell/nav-items.test.ts`.
- **8 Playwright e2e specs** under `e2e/tests/*.e2e.ts`: `auth-lifecycle`, `auth`, `builders`, `canvas`, `failures`, `photos`, `sharing`, `staging-smoke`. Config: `playwright.config.ts`, `testMatch: "**/*.e2e.ts"`, `webServer` boots `npm run dev` against `http://localhost:8080` unless `E2E_NO_SERVER` is set.
- **Classification**:
  - Unit/logic: `src/lib/*.test.ts` — the large majority (~80 files), testing pure functions and small DOM-fragment builders (markup generators returning HTML strings that are then asserted with `querySelector`/`textContent`, since the app is built from `content/*.ts` template-string modules rather than JSX components for these legacy screens).
  - Integration-ish: `src/lib/rls.integration.test.ts` (Supabase RLS — needs a reachable Supabase project/service role; **credential-dependent**), `src/lib/server-secret-boundary.test.ts`, `src/lib/server-config.test.ts`.
  - Component: `src/lib/share-presentation.test.tsx` (only `.tsx` test in the whole suite — everything else is markup-string / DOM assertions, not React Testing Library component tests).
  - "DB" tests: none run against a live Postgres; `rls.integration.test.ts` is the only test that talks to real infrastructure and its pass/fail here could not be confirmed as exercising live Supabase vs. a mocked client — **Needs runtime verification** with real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
  - E2E/visual/a11y/security: only the 8 Playwright specs; **no dedicated visual-regression, axe/a11y automated check, or security-focused Playwright spec exists** (`failures.e2e.ts` covers error-path UI, not authz/security).
- **No `.skip`/`.only`/`xit`/`it.todo` markers found** in any `*.test.*` file (`rg` returned zero matches), so the 5 "skipped" tests are runtime-conditional skips (e.g. `test.skip(condition, …)` gated on environment/credentials rather than static markers) — **Needs runtime verification** to confirm which 5 and why (likely the RLS/service-role-dependent cases, since no `SUPABASE_SERVICE_ROLE_KEY` was exported for this run).
- No test file names or configs indicating **flakiness quarantine** (no `retry:` overrides per-file, no `.flaky.` suffix convention). Flakiness cannot be assessed without repeated CI runs — **Needs runtime verification**.

### Assertion quality: behavior vs. markup

- Confidence: **Confirmed** — a large fraction of `src/lib/*.test.ts` files render an HTML string produced by a `content/*.ts` builder function and then assert via `document.querySelector(...).textContent` / attribute presence (e.g. `photo-format-cards.test.ts`, `upload-flow.test.ts`, `staging-design.test.ts`). This is a hybrid: it does exercise real conditional logic in the generator functions (room counts, card counts, selection state), which is a genuine behavioral assertion, but it does **not** click through actual DOM event handlers wired up by `rd-app-script.ts`/`rd-staging.ts` (the 530KB/131KB runtime scripts) because those attach listeners only when injected into a live page. So: **logic-level behavior is asserted; interactive/event-wiring behavior is not** — that gap is exactly what the 8 Playwright specs are meant to cover, but 8 specs cannot cover the surface of `rd-app-script.ts` (530KB of imperative DOM code) plus the ~29 `content/*.ts` modules.
- The stderr/stdout noise emitted during test runs (`[photo] resolve failed`, `[photo] card unavailable`) shows tests deliberately exercising "missing asset" fallback paths — genuine behavior coverage for degraded states, not just happy-path markup checks. Good sign for that specific area (photo resolution fallback).

### Missing critical tests (evidence: no matching file names / no references found)

| Area | Evidence of gap | Confidence |
|---|---|---|
| Studio draft recovery after refresh/crash | `design-draft.test.ts` and `project-draft.test.ts` exist but only cover draft object shape/serialization, not a simulated tab-reload → restore flow; no e2e spec named `draft-recovery` | Strongly indicated |
| Explore → Studio handoff | `handoff.test.ts` covers unit-level handoff payload construction only; no e2e spec exercises Explore UI → Studio landing with photo/style pre-fill | Strongly indicated |
| Generation job lifecycle end-to-end (submit → poll → complete/fail) | `generation-jobs.test.ts` is unit-level (state machine), no e2e spec drives an actual generation through the UI and asserts credit/version outcome | Strongly indicated |
| Credit idempotency (double-submit / retry doesn't double-charge) | No file named `credit*idempot*`; no test asserts a second identical request is deduped server-side | Needs runtime verification (may be enforced only in server function code, untested) |
| Canvas stability (no unwanted movement/rerender on unrelated state change) | `canvas-badge.test.ts`, `canvas-result.test.ts`, `canvas-route.test.ts`, `canvas-session.test.ts` are narrow unit tests; `canvas.e2e.ts` exists but its assertions weren't verified to check pointer/zoom stability across re-renders | Needs runtime verification |
| Crop persistence across reload/version switch | `crop-frame.test.ts` tests frame math only; no test reloads a design and asserts the crop rectangle survived | Strongly indicated |
| Mask alignment with underlying photo after resize/orientation change | `mask-engine.test.ts`, `selection-mask.test.ts` are logic-only; no test renders a mask over a differently-sized/rotated image and asserts pixel alignment | Strongly indicated |
| Version persistence / version history correctness | No `version-*.test.ts` file found | Strongly indicated (dedicated version-history tests appear absent) |
| Public presentation viewing (unauthenticated visitor) | `sharing.e2e.ts` and `share-presentation.test.tsx` exist — this is the one area with layered coverage; but no test confirms an **expired/revoked** share link is rejected | Needs runtime verification for revocation path |
| Authorization (cross-tenant access denial) | `rls.integration.test.ts` is the only authz-adjacent test and needs live credentials to run meaningfully; no unit test simulates "user B requests user A's design id" through a server function mock | Strongly indicated |
| Feature suppression (beta/plan-gated features hidden AND blocked server-side) | `beta/features.test.ts` and `studio-plan-guard.test.ts` test the client-side gate; no test confirms the corresponding server function also rejects a suppressed feature call (defense in depth) | Strongly indicated |
| Individual tool functionality (each staging/editing tool end-to-end) | Many per-tool unit tests exist (`declutter-brief`, `materials-brief`, `angles-brief`, etc.) but these test prompt/brief construction, not that the tool's result actually lands back in the canvas/version list | Strongly indicated |
| Refresh recovery mid-operation (upload/generation in flight, then reload) | `media-resume.test.ts` exists (good sign) but scope not confirmed to include an in-flight *generation* (as opposed to upload) reload | Needs runtime verification |

---

## (b) CSS & layout architecture

### Inventory

- `src/styles.css` (21.4 KB, tokens) + `src/styles/*.css` — 25 files, **930 KB total**, dominated by `rd-site.css` (232 KB), `rd-app.css` (209 KB), `rd-reveal.css` (119 KB), `rd-staging.css` (61 KB), `rd-canvas.css` (73 KB), `rd-photo-editor.css` (32 KB).
- Additionally, the `src/content/*.ts` template-string modules (e.g. `rd-app-script.ts` 530 KB, `rd-reveal.ts` 304 KB, `rd-staging.ts` 131 KB) contain **inline `style="…"` attributes and inline `<style>` blocks** embedded directly in the HTML strings, meaning layout rules exist in at least three places simultaneously (global CSS files, per-module CSS files, and inline styles baked into JS string literals) — this triple-location model is itself evidence for why fixes don't stick (a fix applied in `rd-app.css` can be silently overridden by an inline style shipped inside `rd-app-script.ts`).

### Quantified findings

- **`!important` usage**: 121 total occurrences across all CSS, concentrated in `rd-app.css` (66) and `rd-site.css` (27), with `rd-canvas.css` (9) and `rd-modal.css` (3) also affected. Heavy concentration in the two largest, most-reused files is exactly the pattern that produces "fix one view, break another" regressions: an `!important` rule in `rd-app.css` wins over a more specific but non-`!important` rule elsewhere, and the next targeted fix has to add its own `!important` to compete, escalating specificity wars file-by-file.
- **z-index range**: values span from `60` to `100001` (`z-index:100000`, `z-index:100001` present, alongside mid-range values like `1200`, `1300`, `2600`, `4000`, `10000`). There is no evidence of a shared z-index scale/token (no `--z-modal`, `--z-overlay` custom properties found in `src/styles.css`); each stacking value is a hardcoded literal chosen ad hoc per component. With modals, drawers, tooltips, and canvas overlays each picking their own large integer, **stacking order is accidental, not designed** — this directly explains recurring "modal overflow" / "hidden source controls" bugs where a newer feature's z-index (e.g. `100001`) unintentionally sits above or below an unrelated overlay that was tuned against an older max value (e.g. `10000`).
- **Duplicate/overlapping selectors**: `.rd-app` and `.rd-site` prefixes appear as the root scoping class in thousands of compound selectors across files (2677 and 1591 selector-line occurrences respectively) — i.e., **the same two root namespaces are used across nearly every stylesheet**, so a rule written for one screen under `.rd-app .foo` can accidentally match markup rendered by an unrelated screen if that screen also happens to nest under `.rd-app`. This is consistent with symptoms like "unequal cards" or "oversized collapsed-menu icons" appearing on screens that didn't change — a shared ancestor class picked up a rule intended for a sibling feature.
- **`overflow` rules**: 105–131 occurrences per large file (`rd-app.css` 131, `rd-site.css` 105, `rd-canvas.css` 51, `rd-staging.css` 48). Numeric fixed-height rules (`height: <number>`) appear 374 times in `rd-app.css` alone and 128 times in `rd-canvas.css`. This combination — many hardcoded pixel heights plus many `overflow: hidden`/`auto` rules — is the direct structural cause of "clipped inspector sections" and "tiny accordion rows": content that grows (longer labels, wrapped text, added controls) exceeds a hardcoded height and gets clipped or squeezed rather than the container growing.
- **Media queries**: `rd-site.css` (87), `rd-app.css` (54), `rd-reveal.css` (33), `rd-staging.css` (22) — each file defines its **own independent breakpoint set** rather than sharing tokens/mixins; no shared `--bp-*` custom properties found in `styles.css`. Different files' breakpoints don't line up (no evidence of a canonical `640/768/1024/1280` set enforced anywhere), so a component whose container query lives in `rd-canvas.css` can flip layout at a different width than the modal chrome around it defined in `rd-modal.css`, producing "canvas movement" and "letterboxing" at intermediate viewport widths where the two files disagree.
- **Thumbnails / list rendering**: `rd-media-lib.css` (23 KB) and `rd-directory.css` (8.6 KB) both style thumbnail grids independently; combined with `content/rd-media-lib.ts` (71 KB of markup templates) generating the actual `<img>` tags, a mismatch between the CSS aspect-ratio/object-fit rules in one file and the markup structure emitted by the other is a plausible root cause for "broken list thumbnails" — **Needs runtime verification** (screenshot diff) to confirm which specific selector mismatch is responsible today.

### Why regressions keep recurring — structural summary

1. **No shared token layer for spacing/z-index/breakpoints** in `src/styles.css` beyond basic color/typography variables — every large file reinvents its own numeric constants.
2. **Three-way duplication of styling authority**: global CSS file → per-feature CSS file → inline styles baked into `content/*.ts` template strings. A developer fixing a clipped section in the CSS file has no way to know an inline style in a 530KB JS string is also constraining the same element.
3. **`!important` concentrated exactly where reuse is highest** (`rd-app.css`, `rd-site.css`), meaning the two most shared files are also the two most likely to have specificity conflicts with newer feature-specific CSS.
4. **Fixed pixel heights + overflow:hidden** as the default containment strategy instead of intrinsic sizing (`min-height`, `flex`/`grid` with `auto` tracks), so any content-length change (translated strings, longer labels, additional badges) breaks layout instead of reflowing.
5. **Broad root-class reuse (`.rd-app`, `.rd-site`)** without feature-scoped subnamespaces removes the natural firewall that would otherwise stop cross-feature leakage.

### Recommendations (containment/tokenization, no redesign)

- Introduce a small set of CSS custom properties in `src/styles.css` for the z-index scale (`--z-nav`, `--z-dropdown`, `--z-modal`, `--z-toast`, `--z-max`) and migrate the highest-collision files (`rd-modal.css`, `rd-canvas.css`, `rd-app.css`) to reference them incrementally — no visual change required if values map 1:1 initially.
- Add `contain: layout paint;` (or `content-visibility: auto` where appropriate) to independently-scrolling panels (inspector sections, accordions, canvas viewport) so a child's overflow can't visually escape its container regardless of ancestor height math.
- Replace literal `height: <px>` on containers that wrap variable-length content with `min-height` + intrinsic sizing; keep the same visual default height as a `min-height` to avoid changing today's appearance while fixing the "grows-and-clips" failure mode.
- Establish one canonical breakpoint set as custom properties and gradually point new/changed media queries at it, without rewriting the existing ones (net-zero visual risk, prevents future divergence).
- When touching `content/*.ts` inline styles, prefer adding a class hook and moving the rule to the matching `rd-*.css` file so there's a single source of truth going forward (again, only apply this when a file is already being touched for a bug fix — no blanket migration).

---

## (c) Performance

### Build/import cost (measured)

- The vitest run itself surfaced the cost of these modules being plain ESM: **`transform 76.4s` and `import 103.6s`** for a 91-file suite — i.e., loading/transpiling the `content/*.ts` string modules (`rd-app-script.ts` 530 KB, `rd-reveal.ts` 304 KB, `rd-staging.ts` 131 KB, `rd-studio-start.ts` 74 KB, `rd-media-lib.ts` 71 KB, `rd-photo-editor.ts` 54 KB, `rd-site-extra.ts` 56 KB) dominates total test time far more than actual test execution (`41.7s`). This is a direct, measured proxy for what the bundler/dev server also pays: **1.7 MB of `content/*.ts` string literals** must be parsed by V8/esbuild wherever imported, even though only a fraction renders on any given route.
- No production build was run (build step is owned by the harness per instructions); bundle composition is reasoned from file sizes/imports instead. Given `content/*.ts` files are plain `export const html = "...long string..."` modules (not gated behind `React.lazy`/dynamic `import()` per the file-name evidence — no `import(` dynamic calls were found referencing these specific content files in the areas inspected), **Strongly indicated**: these strings ship in whatever chunk imports them, inflating initial JS payload for any route that pulls in `rd-app-script.ts` or `rd-reveal.ts` even if the user never scrolls to the markup those strings render. **Needs runtime verification** via an actual `vite build --analyze`/bundle-visualizer pass (not run here to keep the audit read-only and safe).

### Cost of large content modules

- `rd-app-script.ts` (530 KB) contains **286 empty `catch (_) {}` blocks** (of 517 total across the codebase) — beyond the error-handling concern (section e), this density indicates the file is a large, monolithic, imperatively-written runtime controller rather than decomposed modules; monolithic files defeat tree-shaking (a bundler cannot drop the 90% of the file unrelated to the current route because everything lives in one top-level scope with shared closures/listeners).
- `rd-reveal.ts` (304 KB, 41 empty catches) and `rd-staging.ts` (131 KB, 57 empty catches) show the same pattern for the reveal/comparison and staging-design flows.

### Route splitting

- Confidence: **Needs runtime verification** for exact chunk boundaries, but file-size evidence (single 530 KB and 304 KB string modules) combined with the absence of dynamic `import()` wrapping found for these specific files is **Strongly indicated** evidence that route-level code splitting is not effectively isolating these large legacy-template modules from the initial/shared bundle.

### Images, thumbnails, signed URLs, canvas/mask, polling, queries

These sub-areas (repeated signed-URL requests, duplicate decoding, canvas redraws, mask rendering cost, polling frequency, Supabase N+1 queries, property-tree reloads, large-but-hidden DOM, unreleased object URLs, listener accumulation) require **runtime tracing (network panel, React profiler, memory snapshots) against a live session with real data**, which is out of scope for a static/read-only pass beyond what's below:

- `src/lib/media-resume.test.ts` and `storage-paths.test.ts` / `storage-health-stages.test.ts` exist, implying the team is aware signed-URL/storage-path resolution is a fragile area worth testing — consistent with a system where signed URLs are requested per-render rather than cached, but **Needs runtime verification** to confirm actual request counts.
- `rd-app-script.ts`'s scale (530 KB of hand-written DOM/event code with 286 empty catches) makes it **plausible but unconfirmed** that event listeners attached imperatively there are not always paired with teardown, since empty catches around cleanup code would silently swallow removal errors — **Needs runtime verification** (e.g., a heap snapshot across repeated navigation to the same screen) to confirm listener accumulation.
- No explicit `URL.revokeObjectURL` audit was performed; a search would need to pair every `URL.createObjectURL` call with a matching revoke to state this as Confirmed — **Needs runtime verification**.

### What degrades at hundreds of photos/designs (reasoned, not measured)

- Any screen that renders a DOM node (with associated inline styles / large CSS selector matching cost, per section b) per photo/design without virtualization will scale linearly in layout/paint cost; combined with `rd-media-lib.css` (23 KB) and `rd-directory.css` (8.6 KB) using non-trivial selector nesting under shared `.rd-app`/`.rd-site` roots, style recalculation cost per added item is higher than a flat, scoped stylesheet would produce. **Needs runtime verification** (no virtualization library — e.g. `react-window`/`react-virtual` — was searched for/confirmed present or absent in this pass).

---

## (d) Accessibility

Given the codebase's heavy reliance on `content/*.ts` HTML-string generation (rather than JSX with built-in a11y primitives from a UI kit for these legacy screens), several risks are structural rather than incidental.

- **Confirmed** (via `toast` grep): toast/notification usage is spread across `budget-coming-soon.ts`, `canvas-actions.ts`, `builder-card-menu.ts`, `disclosure-export.ts`, `beta-ui.ts`, `describe-composer.ts`, `video-handoff.ts`, `rd-avatar-ui.ts`, `variation-drawer.ts`, `photo-editor.ts` — ten separate call sites implementing toast UI independently rather than through one shared, accessible (`role="status"`/`aria-live`) component; **Needs runtime verification** per file to confirm each actually sets `aria-live`/`role`, but the sheer number of independent implementations is itself risk evidence (any one could regress without the others being touched).
- **Needs runtime verification** for keyboard nav, focus trapping, dialog `role`/`Escape` handling, labels/tooltips, contrast, disabled-state semantics, SR live-region updates on async state changes, drag-and-drop keyboard alternatives, crop/mask keyboard alternatives, reduced-motion handling, and hold-to-compare keyboard behavior — these all require a running browser with assistive-tech tooling (axe, keyboard-only traversal) which was not exercised in this pass to stay strictly read-only/non-invasive. No automated a11y test (axe-core, `@testing-library/jest-dom` a11y matchers, or a Playwright a11y spec) was found among the 91 vitest files or 8 e2e specs — **Confirmed absence of automated a11y coverage**, which means any of the above could currently be failing with no test signal.
- **Strongly indicated risk**: the crop/mask features are described elsewhere in this audit set as pointer/drag-driven (`crop-frame.ts`, `mask-engine.ts`, `selection-mask.ts` — all unit-tested for math, none reference keyboard event handlers by name in the file list gathered). Without evidence of arrow-key/keyboard equivalents in these modules, keyboard-only users likely cannot crop or mask — **Needs runtime verification** to confirm no keyboard path exists, but no supporting evidence for one was found either.

---

## (e) Error handling & observability

### Empty catch inventory

- **517 empty `catch (_) {}` blocks** across the codebase (excluding tests), overwhelmingly concentrated in the large `content/*.ts` runtime modules:

| File | Empty catches |
|---|---|
| `src/content/rd-app-script.ts` | 286 |
| `src/content/rd-staging.ts` | 57 |
| `src/content/rd-reveal.ts` | 41 |
| `src/content/rd-media-lib.ts` | 13 |
| `src/lib/builder-card-menu.ts` | 8 |
| `src/content/rd-present.ts` | 8 |
| `src/lib/builder-card-status.ts` | 7 |
| `src/lib/budget-coming-soon.ts` | 7 |
| `src/lib/builder-exit.ts` | 6 |
| `src/lib/source-picker.ts` | 5 |
| `src/content/rd-reports.ts` / `rd-property-detail.ts` / `rd-explore.ts` / `rd-crm.ts` | 5 each |

- Material ones worth calling out by name (highest blast radius given file role):
  - `rd-app-script.ts` (the main app runtime controller, 530 KB, 286 empty catches) — any of these swallowing a failed save, failed credit deduction call, or failed job-status fetch would leave the UI silently stuck with no user-facing signal, directly supporting the "support cannot tell what failed" risk below.
  - `rd-staging.ts` (57) and `rd-reveal.ts` (41) — these back the core generation/reveal comparison flows; a swallowed error here is squarely in the "did a credit get charged / was a version saved" blast radius called out by the audit brief.
  - `rd-media-lib.ts` (13) — swallowed errors here plausibly explain "broken list thumbnails" from section (b): a failed thumbnail fetch/decode that's caught and silently ignored would leave a blank/broken `<img>` with no retry and no logged signal.

### Observability infrastructure present

- `src/lib/obs/obs.ts` + `obs.test.ts`, `src/lib/obs/jobs.ts`, `src/lib/obs/jobs.server.ts` — a structured job-observability layer exists and is unit-tested, which is a positive sign **if** it's actually invoked from the 517 empty-catch sites above; there's no evidence gathered here that the empty catches route their errors into `obs`/`analytics.ts`/`lovable-error-reporting.ts`/`error-capture.ts` before discarding them — **Needs runtime verification** (would require reading each catch body, which for 517 sites is out of scope for this pass; the fact that they compile to literally empty blocks `{}` with no call inside, per the regex match, is however **Confirmed**: an empty `{}` block cannot be calling into `obs`/`analytics` — if it did, the block wouldn't match `catch (_) {}`).
- `src/lib/analytics.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts` exist as dedicated modules, suggesting the *intended* architecture is centralized reporting — the 517 empty catches represent call sites that bypass this intended architecture entirely.

### Can support answer the operational questions today?

Based on the empty-catch density concentrated in the generation/staging/reveal runtime files, for an in-flight failure that hits one of these 517 sites, support likely **cannot** determine:
- Which operation failed — **No** (error is discarded, not logged with context).
- Which job/provider was involved — **No**, unless the specific call site happens to log before the catch (not confirmed per-site).
- Whether a credit was charged — **No evidence of a paired ledger/idempotency-key log at these catch sites**; this is a **Needs runtime verification** but high-risk item given `rd-app-script.ts`'s catch density and its likely proximity to submission/credit logic (per file naming/role, not per-line confirmation).
- Whether a version was saved — same as above, **Needs runtime verification**, high risk given `rd-staging.ts`/`rd-reveal.ts` catch density.
- Safe retry / duplicate-work avoidance — no idempotency-key module name was found among the files inspected (no `idempotency-key.ts`/`request-id.ts` in the `src/lib` listing gathered) — **Strongly indicated gap**, not Confirmed absent (a fuller repo-wide search would be needed).
- Source preserved — not assessable from this evidence; would require tracing a specific failure path.

### Recommended error taxonomy (non-invasive suggestion, not implemented)

A minimal structured error shape logged at every catch (replacing silent swallowing where the risk is user-money/data-loss, i.e. generation/credit/save paths first) should carry: `{ operation, jobId, provider, creditImpact: 'charged'|'not-charged'|'unknown', versionSaved: boolean, retrySafe: boolean, sourcePreserved: boolean, cause }`, routed through the existing `src/lib/obs` and `lovable-error-reporting.ts` modules rather than a new system, prioritized by file: `rd-app-script.ts` → `rd-staging.ts` → `rd-reveal.ts` first, since those three account for 384 of the 517 empty catches (74%).

---

## (f) Dead code & duplication (evidence-based; nothing deleted or flagged for deletion here — reporting only)

| Item | Evidence | Confidence |
|---|---|---|
| Duplicate crop-related modules | `src/lib/crop-position-dialog.ts`, `crop-frame.ts`, `image-format-ui.ts`, `photo-crop.ts`, `photo-editor-presets.ts`, `photo-editor.ts` all match "crop" — six separate modules touching crop concerns; whether they're layered (each owning a distinct concern) or duplicative needs call-graph tracing per pair | Needs runtime verification (function-level overlap not diffed) |
| Toast implemented independently in 10 files | `budget-coming-soon.ts`, `canvas-actions.ts`, `builder-card-menu.ts`, `disclosure-export.ts`, `beta-ui.ts`, `describe-composer.ts`, `video-handoff.ts`, `rd-avatar-ui.ts`, `variation-drawer.ts`, `photo-editor.ts` all reference `toast` | Strongly indicated duplication (no single shared toast module was found among these hits — each file has its own `toast`-referencing code) |
| Pricing defined in multiple places | `src/routes/pricing.tsx`, `src/components/seo/LandingTemplate.tsx`, `src/content/pricing-faq.ts`, `src/content/rd-site-html.ts` all reference pricing constructs | Strongly indicated — four independent locations for pricing content/logic risk drifting out of sync; not confirmed whether these are legitimately different surfaces (marketing copy vs. live app pricing) or true duplicates |
| Single logo asset/component, not duplicated | `src/assets/rd-logo-icon.png.asset.json`, `src/components/brand/RealDesignsLogo.tsx`, `src/styles/rd-brand-logo.css` — one asset, one component, one stylesheet | Confirmed no duplication found in this specific search |
| `rls.integration.test.ts` requiring live credentials | File name + content pattern (`.integration.` suffix, Supabase RLS) | Confirmed by naming/role; actual credential requirement not executed in this pass |
| Legacy/obsolete localStorage keys | Only 4 distinct keys found in active code: `rd.media.view`, `rd.obDone`, `rd_reveal_active`, `rd_reveal_intro` — inconsistent naming convention (dot vs. underscore) across just 4 keys is itself a minor signal of organic/unplanned growth, but no evidence of dead/unused keys (all 4 appear referenced in current source) | Confirmed: only 4 keys exist in current source; no orphaned key names found to flag as legacy (would need to diff against a schema/migration history not available here) |
| `rd-app-script.ts` as a monolith carrying much dead-weight risk | 530 KB single file, 286 empty catches, likely contains logic for many screens in one module (see Perf section) — increases likelihood some branches are unreachable after feature changes elsewhere, but no specific unreachable function was isolated in this pass | Strongly indicated risk class, not itemized per-function |
| No unused-route evidence gathered | Route inventory/dead-route analysis not performed in this pass (would require diffing `src/routes/**` against a nav registry and server-function callers, not completed here) | Not assessed — flag for a follow-up pass rather than a false negative |

**Note:** consistent with instructions, no files were deleted, renamed, or modified as part of this investigation — all commands above were read-only (`ls`, `wc`, `rg`, `grep`, `bunx vitest run`).
