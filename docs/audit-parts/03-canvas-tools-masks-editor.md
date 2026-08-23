# Part 3 — Canvas Architecture, Design Tool Matrix, Edit Photo, Masking

Scope: `src/lib/canvas-*.ts`, `src/styles/rd-canvas.css`, canvas code inside
`src/content/rd-app-script.ts`, `src/lib/photo-editor*.ts`,
`src/content/rd-photo-editor.ts`, `src/lib/*.functions.ts` for the design
tools, and the masking modules (`mask-engine.ts`, `selection-mask.ts`,
`surface-overlay.ts`, `privacy-blur.ts`, `object-edit-controls.ts`,
`materials-controls.ts`, `declutter-controls.ts`, `markup*.ts`).

All findings are static-analysis (read-only) unless marked "Needs runtime
verification". No production data or credentialed provider access was
available in this session, so provider success/failure and credits ledger
correctness are marked "Unknown without credentials" / "Unknown without
production verification" where relevant.

---

## (a) Canvas architecture

### Finding A1 — There is ONE persistent Canvas shell; tools do not remount the viewport
- Severity: Informational (positive finding) / Confidence: Confirmed
- Impact: this is good architecture — it avoids re-mount flicker, re-loading
  the image, and losing zoom/pan state when switching tools.
- Evidence:
  - `src/lib/canvas-workspace.ts:145-156`: comment block literally titled
    *"one permanent Canvas: the chrome below the image never unmounts"* —
    *"ONE permanent Canvas. The Redesign card, its stage, its overlays and
    its bottom bar stay mounted in every tool."*
  - `activeStage()` (canvas-workspace.ts:524-527): `"There is only ever one
    image viewport, in every tool."` — returns `#rdwStage` unconditionally.
  - `applyZoom()` (canvas-workspace.ts:529-535): `"Zoom is Canvas state, not
    tool state: it survives every tool change."` Sets `--rdw-zoom` CSS var
    and toggles `.zoomed` on the one `#rdwStage` element.
  - `rd-app-script.ts:2593-2664`: a single `#canvas` element has its aspect
    ratio (`setCanvasRatio`) and mode class (`applyCanvasMode`) mutated in
    place; there is no per-tool creation of a new canvas DOM node.
  - Rail/tool switching in `canvas-workspace.ts:710-725` explicitly treats a
    tool switch as a **state change**, not navigation: `"Switching tools is
    a Canvas state change, never navigation."`
- Root cause / design: intentional single-canvas pattern with a `zoom` module
  variable (canvas-workspace.ts:522) and CSS custom property driving
  transform; overlay elements (compare slider `#rdwCmp`, version rail
  `#rdwVersOpen`, crop box, badge) are children of the same stage and share
  its `top/left/width/height/object-fit` via the adoption mechanism below.
- Recommended correction: none needed structurally; see A4 for the one real
  exception (Edit Photo) and A5 for future consolidation recommendation.

### Finding A2 — Edit Photo is adopted INTO the same stage, not a second viewport
- Severity: Informational / Confidence: Confirmed
- Evidence: `canvas-workspace.ts:149-207` (`adoptEditorStage` /
  `releaseEditorStage`):
  ```
  function adoptEditorStage() {
    const stage = document.getElementById("rdwStage");
    const canvas = document.getElementById("canvas");
    const img = document.getElementById("rdpeImg");
    ...
    if (canvas) canvas.hidden = true;
    stage.classList.add("rdw-editing");
    img.classList.add("rdw-editimg");
    stage.appendChild(img);       // editor's own <img> is moved into #rdwStage
    ...
    if (crop) { stage.appendChild(crop); }
    if (badge) { stage.appendChild(badge); }
    if (hold && slot) { slot.appendChild(hold); }   // Hold-to-Compare moved to bottom bar
  }
  ```
  Comment at canvas-workspace.ts:150-154: *"Edit does not build a second
  viewport: the editor's image, crop box and badge are adopted into the
  existing `#rdwStage`, so top, left, width, height, padding, radius,
  object-fit and zoom are literally the same element geometry as Redesign."*
  `closeCanvasPhotoEditor()` (canvas-workspace.ts:251-256) calls
  `releaseEditorStage()` then `applyZoom()`, restoring the generic canvas.
