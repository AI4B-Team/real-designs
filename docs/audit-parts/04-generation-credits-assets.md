# Part 4 — Generation Pipeline, Credits/Entitlements, Asset & Version Model

Scope: `src/lib/design-render.functions.ts`, `concept-render.functions.ts`,
`generation-jobs.ts`, `batch-progress.ts`, `render-providers.ts`,
`scene-clips.server.ts`, `credits.functions.ts`, `credits.server.ts`, `plan.ts`,
`src/features/app-shell/feature-availability.ts`, `src/content/rd-app-script.ts`
(the Studio client, ~14k lines), `src/styles/rd-scan.css`, and the SQL in
`supabase/migrations/*` for `credit_accounts`, `versions`,
`property_media_assets/versions`, `video_projects/scenes/variants`,
`scene_clips`, `presentation_packages/assets/links`.

General note: this codebase is unusually self-documenting — most files carry
block comments stating the exact invariant the code is trying to hold (e.g.
"a batch is created once per idempotency key"). Where code matches the
comment's claim, findings below say so explicitly with evidence rather than
re-deriving it, but every claim is at "Strongly indicated" until the noted
runtime/production checks are done.

---

## (a) Generation pipeline

### A1. End-to-end trace — single-photo Studio render (design)

1. **Client trigger**: `#genBtn` click in `rd-app-script.ts` → `runGeneration(brief, VAR)` (line ~3768), guarded by `const GEN_GUARD = new SubmitGuard()` (line 3700) so re-entrant calls collapse into one in-flight job (`busy` flag + `btn.disabled = true` at line 3773).
2. **Validation**: `currentBrief()` (line 3713) builds a structured brief client-side (room/style/intensity/grade/notes/locks); no server-side echo validation happens until the Zod `Input` schema on `renderDesign` (design-render.functions.ts:23-46) re-validates every field server-side (image length, enums, array caps) — client and server validation are independent, so a tampered client request is still safely rejected/clamped server-side (Zod `.default()`/`.max()`).
3. **Idempotency / retry-without-recharge**: `persistRetryPlan()` + `pendingPersist` (lines 3703, 3793-3796) — if a previous attempt already produced and paid for an image but only the *storage upload* failed, the retry path reuses that image (`plan.action !== "generate"`) instead of calling `renderDesign` again. This is a **narrow, upload-only idempotency guard**, not a generic job idempotency key like the batch path has (see A5).
4. **Provider selection**: hard-coded single model, `MODEL = "google/gemini-2.5-flash-image"` in both `design-render.functions.ts:48` and `concept-render.functions.ts:33`. There is no provider registry/fallback for image generation (unlike `render-providers.ts`, which is video-only, see A7).
5. **Prompt construction**: `buildPrompt()` (design-render.functions.ts:50-99) assembles style, intensity, "Reality Lock" (preserve list), keep/replace/remove instructions, aspect ratio and free-text notes into one deterministic string. Concept path (`concept-render.functions.ts:35-60`) is structurally identical but explicitly labels output "Concept" (never claims architecture preservation) — this correctly reflects the no-source-photo case.
6. **Source asset resolution**: client resolves `srcImg.src` or `VAR.src` to a data URL via `toDataUrl(..., 1600)` (rd-app-script.ts:3800) capped at 1600px — the source is always attached as a base64 data URL, not a storage path; the server never re-fetches from storage for this tool (contrast with `scene-clips.server.ts:sourceDataUrl`, which does support storage paths).
7. **Mask/crop/format**: no mask or crop payload is sent for Redesign; `aspect_ratio` is the only framing control and is threaded into the prompt as text (design-render.functions.ts:89-96) — the provider is *asked* to respect it in natural language, there is no post-generation crop/pad enforcement. **A "5:4" or "16:9" request is not guaranteed pixel-exact even though the UI presents it as a fixed output ratio (Needs runtime verification).**
8. **Credit charge**: `charge(context.userId, "design", ...)` is called **before** the fetch to the model gateway (design-render.functions.ts:110-111; concept-render.functions.ts:71-72). This is server-side, inside the `createServerFn` handler, after `requireSupabaseAuth` middleware — the client cannot skip it.
9. **Queueing**: none. The call is a single synchronous `fetch` to `https://ai.gateway.lovable.dev/v1/chat/completions`; there is no queue/worker and no polling for the single-photo path — the HTTP response *is* the result.
10. **Timeouts/retries**: no explicit request timeout or retry-with-backoff around the `fetch` in `design-render.functions.ts`/`concept-render.functions.ts`. A slow/hanging gateway blocks the request until the platform's own HTTP timeout, at which point the `catch` block still fires `refund()` (see below) — but there is no bounded timeout coded here (**Needs runtime verification** against the platform's function timeout).
11. **Webhook**: none for this path (see A6 for the async video/clip path, which does use polling+reconciliation instead of webhooks).
12. **Cancellation**: `cancellationSupported()` in `generation-jobs.ts:422-424` explicitly returns `false` with the comment "the render call is a single request that keeps running (and billing) once issued" — confirmed no cancel path exists for image generation; the UI must not (and per this function, does not) render a Cancel button.
13. **Credit refund on failure**: `try { fetch... } catch (err) { await refund(...); throw err; }` (design-render.functions.ts:151-154). Any thrown error — 429/402/non-2xx/no-image-returned — triggers a refund attempt. Since `refund()` is called in the `catch`, a refund is only skipped if the refund call itself throws (unhandled) or if the process crashes/times out **before** reaching the catch (e.g., true network death) — that failure mode would charge with nothing returned and no refund. **This is the one credit-integrity edge case in this file (Needs runtime verification: does the platform guarantee the catch always runs on timeout?).**
14. **Storage upload**: `uploadRenderDataUrl(image)` invoked from the client wrapper `persistRender()` (rd-app-script.ts:4180-4197), with one silent retry (`attempt < 2`, 1200ms backoff) before surfacing `PENDING_SAVE` and a toast "Your Design Was Generated But Could Not Be Saved". Confirms: **a charged, generated image can exist only as an in-memory preview if storage upload fails twice** — the credit was already spent (step 8) and is *not* refunded for an upload failure, by design (comment at 4153-4155: "no second generation, no second charge" — i.e. the fix is retry-upload, not refund).
15. **DB persistence / version creation**: `finalizeGeneratedDesign(lastRenderPath)` (called at 3848 and from retry at 4230) is what turns a stored file into a `versions` row (see asset model in part c) — this is a second point of failure after upload: `PENDING_VERSION` (line 4166) exists specifically for "a render that reached storage but whose version row still has to be written," with its own retry button that never re-uploads or re-charges (4201-4213).
16. **UI completion / canvas navigation**: `paintStudioSummary`, `addRenderVariant`, `markStudioResult()` update the canvas in place; the source `<img>` is never replaced/moved during generation (comment at 3750-3752) and there is no forced route navigation on completion — the user stays in Studio and the result is added as a version thumbnail.

