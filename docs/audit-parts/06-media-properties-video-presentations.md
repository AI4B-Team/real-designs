# Part 6 — Properties, Media, Video/Animation, Presentations & Public Links

Scope: `src/content/rd-property-detail.ts`, `rd-room-photos.ts`, `rd-propmedia.ts`, `rd-media-lib.ts`,
`rd-reveal.ts`, `rd-present.ts`; `src/lib/property-*.ts(.functions.ts)`, `address-modal.ts`,
`photo-classify.ts(.functions.ts)`, `rooms.functions.ts`, `media-library.ts`, `media-view.ts`,
`media-assign.functions.ts`, `media-resume.ts`, `reveal.functions.ts`, `reveal-render.ts`,
`scene-clips.server.ts`, `animate.functions.ts`, `presentations.functions.ts`,
`presentation-packages.functions.ts`, `presentation-publish.ts`, `approval-link.ts`,
`src/routes/p.$token.tsx`, `pkg.$token.tsx`, `v.$slug.tsx`.

Everything below is anchored to file/line evidence gathered by direct reading of the current
source tree. Where enforcement lives inside a Postgres RPC/SQL function that is not part of the
TypeScript surface (e.g. `get_presentation_share`, `respond_to_presentation`), this is stated
explicitly and the claim is labeled **Needs SQL/production verification** rather than asserted.

---

## (a) Properties, Projects, Rooms

### Finding A1 — Room identity is deduplicated by source photo, but only when a source path exists
- Severity: Medium / Confidence: Confirmed
- Impact: Saving a room twice from Studio normally updates the same row instead of forking a
  duplicate room, which is the intended behavior — but the same-name fallback path is weaker.
- Evidence: `src/lib/rooms.functions.ts` `saveStudioRoom` (lines 160–190):
  ```
  const match =
    (siblings ?? []).find((r) => r.source_path && r.source_path === sourcePath) ??
    (siblings ?? []).find((r) => !r.source_path && String(r.name).toLowerCase() === roomName.toLowerCase()) ??
    null;
  ```
- Root cause: When a room has no `source_path` yet (created before a photo was attached), the
  only disambiguator is a case-insensitive name match *within the same project*. Two genuinely
  different rooms both saved as e.g. "Bedroom" before either has a photo will collide into one
  row; the second save silently overwrites the first room's `room_type`/`source_path`.
- Recommended correction: Require a client-generated room key (uuid) at first save, or fall back
  to `(name, sequence)` instead of bare name, so two same-named empty rooms in one project don't merge.
- Phase 2 / Risk of delay: Low-frequency edge case (multiple empty rooms with identical names in
  one project), but silent data loss when it happens. Dependencies: `rooms` schema. Suggested
  tests: create two rooms named "Bedroom" in the same project with no photo yet, save both, assert two rows exist.

### Finding A2 — Uploaded property photos have no de-duplication path; re-uploads always create new rows
- Severity: Medium / Confidence: Confirmed
- Impact: Users who re-select the same files (e.g. after a failed upload, or by re-dragging the
  same folder) get duplicate `property_media_assets` rows and duplicate Media tiles/credits-free
  storage bloat, rather than a merge or a warning.
- Evidence: `src/lib/property-media.functions.ts` `createMediaAssets` (lines 49–63) does a plain
  `.insert(rows)` with no existence check against `storage_path`/`original_filename`/hash. The
  schema does carry a `dup_group` field (`AssetInput.dup_group`, line 42) suggesting a duplicate
  *detection* concept exists for classification, but `createMediaAssets` never queries or enforces
  it before inserting. Compare with `rooms.functions.ts saveStudioVersion` (lines 233–242) which
  *does* dedupe by `after_path` before insert — the same discipline is absent for source photo assets.
- Root cause: Insert-only server function; `dup_group` is populated client-side for display/grouping
  only (in `media-analysis`/upload pipeline, not reviewed in this pass) but is not used as a gate.
- Recommended correction / Phase 2: Before insert, check for an existing asset with the same
  `property_id` + `storage_path` (or `original_filename`+`file_size`) and skip/merge. Suggested
  tests: call `createMediaAssets` twice with identical `storage_path` and assert one row.