- Technical impact: confirms overlays (crop box, badge) share the exact
  coordinate system as the redesign image because they are literally
  DOM children of the same stage element with the same CSS transform.
- Confidence caveat: this is proven for **badge, crop box, and Hold-to-
  Compare**. It is not proof that every tool's own overlay (mask brush
  canvas, detected-region boxes) is drawn in the same coordinate frame —
  see Finding A3.

### Finding A3 — Overlay coordinate system is a shared *convention* (normalized 0..1), not a shared *renderer*
- Severity: Medium / Confidence: Strongly indicated
- Impact: as long as every tool's canvas-overlay code paints using the same
  normalized-to-source-frame convention against the same stage element, and
  correctly reprojects on resize, alignment should hold. But because each
  tool has its own overlay-painting code path (`declutter-controls.ts`,
  `materials-controls.ts`, `object-edit-controls.ts`, `privacy-blur.ts`),
  correctness after zoom/pan/crop is not centrally enforced — each caller
  must call `mask-engine`'s painter correctly on resize.
- Evidence:
  - `mask-engine.ts:1-22` states it owns *"the single painter that draws a
    mask into any 2D context"* and that normalized points are stored 0..1
    against the *source* frame, not the *rendered/zoomed* frame — implying
    reprojection to the current stage geometry is done by the caller, not by
    the engine itself, at paint time.
  - `markup.ts:9` independently documents the same 0..1 normalized
    convention (`"Every coordinate in this module is normalized to the
    source frame (0..1 on both axes)"`), but `markup.ts` does **not** import
    `mask-engine.ts` or `selection-mask.ts` — it is a wholly separate
    coordinate/geometry implementation that happens to share the same
    convention by manual discipline, not by shared code (see Finding D2).
  - No single file was found that recomputes/repaints *all* active overlays
    (mask brush strokes, detected-region boxes, markup callouts, crop box)
    on a `resize`/zoom event in one place; `applyZoom()`
    (canvas-workspace.ts:530) only sets a CSS variable, so overlay canvases
    that use `<canvas>` 2D context absolute pixel painting (rather than pure
    CSS-percent-positioned DOM elements) must listen for that CSS var change
    themselves and repaint. No such listener was found for the mask overlay
    in `mask-engine.ts`, `object-edit-controls.ts`, `materials-controls.ts`,
    or `declutter-controls.ts` in this pass.
- Recommendation: Needs runtime verification (Playwright): zoom in, draw a
  mask stroke or trigger detected-region boxes in Object Edit/Materials/
  Declutter, zoom out, resize the window, and visually confirm the
  overlay/box positions still align with the underlying image pixels.
  Phase 1, low risk of delay if deferred, but should be verified before any
  claim of "masks stay aligned after zoom/pan" is made in customer-facing
  documentation.

### Finding A4 — Bottom action bar, compare slider and version rail are single shared components, confirmed by code comments
- Confidence: Confirmed
- Evidence: `canvas-workspace.ts:186-190` — Hold-to-Compare "lives in the
  permanent bottom bar, centred between Version History and the tool
  actions. It is never placed on the photo." `setCompare()`
  (canvas-workspace.ts:539-547) manipulates a single `#cRng` range input and
  a single `#rdwCmp` toggle group regardless of active tool.
  Fullscreen (`#rdwFull`, canvas-workspace.ts:681-691) calls
  `stage.requestFullscreen()` on the one `activeStage()` element — fullscreen
  behavior is therefore identical across every tool including Edit Photo.
  Version history toggle (`#rdwVersToggle`/`#rdwVersOpen`,
  canvas-workspace.ts:692-701) persists open/closed state via
  `save({ versionsOpen })` (localStorage-backed `loadWorkspaceSettings`,
  confirmed by `s.versionsOpen` read at init, line 568-575), so it survives
  reloads and tool switches.
- No letterboxing logic specific to any one tool was found: `setCanvasRatio`
  (rd-app-script.ts:2593-2617) sets one `--rd-canvas-ar` CSS custom property
  read by `rd-canvas.css`, applied uniformly.

### Finding A5 — Recommendation: keep the single-Canvas pattern; harden the overlay-repaint contract
- This codebase has **already implemented** the "one persistent Canvas"
  architecture the audit was asked to evaluate against — it is not multiple
  tool-specific canvases needing consolidation. The remaining architectural
  gap is Finding A3: overlay painters (mask brush, detected regions, markup)
  are independent modules that share a *convention* but not a *resize/zoom
  reprojection contract*.