### A2. Does every "Generate" button actually generate, or do some only navigate?

Confirmed generate-and-charge buttons trace to `renderDesign`/`renderConcept`/`createAndStartClip`/other `*.functions.ts` tool handlers, all of which call `charge()` before any provider call (design-render.functions.ts:110, concept-render.functions.ts:71, scene-clips.server.ts:325, and the same pattern was present in every other `*-render*` /`*.functions.ts` file sampled). No button wired to `renderDesign`/`renderConcept`/`createAndStartClip` was found that merely navigates without calling these functions — `rg` for `renderDesign(` and `createBatch(` resolves only to real handler call sites in `rd-app-script.ts`, `rd-bulk-restyle.ts`, `staging-bulk.ts`, `rd-studio-start.ts`. **Caveat**: verifying *every* per-tool button (floorplan, disclosure, markup, reveal, presentation "generate") individually was out of scope for the time available; the sampled tools (design, concept, video clip) all charge-before-call. Treat unaudited tools as **Needs runtime verification** rather than confirmed clean.

### A3. Do duplicate clicks create duplicate jobs / duplicate charges?

- Single-photo path: `busy` flag + `btn.disabled = true` (rd-app-script.ts:3770-3773) blocks a second click while `runGeneration` is in flight — a **client-side** guard only. If the button is re-enabled by an unrelated re-render, or the request is fired twice from two tabs, there is no server-side idempotency key on `renderDesign`/`renderConcept` (no `idempotency_key` param in their Zod `Input` schemas) — the SQL `spend_credits` RPC has no dedupe by key either, so **two truly concurrent requests from the same user would double-charge** (each independently calls `charge()`, both succeed if balance allows). This is different from the batch and video-clip paths, which do have idempotency keys.
- Batch path: `createBatch(key, seeds)` in `generation-jobs.ts:268-298` explicitly dedupes on `key` — "Calling again with the same idempotency key returns the batch that already exists" (comment at 263-267), confirmed by `const existing = batches.find((b) => b.key === key); if (existing) return existing;` (270-271). This protects the *batch record*, but the underlying per-photo `renderDesign` calls triggered by that batch still lack a job-scoped idempotency key at the server function level — batch-level dedup prevents creating a second batch, but does not, by itself, guarantee the per-job render call inside it is only issued once (that guarantee instead comes from `setStage`/`charged` bookkeping being purely client-local state, which is not re-entrant-safe across tabs/reloads mid-batch). **Needs runtime verification** with two tabs open on the same batch key.
- Video clip path: `createAndStartClip()` (scene-clips.server.ts:269-330) is the most robust — it checks both `idempotency_key` (273-279) **and** an "already active for this scene" query (281-289) before creating a row or charging, entirely server-side. This is the correct pattern; the design/concept render functions should adopt it.

