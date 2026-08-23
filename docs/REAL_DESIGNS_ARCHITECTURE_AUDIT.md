# REAL DESIGNS — Architecture Audit

**Date:** as of the current working tree
**Method:** static read of the entire `src/`, `e2e/`, `supabase/` tree; one full `vitest run`; live read-only queries against the connected Supabase project (RLS, grants, buckets); no source, schema, or data was modified.
**Confidence labels used throughout:** `Confirmed` (verified by direct evidence), `Strongly indicated` (consistent evidence, no counter-evidence), `Needs runtime verification` (requires a live browser/production session to prove).

**Detailed evidence lives in seven companion parts** under `docs/audit-parts/`:

| Part | File | Scope |
|---|---|---|
| 1 | `01-runtime-shell-routing.md` | Runtime ownership, legacy script concentration, routing, shell |
| 2 | `02-studio-explore-crop.md` | Studio workflow, drafts/persistence, Explore handoff, crop/format |
| 3 | `03-canvas-tools-masks-editor.md` | Canvas architecture, tool matrix, Edit Photo, mask engine |
| 4 | `04-generation-credits-assets.md` | Generation pipeline, credits/entitlements, asset & version model |
| 5 | `05-database-auth-security-providers.md` | Database, auth, security sweep, external providers |
| 6 | `06-media-properties-video-presentations.md` | Properties, media library, video/REAL REVEAL, presentations |
| 7 | `07-tests-css-perf-a11y-deadcode.md` | Tests, CSS/layout, performance, a11y, error handling, dead code |

---

## 1. Executive summary

REAL DESIGNS is a **functional, server-enforced product with a genuinely sound backend and a structurally fragile frontend**. The database, authentication, credit enforcement, and AI provider integration are real, correctly gated, and better engineered than the UI layer that sits on top of them. Nearly every recurring symptom the team experiences — "fixes don't stick," "layout breaks somewhere else," "a change in one screen breaks another" — traces to a single root cause: **the authenticated application is driven by one 14,103-line imperative DOM controller (`src/content/rd-app-script.ts`) plus a second 8,178-line one (`src/content/rd-reveal.ts`), rendered into React via `dangerouslySetInnerHTML`, with ~40 unrelated business domains sharing one function closure and one try/catch boundary.**

### Ten most important findings