### Finding A3 — Deleting a property media asset does not delete its edit history
- Severity: Medium / Confidence: Confirmed
- Impact: `property_media_versions` rows (enhanced/AI-edit/design copies) reference `asset_id`.
  `deleteMediaAssets` (property-media.functions.ts lines 132–144) deletes only from
  `property_media_assets`. There is no corresponding cleanup of `property_media_versions` in this
  file, and no cascade is visible from the TS layer.
- Root cause: No explicit `DELETE ... WHERE asset_id IN (...)` on `property_media_versions`, and
  whether the DB has an `ON DELETE CASCADE` FK is not verifiable from this file.
- Recommended correction / Phase 1: Either add the cascading delete in the same server function
  (so both statements succeed/fail together) or confirm and document a DB-level `ON DELETE CASCADE`.
  Dependencies: DB schema/migrations (not reviewed here — **Needs SQL verification**). Suggested
  test: create an asset, add a version via `addMediaVersion`, delete the asset, assert the version
  row is gone (or confirm it is intentionally retained and surfaced somewhere).

### Finding A4 — `deleteVideo` does not clean up dependent rows either
- Severity: Medium / Confidence: Confirmed
- Impact: `deleteVideo` (`reveal.functions.ts` lines 271–278) issues one delete against
  `video_projects` only. `video_scenes`, `video_variants`, `video_audio`, `video_share_links`, and
  `scene_clips` (from `scene-clips.server.ts`) all reference `video_project_id`. If FKs are not
  `ON DELETE CASCADE`, these become orphaned rows (and, worse, an orphaned `video_share_links`
  token could keep a **public URL reachable** with no owning project — see Finding D-links below).
- Root cause: Same "single-table delete, no explicit cascade" pattern as A3.
- Recommended correction / Phase 1 / Risk of delay: High if a stale share link stays live after
  deletion — a real information-exposure risk, not just table hygiene. **Needs SQL verification**
  of FK `ON DELETE` behavior for `video_scenes`, `video_variants`, `video_share_links`,
  `scene_clips`. Suggested test: create a video with a share link, delete the video, then hit the
  `/v/$slug` (or equivalent) route with the old token and confirm it 404s.

### Finding A5 — Property/project/room reuse ("no forking") is real and consistently applied
- Severity: N/A (positive finding) / Confidence: Confirmed
- Evidence: `createMediaProperty` (property-media.functions.ts lines 269–299) does a case-insensitive
  `ilike` lookup before insert and reuses the first match; `saveStudioRoom` reuses the property's
  first project unless one is named (lines 124–158); `assignMediaToProperty`
  (media-assign.functions.ts) re-validates the target property against `owner_id` server-side
  before repointing rows (lines 33–43) — this is real, not a client-trusted `property_id`.
- No action needed; noted for completeness since the audit brief asked whether duplicate
  properties/projects are created — they are not, by design, for the paths reviewed.

### Finding A6 — Address assignment UX correctly never rewrites a saved project title
- Severity: N/A / Confidence: Confirmed
- Evidence: `address-modal.ts` header copy explicitly states "Adding an address never changes your
  project title" (lines 11, 101) and `AddressModalResult` never returns a title field — the modal
  is deliberately address-only. `assignmentChanged` (line 333) is computed and returned so callers
  can react, but no title mutation code path exists in this file.

### Finding A7 — Property context handoff into Studio/Video relies on an in-memory `setHandoff` object
- Severity: Medium / Confidence: Needs runtime verification
- Impact: If `setHandoff`/`window.__rdGo` navigation loses the in-memory payload (e.g. a full page
  reload between "Design These Photos" and Studio mounting, or a race where Studio boots before the
  handoff is read), the property/room association silently reverts to none, and a design saved from
  that session would go through `saveStudioRoom`'s fallback branch (a brand-new/looked-up property
  by typed address, not the one the user started from).
- Evidence: `src/content/rd-property-detail.ts` `startBuild()` (lines 148–197) builds the handoff via
  `setHandoff({...})` (an external module not opened in this pass) and immediately calls
  `window.__rdGo(...)`. If `setHandoff` returns falsy (`if (!h)`) the code explicitly falls back to
  just opening Media with no property context (line 162–167) — so the failure path exists and is
  handled, but only for one specific failure mode (handoff rejected); a *lost* (not rejected) handoff
  after navigation is not covered here.