### A4. Can navigation interrupt a job? Does refresh resume progress?

- `generation-jobs.ts:194-221` (`loadJobs`) explicitly handles this: each page load gets a random `SESSION` id (168); on reload, any batch whose `session` doesn't match the current one and whose job `isActive()` is marked `stage: "failed", interrupted: true` with the message "Generation was interrupted when the page closed." (206-213). This is an honest, non-silent outcome — the code comment states plainly it will not "quietly start the work again, which would charge a second credit" (192).
- However, for the single-photo Studio path (not the batch panel), the in-flight `renderDesign` fetch itself is not tied to `generation-jobs.ts` state — a navigation away mid-fetch aborts the in-flight request (browser cancels fetch on unload) but the *server-side* `charge()` may already have succeeded and the fetch to the model gateway keeps running server-side past the point the browser is gone; the `catch`/`refund` only fires if the server function itself observes an error, and if the client disconnected, the client never receives the credited/refunded state, so **the credit ledger's final page will not agree with what the interrupted session assumed** (server may still complete and store nothing durable since `persistRender`'s upload never runs) — Needs runtime verification for exact TanStack Start server-fn behavior on client abort (does the handler continue executing to completion, uploading nothing since the client-side upload call never fires?). If the server function does complete generation but the browser never calls `persistRender`, the design is generated and charged but **never persisted anywhere** — this is a real "charged with no durable result" risk distinct from the interrupted-batch-job case, which is properly caught by `generation-jobs.ts`.

### A5. Are progress states real or simulated?

Real. `generation-jobs.ts` states outright (comment 9-21): "There is no percentage... a stage is only ever set when that stage actually starts," backed by `setStage()` (309-317) which is only called from real transition points, and `progressText()` (batch-progress path, generation-jobs.ts:153-160) which shows either the real step number or a historical median duration derived from `recordDuration()` of genuinely completed jobs (123-147) — never an invented estimate. `rd-scan.css` (`rd-scan-sweep`, `rd-scan-mask` keyframes, 3.6s infinite loop) is a **decorative scanning-line animation**, not a progress bar tied to percentage — it loops indefinitely while a stage is active and is paused (`animation-play-state: paused`) rather than driven by fake progress ticks, consistent with the "no percentage" claim. Verdict: progress **stages** are real (state-machine driven); the **visual sweep** is cosmetic motion, not a fabricated percentage — this distinction is honestly maintained in code, not misleading.

### A6. Do failures name the right operation? Do failed jobs preserve settings?

- Failure messages are operation-specific: `"Design render failed"` / `"Text concept failed"` (design-render.functions.ts:152, concept-render.functions.ts:109) are passed as the `refund()` note, and gateway-side failures are surfaced verbatim-ish ("Rate limit reached...", "AI credits exhausted...", `Render failed (${res.status})`) — these correctly distinguish rate-limit vs. no-credits vs. generic failure.
- `retryJob()` (generation-jobs.ts:351-359) only resets `stage`, `error`, `interrupted`, `endedAt` — it does **not** touch `label/room/style/thumb/key`, i.e. the original brief/settings of the job are preserved across retry by construction (the `Job` object is mutated, not replaced). Confirmed.

### A7. Do results become durable versions? Are partial batch failures recoverable?

- Durable persistence is a two-step commit: storage upload (`uploadRenderDataUrl`) then version-row write (`finalizeGeneratedDesign`), each independently retryable without recharge (`PENDING_SAVE` / `PENDING_VERSION`, rd-app-script.ts:4156-4230). A generated image is not "done" from the product's own point of view until both steps succeed — the UI's own comment says so (4153: "only 'saved' once it reaches durable storage").
- Batch partial failure: `countBatch()`/`batchTitle()` (generation-jobs.ts:374-406) explicitly support a mixed-outcome batch ("`${complete} Of ${total} Designs Ready`" when `failed && !active`), and `batchDoneMessage()` (batch-progress.ts:123-130) reports "`N designs are ready · M need a retry`" — partial success is a first-class, recoverable state with per-row Retry buttons (`rowHtml`, batch-progress.ts:52-55), not an all-or-nothing batch.