1. **One function owns ~40 domains.** `initApp()` in `rd-app-script.ts` spans nav, Studio, ten AI tools, billing, presentations, reports, team, help, onboarding, and keyboard shortcuts in one closure. Only 5 of ~40 domains are wrapped in the existing `runModule` isolation helper; an exception thrown while painting Product Board can prevent Presentations, Reports, Team, Notifications, billing, and keyboard shortcuts from initializing at all on that page load. *(Confirmed — Part 1b)*
2. **517 empty `catch (_) {}` blocks**, 384 of them (74%) in three files: `rd-app-script.ts` (286), `rd-staging.ts` (57), `rd-reveal.ts` (41). A structured observability layer (`src/lib/obs/*`, `error-capture.ts`, `lovable-error-reporting.ts`) exists and is unit-tested, but an empty block by definition calls nothing. **Support currently cannot answer "which operation failed, was a credit charged, was a version saved" for any failure that lands in one of these.** *(Confirmed — Part 7e)*
3. **Credit integrity is server-enforced and safe from client tampering**, but has two real gaps: the single-photo `renderDesign`/`renderConcept` path has **no server-side idempotency key**, so two truly concurrent requests (two tabs, a re-enabled button) would double-charge; and `grant_credits`/`restore_free_design` have no idempotency guard, so a future double-call would double-refund. Batch and video-clip paths *do* have idempotency keys. *(Confirmed — Part 4 A3/B5/B6)*
4. **Three parallel "current step" enumerations and two parallel asset-lineage models exist for one product concept.** `DesignStep` (`builder-step.ts`), `PhotoStep` (`builder-nav.ts`), and `DraftStep` (`design-draft.ts`) each normalize the others' legacy values; separately, the scope lineage (`property → project → room → version`) and the Studio media lineage (`property_media_assets → property_media_versions`) are **not linked**, so a Studio design and a scope design of the same room have no structural relationship. *(Confirmed — Parts 2 A1, 4 C1)*
5. **Three independent crop coordinate systems** coexist (`crop-frame.ts`, `photo-crop.ts`, `crop-position-dialog.ts` / `image-format-ui.ts`), which is the structural reason crop/format behavior keeps drifting between the single-photo and multi-photo flows. *(Confirmed — Part 2 D1)*
6. **CSS has no shared token layer for z-index, breakpoints, or spacing.** 121 `!important` declarations (66 in `rd-app.css`, 27 in `rd-site.css`), z-index literals from `60` to `100001` with no scale, 374 hardcoded pixel `height:` rules in `rd-app.css` alone paired with 131 `overflow` rules, and each of the six large stylesheets defining its own breakpoints. Styling authority is split three ways: global CSS → per-feature CSS → inline `style="…"` baked into the JS template strings. **This is why layout fixes don't stick.** *(Confirmed — Part 7b)*
7. **Security posture is strong.** All 65 public tables have RLS enabled; zero `anon` grants; all storage buckets private; CSRF middleware correctly re-added in `start.ts` (a common regression point when customizing it); signed-URL TTLs bounded (60s–8h); listing import has a real hostname allow-list plus RFC1918/link-local/metadata blocking; every secret is read only inside `*.server.ts`/`*.functions.ts`. *(Confirmed — Part 5)*
8. **Two genuine security items remain open:** the 75 files using `innerHTML` have not been individually audited for interpolation of user/listing-derived text (an XSS class risk, High if any confirmed), and `scene-clips.server.ts:62` fetches a DB-stored `source_path` as a URL with no host allow-list (SSRF, Medium, depends on whether that column can ever hold client-supplied text). *(Needs runtime verification — Part 5c)*
9. **UI feature-suppression is not server-enforced.** `feature-availability.ts` marks `budget`, `api_white_label`, and `checkout` as `hidden`, but it is a shell/navigation policy file only — no server function imports it. Hidden ≠ disabled. Credit- and plan-gated actions, by contrast, *are* enforced in SQL (`spend_credits` rejects non-`design` actions on the free plan regardless of client state). *(Confirmed — Part 4 B3)*
10. **Test coverage is broad but shallow at the seams.** 965 passing tests across 91 vitest files and 8 Playwright specs — but the vitest suite asserts on generated HTML strings, not on the event handlers `rd-app-script.ts` attaches at runtime. There is **no automated accessibility check, no visual-regression check, and no test for draft recovery after refresh, credit idempotency, crop persistence, mask alignment, version history, or expired-share-link rejection.** *(Confirmed — Part 7a)*

### What is working well (do not rewrite these)

- Server-side credit charging (`charge()` before every provider call, `refund()` in every catch), enforced inside `createServerFn` handlers behind `requireSupabaseAuth`.
- The single-Canvas architecture: there is **one** persistent Canvas viewport; Edit Photo is adopted into it rather than being a second viewport (Part 3 A1/A2).
- **One** canonical mask engine (`mask-engine.ts`) with a normalized 0..1 coordinate convention — not several competing ones (Part 3 D1).
- Database design, RLS, storage privacy, and the "detach, don't destroy" media policy.
- The codebase is unusually self-documenting: most files carry a block comment stating the exact invariant they hold, and in the large majority of cases the code matches the comment.
- REAL REVEAL correctly labels simulated camera motion as simulation, and genuinely server-tracked AI video as such, with stale-job refunds.

---

## 2. Inventory

| Metric | Value |
|---|---|
| Total `src` lines (ts/tsx/css) | 200,061 |
| Routes (`src/routes/**/*.tsx`) | 37 |
| `src/lib` modules | 362 |
| Server functions (`*.server.ts` / `*.functions.ts`) | 91 |
| `src/content` modules | 31 |
| React components/features files | 72 |
| Supabase migrations | 74 |
| Public tables (live) | 65 — all with RLS enabled |
| Stylesheets | 25 files, ~930 KB |
| Vitest files / tests | 91 / 965 passing, 5 conditionally skipped |
| Playwright specs | 8 |

