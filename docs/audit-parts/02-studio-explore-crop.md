# Part 2 — Studio Workflow, Explore Handoff, Image Format & Crop

Scope: `src/lib/design-draft.ts`, `staging-design.ts`, `staging-design-ui.ts`,
`builder-step.ts`, `builder-nav.ts`, `studio-nav.ts`, `canvas-session.ts`,
`drafts.functions.ts`, `src/content/rd-studio-start.ts`, `rd-staging.ts`,
`rd-explore.ts`, `studio-style.ts`, `handoff.ts`, `output-ratio.ts`,
`photo-crop.ts`, `crop-frame.ts`, `crop-position-dialog.ts`,
`image-format-ui.ts`, `photo-format-cards.test.ts`, `photo-editor.ts`.

No Playwright run was performed for this part (browser session was not
exercised in this pass); runtime claims below are marked **Needs runtime
verification** and are based on static trace of the code paths only. All
other claims are **Confirmed** by direct file/line evidence.

---

## (a) Studio workflow trace and entry points

### A1. Two structurally different "canonical" flows coexist for one product concept

- Severity: High
- Confidence: Confirmed (static)
- Impact: The code base asserts, in comments, "one canonical draft" and "one
  handoff contract" in three separate places, but there are in fact **two
  independent state machines** doing the same job for two audiences (single
  photo vs. multi-photo), plus a third machine (`design-draft.ts`) that only
  covers the *style-selection* portion of the flow.
- Evidence:
  - `src/lib/builder-step.ts` — a step machine (`add|rooms|design|review`)
    keyed by `keys`/`activeKey`, used by a "canvas" style single-photo flow.
  - `src/lib/builder-nav.ts` — a **second**, differently-named step machine
    (`PHOTO_FLOW = ["review","design","final"]`) with its own
    `normalizePhotoStep` that maps legacy `"add"`/`"canvas"` values into this
    scheme (`builder-nav.ts:42-56`).
  - `src/content/rd-staging.ts` uses `builder-nav.ts`'s vocabulary
    (`goStep("review"|"design"|"final")`, `durableStep(stepState())` at
    `rd-staging.ts:270,280`) while importing `durableStep`/`restoreStep` from
    `builder-step.ts` (different step names: `"add"|"rooms"|"design"|"review"`
    vs. `"review"|"design"|"final"`).
  - `design-draft.ts` has its own third `DraftStep` union:
    `"source"|"photos"|"design"|"review"|"generating"|"complete"`
    (`design-draft.ts:21`).
  - Net effect: **three different enumerations of "what step is the user
    on"** exist in parallel (`DesignStep` in `builder-step.ts`, `PhotoStep` in
    `builder-nav.ts`, `DraftStep` in `design-draft.ts`), each normalizing the
    others' legacy values defensively (`normalizePhotoStep`,
    `restoreStep`), which is itself evidence that they were not unified.