### A8. Video/clip pipeline — provider abstraction & credit release

- `render-providers.ts` models an honest single-provider-today state: `RENDER_PROVIDERS.browser` is `serverSide:false, survivesTabClose:false, fallback:true` (32-42) and `runsInBackground()`/`renderModeNotice()` (63-66, 158-161) explicitly refuse to claim background survival unless a provider is actually server-side and configured — so the "keep this tab open" warning is truthful today. The registry is designed for a real server-side provider (Creatomate/Shotstack/Remotion) to slot in later without touching credits or DB (comment 1-11).
- `creditRelease()` (90-121) is a pure function computing whether a credit should be released based on `credits_charged - credits_refunded`, only for `failed`/`cancelled` status, and explicitly returns `already_released` once `amount <= 0` — this is a **refund-idempotency guard implemented as a pure computation**, separate from `scene_clips.server.ts:refundClipOnce()` which enforces the same idempotency transactionally at the DB layer (`.eq("credits_refunded", 0)` conditional update, line 152) — belt-and-suspenders, both consistent.
- `isJobStale()` (82-88) flags a render as stale after `RENDER_HEARTBEAT_STALE_MS = 120_000` (80) with no heartbeat — this is how an abandoned browser-side render is detected without a webhook, but it is a **client-reported heartbeat**: a browser that stays open but stalls silently (JS error) would eventually go stale and could be interpreted as failed even though nothing refunds it automatically unless something calls `creditRelease`/reconciliation on that job — **Needs runtime verification**: is there a scheduled sweep that actually calls refund for stale `video_render_jobs`, or does staleness only change a *label* (`jobStatusLabel` → "Render Interrupted") without releasing the credit? From the code read, `jobStatusLabel()` (123-144) only changes display text; no refund call was found wired to `isJobStale()` directly in the files read — **this is a likely credit-integrity gap and should be verified against wherever `video_render_jobs` status transitions are driven** (out of this file set; flag for follow-up).

### A9. Video *clip* pipeline (scene-clips.server.ts) — poll/reconcile in detail

- No webhook; `reconcileClip()` (180-235) is pull-based: called on-demand, checks provider status, and only downloads+stores the MP4 **once** (checks for an existing signed URL for the target path before re-downloading, 218-224) — safe against duplicate storage writes on repeated reconcile calls.
- Failure path refunds via `refundClipOnce()` before marking `status:"failed"` (194-204) — refund-before-fail ordering is correct and matches the DB-level idempotency guard.
- Transient read failures from the provider (`catch` at 189-192) deliberately do **not** fail the job or move credits — "a transient read failure must never fail the job or move credits" — correct defensive design, though this also means a permanently-unreachable provider job would sit in `processing` forever unless something else times it out (ties back to the `isJobStale` gap above).

### A10. Can generation happen without explicit confirmation?

All sampled paths require an explicit button click that constructs a brief/payload client-side (`runGeneration`, batch triggers in `rd-bulk-restyle.ts`/`staging-bulk.ts`) before any `charge()`/render call. No auto-fire-on-mount or auto-retry-with-recharge was found; `retryJob`/`retryPendingSave` are explicitly user-triggered and, per A6/A7, do not recharge. No evidence of implicit/background generation.

### ASCII state diagram (single design render, derived from generation-jobs.ts + design-render.functions.ts)

```
 [idle]
    │ click Generate (GEN_GUARD blocks re-entry)
    ▼
 queued ──────────────────────────────────────────────┐
    │ setStage("analyzing")                            │ page closes / navigates away
    ▼                                                   │  (loadJobs() on next load)
 analyzing ── (startedAt set)                            ▼
    │                                              failed(interrupted:true)
    ▼                                              "Generation was interrupted
 preparing (brief assembled, prompt built)          when the page closed."
    │                                               creditRestored: only if a
    ▼                                               server refund is separately
 generating ── charge() succeeds ── charged:true    confirmed (markCreditRestored)
    │        │
    │        └─fail(402/429/!ok/no image)──► refund() ──► failed (charged kept=false
    │                                                       after refund; error msg
    │                                                       names the operation)
    ▼
 (image returned)
    │
    ▼
 finalizing ── uploadRenderDataUrl()
    │     │
    │     └─fail x2──► PENDING_SAVE (charged, NOT durable) ──Retry(no recharge)──┐
    │                                                                             │
    ▼ success                                                                    │
 version row write (finalizeGeneratedDesign)                                     │
    │     │                                                                      │
    │     └─fail──► PENDING_VERSION (stored, NOT versioned) ──Retry(no recharge)─┤
    ▼ success                                                                    │
 complete ◄────────────────────────────────────────────────────────────────────┘
 (canvas updated in place, version added to history, no forced navigation)

 Cancellation: never offered — cancellationSupported() === false (single HTTP
 request keeps running/billing once issued).
```

