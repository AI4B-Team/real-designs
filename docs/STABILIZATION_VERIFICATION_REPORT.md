# REAL DESIGNS — Stabilization Verification Report

Date: 2026-08-23 (UTC)
Scope: first architecture-stabilization cycle (Phases 0, 1, 2A, 3)
Verdict: **Pass with observations** — no blocking regression found.

---

## 1. What was verified

A behavioural regression suite was written against the real contracts of the
remediated modules, not against implementation details. It lives in
`src/lib/__tests__/stabilization-regression.test.ts` (62 tests) and covers the
twelve workflow areas of the specification:

| # | Area | Verified behaviour |
|---|------|--------------------|
| 1 | Auth and protected routes | Signed-out users get no available feature and no nav entry; an unauthorized canvas load leaves, a network error stays and offers Retry; 401/403 → `unauthorized`, 404 → `missing`, 5xx → `network-error`; the return destination survives refresh. |
| 2 | Studio intake | Upload, Property, Media, Describe and Explore all produce one draft that lands in Prepare Photos with photos attached; one photo and many photos produce the same shape and order; Add More Photos appends without disturbing per-photo settings; a blob URL is never accepted as a durable path. |
| 3 | Explore → Try This Style | Choosing a style creates a draft, charges nothing and starts no job; the style survives picking a source and adding photos; only one session may claim the handoff; an unknown style id never reaches the draft. |
| 4 | Design workflow | Image Format defaults to Original until the user chooses; a per-photo override wins over the project value; crop is stored normalized, clamped and resettable; Design Style, Direction, Finish Grade and Structure Protection persist; Review renders exactly the snapshot Generate submits and a changed snapshot is refused; deselecting photos never loses them. |
| 5 | Generation | Real work returns a durable result; a double-click cannot spend two credits; a repeated request after success replays free; a failure refunds exactly once and a retry still succeeds; a short balance is refused **before** charging; a partly failed batch reports per-item outcomes and keeps the successes; a job interrupted by a page close returns as a failure with Retry and is never silently restarted; batch creation is idempotent per key; credit costs stay 1 / 3 / 6 / 40 with 5 free per day. |
| 6 | Canvas identity | All tools resolve the same active image for the same selection; handoff never changes which version travels; Download writes the version on screen; with nothing selected the original anchors the canvas; a vanished version raises instead of silently swapping; Version History lists durable versions only; tool capabilities are data-driven; Hold to Compare appears only when there is something to compare. |
| 7 | Photo Editor | Editing a source offers "Save as New Version"; editing an open version offers "Save Changes"; an approved or published version can only branch; an edit never overwrites the immutable original. |
| 8 | Media Library | Search narrows correctly, an empty filter returns everything, every item resolves a human label so cards cannot render blank. |
| 9 | Presentations | An empty presentation cannot be published, copied or sent and states why; one usable design unlocks publish/approve/export; a recipient opening an emptied link sees the unavailable notice, not a broken page; failed and processing items are never published; published items stay pinned to their version. |
| 10 | Feature suppression | Budget, Checkout and API/White Label are unavailable, hidden from nav and refused server-side; a direct route to the Budget view redirects to the dashboard; suppressed markup is removed from the HTML before it reaches the DOM; a still-loading plan never flashes a restricted destination as usable. |
| 11 | Security | Rendered strings are escaped (XSS); remote fetches reject private and loopback hosts (SSRF); uploads are sniffed and content that is not the image it claims is rejected; storage paths are ownership-scoped and traversal is refused. |
| 12 | Duplicate entry | A second canvas open for the same photo is recognised as a duplicate while the first is still loading, and a superseded open token stops being current. |

## 2. Automated results

- Full suite: **103 test files, 1312 passing, 5 skipped, 0 failing.**
- New this cycle: 62 regression tests (previous baseline 1250).
- TypeScript: clean.

## 3. Browser matrix

Chromium, four viewports (1440x900, 1280x800, 834x1112, 390x844), routes `/`,
`/pricing`, `/explore`, `/terms`, `/privacy`, `/app` (signed in).

- No horizontal scroll at any viewport on any route (`scrollWidth == innerWidth` everywhere).
- Every public route returns 200, renders exactly one `<h1>` and a unique, route-specific title.
- No suppressed Budget markup present in any rendered document.
- No page errors on public routes.

## 4. Observations (non-blocking)

1. `/app` logs a React warning: *"Attempted to synchronously unmount a root while React was already rendering."* This is the legacy runtime tearing down a mounted React root inside a render pass — expected friction from the Phase 3 strangler boundary, and the next extraction should move teardown into an effect/microtask.
2. `/app` is very light on server-rendered text because the shell hydrates client-side; acceptable today since it is authenticated and not indexed.
3. Listener cleanup is still partial: the `cleanups` registry added in Phase 3 covers only the extracted presentation list. The audit's ~290 residual listeners remain until further regions are extracted.

## 5. Recommendation

The stabilization baseline holds. The next unit of work should be a further
runtime extraction (which also clears observation 1 and 2), not new feature
work — but that requires separate approval.