- Root cause: `design-draft.ts` was added later ("the one canonical
  client-side design draft") to own *style* handoff only; the pre-existing
  step machines for the two photo counts were left in place and reconciled
  only through ad-hoc normalization functions rather than a single shared
  step type.
- Recommended correction: Pick one `DesignStep` enum, have `design-draft.ts`,
  `builder-step.ts` and `builder-nav.ts` all import it, and delete the two
  redundant normalizer functions once the step vocabularies agree.
- Phase: 2 (architecture consolidation, not urgent for correctness since the
  normalizers currently cover the mismatch).
- Risk of delay: Low today (defensive normalization prevents breakage), but
  every new feature that needs "current step" must re-derive it three times.
- Dependencies: none blocking; purely internal refactor.
- Suggested tests: unit test asserting `builder-step.durableStep` and
  `builder-nav.normalizePhotoStep` agree on every legal state transition.

### A2. Single-photo vs. multi-photo Photo Design use genuinely different architectures

- Severity: Informational (documented divergence, not necessarily a bug)
- Confidence: Confirmed
- Evidence:
  - Multi-photo path: `rd-staging.ts` (`openStagingReview`) → local `S` state
    object → `staging-design.ts` (`designGroups`, `categoryStatus`,
    `toDirection`) → `staging-design-ui.ts` (HTML string rendering, DOM event
    binding) → `staging-bulk.ts` (`runBulkDesign`) → per-item canvas crop/
    generation loop (`staging-bulk.ts:155-205`).
  - Single-photo path: `canvas-session.ts` — a typed, functional
    `CanvasSession` object (`outputs[]`, `outputById`, `recompute`) used by
    the Canvas/generation panel (`canvas-workspace.ts`, `canvas-actions.ts`,
    not directly reusing `staging-design.ts` at all — no cross-import found:
    `grep` for `output-ratio|photo-crop|crop-position-dialog|image-format-ui`
    inside `canvas-*.ts` and `rd-canvas*.ts` returns **zero matches**).
  - The multi-photo flow has Design Direction / Finish Grade / Structure
    Protection / Shared + per-photo Instructions
    (`staging-design.ts:29-71`, `DESIGN_DIRECTIONS`, `FINISH_GRADES`); the
    single-photo `CanvasSession` model has none of these fields — it has
    `changeLevel: "subtle"|"balanced"|"bold"` and `finishGrade: string|null`
    only (`canvas-session.ts:65-66`), a different and smaller vocabulary that
    does not obviously map onto `DESIGN_DIRECTIONS`/`FINISH_GRADES` ids
    (`refresh|makeover|renovation|reimagine` vs. `subtle|balanced|bold`).
- Root cause: the two flows were built as separate products (single-room
  "Canvas" redesign vs. bulk "Photo Design") and never shared a data model;
  `design-draft.ts`'s explore-style handoff is the only code both flows call
  into.
- Recommended correction: Not urgent to unify UI, but the Design
  Direction/Finish Grade vocabulary used in Review copy should be
  reconciled with `changeLevel`/`finishGrade` so a user who does one photo
  via Canvas and five photos via bulk Photo Design isn't shown two
  unrelated vocabularies for the same concept.
- Phase: 3. Dependencies: none. Suggested tests: none until unified.

### A3. Enumerated entry points into a design/build workflow

All of the following were traced from `rd-studio-start.ts` and
`rd-explore.ts`; each is **Confirmed** reachable in source:

| Entry point | File:Line | Destination |
|---|---|---|
| Studio nav / Create menu → "Design A Space" door | `rd-studio-start.ts:1268-1301` (`doorCard`) | `openSetup("upload"/"cloud"/"property"/"media")` → `openStagingReview` |
| Upload (drag/drop or picker) | `rd-studio-start.ts:332-334` | `openStagingReview({ files, address })` |
| Cloud source | `rd-studio-start.ts` `CONTEXT_CONFIG[...].sources` (referenced `:1486`) | same review entry |
| Property source | `rd-studio-start.ts:1528-1530,1572-1613` (`sourceType:"property"`) | `openSetup("property")` → staging review |
| Media source (existing saved photos) | `rd-studio-start.ts:1650-1666` (`onDesigns`) | `openStagingReview({ photos: media.map(...) })` |
| Describe (text prompt) | `rd-studio-start.ts:47,985-1051,1578-1613` | either an image job or, when `job==="listing-video"` and refs exist, the **video** builder (`:1598-1613`) — i.e. Describe is a fork point between two unrelated builders based on a heuristic (`state.refs.length`) |
| Explore "Try This Style" | `rd-explore.ts:298,460,488-489,603,717` | `startExploreDraft(id)` + `setStudioStyle(id)`, then navigates to Studio |
| Existing design (open a saved draft) | `drafts.functions.ts:getProjectDraft` consumed by `rd-staging.ts:637-718` (`migrateLegacyStagingDraft`) | resumes `openStagingReview` with restored `S.items`, `S.design`, `S.outputRatio` |
| Sample space | `rd-studio-start.ts:1627-1650` (comment: "A genuine sample video project: real photos, real builder") | video builder, not Photo Design |
| Batch (bulk design) | `staging-bulk.ts` / `rd-staging.ts` runBatch | shares the same `openStagingReview` UI, not a separate entry surface |
| Video | `rd-studio-start.ts:1235,1268-1304`, `startVideoBuilder` import (`:41`) | separate builder entirely (`video_project_id`, `VIDEO_FLOW` in `builder-nav.ts`) |

- Severity (for the Describe→video fork specifically): Medium
- Confidence: Strongly indicated (the branch exists; whether the heuristic
  ever misclassifies user intent needs runtime verification)
- Evidence: `rd-studio-start.ts:1596-1613` — "A video built from the
  property's own photos is a listing video and goes to the listing builder,
  never to text-to-video," gated on `state.job === "listing-video" &&
  state.refs.length`. If `state.job` is not set to `"listing-video"` in a
  case the user intended as a listing video (e.g. because
  `details.job` from the description backend defaults to `"image"` at
  `rd-studio-start.ts:1585`), the request silently becomes a still-image
  generation instead of a video, or vice versa.
- Root cause: builder choice is inferred from a backend classification field
  and a ref-count check rather than from an explicit user choice made before
  the describe call.
- Recommended correction: Require the user to pick "Image" or "Video" before
  the describe call resolves the builder, and use `details.job` only to
  validate that choice, not to make it.
- Phase: 2. Risk of delay: user could be charged for the wrong artifact type.
  Dependencies: describe/classification backend contract.
- Suggested tests: Playwright — Describe with `refs.length>0`, verify the
  builder opened matches the button the user actually pressed.

### A4. Legacy/competing flows still reachable

- Severity: Medium
- Confidence: Confirmed
- Evidence: `rd-staging.ts:718` calls `migrateLegacyStagingDraft(...)` on
  load, and `builder-nav.ts:66-69` (`isAddPhotosStep`) and
  `normalizePhotoStep` (`:51-56`) exist specifically to absorb "the removed
  internal Add Photos routes" and legacy step values (`"add"`, `"1"`,
  `"canvas"`, `"review-results"`). This means old drafts created under a
  previous step/flow shape are still being read and reinterpreted at
  runtime — the old flow's data shape is a live, permanently-supported input
  format, not a one-time migration.
- Root cause: no one-time server-side migration was run over `project_drafts`
  rows; the client absorbs the shape drift on every load instead.
- Recommended correction: run a one-time backfill of `builder_step` values
  in `project_drafts` to the current vocabulary, then delete the
  client-side legacy-normalizing branches.
- Phase: 3. Dependencies: DB migration capability (out of scope for this
  read-only audit to execute). Suggested tests: none client-side once
  migrated.

### A5. Where draft state actually lives

- Severity: Informational / High relevance to (b)
- Confidence: Confirmed
- Evidence:
  - **Supabase**, durable, single source of truth for anything that must
    "reopen exactly where the user left off": `project_drafts` table via
    `drafts.functions.ts` (`saveProjectDraft`/`getProjectDraft`). Comment at
    `drafts.functions.ts:6-13` is explicit that localStorage is *only* a
    recovery cache.
  - **localStorage**: `design-draft.ts` (`rd_design_draft_v1`, style +
    workflow step + session ids, `KEY` at line 18) and `studio-style.ts`
    (`rd_style_choice`, `KEY` at line 17) — both are the *style-selection*
    layer, deliberately kept out of the DB draft row.
  - **sessionStorage / in-memory**: `handoff.ts` (`rd.handoff.v1`, plus a
    `mem` module-level variable as a private-mode fallback, lines 32,68).
  - **window globals**: `studio-nav.ts` reads/writes `window.rdStudioHasSource`
    and `window.__rdGo` (`studio-nav.ts:80-91`) to decide/execute navigation;
    `design-draft.ts` dispatches `window` CustomEvents
    (`rd:draft-changed`, `rd:draft-cleared`) that `rd-studio-start.ts:342-346`
    listens for.
  - **In-memory JS object**: the multi-photo flow's entire per-session state
    (`S` in `rd-staging.ts`, e.g. `S.items`, `S.design`, `S.outputRatio`) is a
    closure-scoped object, not React state — it is serialized into the
    Supabase draft row on a 700ms debounce (`ensureSaver`,
    `rd-staging.ts:341-350`) and otherwise lives only in memory.
- Root cause: N/A — this is intentional layering (durable DB row + local
  style cache + navigation guard globals), but it is undocumented as a
  single map anywhere in the code, so a reader must reconstruct it (as done
  here) to know which layer survives what.
- Recommended correction: Non-blocking; consider a single top-level comment
  (e.g. in `design-draft.ts` or a new `docs/` note) enumerating all four
  storage layers and their lifetimes, since three different files each
  claim to be "the one canonical X."
- Phase: 4 (documentation only).

---

## (b) Refresh / persistence matrix

Multi-photo flow only (`rd-staging.ts` + `staging-design.ts`); the
single-photo Canvas flow does not persist most of these fields at all (see
A2) and is noted separately below.

| Field | Persisted where | Survives refresh? | Reaches generation exactly as shown in Review? |
|---|---|---|---|
| Selected photos (`selected`) | `project_drafts.selected` (array of keys), server row (`drafts.functions.ts:44`) | Yes — DB-backed | Yes: `runBatch(items,...)` filters from `S.items` which is restored from the same row (`rd-staging.ts:665`) |
| Photo order (`item_order`) | `project_drafts.item_order` (`drafts.functions.ts:45`, written `rd-staging.ts:301-303`, read `:637`) | Yes | Yes — `ordered()` drives both Review render and the batch array |
| Room classifications (`room`, `room_source`, `confidence`) | `project_drafts.assets[]` (typed Zod fields, `drafts.functions.ts:17-29`) | Yes | Yes — used for `spaceOf()`/`designGroups()` grouping that determines style application |
| Output format (`output_ratio`, `output_ratio_explicit`) | `project_drafts.settings.output_ratio` (generic `z.record` field, not a typed column) (`rd-staging.ts:311-314`) | Yes, but only because `settings` is an untyped JSON blob — **Needs production-data verification**: nothing in `drafts.functions.ts`'s Zod schema validates that `settings.output_ratio` is one of `SUPPORTED_RATIOS`; a corrupted/old value falls back silently via `normalizeOutputRatio` (`output-ratio.ts:79-81`) rather than being rejected at write time |
| Crop positions (per photo) | `project_drafts.settings.rooms[key].crop` (`rd-staging.ts:315-327`), read back through `cropForDraft` (`:673-674`) | Yes, same caveat as above (untyped `settings` bag) | Yes — `runBulkDesign`→`cropToRatio` (`staging-bulk.ts:114-137`) reads `it.crop`/`it.ratio` from the same in-memory items that were restored from `settings.rooms` |
| Selected style (group/per-space) | `project_drafts.settings.design.styleBySpace` (`S.design` saved via `settings.design`, `rd-staging.ts:310`) | Yes | Yes via `toDirection(model, items, ratio)` (`staging-design.ts:339-369`), called with the same `S.design` shown in Review's `reviewStepHtml` |
| Design Direction (`direction`) | `project_drafts.settings.design.direction` | Yes | Yes — `toDirection` maps `model.direction` → `INTENSITY_TEXT`; `directionFromPayload` + `assertDesignState` assert Review-shown value matches payload **in DEV only** (`staging-design.ts:393-407`, gated on `import.meta.env.DEV`) — in production this cross-check is compiled out, so a drift between what Review displays and what generation receives would not be caught by any runtime assertion in prod. **Needs runtime verification** (DEV-only assertion, unverifiable without shipping instrumentation in prod).
| Finish Grade (`grade`) | same `settings.design.grade` | Yes | Same caveat: DEV-only assertion (`staging-design.ts:401-402`) |
| Shared Instructions (`notes`) | `settings.design.notes` | Yes | Yes — `toDirection` includes `notes: (m.notes||"").trim()||null` (`staging-design.ts:365`) |
| Per-photo overrides (style, ratio, crop, notes) | style override: `settings.design.overrides[key]`; ratio/crop: `settings.rooms[key]`; per-photo notes: `settings.design.notesByPhoto[key]` | Yes (same untyped-`settings` caveat) | Style overrides: yes, via `toDirection`'s `styleByPhoto` map (`staging-design.ts:346-350`). Ratio/crop overrides: yes, via `effectiveRatio`/`it.crop` read directly in `runBulkDesign` (bypassing `toDirection` entirely — `toDirection`'s returned payload does **not** carry per-photo ratio/crop, only style). Per-photo notes (`notesByPhoto`): included in `toDirection`'s payload (`staging-design.ts:366`) but **not surfaced anywhere in `reviewStepHtml`** (grep of `reviewStepHtml`/`reviewGroupHtml` in `staging-design-ui.ts` shows only shared `model.notes`, never `model.notesByPhoto`) — see finding B1 below. |

### B1. Per-photo instructions are collected but never shown in Review

- Severity: Medium
- Confidence: Confirmed
- User-facing impact: A user who adds a custom instruction to one photo (via
  whatever UI writes `model.notesByPhoto[key]` — the Design step's
  "Customize Individual Photos" section, `staging-design-ui.ts:164-191`,
  only exposes style customization and "Use Group Style" reset, with no
  per-photo notes textarea actually wired in the current `overridesHtml`)
  has no way to see, in Review, "generation uses exactly the Review-displayed
  values" for that field, because the field is never displayed at all,
  though it is defined in the model (`staging-design.ts:96`,
  `normalizeDesignModel`) and sent to generation (`toDirection`,
  `staging-design.ts:366`).
- Evidence: `staging-design.ts:29-116` defines `notesByPhoto`; `toDirection`
  forwards it (`:366`); `staging-design-ui.ts` `reviewStepHtml`/
  `reviewGroupHtml` (`:353-451`) never reference `notesByPhoto`; `overridesHtml`
  (`:164-191`) has no textarea/UI to set it either — so it is dead state with
  no producer or consumer UI, only a pass-through field, **unless** another
  file writes `model.overrides`/`model.notesByPhoto` that this audit did not
  search (a targeted follow-up grep for `notesByPhoto` across `src/` would
  confirm whether any UI ever sets it — not run in this pass, flagged as
  **Needs runtime verification**).
- Recommended correction: either wire a per-photo notes control into
  `overridesHtml`/Review, or remove the field to stop it being silently sent
  to generation as always-empty.
- Phase: 2. Risk of delay: low (dead code, not incorrect behavior) unless a
  hidden writer exists, in which case Review is misleading (Medium risk).
- Suggested tests: `rg -n "notesByPhoto" src` to find all writers; Playwright
  check that any UI claiming "add instructions to this photo" appears in the
  Review summary.

### B2. Design Direction/Finish Grade Review-vs-generation parity check is dev-only

- Severity: Medium
- Confidence: Confirmed
- Evidence: `staging-design.ts:393` — `const DEV = typeof import.meta !==
  "undefined" && import.meta.env && import.meta.env.DEV;` and
  `assertDesignState` returns `true` unconditionally when `!DEV` (`:396`).
  The three call sites that exist specifically "so Review, the saved draft
  and the request must agree before spending" (`rd-staging.ts:1704,1709`)
  are therefore no-ops in production builds.
- Root cause: the safety net for this specific class of bug (UI/draft/
  payload drift) was implemented as a dev warning, not a build-time test or
  a production-safe invariant.
- Recommended correction: move the equivalent check into a unit test that
  runs `toDirection` against `readDesignSelection`-shaped fixtures for every
  `DESIGN_DIRECTIONS`/`FINISH_GRADES` id, so the guarantee holds without
  relying on `DEV` at runtime.
- Phase: 1 (cheap, protects against silent regressions in billed generation
  requests). Dependencies: none. Suggested tests: exactly the unit test
  described above; also add to `photo-format-cards.test.ts`-style
  vitest suite.

### B3. Single-photo Canvas flow has none of this persistence surface

- Severity: Informational (documents scope of A2 for part (b))
- Confidence: Confirmed
- Evidence: `canvas-session.ts` has no `localStorage`/`saveProjectDraft`
  calls at all (module is a pure in-memory reducer-style model: `createSession`,
  `patch`, `recompute`); persistence for the single-photo flow must happen
  entirely in whatever calls this module (`canvas-workspace.ts`,
  `canvas-actions.ts` — not in this part's scope to fully trace). No Image
  Format or Crop Position selection exists in this model at all (no
  `outputRatio`/`crop` fields in `CanvasSession`, `canvas-session.ts:51-74`),
  so questions (b) about output format/crop persistence are **not
  applicable** to single-photo Canvas as currently built — a real behavioral
  gap versus the multi-photo flow, not merely a documentation gap.
- Recommended correction: decide, as a product question, whether single-photo
  Canvas is intended to ever support non-Original Image Format/crop; if yes,
  it needs the same `output-ratio.ts`/`photo-crop.ts` primitives wired in.
- Phase: 3.

---

## (c) Explore → Studio "Try This Style" handoff

### C1. Style id storage is draft-scoped, not leaked to unrelated projects — confirmed by design, but the previous learnable id survives outside the draft

- Severity: Low
- Confidence: Confirmed
- Evidence: `startExploreDraft` (`design-draft.ts:131-146`) always allocates
  a brand-new draft id (`newId()`) and never reuses an existing one, so a new
  Explore pick cannot silently attach to a stale in-progress project's draft
  row — comment at `design-draft.ts:126-130` states this explicitly and the
  code matches. **However**, `studio-style.ts`'s `rd_style_choice` key
  (`KEY = "rd_style_choice"`, line 17) is a **separate, single global
  slot**, not scoped to a draft id at all. `setStudioStyle` (`:54-85`) is
  called both from Explore (`rd-explore.ts:489`) and, per its own doc
  comment, is read by "Studio... on mount" (`studio-style.ts:4-8|89-99`)
  independent of which draft is currently open. If a user opens Property A's
  in-progress draft after having pressed "Try This Style" for a different,
  unrelated Property B design, `getStudioStyle()`/`applyStudioStyleToControls`
  could reapply Property B's style choice into Property A's Studio controls,
  because nothing in `applyStudioStyleToControls` (`:114-137`) checks
  `draftId`/`propertyId` before writing into the live `#fStyle` select.
- Root cause: two parallel style-storage mechanisms exist —
  `design-draft.ts`'s draft-scoped `selectedStyleId`/`claimedBy` pair (which
  *is* scoped correctly, via `claimDraftStyle(sessionId)` at
  `design-draft.ts:186-194`) and `studio-style.ts`'s unscoped
  `rd_style_choice` (which is not). It is not proven in this static pass
  whether `rd-studio-start.ts` actually consumes `getStudioStyle()` for
  cross-draft reapplication versus only ever reading it once at
  first-mount before a draft is chosen — that ordering question is the crux
  and needs a runtime check.