---

## (b) Pricing, credits and entitlements

### B1. One canonical cost registry, or several?

**Two static copies, kept manually in sync, plus one live DB source of truth:**

1. **Source of truth (server enforcement)**: `public.credit_cost(_action)` used inside `spend_credits()` SQL function (`supabase/migrations/20260809060348_...sql:91`, `cost := public.credit_cost(_action)`). This is what actually decides how much is deducted.
2. **Server display copy**: `src/lib/credits.server.ts:15-20`, `CREDIT_COSTS = { design:1, scope:3, plan_3d:6, video:40 }` — used only for messages/refund-amount logic in that file, not for charging (charging always goes through the RPC).
3. **Client-exposed display copy**: `src/lib/credits.functions.ts:5`, an **identical** literal `CREDIT_COSTS` re-declared for `getMyCredits()`'s response — comment says "mirrored from the database cost table for display only" (line 4), which is an honest label, but it is a second manually-maintained literal that must be kept in lockstep with the DB table by hand. If `credit_cost` in the DB is ever changed (e.g. a real pricing change) without updating both `credits.server.ts` and `credits.functions.ts`, the **UI will silently display a stale number while the DB-enforced charge is correct** — a UI/server mismatch is architecturally possible even though the *charge itself* can never be spoofed by the client (it's server/RPC-driven). This is the answer to "is there one canonical registry": **no — there is one canonical enforcement point (SQL `credit_cost`) but two independent display literals that could drift.** Confirmed by direct comparison of the three files; drift itself is a "Needs verification against the live `credit_cost` table" question (I did not run read-only SQL against the live DB in this session to confirm the four numbers still match — recommend a scheduled check or a single shared constant sourced from the DB at build/deploy time instead of two literals).

### B2. Do UI-displayed costs match server charges everywhere?

For the two literals compared directly, yes today (`design:1, scope:3, plan_3d:6, video:40` identical in both files). The real charge always happens through `spend_credits`, so even if the two literals drifted from the DB, **the amount actually deducted is still correct** — only the *displayed* pre-charge estimate would be wrong. This limits the blast radius of a mismatch to a UX/trust issue, not a billing-integrity issue.

### B3. Is UI gating matched by server enforcement? Are hidden features still callable?