**Concentration:** `rd-app-script.ts` (530 KB), `rd-reveal.ts` (304 KB), `rd-staging.ts` (131 KB), `rd-app-html.ts` (66 KB) — ~1.0 MB in four files, driving the entire authenticated surface.

---

## 3. Runtime & rendering ownership

```text
/app route (TanStack)
└── <div class="rd-app">
    ├── <AppShell>            ← REAL React (Sidebar, Topbar, menus)
    │   └── <LegacyViews/>    ← dangerouslySetInnerHTML(gateFeatureMarkup(viewsHtml))
    ├── <LegacyOverlays/>     ← dangerouslySetInnerHTML(gateFeatureMarkup(overlaysHtml))
    └── <LegacyRuntime/>      ← useEffect(() => initApp())   [14,103 lines]
                                 ├─ attaches click handlers to React-rendered .nav-i buttons
                                 ├─ owns hash routing (#v-studio, #v-dash …) invisible to the Router
                                 └─ writes innerHTML into #tree, #recentList, #roomCards …
```

**Split ownership is the defining characteristic:** React *renders* the sidebar buttons, the legacy script *owns their behavior* (`document.querySelectorAll(".nav-i").forEach(b => b.addEventListener(...))`, `rd-app-script.ts:1088`). `Sidebar.tsx`'s own comment acknowledges the fragility ("the legacy rail controller must never rewrite this button's innerHTML").