- Recommended single future architecture: introduce one
  `CanvasViewportController` (new, thin, no business logic) that:
  1. Owns `zoom`, `pan`, `stage rect`, and `object-fit` geometry as the only
     source of truth (currently split between `canvas-workspace.ts` module
     state and CSS custom properties).
  2. Exposes a `projectToScreen(normalizedPoint) -> pixel` /
     `projectToSource(pixel) -> normalized` pair.
  3. Emits a single `viewport:changed` event on zoom/pan/resize that
     `mask-engine.ts`'s painter and `markup-render.ts` both subscribe to,
     replacing any ad hoc per-module resize listeners.
  - Phase: 2 (non-urgent hardening, do after shipping features that
    currently work). Risk of delay: low — current visual bugs, if any, would
    only surface at extreme zoom/pan combined with mask drawing, which is a
    narrow interaction. Dependencies: none blocking. Suggested tests:
    Playwright test that zooms to 2x, pans, opens Object Edit, clicks a
    detected region, and asserts the highlighted box bounding rect matches
    the underlying photo pixel region within tolerance.

---

## (b) Design tool functionality matrix

Method: for each tool, the UI call site in `src/content/rd-app-script.ts`
(or `rd-photo-editor.ts`) was matched against the `*.functions.ts` export it
invokes (all confirmed callers found via `rg` in the previous exploration
step — every export below has at least one call site in UI code except
`deleteMarkup`, flagged separately). Provider/credits detection is by
reading the function body's imports of `@/lib/credits.server` and any
hard-coded model identifiers.