- Recommended correction: Runtime test (Playwright) — click "Create A Video" from a Property page,
  confirm the video builder shows the same address before any scene is added. Phase 3 (verification
  task, not necessarily a code change) since the actual `setHandoff`/`video-handoff` modules were not
  in scope for this file set.

### Finding A8 — Photo classification review gating is conservative and does not fabricate certainty
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: `photo-classify.ts` `resolvePhoto()` only marks a room "confirmed" above
  `ACCEPT_CONFIDENCE = 0.7` (line 37); between 0.45–0.7 it is forced to `REVIEW_LABEL` = "Needs
  Review" (lines 149–161) and excluded from "present" category checks (`missingRecommendation`,
  lines 216–219: only `state === "confirmed"` counts as present). This means a low-confidence AI
  guess can never silently pass as a confirmed room type in the missing-photo notice — a real,
  verifiable safeguard, not marketing copy.

### Finding A9 — "Stable" media IDs are prefix-typed, not globally unique across kinds
- Severity: Low / Confidence: Confirmed
- Impact: IDs like `"ver_" + version_id`, `"ast_" + asset_id`, `"vid_" + project_id`, `"job_" + job.id`,
  `"draft_" + draft.id` (media-library.ts lines 152, 240, 202, 263; media-view.ts line 100) are stable
  *within a session* and *for their own row*, which is good for React/DOM keys and for `resumeInputForMedia`
  (media-resume.ts) to route back to the right workflow. However, a render job that has no linked
  video card yet is synthesized as `"job_" + j.id` (media-view.ts line 193) using the *job's own* id,
  not the eventual `video_project_id` — once the project appears, `mergeRenderJobs` correctly merges
  by `video_project_id` (line 183) rather than by the synthetic id, so no duplicate card results, but
  any code holding onto the earlier `"job_"+j.id` identity (e.g. a previously-opened detail panel)
  would not automatically follow the merge. Confidence: Confirmed for the ID scheme; **Needs runtime
  verification** for any UI that caches the pre-merge id across a re-render.

---

## (b) Media Library Architecture

### Finding B1 — Media is a genuine union of five real data sources, not a single table view
- Severity: N/A / Confidence: Confirmed
- Evidence: `loadMediaLibrary()` (`media-library.ts` lines 133–298) merges, in order:
  generated design images from the property tree (`getPropertyTree`, only rows with a `version_id`,
  line 150), generated videos (`listVideos`, video_projects/variants/scenes/shares, line 188),
  uploaded source photos (`listMediaAssets`, line 238), in-flight uploads from the client-side
  upload manager (`UM.listJobs()`, line 258), in-memory pending generations (`listPendingMedia()`,
  line 280), durable drafts (`listProjectDrafts` merged via `mergeDrafts`, line 291) and persisted
  render jobs (`listRenderJobs` merged via `mergeRenderJobs`, line 291). Favorites are a separate
  per-user table referenced from `rd-media-lib.ts` (`isFavorite`/`toggleFavorite`, lines 61–89) keyed
  by `{kind:"media", id}` — i.e. account-scoped, not local-storage.
- Every one of "uploaded sources / generated images / generated videos / pending jobs / favorites /
  property-linked assets" from the audit brief is present and traced to a real backing table or a
  real in-memory registry (`pending` Map, `emitMediaChange` event, lines 26–91) — none of it is a
  hard-coded placeholder.

### Finding B2 — No stretched-thumbnail risk: Media has one card layout, not separate grid/list models
- Severity: N/A / Confidence: Confirmed
- Evidence: `src/styles/rd-media-lib.css` defines a single `.ml-thumb { aspect-ratio: 4/3; }` +
  `.ml-thumb img { width:100%; height:100%; object-fit: cover; }` (lines 201–233), and there is a
  second, structurally identical block for the picker (lines 606–607, `aspect-ratio: 4/3;
  object-fit: cover;`, and modal/detail view lines 993–1003 with the same pattern). `rd-media-lib.ts`
  has no `S.view`/`viewMode` toggle and no distinct list-row template — only tab/status/property/text
  filters (`S.tab`, `S.status`, `S.prop`, `S.q`, `S.sort`, `S.favOnly`, lines 92–107). So the specific
  failure modes named in the brief ("stretched list thumbs", "metadata-derived heights") do not
  apply to this codebase as written — there is only one equal-height card format, uniformly cropped,
  not stretched.