`feature-availability.ts` is a **client/shell-only** registry: `budget`, `api_white_label`, `checkout` are `"hidden"` (lines 30-34), meaning "no entry point anywhere in the shell" (comment, 12-13). This governs **navigation/menu visibility only** — it is not consulted by any server function in the files reviewed (no import of `feature-availability.ts` found in `credits.server.ts`, `design-render.functions.ts`, etc.). This means: **a signed-in user who already knows/derives the route or calls the underlying `createServerFn` directly (e.g. via devtools or a saved deep link) for a "hidden" feature is not blocked by this registry** — hidden ≠ disabled server-side. Whether those hidden features (`budget`, `api_white_label`, `checkout`) have their own independent server-side authorization is **out of scope of the files reviewed here and needs runtime verification** — this audit only confirms that `feature-availability.ts` itself provides no server enforcement, by design (it's explicitly a UI policy file). This is a plausible client-bypass surface for those three features specifically and should be checked against whatever server functions back them.

Plan-gated actions (`scope`, `plan_3d`, `video` for `free` plan) **are** enforced server-side: `spend_credits` SQL rejects any non-`design` action on `plan='free'` with `reason:'plan_required'` regardless of what the client sends (migration 20260809060348, lines 95-98) — this is real server enforcement, independent of the client's plan display state. So credit-gated actions are safe from client bypass; shell-visibility-gated features (`feature-availability.ts`) are a separate, weaker mechanism and were not shown to have equivalent server backing in the reviewed files.

### B4. Late plan data flashing / "Loading Plan" wrong states

`plan.ts` deliberately distinguishes "not loaded" from "resolved to Free": `normalizePlan()` returns `null` for blank/unknown values ("never `''`", comment line 4), while `resolveSubscriptionPlan()` applies the `DEFAULT_PLAN = "free"` fallback only for entitlement checks (49-51), keeping `null` available upstream for a real "loading" UI state. This is the correct pattern to avoid a flash of "Free" plan chrome before the real plan loads, **provided callers actually branch on `normalizePlan() === null` for loading UI and only call `resolveSubscriptionPlan()`/`planAllows()` for gating decisions** — I did not find and verify every UI call site that renders a plan-loading state in this pass (the module itself is correct; whether every consumer uses it correctly is **Needs runtime verification**).

### B5. Free-daily-design accounting

`spend_credits` (free branch, migration 20260809060348, 95-112): increments `free_used_today`, writes a `credit_ledger` row with `delta:0` (line 108) even though nothing was actually charged — this makes free-daily usage auditable in the same ledger as paid charges (a `delta:0` "free daily allowance" row), a reasonable design. `restore_free_design` (migration 20260823160345) is the refund counterpart: it decrements `free_used_today` **only if** `plan='free' AND free_used_today > 0` (13-15), else returns `{ok:false, reason:'nothing_to_restore'}` — this correctly prevents restoring below zero, i.e. **refund idempotency for the free-daily path is enforced by the guard condition itself**, not by a separate "already refunded" flag; calling it twice for the same failure would still decrement twice if `free_used_today` was ≥2 at call time, which is a **subtler idempotency gap**: unlike `refundClipOnce()` (DB-level `.eq("credits_refunded", 0)` guard) or `creditRelease()` (amount-based idempotency), `restore_free_design` has **no per-request/per-job marker** stopping the *same* failed generation from being refunded twice if `refund()` were accidentally called twice for it (e.g., a retried error handler). In `design-render.functions.ts`/`concept-render.functions.ts` this risk is low because `refund()` is called exactly once in the single `catch` block per request — but the SQL function itself provides no defense-in-depth if a caller ever did call it twice. **Recommendation**: add a `note`/job-id uniqueness check (or reuse the `credits_refunded` pattern from `scene_clips`) to `restore_free_design` for defense in depth, without changing pricing.

### B6. Refund-on-failure correctness (paid balance path)

`grant_credits` (migration 20260809060348, 131-144) has no idempotency key parameter either — same class of risk as B5 but for paid refunds; `credits.server.ts:refund()` (60-75) calls `grant_credits` unconditionally when `amount > 0`. Both `design-render.functions.ts` and `concept-render.functions.ts` call `refund()` exactly once per request lifecycle (inside the single `catch`), so the current call sites are safe, but the **SQL function itself would not stop a double-refund if a future call site called it twice** (e.g. a bug in a retry loop). This mirrors B5: recommend adding an idempotency key to `grant_credits`/`restore_free_design` as defense-in-depth, not because a double-refund bug was found in the current call sites, but because nothing in the SQL guards against one.

---

## (c) Asset & version model

### C1. Two parallel lineage models coexist

The migrations reveal **two independently-designed asset hierarchies**, not one:

**Model 1 — "Scope estimator" lineage** (`20260807151202_...sql`):
```
property → project → room → version → change_items / scopes → scope_lines
```
`versions` (110-124) has `before_path text NOT NULL, after_path text`, `version_no` unique per room, `status` default `'draft'`. This is the model used for cost-estimation/scoping and is a strict, linear per-room version ladder.

**Model 2 — "Studio media" lineage** (`20260813181525_...sql`):
```
property_media_assets (source photo) → property_media_versions (edited/enhanced copies)
```
`property_media_assets.property_id` is `ON DELETE SET NULL` (line 4) — an asset **survives** its property being deleted and becomes orphaned-but-not-deleted (an intentional "detach, don't destroy" policy, confirmed by the comment in `storage-cleanup.server.ts:7`: "detaching media from a property only clears `property_id`, it does not delete the source"). `property_media_versions.asset_id` is `ON DELETE CASCADE` (line 33) — versions **do** get deleted if their parent asset is deleted, which is the opposite lifecycle policy from the parent-property relationship one level up. `approved_version_id` on the asset (line 22) is how an asset's "active"/chosen version is selected — a single nullable FK-like column (not FK-enforced at the DB level per the shown DDL) pointing at one `property_media_versions.id`.

**These two models are not merged.** `video_projects.design_version_id` (20260813231541, line 34) references the **Model 1** `versions` table for video generation, while Studio's redesign/staging tools persist through **Model 2** (`property_media_assets/versions`, confirmed by `storage-cleanup.server.ts`'s reference scan treating `versions.before_path/after_path` and `property_media_assets.storage_path` as two separate reference sets, lines 27-33). A design produced in Studio and a design produced via the scope/estimate flow can therefore have **no structural link to each other** even when they depict the same room, unless application code explicitly cross-references them. This is the central architectural ambiguity behind "which version is latest" and "what does this tool's input asset resolve to."