| Tool | Visible | Selectable | UI Wired | Server Wired | Provider Wired | Credits Wired | Persists Result | Refresh Safe | Production Ready |
|---|---|---|---|---|---|---|---|---|---|
| Redesign | Yes | Yes | Yes (`rd-app-script.ts` tool rail) | Yes (`renderDesign`, `design-render.functions.ts:101`) | Yes (`MODEL = "google/gemini-2.5-flash-image"`, design-render.functions.ts:48) | Yes (`charge`/`refund` from `credits.server`, line 109) | Yes (version rows) | Needs runtime verification | Working |
| Stage | Yes | Yes | Yes | Yes (`analyzeStageRoom`, `renderStaging`, `checkStagedResult`) | Unknown without credentials (no literal model id found in stage.functions.ts snippet reviewed; charge/refund present) | Yes (credits.server, stage.functions.ts:83) | Yes | Needs runtime verification | Working (pending provider check) |
| Declutter | Yes | Yes | Yes | Yes (`detectClutter`, `renderDeclutter`, `checkDeclutteredResult`) | Unknown without credentials | Yes (declutter.functions.ts:94) | Yes | Needs runtime verification | Working (pending provider check) |
| Materials | Yes | Yes | Yes | Yes (`detectSurfaces`, `renderMaterials`, `checkMaterialResult`) | Unknown without credentials | Yes (materials.functions.ts:103; "One credit per option") | Yes | Needs runtime verification | Working (pending provider check) |
| Edit Photo | Yes | Yes | Yes (`#rdwEditPhotoTool`, canvas-workspace.ts:705-709) | Yes (`runPhotoEdit`, `savePhotoEdit`, `resetPhotoEdit`, `listPhotoEdits`) | Unknown without credentials | Yes (photo-edit.functions.ts:92 for AI ops; explicitly **no credit** for `analyzePhoto`, line 185 "Free — no credit is charged") | Yes (`savePhotoEdit` writes a row) | Needs runtime verification | Working |
| Sketch | Yes | Yes | Yes | Yes (`classifySketch`, `detectSketchPlan`, `renderSketch`, `checkSketchDrift`) | Unknown without credentials | Yes (sketch.functions.ts:151) | Yes | Needs runtime verification | Working (pending provider check) |
| Angles | Yes | Yes | Yes | Yes (`readAngleRoom`, `renderAngleSet`, `scoreAngleView`) | Unknown without credentials | Yes (angles.functions.ts:103) | Yes | Needs runtime verification | Working (pending provider check) |
| Animate/Video | Yes | Yes | Yes | Yes (`startMotionClip`, `pollMotionClip`, `listMotionClips`, `updateMotionClip`, `deleteMotionClip`, `checkMotionClip`) | Unknown without credentials | Yes (job row created "before a single credit is [charged]", animate.functions.ts:8; charge/refund at lines 121, 187) | Yes (`motion_clip_jobs` table, per comment) | Needs runtime verification | Working (async job pattern; pending provider check) |
| Floorplan | Yes | Yes | Yes | Yes (`classifyFloorplan`, `detectFloorplan`, `renderFloorplan`, `checkFloorplanDrift`) | Unknown without credentials | Yes ("Six credits per view", floorplan.functions.ts:137, charge at 151) | Yes | Needs runtime verification | Working (pending provider check) |
| Object Edit | Yes | Yes | Yes (canvas-workspace.ts:710-716 treats it as a normal rail tool) | Yes (`detectObjects`, `renderObjectEditResult`, `checkObjectEditResult`) | Unknown without credentials | Yes ("One masked edit, one credit", object-edit.functions.ts:74, charge at 89) | Yes | Needs runtime verification | Working (pending provider check) |
| Privacy Blur | Partially — only `scanPrivacy` export found | Unknown without runtime check | Partial: `scanPrivacy` called only from `photo-editor.ts`, not from a dedicated Privacy Blur tool row in `rd-app-script.ts` | Only detection wired (`scanPrivacy`, `privacy.functions.ts:13`); **no render/apply server function exists** for Privacy Blur (`privacy.functions.ts` has one export total) | No — nothing to render with | No credit charge found in `privacy.functions.ts` | Unknown | Unknown | **Partially working / UI-only for the apply step** — masking vocabulary exists in `mask-engine.ts` comment ("later Privacy Blur") and `privacy-blur.ts` (402 lines) implements client-side blur logic, but there is no `renderPrivacyBlur`-style server fn to persist a provider-rendered or even server-composited result; treat as **client-side-only / not confirmed to persist** |
| Day to Dusk | Not found as a distinct tool | No dedicated `*.functions.ts` file, no UI string match for "dusk" outside `rd-vfx-looks.ts`/`scene-enhancement.ts`/disclosure copy | UI wiring unclear | No dedicated server function found | Unknown | Unknown | Unknown | Unknown | **Planned / Unknown** — only incidental references (`disclosure.ts`, `rd-firstuse.ts`, `rd-vfx-looks.ts`, `scene-enhancement.ts`); no evidence of an executable Day-to-Dusk render path in `*.functions.ts` inventory. Needs a targeted follow-up search of `rd-vfx-looks.ts` before concluding "Suppressed" vs "Planned". |
| Auto Enhance | Yes (inside Edit Photo) | Yes | Yes (`data-act="autoundo"`, `data-act="batchauto"`, photo-editor.ts:1773,1999) | Yes — client-computed via `autoEnhanceAdjustments()` (`photo-auto-enhance.ts:103`), then persisted through the same `runPhotoEdit`/`savePhotoEdit` path as manual edits | N/A (local histogram math, not a provider call — see (c)) | Shares Edit Photo's credit rule (see (c) for idempotency risk) | Yes | Needs runtime verification | Working |
| Window Balance | Named only inside Edit Photo's AI-ops picklist | Selectable as an Edit-Photo AI op label | Yes — `["window_balance", "Window Balance"]` (rd-photo-editor.ts:42) and `window_balance: "Window Balance"` (photo-edit.functions.ts:20) both map into the same generic `runPhotoEdit` AI-op flow | Yes, via the **generic** `runPhotoEdit` server fn (no dedicated `window-balance.functions.ts`) | Unknown without credentials — depends on whatever provider/prompt `runPhotoEdit` selects for the `window_balance` op key | Yes (shares `runPhotoEdit`'s charge/refund) | Yes (shares Edit Photo save path) | Needs runtime verification | Working (as an Edit-Photo AI op, not a standalone tool) |
| Crop / Geometry | Yes | Yes | Yes (`data-act="cropreset"`, rotation/straighten/flip controls, photo-editor.ts:1851-1895) | N/A — pure client-side transform, persisted via `savePhotoEdit`'s `crop`/`rotation`/`geometry` fields (photo-editor.ts:2463-2470) | N/A (no provider call for geometry) | No credit (non-AI edit) | Yes | Needs runtime verification | Working |
| Other generative enhancements (batch edit) | Yes | Yes | Yes (`batchauto`, photo-editor.ts:1999) | Yes (`batch-edit.functions.ts`) | Unknown without credentials | Unknown without credentials | Unknown | Unknown | Unknown without production verification |