### Finding B3 — Filtering, search and sort are real and centrally shared; grouping is limited to a property dropdown
- Severity: Low / Confidence: Confirmed
- Evidence: `media-view.ts` `filterMedia()` (lines 241–286) implements tab matching (`matchesTab`,
  lines 229–239), status filter, property scope (`all`/`none`/id), free-text search across title,
  property, project, address, city, room, filename, type, status and draft label (lines 257–273),
  favorites-only, and three sort modes (`old`, `name`, `prop`) plus an implicit "new" default (the
  upstream list is already sorted newest-first at `media-library.ts` line 293). There is no
  "group by property" or "group by date" rendering mode in `rd-media-lib.ts` — only a property
  *filter* via `propertyOptions()` (media-view.ts lines 26–49). This matches the brief's ask about
  grouping only partially: filtering by property exists; visual grouping (e.g. section headers per
  property) does not, as far as this file set shows.
- Recommendation: If grouped display is a product requirement, it is not implemented; otherwise no
  action needed. Phase 3 (product decision, not a bug).

### Finding B4 — Multi-select selection order uses a `Set`, which preserves insertion order in JS, but no code path was found that reads that order
- Severity: Low / Confidence: Needs runtime verification
- Evidence: `S.sel = new Set()` (`rd-media-lib.ts` line 102). A `Set` iterates in insertion order in
  standard JS engines, so *if* a caller iterates `S.sel` directly, selection order is stable by
  runtime guarantee. This audit did not locate the consumer of `S.sel` (e.g. a bulk-assign or
  bulk-restyle call) inside the files in scope, so whether the app actually depends on — or discards —
  that order could not be confirmed from this file set alone. Recommendation: trace `S.sel` usage in
  the bulk-action handlers (`openBulkRestyle`, `assignMediaToProperty` callers) to confirm order is
  preserved end-to-end; add a Playwright test selecting items in a defined order and asserting the
  bulk-action payload matches.

### Finding B5 — Pending/failed states are backed by real, persisted work, not fake progress bars
- Severity: N/A / Confidence: Confirmed
- Evidence: In-flight uploads reflect `UM.listJobs()` state machine (`media-library.ts` 258–277)
  with a computed `progress` percentage from `j.uploaded/total`; pending generations are a real
  registry (`addPendingMedia`/`updatePendingMedia`, lines 46–74) that other workflow code (outside
  this file set) is expected to update as generation actually proceeds; render jobs are backed by
  the `video_render_jobs` table (`reveal.functions.ts` `startRender`, discussed in section (c)) and
  motion clips by `motion_clip_jobs` (`animate.functions.ts`). None of the "processing" states in
  Media are client-only animations with no server counterpart in the code reviewed.

### Finding B6 — Source vs. generated is always structurally distinguishable, not just by label
- Severity: N/A / Confidence: Confirmed
- Evidence: Every Media record carries a `type` of `uploaded_image | uploaded_document |
  generated_image | generated_video` (media-library.ts type union, lines 17–18) used for icon
  selection (`TYPE_ICON`, rd-media-lib.ts lines 129–134) and for filter/tab logic (`typeGroup`,
  media-library.ts line 301). A generated design's title always appends its version number
  (`r.name + " v" + r.version_no`, line 157) which an uploaded photo's title never does (falls back
  to filename/room group, line 244).

---

## (c) Video & Animation (REAL REVEAL / Animate)

### Finding C1 — REAL REVEAL's "cinematic camera movement" is a genuine in-browser simulation on a still photo, and the code says so
- Severity: N/A (transparency finding, not a defect) / Confidence: Confirmed
- Evidence: `reveal-render.ts` file header (lines 1–8): "Renders a scene list to a real video file in
  the browser: canvas motion + transitions + captions + disclosure labels ... recorded with
  MediaRecorder. No AI video call." All of `STANDARD_MOTIONS` (lines 47–66) and `EXTERIOR_EFFECTS`
  (lines 78–82) are implemented as deterministic zoom/pan math in `drawMotion()` (lines 370–474) —
  every case (`push`, `pan_left`, `orbit_left`, `approach`, `aerial_reveal`, etc.) is a closed-form
  function of `t` (0..1 progress), not a model call. The code even ships a **user-facing disclosure
  string** for this: `EXTERIOR_DISCLOSURE = "Cinematic camera movement is simulated from still
  photography. This is not actual drone footage."` (line 84–85). This is the correct, honest label
  for a browser-only preview/production path — the deliverable video file is real (MediaRecorder
  output, downloadable), but the "camera motion" inside it is a simulated pan/zoom, not generated video content.