### C2. Immutable vs. overwritable

- `property_media_assets.storage_path` and `property_media_versions.storage_path` are **not overwritten in place** by the reviewed code — `scene-clips.server.ts` and the Studio upload path (`uploadRenderDataUrl`) always write to a **new** path/row per generation; `reconcileClip()` uses `upsert:true` only for its own single completed-clip storage object (idempotent re-download-safe), not for overwriting a prior distinct version. Practically: **source photos and generated versions are treated as immutable once written; "editing" a design creates a new `property_media_versions` row, not a mutation of an existing one.** This matches the credit model (each generation charges once and produces a new artifact) and is a defensible, auditable design.
- The one genuinely mutable/overwritable pointer is `property_media_assets.approved_version_id` — "active version" is a **pointer swap**, not a data copy, which is correct and cheap, but means the same version id may be pointed to, un-pointed, and re-pointed with no history of *which version was active when* unless `presentation_assets`/exports snapshot it explicitly (see C4).

### C3. How each tool picks its input asset / parent references / orphan risk

- Studio Redesign reads the **currently displayed canvas image** (`#cBefore img`) as a data URL, not a storage path or asset id (design-render.functions.ts `Input.image` is `z.string().min(16)`, a raw data URL) — the server function has **no `source_asset_id` field at all**. This means: **the generated result's provenance (which source asset it was rendered from) is not recorded by the render function itself** — any `variation_of`/parent linkage seen in `rd-app-script.ts` (`variation_of: (VAR && VAR.parentPath) || null`, line 3824) is a client-supplied **path string**, not a validated FK, and `renderDesign`'s own Zod schema doesn't even declare/accept `variation_of` (it's absent from `Input`, so if sent it is silently dropped by `.parse()`/stripped since Zod object schemas without `.passthrough()` discard unknown keys) — **the parent-of-a-render linkage that the client believes it's sending is not actually persisted by this handler.** This is a real lineage gap: Confirmed by the schema (design-render.functions.ts:23-46 has no `variation_of` field) versus the call site sending it (rd-app-script.ts:3824).
- Video pipeline is stronger: `scene_clips.source_path` / `source_version` (scene-clips.server.ts `StartParams`, 251-262) are explicit, typed parent references stored on the clip row — a clip's lineage to its source is genuinely durable and queryable.
- Orphan risk: `property_media_assets.property_id ON DELETE SET NULL` (by design) means deleting a property leaves media assets that are still fully stored and billed-for but no longer reachable through any property-scoped UI query unless there's a "detached media" view — **Needs runtime verification** whether such a recovery view exists; if not, these are functionally-orphaned-but-not-deleted assets (safe from data loss, but a UX/storage-cost dead end).

### C4. Deletion of still-referenced files / files left behind

`storage-cleanup.server.ts` is the relevant control: it computes a `referencedPaths()` set from **five** tables (`versions`, `property_media_assets`, `video_scenes`, `scene_clips`, `scene_start_end`, lines 27-49) and only removes a storage object if it's outside all of them **and** older than a 24h grace window (12, 93-95). This is a conservative, correct sweep — but it is **not automatically triggered by every delete operation**; it's an out-of-band cleanup job (`cleanupAbandonedUploads`). Two consequences: (1) a delete of a `property_media_assets` row (e.g. `ON DELETE CASCADE` from `property_media_versions`) removes the DB row but the underlying storage object is only reclaimed **later**, by this sweep, not immediately — acceptable, but means storage cost briefly outlives the DB row; (2) the sweep's reference list must be kept in sync by hand with every new table that stores a path (it currently omits `presentation_assets.url`/`compare_url` and `property_media_exports` outputs from its reference set — if those tables reference the same storage paths by URL rather than bare path, the `add()` filter at line 24 already excludes `https?:`/`data:` URLs from being treated as references at all, meaning **a presentation-referenced signed/public URL would not protect that file from being swept as an "orphan" if it happens to also be an unreferenced bare-path object elsewhere** — Needs runtime verification of whether `presentation_assets.url` ever stores a bare storage path vs. always a resolved URL; if the former, this is a real risk of deleting a file a live public presentation link still needs).