### Finding B1 — `deleteMarkup` export has NO caller in UI code
- Severity: Low / Confidence: Confirmed (for this codebase snapshot)
- Evidence: `rg -l "\bdeleteMarkup\b" src --glob '!**/*.functions.ts' --glob
  '!**/*.test.ts'` returned no results, versus every sibling export in
  `markup.functions.ts` (`listMarkups`, `saveMarkup`) having callers in
  `src/lib/photo-editor.ts`.
- Impact: markup annotations can be created and listed but the server-fn
  path to delete one appears to be dead code, or deletion is implemented by
  some other means not using this export (e.g. optimistic local-only
  delete, or delete-by-overwrite via `saveMarkup`). Needs confirmation
  before deleting the function, since it may be intentionally reserved for
  a not-yet-shipped "delete callout" UI affordance.
- Recommended correction: grep the markup UI code in `rd-photo-editor.ts`/
  `photo-editor.ts` for a delete/remove button on individual markup layers;
  if none exists, either wire it or remove the dead export. Phase 3.
  Suggested test: unit test exercising the UI delete affordance if present.

### Finding B2 — Privacy Blur and Day-to-Dusk are the two clearest gaps between "named in code" and "fully wired tool"
- Severity: Medium / Confidence: Strongly indicated for Privacy Blur,
  Needs runtime verification for Day-to-Dusk (a fuller search of
  `rd-vfx-looks.ts` and `scene-enhancement.ts` was not completed in this
  pass; flagging rather than asserting "Suppressed").
- Impact: if these are surfaced as selectable options anywhere in the
  product's UI copy or marketing, users could select a tool that either has
  no apply/render path (Privacy Blur) or no discoverable implementation at
  all (Day-to-Dusk) in the source inventory searched.
- Recommended correction: Phase 1 triage — confirm via the running app
  (`http://localhost:8080`) whether these appear as clickable tool rows;
  if yes and non-functional, either suppress the UI control or complete the
  wiring. Dependencies: product decision on whether these are unreleased
  features (in which case they should be hidden, not half-wired, per this
  repo's stated engineering conventions of not shipping mocked / demo
  console.log-labeled behavior — see Part 1/2 general findings on Suppressed
  vs Mock-demo classification).

---

## (c) Edit Photo architecture

`src/lib/photo-editor.ts` is 3762 lines / ~146 KB — by far the largest
single module reviewed in this codebase, alongside `photo-editor-context.ts`
(219 lines), `photo-editor-presets.ts` (211 lines), `photo-editor-dialogs.ts`
(104 lines), `photo-auto-enhance.ts`, `photo-edits.functions.ts` (persistence)
and `src/content/rd-photo-editor.ts` (1329 lines, UI shell).

### Finding C1 — No Auto Enhance / Quick Enhance duplication found; one Auto Enhance path
- Severity: Informational / Confidence: Confirmed
- Evidence: `rg` for "quickEnhance"/"Quick Enhance" across
  `photo-editor.ts` and `photo-auto-enhance.ts` returned zero matches; all
  hits are for "Auto Enhance" (photo-editor.ts:233, 1627, 1764, 1773, 1809,
  1999, 2870, 2892, 2936). The audit brief presupposes a possible duplication
  between "Auto Enhance vs Quick Enhance" — this was **not found** in the
  current source; if the product surfaces two visually distinct enhance
  buttons in the running UI, that would be a UI-copy/labeling issue rather
  than a code duplication (Needs runtime verification against the live app
  since this was not confirmed via browser).

### Finding C2 — Auto Enhance idempotency is explicitly engineered, layered on manual adjustments
- Severity: Informational / Confidence: Confirmed
- Evidence: `photo-editor.ts:2048` — *"Measure the untouched image once per
  source: keeps Auto Enhance idempotent."* `photo-editor.ts:2125` — *"Auto
  Enhance is layered on the adjustments the user made themselves"*. The
  "Undo Auto Enhance" button (`data-act="autoundo"`, line 1773) implies Auto
  Enhance's contribution is tracked separately from manual `adj` (confirmed
  by the `autoOps`-style field referenced near line 233 "Applied Auto
  Enhance, and the adjustments it was layered on top of").