- Confidence caveat: **Needs runtime verification** for the actual leak (the
  storage-shape hazard is Confirmed; whether it manifests as a real leak
  depends on call order in `rd-studio-start.ts`, which was only partially
  traced — the `rd:style-selected` listener at `rd-studio-start.ts:342-344`
  re-applies on every style-selected event, which fires whenever
  `setStudioStyle` is called from *any* draft context, which is consistent
  with a cross-draft leak risk).
- Recommended correction: fold `studio-style.ts` into `design-draft.ts`'s
  already-scoped `claimedBy`/`selectedStyleId` mechanism, or make
  `rd_style_choice` carry and be checked against the active draft id the
  same way `claimDraftStyle` does.
- Phase: 1 (data-integrity/billing-adjacent: an unwanted style silently
  applied to the wrong property could lead to an unwanted generate+charge if
  the user doesn't notice before pressing Generate).
- Dependencies: none. Suggested tests: Playwright — open Explore, pick style
  A, navigate to Studio, switch source to Property B's existing draft
  (different property), assert the Design step for Property B does not show
  style A pre-selected.

### C2. Ordering vs. control mount: "explore" style could be lost if Studio controls aren't mounted yet

- Severity: Low
- Confidence: Confirmed (defensive code proves the race is anticipated, not
  necessarily unhandled)
- Evidence: `applyStudioStyleToControls` returns `false` and does nothing if
  `document.getElementById("fStyle")` is not present yet
  (`studio-style.ts:117-118`), and `rd-studio-start.ts:342-344` listens for
  `rd:style-selected` to reapply — but that listener only fires on a fresh
  `setStudioStyle` call, not on a later mount of `#fStyle` after a
  navigation. If the DOM node mounts after the event already fired (e.g.
  Explore → Studio route transition faster than the event delivery, or
  slower DOM construction), the style choice is stuck in localStorage but
  never mirrored into the visible control until some other trigger reads
  `getStudioStyle()` explicitly.
- Root cause: event-driven mirroring with no re-check on mount completion.
- Recommended correction: call `applyStudioStyleToControls()` unconditionally
  once from Studio's own mount lifecycle (not only from the event listener),
  which the code may already do elsewhere — **Needs runtime verification**
  (not traced beyond the two call sites found by grep).
- Phase: 3. Suggested tests: Playwright — throttle CPU/network, do
  Explore→Studio transition, assert style select shows correct value after
  mount settles.

### C3. Project-type compatibility is checked, but only against the catalog, not against the destination project's actual type

- Severity: Low
- Confidence: Confirmed
- Evidence: `draftStyle()` (`design-draft.ts:156-166`) re-validates the style
  still exists in the catalog and returns its `compatibleProjectTypes`, but
  nothing in `design-draft.ts` or `studio-style.ts` cross-checks that list
  against the actual `spaceType`/`projectType` of the destination the user
  ends up in (e.g. an interior-only style handed off, then the user picks an
  "exterior" source in Studio). `pruneIncompatible` in `staging-design.ts`
  (`:161-188`) performs this check, but only for the **multi-photo** flow's
  per-space style assignment, at Design step time — not for whatever style
  the single-photo Canvas flow received via `claimDraftStyle`.
- Root cause: compatibility enforcement exists in one flow
  (`staging-design.ts`) and not in the shared handoff layer
  (`design-draft.ts`), so protection depends on which flow the user lands in.
- Recommended correction: move the "does this style fit this space" check
  into `claimDraftStyle`/`draftStyle` so both flows get it uniformly.
- Phase: 2. Suggested tests: unit test `claimDraftStyle` returning null/
  requiring re-pick when the claimed space is incompatible.

### C4. Legacy upload detour

- Severity: Informational
- Confidence: Needs runtime verification
- Evidence: `builder-nav.ts:65-69`'s `isAddPhotosStep`/comment "the removed
  internal Add Photos routes, which now bypass to Studio" indicates a
  legacy "Add Photos" page used to exist as a distinct step before Studio
  became the universal source picker. Whether any residual route/component
  for that old page is still reachable (e.g. a stale deep link or
  bookmark using `#step=add`) was not verified by loading the running app;
  the normalizer functions (`normalizePhotoStep`, `isAddPhotosStep`) suggest
  the old *value* is still accepted as input, which is a exactly the
  "legacy detour still reachable via old links/drafts" pattern, though the
  destination is the current Studio, not a defunct standalone page.
- Recommended correction: none needed if the normalizer is the only
  remaining trace; confirm no standalone `/add-photos`-style route exists
  (`rg -n "add-photos\|AddPhotos" src/routes` — not run in this pass).
- Phase: 4.

### C5. Duplicate draft creation / unexpected generate-and-charge paths

- Severity: Confirmed-mitigated (documenting the mitigation, not a bug)
- Confidence: Confirmed
- Evidence: Several explicit guards exist against duplicate charges:
  `drafts.functions.ts:34-35` — draft `id` is client-generated so "a
  rerender can never create a second draft"; `rd-staging.ts:2475-2477` —
  idempotency key derived from `draftId + item keys + generatePress`
  specifically so "a double click, a resubmit or a remount never creates a
  second job set"; `rd-staging.ts:2467` — `S.busy` guard, "one batch at a
  time... a second click can never charge"; `design-draft.ts` comment
  (lines 12-13) — "Selecting a style here never generates anything and
  never charges a credit: only the final Generate action creates jobs,"
  matched by the fact that `setStudioStyle`/`startExploreDraft`/
  `claimDraftStyle` never call any generation function (confirmed by
  absence of generation-function imports in `design-draft.ts` and
  `studio-style.ts`). No path was found in this pass where selecting an
  Explore style, switching source, or reopening an existing draft directly
  triggers `runBatch`/`runBulkDesign`/`createSession` — all such calls are
  gated behind explicit user "Generate"/"Next: Review"→Generate actions.
- No correction needed; documented as a control that should be preserved
  when C1/C2/C3 above are fixed (their fixes must not remove the `S.busy`/
  idempotency-key guards).

---

## (d) Image format, crop and geometry inventory

### D1. Three independent crop coordinate systems exist, not one canonical model

- Severity: High
- Confidence: Confirmed
- Impact: Despite `photo-crop.ts`'s doc comment describing itself as "the"
  crop placement model and `crop-frame.ts`'s doc comment describing itself
  as owning "every number that makes [the interaction] honest," there are
  **three separate, non-interoperable crop representations** in the code
  base:
  1. `photo-crop.ts` — `Crop = { x, y, scale }`, a **focal-point + zoom**
     model, 0..1 normalized to the *source image*, independent of pixels
     (`photo-crop.ts:13-15`). Used by the multi-photo flow: `rd-staging.ts`
     (`it.crop`, lines 1290-1355), `crop-position-dialog.ts` (the
     "Reposition Photo" dialog, using `clampCrop`/`normalizeCrop` directly
     from `photo-crop.ts`, not from `crop-frame.ts`), `image-format-ui.ts`
     (`isCustomCrop`), and baked into pixels by `staging-bulk.ts:114-137`
     (`cropToRatio`) before generation.
  2. `crop-frame.ts` — `CropState = { ratio, frame:{x,y,width,height},
     offsetX, offsetY, scale, focalX, focalY }`, a **stationary-frame,
     draggable-photo, CSS-pixel** geometry engine (`crop-frame.ts:16-28`)
     with its own independent clamp math (`clampOffset`, `minCoverScale`,
     `cropBounds`-equivalent logic) that duplicates, in a different
     coordinate space, what `photo-crop.ts`'s `cropBounds`/`clampCrop`
     already do. It converts to a normalized rect via `cropRect()`
     (`:96-108`), which returns `{x,y,w,h}` — a **rectangle**, not a
     focal point + scale.
  3. `photo-editor.ts` — its own `Crop = { x, y, w, h, ratio }` type
     (`photo-editor.ts:211`), populated from `crop-frame.ts`'s `cropRect()`
     output but stored and persisted (via `photo_edits`,
     `savePhotoEdit`/`listPhotoEdits`) as a **rectangle**, structurally
     different from both `photo-crop.ts`'s `{x,y,scale}` and from what a
     generation payload for staging expects. This editor is used by
     Media Library / Property Media / general photo editing
     (`rd-media-lib.ts`, `rd-propmedia.ts`, `rd-photo-editor.ts`,
     `active-image.ts`, `canvas-workspace.ts`, `canvas-actions.ts` all import
     `photo-editor.ts` — confirmed by grep), i.e. it **is** reachable from
     the Canvas workspace, so a photo touched via "Adjust/Crop" inside the
     Canvas editor produces a crop value in a third format that the
     multi-photo Photo Design pipeline (`photo-crop.ts`/`staging-bulk.ts`)
     cannot consume without conversion, and no conversion function between
     `{x,y,w,h,ratio}` and `{x,y,scale}` was found in this pass.
- Root cause: three features were built at different times (bulk Photo
  Design reposition dialog, a lower-level draggable-frame geometry engine,
  and a full-screen non-destructive photo editor) each needing "crop," and
  each implemented its own math and its own storage shape instead of
  standardizing on one.
- Real default vs. UI default: `output-ratio.ts:69`
  (`DEFAULT_OUTPUT_RATIO = "original"`) and `photo-crop.ts:15`
  (`DEFAULT_CROP = {x:0.5,y:0.5,scale:1}`, centered/no-op) agree with each
  other and with the UI default (`IMAGE_FORMAT_CARDS[0].id === "original"`,
  `output-ratio.ts:37`) — **no default mismatch found** for the multi-photo
  flow specifically. `photo-editor.ts`'s crop default was not traced in this
  pass (file is 3762 lines; only crop-relevant lines were sampled) —
  **Needs runtime verification** whether its default agrees.
- Normalized vs. pixel coordinates: `photo-crop.ts` and `crop-frame.ts`'s
  final `cropRect()` output are both 0..1 normalized (compatible in *range*
  but not in *shape* — point+scale vs. rectangle); `crop-frame.ts`'s
  internal working state (`frame`, `offsetX/Y`) is CSS pixels, converted to
  normalized only at the boundary (`cropRect`, `focalOf`). This means any
  code that wants to compare a `crop-frame.ts` state to a `photo-crop.ts`
  value must go through an undocumented, unimplemented conversion.
- Drag/zoom/clamping: both `photo-crop.ts` (`cropBounds`/`clampCrop`) and
  `crop-frame.ts` (`clampOffset`/`minCoverScale`) independently implement
  "never show empty space at the edge" — the same invariant, proven twice,
  in two different coordinate systems, doubling the surface area for a
  clamping bug to be fixed in only one place and not the other.
- Persistence: multi-photo crop → `project_drafts.settings.rooms[key].crop`
  (untyped JSON, see B-table above); `photo-editor.ts` crop → `photo_edits`
  table via `savePhotoEdit`/`listPhotoEdits` — two entirely separate
  persistence destinations for "the crop of a photo," so the same photo
  could carry two different, unsynchronized crop records depending on which
  editor last touched it.
- Whether crop/format reaches generation and output dimensions match: for
  the multi-photo flow, **yes** — traced end-to-end: draft → `it.crop`/
  `it.ratio` → `cropToRatio` canvas draw at the exact target aspect
  (`staging-bulk.ts:114-137`, `out.width/out.height` set to the ratio-
  derived `w`/`h`) → sent as the generation source image, so the
  *input* image sent for generation does match the selected Image Format's
  aspect ratio. Whether the **AI generation backend's own output** is
  guaranteed to preserve that exact aspect ratio (rather than the model
  producing a slightly different pixel size) was **not verifiable** in this
  static pass — that is a backend/model contract, not client code, and is
  explicitly out of scope without a runtime generation call
  (**Needs production-data verification**).
- Recommended correction (ONE canonical crop model, not implemented here as
  instructed): Standardize on the **focal-point + scale** model
  (`photo-crop.ts`'s `{x, y, scale}`), because (1) it is resolution- and
  frame-shape independent by construction, (2) it is already the model that
  reaches generation for the flow that actually charges credits, and (3) it
  is the smallest, easiest representation to persist as JSON and to migrate
  `crop-frame.ts`/`photo-editor.ts` onto by wrapping their pixel-space
  interaction with a single conversion boundary
  (`cropRect`→ derive `{x,y,scale}` at commit time instead of persisting the
  rectangle). `crop-frame.ts` should remain purely as the *drag/zoom
  interaction engine* (it already produces `focalX/focalY` and `scale`,
  which map directly to `photo-crop.ts`'s shape) but should stop being a
  second source of truth by never persisting its own `CropState`/rectangle —
  only ever emitting a `{x,y,scale}` value at save time. `photo-editor.ts`
  should be updated to write that same shape into `photo_edits` (or,
  better, into the same `settings.rooms[key].crop` location) instead of its
  own `{x,y,w,h,ratio}`.
- Phase: 2 (behavioral risk is currently contained because the two systems
  don't yet write to the same table, but any future feature that tries to
  show "this photo's saved crop" across both Media Library and Photo Design
  will hit this immediately).
- Risk of delay: Medium — grows every time a new surface needs "crop."
- Dependencies: `photo_edits` schema, `project_drafts.settings` shape (no
  DB migration strictly required if the conversion happens at the app
  boundary, since both are untyped JSON columns).
- Suggested tests: a new shared unit test asserting
  `toFocalScale(cropRectFromCropFrame(state)) ≈ manuallyEnteredFocalScaleCrop`
  for a battery of frame/zoom/drag combinations, once the conversion helper
  exists.

### D2. Image Format primary-ratio list omits `"original"`, creating an inconsistent "custom" badge condition

- Severity: Low
- Confidence: Confirmed
- Evidence: `isPrimaryRatio` (`output-ratio.ts:75-77`) checks membership in
  `IMAGE_FORMAT_CARDS`, which **does** include `"original"`
  (`output-ratio.ts:37`), so `isPrimaryRatio("original")` is `true`. But
  `PRIMARY_OUTPUT_RATIOS` (`:26-30`, described as "the three buttons the
  video-parity header is allowed to show") deliberately excludes
  `"original"`. Both constants are named similarly ("primary ratios") but
  serve different purposes and have different membership — a future
  maintainer reusing `PRIMARY_OUTPUT_RATIOS` where `IMAGE_FORMAT_CARDS`/
  `isPrimaryRatio` was intended (or vice versa) would silently mis-render
  the "Original" state as "Custom."
- Root cause: naming collision between two constants with different
  membership rules and no shared type/comment cross-referencing them.
- Recommended correction: rename `PRIMARY_OUTPUT_RATIOS` to something like
  `VIDEO_HEADER_RATIOS` to remove the naming collision with
  `isPrimaryRatio`/`IMAGE_FORMAT_CARDS`.
- Phase: 4. Suggested tests: none required beyond the rename.

### D3. Per-photo ratio override bypasses `toDirection`'s payload but per-photo style does not

- Severity: Medium
- Confidence: Confirmed
- Evidence: `staging-design.ts`'s `toDirection` (`:339-369`) builds a
  payload with `styleBySpace`/`styleByPhoto` explicitly, but has no
  `ratioByPhoto`/`cropByPhoto` fields at all — the top-level `outputRatio`
  parameter is the only format information in the returned object
  (`:367`). Per-photo ratio/crop overrides are instead read directly off
  the live `it` object inside `runBulkDesign`/`cropToRatio`
  (`staging-bulk.ts:173-174`), completely independent of the `direction`
  object produced by `toDirection`. This means the object that
  `assertDesignState`/`directionFromPayload` treat as "the generation
  request" (`rd-staging.ts:1708-1709`) is **not actually the full
  generation request** — per-photo format/crop is applied through a
  parallel, unaudited path that the dev-only consistency assertion never
  looks at.
- Root cause: `toDirection` was designed to carry style/direction/grade/
  notes only; format/crop were added to the per-item objects later and
  wired straight into `runBulkDesign` instead of being folded into the same
  payload object.
- Recommended correction: extend `toDirection`'s return value to include a
  `ratioByPhoto`/`cropByPhoto` map (mirroring `styleByPhoto`), and have
  `runBulkDesign` read from that payload rather than from `it.ratio`/
  `it.crop` directly, so there is exactly one "generation request" object
  and the existing (currently DEV-only, see B2) assertion can be extended to
  cover format/crop too.
- Phase: 2. Risk of delay: Medium — any future bug in how `it.crop`/
  `it.ratio` are populated on the live item objects (e.g. from a stale
  reference, or a race with the crop dialog's `onSave`) would not be caught
  by the existing Review/generation-parity assertions, because those
  assertions don't inspect format/crop at all.
- Dependencies: none. Suggested tests: extend `photo-format-cards.test.ts`
  (or a new test file) to assert that the object passed into
  `runBulkDesign`'s crop step for each photo matches the ratio/crop shown in
  `reviewGroupHtml`'s per-photo caption line (`staging-design-ui.ts:369`,
  which already renders `fmt`/`custom` labels from `ctx.photoFormat`/
  `ctx.photoCustomCrop` — confirming Review *does* display these per-photo
  values, making the lack of a payload-level assertion for them more
  notable).