### Finding C2 — "Immersive motion" and "Animate" are genuine server-tracked AI video generation, charged before the provider call
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence:
  - `scene-clips.server.ts` `createAndStartClip()` (lines 269–358): inserts a `scene_clips` row,
    charges credits (`charge(userId, "video", ...)`, line 325) **before** calling the provider,
    refunds once via `refundClipOnce` if the provider call throws (lines 347–356), and stores the
    provider job id for later polling (`reconcileClip`, lines 180–235) which downloads and persists
    the finished MP4 to the `reveal-videos` bucket exactly once (idempotent existence check, line 218).
  - `animate.functions.ts` `startMotionClip()` (lines 87–158): same pattern — insert row, charge,
    call provider (`createProviderJob`), refund-and-mark-failed on any provider error (lines
    149–157). `pollMotionClip()` (lines 162–280) downloads the finished clip once, and **also
    creates a `video_projects`/`video_variants` row** (lines 232–263) purely so the clip appears in
    Media as a normal generated video — a real integration point, not a dead end.
  - Both flows use `google/veo-3.1-lite` (`scene-clips.server.ts` line 13) via the same Lovable AI
    Gateway pattern used elsewhere in the app.
- This directly answers the brief's ask to "state clearly which steps are real generation": scene
  clips and Animate clips are real generation with real jobs; the base Reveal render (per C1) is a
  real video *file* produced by a simulated *camera move*, not an AI video call.

### Finding C3 — REAL REVEAL's render job persists to survive tab close, and stale jobs are refunded, not left charged forever
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: `reveal.functions.ts` `startRender()` (lines 324–444): a live `video_render_jobs` row
  for the same project is reused as-is if not stale (`isJobStale`, lines 353–360, imported from
  `render-providers`), otherwise retired via `retireJob()` (lines 451–467) which refunds credits
  through `creditRelease()`. Immersive-motion scenes are metered per scene *in addition to* the base
  render charge (lines 383–402), and if any per-scene charge fails mid-loop, the code explicitly
  refunds everything already spent (`await refund(userId, spent, ...)`, line 397) before throwing —
  no path leaves a user charged for a render that never started.