- Residual risk (Needs runtime verification): whether re-clicking Auto
  Enhance twice in a row without an intervening manual edit re-applies on
  top of itself (non-idempotent double-apply) or correctly replaces the
  prior Auto Enhance layer — the "measure once per source" comment suggests
  the *measurement* is cached, but does not by itself prove the *applied
  adjustment* is replaced rather than stacked on repeat clicks. Recommend a
  Playwright test: click Auto Enhance twice, compare resulting `adj` values
  or rendered pixel diff against clicking once.

### Finding C3 — `applyAi()` resets crop/rotation/straighten/flip when an AI op is committed
- Severity: Medium / Confidence: Confirmed
- Evidence: `photo-editor.ts:2429-2442`:
  ```
  function applyAi() {
    if (!aiPreview) return;
    const s = st();
    push();
    s.base = aiPreview.image;
    s.aiOps = [...s.aiOps, aiPreview.op];
    s.adj = {};
    s.crop = null;
    s.rotation = 0;
    s.straighten = 0;
    s.flipH = false;
    ...
  }
  ```
- User-facing impact: after running any AI op (e.g. Window Balance, Privacy
  scan-driven edit, or other `runPhotoEdit` ops), all prior non-destructive
  crop/rotation/straighten/flip adjustments the user made are silently
  discarded (reset to defaults) because the AI op's output image (`s.base`)
  is a new baseline raster that no longer corresponds to the old crop/
  rotation geometry. This is *architecturally correct* (you cannot keep an
  old crop rectangle valid against a brand-new base image) but is **not
  obviously communicated to the user** in the reviewed code — no toast/
  confirmation referencing "your crop and rotation will be reset" was found
  adjacent to this function.
- Root cause: single mutable `PhotoState` object where crop/rotation are
  defined relative to `s.base`; there is no separate "crop is preserved by
  reprojection" logic.
- Recommended correction: add a confirmation step or at least a toast when
  `applyAi()` would discard non-trivial existing crop/rotation state (i.e.
  when `s.crop`, `s.rotation`, `s.straighten`, or `s.flipH` are non-default
  at the moment `applyAi()` runs). Phase 2. Risk of delay: low (UX polish,
  not correctness). Suggested test: set a crop + rotation, run an AI op,
  assert a warning/confirmation was shown before the reset, or that state is
  intentionally preserved via reprojection if that becomes the chosen fix.

### Finding C4 — Save Changes vs Save As Copy: both call the same `savePhotoState`, differentiated by an `asCopy` boolean
- Severity: Informational / Confidence: Confirmed
- Evidence: `photo-editor.ts:2444-2470` — `savePhotoState(p, s, asCopy)` is
  the single function backing both `id="rdpeSave"` (`data-act="save"`,
  line 3673/3724) and `id="rdpeSaveCopy"` (`data-act="savecopy"`, line
  3671/3722). It renders (`renderPhoto`), uploads
  (`uploadRenderDataUrl`), then calls `savePhotoEdit()` with
  `asset_key`, `source_path`, `adjustments`, `crop`, `rotation`, `flip_h`,
  and a `geometry` object.
- Whether "Save Changes" **overwrites an immutable source** vs writes a new
  version row is **Needs runtime verification** — the call passes
  `source_path: p.path || p.src || p.key` unconditionally for both save
  modes (only `asCopy` differs, and its downstream branching was not
  captured in the lines reviewed — need to inspect `savePhotoEdit`
  server-side in `photo-edits.functions.ts:90` to see how it decides
  whether to version vs overwrite based on `asCopy`). This should be
  confirmed by reading `photo-edits.functions.ts` around line 90-165 in a
  follow-up pass; flagged here rather than asserted.