Other structural facts:
- **Two independent implementations** of the "mount HTML string + run init + clean up" pattern exist (`PrototypeSurface.tsx` and the bespoke `LegacyViews/Overlays/Runtime` trio), with tooltip/select/datalist wiring duplicated a third time in `__root.tsx:290`.
- **Double-init guard is a dataset flag** (`root.dataset.rdInit`), which protects a re-mount onto the *same* node but not a fresh `.rd-app` node (StrictMode, key-based remount).
- **Cleanup is asymmetric:** `initApp()`'s returned cleanup clears timers only; dozens of `document`/`window` click listeners registered inside it have no matching `removeEventListener`. *(Needs runtime verification of an actual leak — measure listener counts across repeated navigation.)*
- **Two `hashchange` listeners** exist in the same function (lines 1059 and 14085), both dispatching `go()`. *(Needs runtime verification that they don't double-fire.)*
- **147 `window.__rd*` globals** form a second, untyped state/API surface parallel to React state (`__rdIsView`, `__rdStudioMode`, `__rdOpenPhotoCanvas`, `__rdBuilderSaveExit`, `__rdGo`, `__rdNav.*`, …). Cross-domain calls go through these with no compile-time contract.

---

## 4. Studio, drafts and the Explore handoff

**Draft state lives in four layers**, correctly designed but documented nowhere as a single map:

| Layer | Holds | Survives refresh | Survives device change |
|---|---|---|---|
| Supabase `project_drafts` (via `drafts.functions.ts`) | The authoritative multi-photo draft (`S.items`, design, ratio), 700 ms debounce | Yes | Yes |
| `localStorage` (`rd_design_draft_v1`, `rd_style_choice`) | Style selection + workflow step | Yes | No |
| `sessionStorage` (`rd.handoff.v1`) + in-memory `mem` fallback | Explore → Studio handoff payload | Tab only | No |
| `window` globals + CustomEvents (`rd:draft-changed`) | Navigation guards, cross-module signalling | No | No |

**Key findings:**
- **A1 (High):** three step enumerations for one flow, reconciled by defensive normalizers rather than unified.
- **A2:** single-photo and multi-photo Photo Design use genuinely different architectures, not one parameterized flow.
- **A4 (Medium):** legacy draft shapes (`"add"`, `"canvas"`, `"review-results"`) are still reinterpreted on every load because no one-time backfill of `project_drafts.builder_step` was ever run — the old format is now a permanently supported input.
- **B1:** per-photo instructions are collected but **never displayed on Review** — the user cannot verify what they typed before spending credits.
- **C1/C2:** Explore style ids are draft-scoped (correct), but an "explore" style can be lost if Studio controls haven't mounted when the handoff lands (ordering dependency).
- **D2:** the Image Format primary-ratio list omits `"original"`, which is why the "custom" badge condition behaves inconsistently.

---

## 5. Canvas, tools and masks

**One persistent Canvas shell; tools do not remount the viewport** — confirmed, and Edit Photo is adopted into the same stage rather than opening a second one. Overlay tools share a *convention* (normalized 0..1 coordinates) rather than a shared renderer, so `markup.ts` and `mask-engine.ts` agree on math but not on code.

### Tool status matrix (condensed from Part 3; provider column corrected against live config)

All AI tools route through the Lovable AI Gateway with `LOVABLE_API_KEY` present, using Gemini models — verified by direct grep of `*.server.ts` / `*.functions.ts`.

| Tool | UI wired | Server fn | Provider | Credits | Persists | Status |
|---|---|---|---|---|---|---|
| Redesign | Yes | `renderDesign` | `google/gemini-2.5-flash-image` | Yes (1) | versions | Working |
| Stage | Yes | `renderStaging` + analyze/check | Gemini via gateway | Yes | Yes | Working |
| Declutter | Yes | `renderDeclutter` | Gemini | Yes | Yes | Working |
| Materials | Yes | `renderMaterials` | Gemini | Yes (per option) | Yes | Working |
| Edit Photo | Yes | `runPhotoEdit`/`savePhotoEdit` | Gemini | Yes (analyze is free) | Yes | Working |
| Sketch → Render | Yes | `renderSketch` | Gemini | Yes | Yes | Working |
| Angles | Yes | `renderAngleSet` | Gemini | Yes | Yes | Working |
| Animate / Video | Yes | `startMotionClip` + poll | Gemini video | Yes (40) | `motion_clip_jobs` | Working (async) |
| Floorplan | Yes | `renderFloorplan` | Gemini | Yes (6) | Yes | Working |
| Object Edit | Yes | `renderObjectEditResult` | Gemini | Yes (1) | Yes | Working |
| Auto Enhance | Yes (in Edit Photo) | client histogram + `savePhotoEdit` | N/A local | shares Edit Photo | Yes | Working |
| Crop / Geometry | Yes | client transform + `savePhotoEdit` | N/A | Free | Yes | Working |
| Window Balance | Yes | generic `runPhotoEdit` op | Gemini | Yes | Yes | Working (an op, not a tool) |
| **Day to Dusk** | In Edit Photo op list (`dusk`) | generic `runPhotoEdit` (`HEAVY_PROPERTY_OPS`) | Gemini | Yes | Yes | Working as an Edit-Photo op — **not** a standalone tool (Part 3 flagged it Unknown; corrected here) |
| **Privacy Blur** | Detection only | `scanPrivacy` only — **no apply/render server fn exists** | detection only | none | **not confirmed** | **Client-side only for the apply step — the one genuine gap** |

**Other tool-layer findings:** `deleteMarkup` is exported with no caller in UI code (Part 3 B1); `applyAi()` silently resets crop/rotation/straighten/flip when an AI op is committed (C3); Auto Enhance idempotency is explicitly engineered and layered over manual adjustments (C2).

---

## 6. Generation pipeline & credits

### Single-photo design render, end to end

```text
#genBtn ──[SubmitGuard: client-only]──> runGeneration()
   └─> renderDesign (createServerFn, requireSupabaseAuth)
        ├─ Zod re-validates every field server-side (client validation not trusted)
        ├─ buildPrompt() — style + intensity + Reality Lock + aspect ratio as TEXT
        ├─ charge(userId,"design")           ← BEFORE the provider call
        ├─ fetch ai.gateway.lovable.dev      ← no timeout, no retry, no queue, no webhook
        │     └─ catch ──> refund() ──> throw
        └─ returns image inline (the HTTP response IS the result)
   └─> uploadRenderDataUrl()  ── fail x2 ──> PENDING_SAVE (charged, unsaved)
   └─> finalizeGeneratedDesign() ── fail ──> PENDING_VERSION (stored, no version row)
```

**Confirmed strengths:** charge is always server-side and unskippable; refund fires on every thrown error; cancellation is honestly reported as unsupported (`cancellationSupported() === false`) so no fake Cancel button is shown; retry after an upload failure reuses the paid image instead of regenerating; progress stages are real (derived from `generation-jobs.ts`), not simulated.

**Confirmed risks:**
- No server-side idempotency for single-photo renders (see finding 3 above).
- Aspect ratio is requested in natural language; there is **no post-generation crop/pad enforcement**, so a "16:9" output is not guaranteed pixel-exact despite the UI presenting it as a fixed ratio. *(Needs runtime verification.)*
- No request timeout around the gateway `fetch`; a hung gateway relies on the platform timeout still reaching the `catch` for the refund to fire. *(Needs runtime verification.)*
- Cost is defined in **three places**: the SQL `credit_cost()` table (the only enforcement point) plus two hand-maintained display literals in `credits.server.ts` and `credits.functions.ts`. Drift would produce wrong *displayed* prices; the *charged* amount is always correct.

### Asset & version model

Two lineages coexist and are not merged (finding 4). Lifecycle policies also invert between levels: `property_media_assets.property_id` is `ON DELETE SET NULL` (detach, don't destroy — intentional) while `property_media_versions.asset_id` is `ON DELETE CASCADE`. Deleting a property media asset does not delete its edit history (Part 6 A3), and `deleteVideo` does not clean up dependent rows (A4).

---

## 7. Media, properties, video and presentations

- Rooms are deduplicated by source photo, **but only when a source path exists**; uploaded property photos have **no dedupe path at all**, so re-uploads always create new rows (Part 6 A1/A2).
- The Media Library is a genuine union of five real data sources with one shared card layout (no grid/list divergence, no stretched-thumbnail model), real filtering/search/sort, and pending/failed states backed by persisted work rather than fake progress (B1–B6).
- **Two structurally different "presentation" systems ship under one product name** (Part 6 D1). Shared single-version decks are genuinely version-locked; package assets are snapshotted at save time (D3).
- View counts increment on **every** page load with no per-visit/session dedupe (D4), and anonymous approval decisions have **no identity verification** beyond a free-text name (D5) — both matter if these numbers are ever presented to a client as evidence.
- Budget/pricing data is correctly stripped **server-side** in both presentation systems when budgets aren't live (D6).
- Owner list/detail queries for packages rely entirely on RLS with no defense-in-depth `user_id` filter in the query itself (D8) — safe today, fragile if an RLS policy is ever loosened.
- The REAL DESIGNS logo has one canonical React component used on both public share routes, but a second hand-rolled implementation exists for marketing/SEO chrome (D9).

---

## 8. Security & data boundaries

### Verified clean (live checks)

| Check | Result |
|---|---|
| RLS on public tables | 65/65 enabled |
| `anon` role grants on public tables | Zero |
| Storage buckets (`reveal-videos`, `room-photos`, `user-audio`) | All `public: false` |
| Secrets in client bundle | All secrets read only in `*.server.ts`/`*.functions.ts`; only `VITE_SUPABASE_*` (publishable by design) exposed |
| CSRF | `createCsrfMiddleware` correctly re-added in `start.ts`, scoped to `serverFn` |
| Share/approval token entropy | UUID-based, not enumerable |
| Signed-URL TTLs | 60 s – 8 h, none unbounded |
| SSRF on listing import | Hostname allow-list + RFC1918/link-local/`.internal`/IPv6-loopback blocking |

### Open items

| Item | Severity | Status |
|---|---|---|
| 75 files using `innerHTML` not individually audited for interpolated user/listing text | High **if** confirmed | Needs verification: `rg -n "innerHTML\s*="` then check each for `` `…${` `` of user data |
| `scene-clips.server.ts:62` fetches DB-stored `source_path` as a URL without host allow-list | Medium | Needs verification that `source_path` can never hold client-supplied text |
| Hidden features (`budget`, `api_white_label`, `checkout`) have no server-side gate | Medium | `feature-availability.ts` is UI policy only |
| Prompt injection via imported listing text into AI prompts | Medium | Not traced; confirm listing text is delimited as untrusted |
| Server-side file-type/size validation on uploads | Medium | Not reviewed |
| Provider silent-fallback-to-mock when a key is absent | Medium | Test by unsetting each key and confirming a loud failure |
| Stripe webhook signature verification | Medium | Not confirmed present |
| Cloud OAuth refresh-token storage (Drive/Dropbox) | Medium | Encryption-at-rest not reviewed |

---

## 9. Why fixes don't stick — the structural answer

Four compounding mechanisms, all confirmed:

1. **Styling authority is split three ways** (global CSS → feature CSS → inline styles inside 1 MB of JS template strings). A developer fixing a clipped panel in `rd-app.css` cannot see the inline style constraining the same element from inside `rd-app-script.ts`.
2. **No token layer.** 121 `!important`s concentrated in the two most-reused stylesheets, z-index literals spanning `60`–`100001` with no scale, and per-file breakpoint sets that don't align. Every fix must escalate specificity to win, which makes the next fix harder.
3. **Fixed pixel heights + `overflow:hidden` as the default containment strategy** (374 literal heights in `rd-app.css` alone). Any content-length change clips instead of reflowing.
4. **Broad root-class reuse (`.rd-app`, `.rd-site`)** across 2,677 and 1,591 selector occurrences removes the firewall that would stop cross-feature leakage — a rule written for one screen matches markup on an unrelated one.

Behind all four sits the deeper cause: one function, one closure, one try/catch, ~40 domains, 147 ambient globals, and 517 silent catches — so a change's blast radius is unbounded and its failures are invisible.

---

## 10. Target architecture

Not a rewrite. The destination is the pattern the codebase already reaches for in its newest files:

```text
Route (TanStack)
  └─ React feature shell            ← owns layout, chrome, and mount lifecycle
       └─ Feature module            ← one domain, one file set, own error boundary
            ├─ view model (pure TS, unit-testable)
            ├─ server fn (Zod in, charge/refund, typed errors)
            └─ imperative canvas adapter (only where a canvas genuinely needs it)
```

Principles to hold:
- **One domain per module, each wrapped in `runModule`** (the helper already exists — apply it uniformly instead of to 5 of 40 domains).
- **Typed contracts replace `window.__rd*`** — one exported interface per cross-domain call, so the compiler catches breakage.
- **One step enum, one crop model, one lineage** — pick the survivor in each of the three duplicated concepts and have the others import it.
- **Tokens before pixels** — a z-index scale, a breakpoint set, `min-height` over `height`.
- **No silent catches on money or data paths** — every catch in generation/credit/save code logs `{ operation, jobId, provider, creditImpact, versionSaved, retrySafe, sourcePreserved, cause }` through the existing `src/lib/obs` layer.
- **Keep** the single Canvas, the single mask engine, server-side charging, and RLS-first data access exactly as they are.

---

## 11. Remediation roadmap

Ordered by risk-reduction per unit of effort. Nothing here requires a rewrite, and no phase blocks shipping features.

### Phase 0 — Correctness and money (days)

| # | Action | Why | Test |
|---|---|---|---|
| 0.1 | Add a server-side idempotency key to `renderDesign`/`renderConcept` (reuse the batch pattern in `generation-jobs.ts`) | Removes the only path that can double-charge a user | Fire two concurrent identical requests; assert one charge |
| 0.2 | Add an idempotency guard to `grant_credits` and `restore_free_design` (mirror `scene_clips.credits_refunded`) | Defense in depth against double-refund | Call twice with the same job id; assert one effect |
| 0.3 | Replace empty catches on credit/save/generation paths in `rd-app-script.ts`, `rd-staging.ts`, `rd-reveal.ts` with the structured error shape routed through `src/lib/obs` | Makes every future incident diagnosable | Force a save failure; assert a structured log with `creditImpact` |
| 0.4 | Audit the 75 `innerHTML` sites for interpolated user/listing text; convert to `textContent`/DOM construction where found | Closes the one plausible XSS class | Store `<img src=x onerror=alert(1)>` in a listing description; assert inert |
| 0.5 | Add an explicit timeout + one bounded retry around the gateway `fetch` | A hung gateway must still reach the refund path | Point at a stalling endpoint; assert refund fires |
| 0.6 | Constrain `scene-clips.server.ts` `sourceDataUrl` to internal storage paths | Closes the SSRF vector | `source_path = http://169.254.169.254/`; assert rejection |

### Phase 1 — Containment (1–2 weeks)

| # | Action | Why |
|---|---|---|
| 1.1 | Apply `runModule` to all ~40 domains in `initApp` | One broken painter stops breaking 30 unrelated screens |
| 1.2 | Add a z-index token scale and a canonical breakpoint set to `src/styles.css`, map existing values 1:1 (zero visual change) | Stops accidental stacking order |
| 1.3 | Convert container `height:` to `min-height:` on panels wrapping variable-length content; add `contain: layout paint` to independently scrolling panels | Kills the grow-and-clip failure mode |
| 1.4 | Server-side gate for `budget`, `api_white_label`, `checkout` | Hidden must equal disabled |
| 1.5 | Show per-photo instructions on the Review step | Users must see what they're paying for |
| 1.6 | Either finish Privacy Blur's apply/persist path server-side, or mark it explicitly as a client-side preview | Removes the one tool that promises more than it delivers |

### Phase 2 — Consolidation (3–6 weeks)

| # | Action |
|---|---|
| 2.1 | One `DesignStep` enum imported by `builder-step.ts`, `builder-nav.ts`, `design-draft.ts`; delete both normalizers |
| 2.2 | One crop model; make `photo-crop.ts` canonical and have the dialog/format UIs consume it |
| 2.3 | Replace the `window.__rd*` surface with a single typed `RdBridge` interface (mechanical, incremental) |
| 2.4 | One shared toast component with `role="status"`/`aria-live`, replacing 10 independent implementations |
| 2.5 | Post-generation crop/pad enforcement so requested output ratios are pixel-exact |
| 2.6 | Add the missing tests: draft recovery after refresh, credit idempotency, crop persistence, mask alignment, version history, expired-share-link rejection, cross-tenant denial |

### Phase 3 — Migration (ongoing, opportunistic)

| # | Action |
|---|---|
| 3.1 | Extract domains out of `initApp` into React feature modules, one at a time, highest-churn first (Studio → Presentations → Account → Reports). Each extraction removes its own listeners, its own CSS, and its own globals |
| 3.2 | One-time backfill of `project_drafts.builder_step`, then delete the client legacy-normalizing branches |
| 3.3 | Decide the canonical asset lineage and cross-link (or merge) the scope and Studio media models |
| 3.4 | Dynamic-import the large `content/*.ts` string modules so `/app` stops paying for `rd-reveal.ts` and vice-versa |
| 3.5 | Consolidate the two presentation systems behind one contract |

### Phase 4 — Hygiene

Document the four-layer draft storage map in one place; add automated a11y (axe in Playwright) and visual-regression checks; dedupe view counts per session; add identity to approval attribution; remove the orphaned `deleteMarkup` export and the duplicate logo implementation.

---

## 12. Things this audit did **not** prove

Stated explicitly so nothing here is mistaken for verified fact:

- Listener/memory accumulation across repeated navigation (needs heap snapshots).
- Whether the two `hashchange` listeners double-fire `go()`.
- Whether any of the 75 `innerHTML` sites actually interpolates untrusted text.
- Whether any provider silently falls back to a mock when its key is absent.
- Exact bundle composition and route-chunk boundaries (no production build was run).
- Runtime accessibility behavior: focus trapping, keyboard crop/mask alternatives, contrast, reduced-motion.
- Whether `credit_cost` in the live DB still matches the two display literals.
- Per-tool verification of every Generate button (design, concept, and video clip were traced; the rest were sampled).