- One caveat worth flagging as **Needs runtime verification**: because the actual encode happens in
  the browser (per C1's doc comment) rather than on a worker, the `video_render_jobs` row's ongoing
  `status`/`progress` must be updated by client-side code not in this file set. If the browser tab is
  closed mid-encode, the row will sit at `queued`/`rendering` until `isJobStale` triggers on a later
  call — meaning a user who never returns to that project could have credits parked in "processing"
  limbo until they revisit it (there is no visible background sweeper here). Recommend confirming
  whether a cron/edge function proactively reconciles stale render jobs, or whether reconciliation is
  purely on-demand (as `reconcileUserClips`/`isJobStale` suggest for the clip flows).

### Finding C4 — Standard/immersive/exterior motion vocabulary is consistent between builder and renderer, no button found in this file set that fakes a job
- Severity: N/A / Confidence: Confirmed for files reviewed; Needs runtime verification for full `rd-reveal.ts`
- Evidence: `rd-reveal.ts` is ~8,200 lines and was not read in full (out of scope for a focused pass);
  the entry points from the Property page (`rd-property-detail.ts` `startBuild("video", ...)`,
  lines 168–187) always go through `startVideoBuilder()` from `video-handoff` (not reviewed) before
  any render or clip job is created — i.e. "Create A Video" opens a configuration flow, it does not
  itself create a charge or a job. Whether every button *inside* `rd-reveal.ts`'s multi-step builder
  correctly gates on `startRender`/`startMotionClip`/`createAndStartClip` (rather than any sample
  preview button silently doing nothing) could not be fully confirmed without reading that entire
  file; flagging as an explicit follow-up rather than asserting it is clean.

---

## (d) Presentations & Public Links

### Finding D1 — Two structurally different "presentation" systems exist under one product name
- Severity: Medium (product-clarity / audit-scope risk) / Confidence: Confirmed
- Impact: The audit brief's three concepts ("Quick Approval Link / Presentation / Package") map to
  **two** actual backends, not three, and the naming does not line up 1:1 with the UI's "Presentations" screen:
  1. `presentations` table + `presentations.functions.ts` + `approval-link.ts` + route `/p/$token`
     (`p.$token.tsx`) — a **single saved design/version** deck: `createPresentation` takes one
     `version_id` (lines 104–122), `getSharedPresentation` reads one version's before/after + scope
     lines (lines 162–214), and `approval-link.ts` names this concept "Quick Approval Link"
     (`CREATE_BUTTON_LABEL`, `approvalUrl` → `/p/${token}`, lines 35–80).
  2. `presentation_packages` table + `presentation-packages.functions.ts` + route `/pkg/$token`
     (`pkg.$token.tsx`) — a **multi-asset, multi-section** package with its own comments, activity
     log, access codes and slideshow permissions (`savePackage`, `getSharedPackage`, lines 113–291).
  3. `src/content/rd-present.ts`, the screen the app calls "Presentations" in its own UI copy
     (`PRES_SECTIONS`, "New Presentation" empty state, lines 58–117), is built **entirely** on the
     `presentation_packages` functions (imports at lines 15–22) — it never calls
     `presentations.functions.ts`. It does, however, separately import `buildApprovalEmail` /
     `productionSafeOrigin` from `approval-link.ts` (lines 13–14), so the "Quick Approval Link"
     concept appears to be surfaced somewhere inside the Presentations screen's per-design email flow,
     blending both systems in one UI.
- Root cause: Two independently evolved sharing systems (per-version quick approval vs. multi-asset
  package) were not consolidated; the public-facing route names (`/p/`, `/pkg/`) reflect the split
  but the in-app label "Presentations" does not.
- Recommended correction / Phase 2: Either document this split explicitly for support/product (so
  "a presentation" in a bug report can be triaged to the right table/route), or migrate the Quick
  Approval Link entirely into a package with a single asset if convergence is the goal. Suggested
  test: audit every UI entry point that creates a `presentations` row vs. a `presentation_packages`
  row, and confirm the routes it links to (`/p/…` vs `/pkg/…`) match user expectation.

### Finding D2 — Publishing with zero items is explicitly blocked for packages, and the public page degrades gracefully
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: `presentation-publish.ts` `presentationReadiness()` (lines 43–59) returns
  `canPublish:false`, `isDraft:true`, and `message: EMPTY_MESSAGE` when `validItems().length === 0`;
  `publicPresentationState()` (lines 62–73) separately defines what a *recipient* sees if a
  previously-published deck becomes empty (`RECIPIENT_UNAVAILABLE`, "This presentation is
  temporarily unavailable."). On the actual public package route, `pkg.$token.tsx` independently
  renders "This presentation does not contain any designs yet." when `items.length === 0` (lines
  439–443) — i.e. the zero-item case is handled at both the pre-publish gate and the post-publish
  render, not just one.

### Finding D3 — Shared single-version decks are genuinely version-locked (no drift), package assets are snapshotted at save time
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: `getSharedPresentation` reads a specific `version_id` through `get_shared_presentation`
  RPC keyed by the presentation's fixed `version_id` (set once at `createPresentation`, never
  updated elsewhere in this file) — and design versions themselves are append-only in
  `rooms.functions.ts` (`saveStudioVersion` always inserts a new `version_no`, never updates
  `after_path` on an existing version, lines 254–274). So a Quick Approval Link cannot silently
  start showing a newer edit — it is pinned to the version row it was created against, matching the
  "immutable version locking" requirement. For packages, `savePackage`/`getPackage` store each
  asset's `url`/`compare_url` directly on the `presentation_assets` row (lines 170–182), i.e. a
  snapshot of the storage path at build time, not a live foreign-key join re-resolved to "latest" —
  also non-drifting, **provided the underlying storage object at that path is never overwritten**
  (this audit did not check whether any `runPhotoEdit`/version-save path overwrites a path in place;
  the evidence from `rooms.functions.ts` suggests always-new paths, but this specific guarantee for
  package-asset URLs is **Needs runtime verification**).

### Finding D4 — View counts are incremented on every recipient page load, not deduplicated per visit/session
- Severity: Low / Confidence: Confirmed
- Impact: `view_count`/analytics shown to the owner (`listPresentations`, `listPackages`) will
  overstate genuine distinct visits whenever a recipient refreshes the page, re-opens the same link,
  or a link preview/crawler fetches it (mitigated somewhat by `robots: noindex, nofollow` meta on
  both routes, but that only discourages well-behaved crawlers, not link-preview bots or repeat human refreshes).
- Evidence: `presentations.functions.ts` `getSharedPresentation` unconditionally calls
  `client.rpc("record_presentation_view", { _token: data.token })` on every successful load (line
  173) with no session/cookie/dedup key; `presentation-packages.functions.ts` `getSharedPackage`
  does the same via `record_presentation_share_view` (line 271) on every call, including every
  `unlock()` retry after a wrong access code in `pkg.$token.tsx` (line 318, `getSharedPackage` called
  again). Owner-side preview correctly avoids inflating the count: `getPresentationPackage`
  (`presentations.functions.ts` lines 238–287) and there is no equivalent "owner preview" function
  for packages in this file (the owner uses `getPackage`, a separate authenticated query that does
  not call the view-recording RPC, lines 50–111) — so owner previews are not counted, but repeated
  recipient loads are.
- Recommended correction / Phase 3: If "view count" is meant to represent unique opens, dedupe by a
  short-lived signed cookie or by hashing IP+UA within a time window inside the RPC (SQL change, not
  reviewable from this file set — **Needs SQL verification** of `record_presentation_view`'s current behavior).

### Finding D5 — Anonymous decision attribution has no identity verification; free-text name only
- Severity: Low (expected for a no-login flow, but worth stating plainly) / Confidence: Confirmed
- Evidence: `respondToPresentation`/`decideOnPackage` (both public, no auth middleware) accept an
  optional free-text `name`/`client_name` with no verification (`presentations.functions.ts` lines
  217–231; `presentation-packages.functions.ts` lines 308–321). Anyone holding the link URL (and, for
  packages, the access code if set) can record an "Approved"/"Changes Requested" decision under any
  name they type. This is consistent with a no-login public-approval product design, but it means
  the recorded "who approved" is **not authenticated identity**, only a submitted label — worth
  documenting for any compliance/audit-trail claims the product makes about approvals.

### Finding D6 — Budget/pricing data is deliberately stripped server-side when budgets are not live, in both presentation systems
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: `getSharedPresentation` gates `total_low/total_high/lines` behind
  `checkBudgetsAvailable()` (lines 176–210); `getSharedPackage` filters both `sections` and `assets`
  whose `section_key` is budget-tagged via `isBudgetSectionKey` when budgets are unavailable (lines
  273–289); `getPackage` (owner-side) applies the identical filter (lines 94–101) — so even the
  *owner's own* preview never receives priced data it isn't allowed to have, not just the public one.
  This is real server-side gating, not a client-side hide.

### Finding D7 — Expired/revoked package-link enforcement is entirely inside a Postgres RPC not visible to this review
- Severity: High (unverified security-relevant logic) / Confidence: Needs SQL/production verification
- Impact: `revokePackageLink` sets `revoked:true` on `presentation_links`
  (`presentation-packages.functions.ts` lines 247–257) and `createPackageLink` can set `expires_at`
  (lines 209–244), but **all enforcement** of "is this link still valid" happens inside the
  `get_presentation_share` Postgres RPC called from `getSharedPackage` (line 264) — there is no
  TypeScript-side check of `revoked`/`expires_at` before returning data. This audit's file set does
  not include the SQL migration/function body, so whether an expired or revoked token is actually
  rejected by the RPC (versus merely hidden from the owner's list UI) **could not be confirmed**.
- Recommended correction / Phase 0 (verify before relying on this feature for client confidentiality):
  Locate and review `get_presentation_share` (and `record_presentation_share_view`,
  `get_shared_presentation`, `respond_to_presentation`, `decide_presentation_share`,
  `add_presentation_comment`) directly in the Supabase migrations/functions, and add an integration
  test that: (1) creates a link, (2) revokes it, (3) confirms a subsequent `getSharedPackage({token})`
  call returns an error/blocked state rather than the payload. Same test with an `expires_at` in the past.

### Finding D8 — Owner list/detail queries for packages rely entirely on RLS, with no defense-in-depth `user_id` filter in the query itself
- Severity: Medium / Confidence: Needs verification (RLS policies not in this file set)
- Impact: `listPackages` (`presentation-packages.functions.ts` lines 13–47) and `getPackage` (lines
  50–111) select from `presentation_packages`/`presentation_sections`/`presentation_assets`/
  `presentation_links`/`presentation_comments`/`presentation_activity` with **no `.eq("user_id", …)`
  or `.eq("owner_id", …)` clause** — correctness depends 100% on Postgres RLS policies scoping these
  tables to the signed-in user. Contrast with `assignMediaToProperty`
  (`media-assign.functions.ts` lines 33–43) and `saveVideo` (`reveal.functions.ts` lines 179–189),
  which both **explicitly** re-verify the target `property_id` belongs to the caller before writing,
  i.e. a defense-in-depth pattern that `presentation-packages.functions.ts` does not use for reads.
- Root cause: Reliance on RLS alone for the packages feature's read paths, while other features in
  the same codebase double-check ownership in application code.
- Recommended correction / Phase 1: Either confirm (and keep) strict RLS on all six presentation
  tables listed above with a migration-level test, or add an explicit `user_id` filter to these
  queries as defense-in-depth consistent with the rest of the codebase's pattern. **Needs SQL
  verification** of current RLS policies on `presentation_packages` and its child tables before
  concluding this is safe as-is.

### Finding D9 — The REAL DESIGNS logo has one canonical React component, correctly used on both public share routes, but a second, independent hand-rolled implementation exists for marketing/SEO chrome
- Severity: Low / Confidence: Confirmed
- Evidence: `src/components/brand/RealDesignsLogo.tsx` states in its own doc comment (lines 3–10):
  "Every surface that shows the brand — app shell, public presentation links, emails, exports, PDFs
  — must render this component... Do not re-create the badge with ad-hoc text and letter spacing
  anywhere else." Both public share routes comply: `p.$token.tsx` (lines 4, 56, 215) and
  `pkg.$token.tsx` (lines 4, 68, 424) import and render `RealDesignsLogoResponsive`. However,
  `src/components/seo/SiteChrome.tsx` `BrandMark()` (lines 24–33) independently renders the *same*
  visual mark (`<b>REAL</b><em>Designs</em>` inside a `span`/`i` structure) using its own `rd-mark`
  class rather than the canonical component's `rdl-mark`/`RealDesignsLogo`. This is a second,
  parallel implementation of exactly the pattern the canonical component's comment says must not be
  recreated — a maintenance/drift risk (a rebrand or accessibility fix to `RealDesignsLogo` would not
  propagate to `SiteChrome`'s `BrandMark`), even though it is used on marketing pages rather than the
  authenticated app or the public share links themselves.
- Recommended correction / Phase 3: Replace `SiteChrome.tsx`'s `BrandMark()` with
  `RealDesignsLogo`/`RealDesignsLogoResponsive`, or, if the marketing site intentionally needs a
  different mark treatment, update the canonical component's doc comment to reflect the actual
  scope of the "single source of truth" rule. Suggested test: visual regression snapshot of the
  marketing header vs. the app/public-share header confirming pixel-identical brand mark.

### Finding D10 — Workspace Brand Kit correctly falls back to the canonical mark unless explicitly verified
- Severity: N/A (positive) / Confidence: Confirmed
- Evidence: Both public routes only substitute a workspace's own name/logo when a `verified` flag is
  true: `p.$token.tsx` (lines 128–135) sets `verified: !!brandName` (i.e. only if a brand name was
  actually captured at share-creation time) and the inline comment states "A workspace name only
  appears when it was captured from a verified brand kit at creation time; otherwise the canonical
  REAL DESIGNS mark is shown." `pkg.$token.tsx` (lines 376–382) does the same via
  `settings["brand_verified"] === true`. This prevents an unverified/free-text brand name from
  silently replacing the REAL DESIGNS mark on a public link.