### Finding C5 — Reset Photo confirms before calling `resetPhotoEdit`
- Confidence: Confirmed
- Evidence: `photo-editor.ts:2980-2991` — a confirm dialog ("Reset This
  Photo?" / "Reset Photo") gates the call to
  `resetPhotoEdit({ data: { asset_key: p.key } })`. This is a reasonable
  destructive-action guard. Whether "Reset" restores to the **original
  uploaded source** or to the **last saved version** was not confirmed in
  this pass (Needs runtime verification / follow-up read of
  `photo-edits.functions.ts:165` `resetPhotoEdit` body).

### Finding C6 — Edit Photo uses the shared Canvas viewport (see Finding A2)
- Confirmed by Finding A2's evidence; not re-derived here.

### Not verified in this pass (explicitly flagged, not claimed)
- Slider-exposed-but-unsupported or supported-but-unexposed adjustment
  parameters: would require diffing the full slider list in
  `rd-photo-editor.ts`/`photo-editor.ts` against every key read by
  `renderPhoto()`'s pixel pipeline — out of scope for the time available in
  this pass. **Unknown, needs a dedicated follow-up**.
- Accordion scroll ownership and footer overlap: these are CSS/layout
  concerns in `rd-canvas.css` (3209 lines) and would need a rendered
  Playwright screenshot pass to confirm visually; **Needs runtime
  verification**, not confirmed here.
- Download fidelity (does the downloaded file match the on-screen render
  pixel-for-pixel, including any non-destructive adjustment layers):
  **Needs runtime verification**.

---

## (d) Masking / region selection inventory

### Finding D1 — There is already ONE canonical mask engine (`mask-engine.ts`), not several competing ones
- Severity: Informational (positive) / Confidence: Confirmed
- Evidence: `mask-engine.ts:1-22` header comment: *"The canonical masking
  engine for the REAL DESIGNS Canvas... Object Edit, Materials, Declutter,
  and later Privacy Blur, Window Balance, Sky, Lawn and Redesign
  Keep/Replace/Remove... is one problem, so it has one implementation."*
  Confirmed by import graph:
  - `object-edit-controls.ts:51` imports from `@/lib/mask-engine`
  - `materials-controls.ts:34` imports from `@/lib/mask-engine`
  - `declutter-controls.ts:21` imports from `@/lib/mask-engine`
  - `privacy-blur.ts:21` imports from `@/lib/mask-engine`
  - `surface-overlay.ts:16` imports only from `@/lib/selection-mask` (the
    documented "per-tool vocabulary adapter", mask-engine.ts:18-21), which
    is consistent with the intended layering, not a competing engine.
- Model: strokes are normalized polylines (`BrushStroke.points:
  NormalizedPoint[]`, 0..1 on both axes, mask-engine.ts:40-48), detected
  regions carry `box`/`polygon`/`maskPath` plus `id`, `label`, `confidence`
  (mask-engine.ts:50-57). `selection-mask.ts` translates each tool's own
  vocabulary (Declutter's Remove/Keep, Materials' Include/Exclude, Object
  Edit's Add/Erase/Protect) onto the two canonical `SelectionIntent`s before
  handing geometry to `mask-engine.ts` (mask-engine.ts:18-21).
- This directly answers "how many engines": **one** canonical raster/stroke
  engine (`mask-engine.ts`) plus one vocabulary adapter
  (`selection-mask.ts`), and a **separate, independent** annotation engine
  for on-photo callouts/measurements (`markup.ts` + `markup-editor.ts` +
  `markup-callouts.ts` + `markup-measure.ts` + `markup-render.ts`), which is
  a different problem domain (labels/measurements, not pixel masks) and is
  reasonably separate.

### Finding D2 — `markup.ts` shares the normalized-coordinate *convention* with `mask-engine.ts` but not its code
- Severity: Low / Confidence: Confirmed
- Evidence: `markup.ts:9` — *"Every coordinate in this module is normalized
  to the source frame (0..1 on both axes)"* — textually identical
  convention to `mask-engine.ts`'s `NormalizedPoint` — but
  `rg "from \"@/lib/mask-engine\"|from \"@/lib/selection-mask\"" src/lib/markup.ts`
  returns nothing: no shared import.
- Impact: low risk today (both independently correct), but any future
  change to the normalization convention (e.g. switching to a different
  aspect-ratio-aware normalization) would need to be made in two places by
  two different engineers/PRs, with no compiler-enforced link between them.
- Recommended correction: Phase 3 (nice-to-have) — extract the
  `NormalizedPoint` type and the projection helpers into a small shared
  `@/lib/geometry-normalized.ts` that both `mask-engine.ts` and `markup.ts`
  import, so the convention is enforced by the type system rather than by
  a matching pair of comments. Risk of delay if not done: low. No behavior
  change required, purely a refactor — safe to defer indefinitely.

### Finding D3 — Per-tool undo stacks, stable region IDs, and provider hand-off not fully confirmed in this pass
- Severity: Needs runtime verification / Confidence: Needs runtime
  verification
- What was confirmed: `DetectedRegion.id` (mask-engine.ts:50-57) is a stable
  field on the shared type, which *architecturally supports* using the same
  ID for a hover label and a side-panel label if both UI surfaces read from
  the same `DetectedRegion[]` array — but confirming they actually do (vs.
  each independently re-deriving a label) requires tracing the render call
  sites inside `object-edit-controls.ts`/`materials-controls.ts`/
  `declutter-controls.ts`, which was not completed to full depth in this
  pass given the size of those files (853/879/890 lines respectively).
- What was NOT confirmed: (i) whether each tool keeps its own undo/redo
  stack or whether `mask-engine.ts` exposes one shared undo primitive used
  by all three controllers; (ii) whether masks/detected regions are
  rasterized to a real binary mask (per the engine's stated capability,
  mask-engine.ts:14-15) and actually included in the payload sent to
  `renderMaterials`/`renderDeclutter`/`renderObjectEditResult` — this would
  need a body-level read of those three `*.functions.ts` files' request
  payload construction, not just their existence; (iii) accessibility
  alternatives to mouse-drawn masks (keyboard-operable region selection) —
  no evidence searched for or found either way.
- Recommendation: before relying on any claim that "masks reach the
  provider," a follow-up pass should specifically diff the mask payload
  shape produced by `mask-engine.ts`'s rasterizer against the request body
  built in `materials.functions.ts:91` (`renderMaterials`),
  `declutter.functions.ts:81` (`renderDeclutter`), and
  `object-edit.functions.ts:78` (`renderObjectEditResult`). Phase 1 (should
  precede any Phase 2/3 refactor of the mask engine, since it validates the
  most safety/cost-critical property: that credits are being charged for
  operations that actually send the mask, not a full-frame edit by
  accident).

### Recommendation — canonical mask engine already exists; migration order if further consolidation is desired
1. **Do not build a new engine.** `mask-engine.ts` + `selection-mask.ts`
   already satisfy the "one canonical mask engine" goal implied by the
   audit brief; the remaining work is verification (Finding D3), not
   construction.
2. If `surface-overlay.ts` (imports only `selection-mask.ts`, not
   `mask-engine.ts`) turns out on closer reading to paint or rasterize its
   own overlay independently, migrate it to call `mask-engine.ts`'s shared
   painter/rasterizer next — it is the smallest of the five controller
   files (257 lines) and lowest-risk to move first.
3. Only after (1) and (2) are confirmed safe, consider the Finding D2
   refactor (shared normalized-geometry types with `markup.ts`) as a
   low-priority cleanup, since `markup.ts` is a different problem domain and
   carries real migration risk (525+397+296+230 lines across
   `markup-editor.ts`/`markup-render.ts`/`markup-measure.ts`/
   `markup-callouts.ts`) for a purely type-sharing benefit.
4. Do not touch `privacy-blur.ts`, `declutter-controls.ts`,
   `object-edit-controls.ts`, or `materials-controls.ts` migration order
   further — they already import `mask-engine.ts` directly.

---

## Summary of unresolved items requiring follow-up (explicitly not claimed as fact above)
1. Overlay repaint-on-zoom/pan/resize correctness (A3) — Needs runtime
   verification via Playwright.
2. Day-to-Dusk tool existence/wiring (B, matrix) — Needs a dedicated search
   pass of `rd-vfx-looks.ts` / `scene-enhancement.ts` before final
   classification.
3. Privacy Blur apply/persist path — confirm whether `privacy-blur.ts`'s
   402 lines of client logic ever calls a server fn to persist a result, or
   whether Privacy Blur silently only detects (`scanPrivacy`) without an
   apply step reaching storage.
4. `savePhotoEdit`/`resetPhotoEdit` server-side behavior for `asCopy` and
   reset-target semantics (C4/C5) — requires reading
   `photo-edits.functions.ts:90-210` in full, not done in this pass.
5. Mask-to-provider payload verification (D3) — highest-priority follow-up
   given credits-per-operation billing depends on it.