### C5. Do public links lock an exact version? Download fidelity?

`presentation_links` (20260814031824, 24-42) reference a `package_id`, and `presentation_assets.url`/`compare_url` (58-71) are static strings written into the package at build time (`source_id` is a free-text reference, not an enforced FK to `property_media_versions.id`). This means: **a presentation link is a snapshot by construction** — it shows whatever URL was baked into `presentation_assets` when the package was built, not a live "current active version" query — so editing/re-approving a design after a package is published does **not** retroactively change what a shared link shows, which is generally the *safer* behavior for approval workflows (the recipient sees what was actually presented). The flip side: if the underlying storage object were ever deleted (see C4 signed-URL gap) while a link is still live, the presentation would break with no automatic re-resolution, since there's no live FK to re-fetch a fresh URL from.

### C6. Ambiguity of "latest version"

Because of the two parallel models (C1) and because "active" is a mutable pointer (`approved_version_id`) rather than "most recently created," there is **no single, unambiguous definition of "latest version" in the schema**: `property_media_versions.created_at DESC` (its own natural latest) can legitimately differ from `property_media_assets.approved_version_id` (the *chosen* one), and neither necessarily corresponds to whatever `versions.version_no` sequence exists for the same room in Model 1 if a room was also processed through the scope-estimator flow. Any UI or export surface must pick one of {most recent, approved, highest version_no} explicitly and consistently; the DB does not enforce which.

### Recommended canonical lineage model (no schema changes)

Adopt a documented **application-level convention**, enforced in one shared helper module (e.g. `src/lib/asset-lineage.ts`), rather than new tables/columns:

1. Treat `property_media_assets` + `property_media_versions` as the canonical "current design" lineage for anything Studio-generated, and `properties→projects→rooms→versions` as the canonical lineage for anything scope/estimate-generated; add a single lookup helper that, given a room, returns *both* lineages explicitly labeled, instead of letting call sites silently assume one.
2. Standardize "latest" as `approved_version_id` when set, falling back to `MAX(created_at)` among non-`archived` versions — encode this precedence once in a shared `resolveActiveVersion(asset)` function used by every consumer (Studio canvas, presentation builder, exports), rather than each surface re-deriving "latest" independently.
3. Have `renderDesign`/`renderConcept` **accept and pass through** an optional `source_asset_id`/`parent_version_id` string (validated as UUID, not re-plumbed into a new column) purely so that the client-recorded `variation_of` metadata that already exists in `rd-app-script.ts` is not silently dropped by the Zod schema — persist it into `property_media_versions.ops` (already a free-form `jsonb` column, no schema change needed) so lineage becomes queryable after the fact.
4. Extend `storage-cleanup.server.ts`'s `referencedPaths()` reference set to also treat `presentation_assets.url`/`compare_url` as references whenever they contain a bare storage path (not just skip all URL-shaped values), and add `property_media_exports` outputs to the same set, closing the specific sweep gap identified in C4 — this is a code-only change to an existing function, no schema change.

---

## Summary of Confirmed vs. Needs-verification items

**Confirmed (by direct code reading):**
- Charge-before-call / refund-on-failure pattern in `renderDesign`, `renderConcept`, `createAndStartClip`.
- Cancellation is explicitly unsupported and the UI is told not to offer it.
- Batch and video-clip idempotency keys are real and server-enforced; single-photo `renderDesign`/`renderConcept` have **no** server-side idempotency key (client-only double-click guard).
- Progress stages are state-driven, not simulated; the scan animation is decorative.
- Free-daily and paid refund SQL functions lack per-request idempotency markers (defense-in-depth gap, not a confirmed exploited bug).
- Two independent asset/version lineages coexist (`versions` vs. `property_media_assets/versions`) with no structural cross-link.
- `renderDesign`'s Zod schema silently drops the `variation_of` field the client believes it is sending — parent linkage for Studio renders is not actually persisted by that handler.

**Needs runtime/production verification (flagged inline above):**
- Whether a client-abort mid-`renderDesign` leaves a charged-but-unpersisted result server-side.
- Whether stale `video_render_jobs`/clips actually get their credits released by a scheduled sweep, or only get a relabeled status.
- Whether `feature-availability.ts` "hidden" features have independent server-side authorization.
- Whether `presentation_assets.url` ever stores a bare storage path (making it vulnerable to the orphan-sweep gap) vs. always a resolved external URL.
- Live comparison of the `credit_cost` DB table against the two hardcoded `CREDIT_COSTS` literals to confirm no drift has already occurred.
