# Incremental Componentization Guide

How the ~14,000-line imperative runtime in `src/content/rd-app-script.ts` is
decomposed, one region at a time, without a rewrite. Phase 3 of the
architecture remediation plan.

## 1. Runtime responsibility map

`src/content/rd-app-script.ts` currently owns nineteen distinct
responsibilities. Line numbers move as regions are extracted; the ownership
column is what matters.

| # | Region | Owner today | Extraction risk |
|---|--------|-------------|-----------------|
| 1 | Bootstrap / init guard | legacy | high (touches everything) |
| 2 | Routing and view switching | legacy + `features/registry` | medium |
| 3 | App shell (sidebar, topbar, menus) | React (`features/app-shell`) | done |
| 4 | Feature availability and gating | React (`features/registry`) | done |
| 5 | Search metadata index | legacy | medium (reads many regions) |
| 6 | Dashboard cards and onboarding | legacy | medium |
| 7 | Properties and rooms | legacy | high |
| 8 | Photos / prepare step | legacy + `lib/source-picker` | high |
| 9 | Studio draft and steps | `lib/studio-draft` | done (model only) |
| 10 | Canvas workspace and inspector | `lib/canvas-inspector` | partial |
| 11 | Photo editor | `lib/photo-editor` | partial |
| 12 | Crop and ratio | `lib/crop-model` | done |
| 13 | Generation and credits | `lib/generation-run.server` | done |
| 14 | Designs list | legacy | medium |
| 15 | Product board and scope | legacy | medium |
| 16 | **Presentations (client links)** | **`features/presentations`** | **done** |
| 17 | Video builder | legacy | high |
| 18 | Reports | `content/rd-reports` | done |
| 19 | Account, team, billing | legacy | medium |

## 2. Selection rules for the next extraction

Pick a region only if all of these hold:

1. It has a **single DOM region** the legacy runtime can hand over whole.
2. It does **not** own credit spend, generation orchestration or asset
   deletion (those are already behind server modules and must stay there).
3. Its inputs are **data plus callbacks**, not shared mutable globals.
4. Behaviour can be pinned by tests **before** the legacy code is deleted.
5. Deleting the legacy copy is part of the same change. No parallel
   implementations, no dual-write state.

## 3. Extraction contract

Every extracted feature module provides:

- **A pure model** (`*-model.ts`): formatting, filtering, derived copy. No DOM,
  no fetching. This is where the tests concentrate.
- **A React surface**: owns its region's markup, local UI state and effects.
  Keeps legacy class names so existing CSS still applies.
- **A mount adapter** (`mount.tsx`): `mount(container, deps) -> handle`. It
  clears the container, creates the React root, and returns an imperative
  handle plus `destroy()`.
- **Injected dependencies**: data access and any action the legacy runtime
  still owns (modals, exporters, navigation) arrive as typed callbacks. The
  module never imports the legacy script.
- **Teardown**: `destroy()` unmounts the root and clears timers and listeners.
  The runtime registers it in the `cleanups` array returned by `initApp`.

State ownership rule: after extraction the module is the only owner of its
rows/state. The legacy runtime reads through the handle (`handle.rows()`),
never through a mirrored global.

## 4. First extraction: the client-link list

**Region:** `#linkList` in the Presentations view.

**Removed from the runtime:** `PRES_STATUS`, `PRES_ROWS`, `PRES_TABS`,
`PRES_FILTER`, `presAgo`, `presDue`, `presMatch`, `renderPresRows`,
`paintPresentations`'s DOM work, `HIST_META`, `togglePresHistory`, and the
delegated `#linkList` click handler.

**New module:** `src/features/presentations/`

- `list-model.ts` — status meta, relative time, follow-up rules, tab counts,
  row copy, activity timeline copy.
- `PresentationList.tsx` — tabs, rows, inline activity timeline, empty and
  loading states, copy-link feedback, export busy state.
- `mount.tsx` — `mountPresentationList(container, deps)`.

**Still owned by the runtime** (passed in as actions): the new-link and
send/reminder modals, the PDF, product-board and social-reel exporters, and
navigation to Studio. The exporters report progress by writing into a button
element, so they receive a small `ProgressTarget` proxy instead of a real DOM
node — React keeps owning the button.

**Runtime surface after extraction:** `PRES_LIST` (the handle), `presRows()`,
`paintPresentations()` and `focusPresentation(id)` are thin shims over the
handle.

**Tests:** 29 new tests — `list-model.test.ts` (copy, pluralisation,
follow-up windows, filters, tab counts, timeline mapping) and `mount.test.tsx`
(render, empty state, tab filtering, action routing, delete-and-reload,
timeline expand/collapse, `rd:saved` refresh, teardown, load failure, focus).

## 5. Known follow-ups

- `initApp` clears timers and now runs registered `cleanups`, but roughly 290
  `addEventListener` calls in the legacy script are still not unregistered.
  Each extraction should shrink that number rather than add to it.
- `src/lib/source-picker.ts` creates object URLs without revoking them; fold
  that into the Photos-step extraction.
