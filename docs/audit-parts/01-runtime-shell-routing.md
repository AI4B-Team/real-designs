# Part 1 — Runtime Shell, Legacy Script Concentration, Routing & Shell Ownership

Scope: `src/components/PrototypeSurface.tsx`, `src/features/legacy/LegacyPrototypeView.tsx`,
`src/content/rd-app-html.ts`, `src/content/rd-app-script.ts` (14,103 lines / 530,636 bytes),
`src/content/rd-reveal.ts` (8,178 lines / 304,303 bytes), `src/content/feature-markup-gate.ts`,
`src/features/app-shell/*`, `src/routes/*`.

---

## (a) Runtime & rendering ownership

### Mounting chain
`/app` (`src/routes/_authenticated/app.tsx:42-51`) renders:
```tsx
<div className="rd-app">
  <AppShell><LegacyViews /></AppShell>
  <LegacyOverlays />
  <LegacyRuntime />
</div>
```
- `AppShell` (`src/features/app-shell/AppShell.tsx`) is real React: it renders `Sidebar` and
  `Topbar` from JSX/TSX components, not from a markup string.
- `LegacyViews` / `LegacyOverlays` (`src/features/legacy/LegacyPrototypeView.tsx:27-33`) each
  render a `<div dangerouslySetInnerHTML>` sourced from `gateFeatureMarkup(viewsHtml)` /
  `gateFeatureMarkup(overlaysHtml)`, i.e. from `src/content/rd-app-html.ts`'s two exported
  strings (`viewsHtml`, `overlaysHtml`).
- `LegacyRuntime` (`LegacyPrototypeView.tsx:39-53`) is a React component whose only job is to run
  `initApp()` (from `rd-app-script.ts`) in a `useEffect` after its siblings have mounted, relying
  on React's guarantee that child effects fire in tree order so the DOM the imperative script
  expects (`.rd-app`, `.content`, overlays) already exists.
- `PrototypeSurface.tsx` is a second, generic version of the same pattern (`html` + `init()`
  props) used by feature-level ports outside `/app` (e.g. presentation/marketing surfaces ported
  from the same prototype). Two independent implementations of "mount HTML string, run imperative
  init, clean up" exist (`PrototypeSurface` and the bespoke `LegacyViews/Overlays/Runtime` trio)
  with near-identical cleanup logic (`initTooltips`/`initSelects`/`initDatalists` wiring is
  duplicated verbatim in both files and a third time in `src/routes/__root.tsx:290-304`).

### Ownership split: React DOM vs imperative DOM
- React owns: shell chrome (`Sidebar`, `Topbar`, and their submenus — `AccountMenu`,
  `CreateMenu`, `CreditSummary`, `HelpMenu`, `NotificationsMenu`, `SearchBar`, `ShellIcon`), route
  transitions, `<head>` metadata, and the outer `.rd-app` / `.app` / `.main` / `.content`
  scaffolding.
- The imperative runtime (`rd-app-script.ts`'s `initApp`) owns everything inside `.content`'s
  `.view` nodes (dashboard, properties, studio/canvas, designs, batch, products, reports,
  presentations, account, help, notifications — see part (b) for line ranges), all overlay
  modals, all click handling for `.nav-i` buttons (the same buttons React renders — see below),
  hash-based view switching, and direct DOM writes (`innerHTML`, `textContent`, class toggles)
  inside that subtree.
- The React `Sidebar` renders the `.nav-i` buttons declaratively (`data-v={item.view}`,
  `src/features/app-shell/Sidebar.tsx:44-58`) but attaches **no** click handlers itself; `initApp`
  attaches them imperatively (`rd-app-script.ts:1088-1092`:
  `document.querySelectorAll(".nav-i").forEach(b => b.addEventListener("click", () => go(b.dataset.v)))`).
  This means the same DOM nodes are rendered by React and behaviorally owned by the legacy script
  — a split-ownership pattern the `Sidebar.tsx` comment explicitly acknowledges: "React never
  fights those imperative updates" and "the legacy rail controller must never rewrite this
  button's innerHTML."

### Estimated proportions (counting method: source bytes of the three content buckets)
- Imperative-runtime script: `rd-app-script.ts` (530,636 B) + `rd-reveal.ts` (304,303 B) ≈ 835 KB.
- Legacy prototype markup: `rd-app-html.ts` (66,293 B).
- All other `.ts`/`.tsx` under `src/` (routes, features, components, lib): 156,714 LOC /
  5,795,307 B total project source, of which the three legacy files above are ~901 KB.
- By bytes: legacy script + markup ≈ 901 KB out of ~5.8 MB total source (~15.5% of all source
  bytes), but that 15.5% is concentrated in 3 files that drive the single largest authenticated
  surface (`/app`) end-to-end — i.e. a small file count carries a disproportionate share of
  business logic. This is a rough proxy only (bytes ≠ execution weight ≠ UI surface); it is not a
  runtime-rendered-pixel measurement. **Label: estimate, not measured from a running page.**

### Double-initialization risk
- `initApp()` (`rd-app-script.ts:510-513`) guards against being run twice on the same DOM node:
  ```js
  const root = document.querySelector(".rd-app") as HTMLElement | null;
  if (root && root.dataset["rdInit"] === "1") return () => {};
  if (root) root.dataset["rdInit"] = "1";
  ```
  This guard is a dataset flag, not a React ref or module-level singleton. It protects against a
  second physical mount of `.rd-app` reusing the same node, but:
  - It does **not** prevent double-init across route remounts that produce a *new* `.rd-app` node
    (e.g. key-based remount, StrictMode double-invoke in dev, or a hot navigation that unmounts
    then remounts `BackOfficePage`) — in that case `root.dataset.rdInit` starts fresh at `undefined`
    and `initApp` runs fully again, re-attaching all of the listeners enumerated in (e).
  - `LegacyRuntime`'s cleanup return value from `initApp()` clears timers it collected in its own
    local `timers` array (`rd-app-script.ts:527-535`, `return () => { timers.forEach(...) }`,
    ~14090-14100), but global `addEventListener` calls on `document`/`window` registered deep
    inside `initApp` (see (e)) are not all captured by that timer-cleanup return; several are
    fire-and-forget delegated listeners with no matching `removeEventListener` in the cleanup path
    (verified by grep: dozens of `addEventListener("click", ...)` calls inside `initApp`, and the
    single `return` block only clears intervals/timeouts, not click listeners). Confidence:
    **Needs runtime verification** (static reading confirms the asymmetry; confirming an actual
    leak requires attaching/detaching the route repeatedly and diffing listener counts, e.g. via
    Chrome DevTools/Playwright).

### `module-guard.ts` usage
- `src/lib/module-guard.ts` exports `runModule`, a try/catch wrapper that isolates one "painter"
  so a throw in it doesn't take down the rest of `initApp`, and records failures with a
  diagnostic id (`diagnosticId()` -> `RD-<time><random>`).
- Actual usage inside `rd-app-script.ts` is limited to 5 call sites, all clustered at
  lines 2382-2386 (`Property tree`, `Designs`, `Search metadata`, `Batch`, `Sidebar navigation`).
  The other ~50+ domain blocks enumerated in (b) (studio, uploads, generation tools, versions,
  billing, presentations, reports, account, notifications, onboarding, etc.) are **not** wrapped
  in `runModule`; they mostly rely on a single outer `try { ... } catch (e) { console.error(e) }`
  around the bulk of `initApp`'s body (visible at the top of the function and the catch near the
  return statement). A throw in, say, the Studio style-selection code
  (`rd-app-script.ts:11744`) can therefore abort initialization of everything declared after it
  in the same try block, even though `runModule` exists specifically to prevent that class of
  failure — the guard is not applied uniformly to the domains that most need it.

### Global window state
`initApp` attaches numerous debug/interop hooks directly onto `window` (not namespaced under one
object consistently), e.g. (`rd-app-script.ts:711-732`):
```js
(window as any).__rdIsView = ...
(window as any).__rdStudioMode = ...
(window as any).__rdNavToken = ...
(window as any).__rdNavCurrent = ...
(window as any).__rdNavView = ...
(window as any).__rdNav = { token, view, current };
(window as any).__rdClearStudioMode = ...
(window as any).__rdOpenPhotoCanvas = ...
```
Some are namespaced (`__rdNav.*`), others are flat globals (`__rdIsView`, `__rdStudioMode`,
`__rdClearStudioMode`, `__rdOpenPhotoCanvas`, and elsewhere `__rdBuilderSaveExit`,
`referenced at line 752`). This is a de facto second, ad hoc state/API surface parallel to React
state and to the module's own closures — any other module (including future React components)
can read/mutate app navigation state through untyped `window` properties with no compile-time
contract.

### Delegated click handlers
Handlers are attached individually per-node (`b.addEventListener("click", ...)` inside
`.forEach`), not via a single delegated listener on a stable ancestor — except for a few
document-level delegated cases used for "click outside to close" patterns (e.g.
`document.addEventListener("click", (e) => {...})` at lines 1256, 1484, 1557). This means:
- Every re-render of `.view` content that regenerates node lists (e.g. re-painting `#tree`,
  `#recentList`, `#roomCards`) requires re-running the relevant `forEach(...addEventListener...)`
  block to rebind handlers to the new nodes, or those regenerated nodes silently lose interactivity.
- No unbinding of the old nodes' listeners is needed only because they are garbage collected with
  the detached DOM subtree — but any handler that closed over stale local state (`STUDIO_CTX`,
  `WORKSPACE_LOADED`, etc.) before a repaint is a stale-closure risk if a reference to the old
  node is retained anywhere (e.g. in a timer scheduled before the repaint).

### Hash routing
- View switching for `/app` is hash-based on top of the file route: `location.hash` values like
  `#v-studio`, `#scope`, `#v-dash` are read/written directly (`rd-app-script.ts:707`, `737`,
  `1004-1220`, `1676-1677`, `3189`, `4085`+), with normalization logic
  (`needsNormalize`, `canonicalHash`) to fold legacy forms (`#studio`, `#v-scope`) into canonical
  ones, and a `window.addEventListener("hashchange", ...)` (line 1059, and a second one at line
  14085) that re-invokes the same `go()` dispatcher TanStack Router never sees.
- Two independent `hashchange` listeners exist in the same function (1059 and 14085); both must be
  read together to know the full hash-routing behavior, which increases the chance a future edit
  to one leaves the other's assumptions (e.g. canonicalization) inconsistent. **Needs runtime
  verification** to confirm they don't double-fire `go()` on the same hash change.
- Because this is hash state on the single `/app` route (not distinct TanStack routes), the
  browser back/forward button navigates within `/app`'s hash history correctly for `#v-*`
  transitions, but a full page refresh on a hash deep link (`/app#v-scope`) re-runs the entire
  React mount → `initApp()` boot sequence before the requested view can be shown, and — per the
  code's own comments — a stale/unknown hash (`#v-scope` when Budget is hidden) is redirected to
  `#v-dash`, meaning a bookmarked deep link to a since-hidden feature silently lands the user on
  the dashboard with no explanation.

### Direct innerHTML replacement
Beyond the two top-level `dangerouslySetInnerHTML` mounts (`viewsHtml`, `overlaysHtml`), the
imperative script performs its own additional `innerHTML`/`textContent` writes throughout
`initApp` to paint dynamic content (trees, cards, tables) into fixed containers (`#tree`,
`#recentList`, `#budgetTable`, etc.) — i.e. a third layer of DOM writing beneath the two React
`dangerouslySetInnerHTML` boundaries, invisible to React's reconciler and to any tooling that
diffs React trees.

---

## (b) Responsibility concentration in `rd-app-script.ts` and `rd-reveal.ts`

`rd-app-script.ts` is a single exported function, `initApp()` (line 510 to file end, 14,103 total
lines), containing dozens of `/* ---------- <domain> ---------- */`-delimited inline sections, all
sharing one closure (`STUDIO_CTX`, `WORKSPACE_LOADED`, `timers`, etc.). Approximate domain→line
ranges (from in-file section markers):

| Domain | Approx. lines | Notes |
|---|---|---|
| Nav / global hash routing (`go`, `viewFromHash`, `beginNavigation`) | 562–1236 | also re-entered at 2391–2572 (progressive nav) and 14085+ |
| Account menu (topbar) | 1237–1262 | |
| Search scope menu + live results | 1263–1533 | |
| Account page | 1534–1685 | |
| Integrations readiness (owner-only) | 1686–1732 | |
| Dashboard real data | 1733–1890 | |
| Sample workspace | 1891–2185 | |
| Properties (owned hierarchy, tree paint) | 2186–2390 | |
| Progressive navigation | 2391–2572 | second nav concentration |
| Studio (core canvas/editor) | 2573–4291 | ~1,700 lines, largest single domain |
| Studio tools: 3D plan / walkthrough video | 4292–4325 | |
| Floorplan tool | 4326–4589 | |
| Animate tool (motion clip + polling) | 4590–4936 | owns `CLIP_TIMER = setInterval(tick, 7000)` (line 4776) |
| Virtual Stage tool | 4937–5118 | |
| Declutter tool | 5119–5334 | |
| Object Edit tool | 5335–5614 | |
| Materials tool | 5615–5823 | |
| Sketch-to-Render tool | 5824–6066 | |
| Angles (multi-angle) tool | 6067–6681 | |
| Saved rooms | 6682–7133 | |
| Designs (saved versions + sample gallery) | 7134–7703 | |
| Version history | 7704–7879 | |
| Batch | 7880–8182 | |
| Scope / pricing (budget, hidden feature) | 8183–8330 | |
| Materials allowance list | 8331–8517 | |
| AI-proposed dimensions | 8518–8563 | |
| Contractor brief | 8564–8733 | |
| Budget bands | 8734–8790 | |
| Product board | 8791–9118 | |
| Presentations | 9119–9376 | |
| Reports | 9377–9646 | |
| Client link sending | 9647–9821 | |
| Quick approval link creation | 9822–10066 | |
| Team | 10067–10347 | |
| Workspace preferences | 10348–10439 | |
| Collapse left menu | 10440–10540 | |
| Help menu | 10541–10572 | |
| Help center | 10573–10895 | |
| Walkthroughs | 10896–11035 | |
| Feedback modal | 11036–11318 | |
| Product tour | 11319–11408 | |
| Notifications (from account activity) | 11409–11707 | |
| Studio tool rows w/ plan badges (gating) | 11708–11743 | |
| Studio visual style selection | 11744–12173 | |
| Studio canvas surround | 12174–12175 | |
| Accounts: identity + saved projects | 12176–12251 | |
| Account side card, data & privacy | 12252–12763 | |
| Dashboard greeting | 12764–12789 | |
| Signup questionnaire | 12790–12801 | |
| First-run onboarding | 12802–13054 | |
| Live credit meter, billing pane, upgrade prompts | 13055–13308 | |
| Plan lifecycle (request/downgrade/cancel/refill) | 13309–13482 | |
| Property Design DNA, scenarios, approval, avatar | 13483–13810 | |
| Website handoff | 13811–13880 | |
| Keyboard shortcuts | 13881–14017 | global; can conflict with any React-owned shortcut handling elsewhere |
| First-use experience / adaptive post-login routing | 14018–end | |

`rd-reveal.ts` (8,178 lines) is a second, separately-owned monolith for the client-facing
presentation/reveal experience, with its own comparable domain concentration: durable builder
drafts (~1684–1920), property address autosave (~1920–2639), video-ending behavior (~2639–2925),
shared card overflow menu (~2925–3299), draft leave/delete (~3299–3431), per-scene motion/exterior
effects (~3431–3508), start/end sequencing (~3508–4174), and step-4 templates (~4174+). It runs
64 combined `addEventListener`/`removeEventListener` call sites and its own `setInterval` (line
7136, `w.playTimer = setInterval(...)`), independent of `rd-app-script.ts`'s timer bookkeeping.

### Concrete failure modes this concentration creates
- **Shared mutable closure state across unrelated domains.** `STUDIO_CTX` and `WORKSPACE_LOADED`
  are declared once at the top of `initApp` (lines 528-531) specifically because Studio "can be
  painted while `initApp` is still executing its body" — i.e. a *navigation* concern
  (nav domain) directly dictates variable placement inside the *Studio* domain's closure. Any
  future refactor that reorders sections risks reintroducing the exact `ReferenceError` the
  comment describes (temporal dead zone on a `let` declared later).
- **One try/catch boundary, ~40 domains.** With only 5 of ~40 domains wrapped in
  `runModule` (see (a)), an uncaught exception thrown while painting, e.g., the "Product board"
  section (8791-9118) can prevent every subsequent section in the same try block — Presentations,
  Reports, client-link sending, Team, Help, Notifications, onboarding, billing, keyboard shortcuts
  — from initializing on that page load, since they all execute sequentially inside `initApp`'s
  body.
- **Cross-domain coupling via ambient globals.** Studio (canvas domain) exposes
  `window.__rdOpenPhotoCanvas`/`__rdBuilderSaveExit` that Properties/Media/other domains call
  into directly, bypassing any typed interface; a change to Studio's internal state machine (e.g.
  `STUDIO_MODE`) can silently break callers in unrelated domains with no compiler signal.
- **Feature gating logic duplicated per domain.** Plan/entitlement checks
  (`data-required-plan`, `isPlanBlocked`, `planBlockTitle` from `@/lib/rd-upgrade`) are invoked
  ad hoc inside Studio tool rows (11708-11743), plan lifecycle (13309-13482), and the credit
  meter (13055-13308) rather than through one gating boundary, so a plan-limit rule change (e.g.
  which tools require "studio" tier) must be hunted down across at least three separate sections.
- **Polling that outlives its narrow purpose sits beside unrelated domains.** The Animate domain's
  `CLIP_TIMER = setInterval(tick, 7000)` (line 4776) lives inside the same function scope as
  Billing, Notifications, and Onboarding; the only thing preventing it from leaking across
  navigations is that it is pushed into the shared `timers` array cleaned up when `initApp`'s
  returned cleanup runs — i.e. Animate's cleanup correctness depends on Nav/Runtime's unrelated
  cleanup mechanism, not on its own lifecycle.
- **Single point of merge conflicts / blast radius.** Because 40 domains share one file and one
  function, any two engineers touching different domains (e.g. Reports and Presentations) are
  editing adjacent regions of the same 14k-line file, and a lint/type error anywhere in the file
  blocks builds for every domain.

### Suggested natural future component/module boundaries (not implemented here)
Per the domain table above, natural seams already exist at the `/* ---------- ... ---------- */`
markers: Navigation/Hash-Routing, Studio-Core, per-tool modules (Floorplan, Animate, Virtual
Stage, Declutter, Object Edit, Materials, Sketch-to-Render, Angles) which already have discrete
line ranges and mostly-local DOM ids, Properties/Design-DNA, Designs/Versions, Batch, Budget
Pricing (dormant/hidden), Product Board, Presentations, Reports, Client-Link/Approval sharing,
Team, Account/Billing/Plan-lifecycle, Help/Tour/Onboarding/Feedback, Notifications. `rd-reveal.ts`
similarly seams at Draft-Persistence, Property-Address, Video-Ending, Card-Overflow-Menu,
Per-Scene-Motion, Start/End-Sequencing, Templates. These are described as candidate boundaries
only; no componentization is performed as part of this audit.

---

## (c) Routing & navigation inventory

### File routes under `src/routes`
| Route file | Path | Auth | Feature/plan gate | Notes |
|---|---|---|---|---|
| `__root.tsx` | root layout | none | none | Global boot-recovery script, tooltip/select/datalist init, analytics pageview subscription, chunk-load error recovery |
| `_authenticated/route.tsx` | layout for `/_authenticated/*` | Supabase session check (client-side, post-hydration) | none | Own `checking/in/offline` state machine; redirects to `/auth` only on confirmed no-session, not on network failure |
| `_authenticated/app.tsx` | `/app` | inherited from layout | Budget feature markup gated (`feature-markup-gate.ts`) at render time | Mounts `AppShell` + `LegacyViews/Overlays/Runtime`; single entry point for the entire hash-routed legacy SPA |
| `_authenticated/app_.media.video.new.tsx` | `/app/media/video/new` | inherited | not verified from this pass | Sibling file-route alongside the hash-routed `/app`; a real nested route co-existing with hash routing under the same `/app` prefix — **duplicate routing mechanism risk**: this URL is a real TanStack route, while `#v-lvideo` is a hash view inside `/app`'s SPA — two different navigation systems can both claim to represent "listing video" |
| `_authenticated/welcome.tsx` | `/welcome` | inherited | not verified | |
| `index.tsx`, `about.tsx`, `pricing.tsx`, `pricing_.compare.tsx`, `pricing_.credits.tsx`, `explore.tsx`, `founders.tsx`, `contact.tsx`, `resources.tsx`, `status.tsx`, legal pages (`privacy`, `terms`, `security`, `accessibility`, `acceptable-use`, `affiliate-disclosure`, `copyright`, `do-not-sell`, `refund-policy`, `refunds`, `subprocessors`) | public marketing/legal | none | none | Public, no shell |
| `free/index.tsx`, `free/ai-interior-design.tsx`, `free/arv-calculator.tsx`, `free/rehab-cost-calculator.tsx`, `free/virtual-staging.tsx` | public free tools | none | none | |
| `auth.tsx` | `/auth` | none (entry point) | none | |
| `reset-password.tsx` | `/reset-password` | none (token-based) | none | |
| `$slug.tsx` | catch-all | none | none | Likely CMS/marketing catch-all; risk of shadowing other routes if ordering/specificity is wrong — **needs runtime verification** against the exact router priority rules |
| `v.$slug.tsx` | `/v/$slug` | none (public share link) | `deck.locked` gate from loader data, not auth | Public presentation viewer; `noindex, nofollow` |
| `p.$token.tsx`, `pkg.$token.tsx` | `/p/:token`, `/pkg/:token` | none (token-based) | not verified | Two similarly-shaped public token routes — worth confirming they are not duplicate/overlapping delivery mechanisms for the same feature (**needs runtime verification**) |
| `api/public/founding.ts`, `api/public/health.ts` | API routes | none | none | |
| `sitemap[.]xml.ts` | `/sitemap.xml` | none | none | |

### Internal hash views (`#v-*`) inside `/app`
Extracted from `rd-app-html.ts`'s `viewsHtml`/`overlaysHtml` string literals (`id="v-..."`):
`v-account`, `v-dash`, `v-designs`, `v-explore`, `v-help`, `v-listings`, `v-lvideo`, `v-media`,
`v-notifications`, `v-present`, `v-products`, `v-props`, `v-reports`, `v-reveal`, `v-scope`,
`v-studio`, `v-tutorials`.
- All are owned by `rd-app-script.ts`'s `go()`/hash-normalization logic (a single router
  implementation, not competing with TanStack Router — TanStack owns `/app` as one route,
  `go()` owns everything after the `#`).
- `v-scope` (Budget) has markup physically stripped by `gateFeatureMarkup` when
  `isFeatureVisible("budget")` is false (current registry: `budget: "hidden"`,
  `feature-availability.ts:30`), **and** `go()` independently redirects any navigation to `"scope"`
  to `"dash"` when `!budgetsLive()` (`rd-app-script.ts:737-745`) — i.e. Budget is gated twice, by
  two different mechanisms (markup removal + navigation redirect) that must be kept in sync
  manually; a change to one without the other could reintroduce a dead deep link or an empty view.
- `v-lvideo` has empty markup in `viewsHtml` (`<div class="view" id="v-lvideo"></div>`) — its
  actual content is presumably painted at runtime by the "Listing video" domain in
  `rd-app-script.ts`, or superseded by the newer file-route `/app/media/video/new`
  (`app_.media.video.new.tsx`). **Needs runtime verification** to determine which of the two
  ("#v-lvideo" hash view vs the file route) is the live entry point and whether the other is
  dead/reachable-but-unused legacy code.
- Deep-link / refresh behavior: because these are hash fragments on one TanStack route, a hard
  refresh at `/app#v-studio` re-runs the full `initApp()` boot before `go()` can route to
  `v-studio`; per the code's own comments this ordering is intentional but means the *first*
  paint after a refresh is always the dashboard/default view rendering briefly before the
  requested view swaps in — a potential flash-of-wrong-view. **Needs runtime verification**
  (visual confirmation via a real reload) to quantify the flash duration.
- Back/forward behavior: browser history responds to `hashchange` (two listeners, see (a)); back
  navigation across `#v-*` boundaries is handled, but back navigation across the *file-route*
  boundary (e.g. from `/app#v-studio` back to `/pricing`) is TanStack's concern and is not
  coordinated with the hash-state stack, so state that `go()` expects to restore (e.g.
  `STUDIO_MODE`) is not persisted across a full route unmount and does not "survive" — it depends
  entirely on whatever `initApp` reconstructs from server data on the next mount.

### `nav-items.ts` vs competing sidebar definitions
- `src/features/app-shell/nav-items.ts` (`NAV_GROUPS`) is the single declarative source for the
  authenticated sidebar, consumed only by `Sidebar.tsx`.
- No second `NAV_GROUPS`-shaped structure was found; `rd-app-html.ts` no longer contains sidebar
  markup (confirmed by grep — the file's own header comment states "The shared shell ... now
  lives in real React components"). This is consistent with a single authoritative nav *data*
  source. However, the *behavior* bound to those nav items (`go(b.dataset.v)`) is defined entirely
  in `rd-app-script.ts`, so "what the sidebar contains" (React, `nav-items.ts`) and "what clicking
  it does" (imperative script, `go()`) are two different files with no shared type — a rename of a
  `view` key in `nav-items.ts` (e.g. `"props"` → `"properties"`) would silently break `go()`'s
  switch/dispatch unless the corresponding `id="v-props"` markup and hash-handling code are
  updated in lockstep, since nothing statically ties `NavItem.view` to `rd-app-script.ts`'s
  view-key handling.

---

## (d) Application shell ownership

### Shell implementation count
Two shell-adjacent mechanisms coexist inside `/app`:
1. **React `AppShell`** (`src/features/app-shell/AppShell.tsx`) — authoritative for chrome
   structure: `.app > (Sidebar, .main > (Topbar, .content))`. `Sidebar` and `Topbar` are true React
   components with their own state (menus, search).
2. **Prototype markup + imperative script** — authoritative for everything *inside* `.content`
   (the `.view` nodes) and for the overlay layer (`LegacyOverlays`), plus for the *behavior* of
   the React-rendered sidebar buttons (click handling via `go()`).

There is effectively **one shell chrome implementation** (React) but **one behavioral controller**
(the imperative script) that reaches back into the React-rendered chrome (nav buttons, collapse
toggle interactions referenced via ids like `#sideToggle`) to attach handlers. This is not two
competing renderers of the same chrome; it is one renderer (React) plus one external behavior
owner reaching into that renderer's output — still a split-ownership pattern with the same
fragility noted in (a): a future edit to `Sidebar.tsx` that removes or renames `data-v`/`id`
attributes silently breaks the legacy script's `querySelectorAll` selectors with no compile-time
signal.

### Expanded vs collapsed nav data
`NAV_GROUPS` in `nav-items.ts` has a single data shape used for both expanded and collapsed
renderings; collapse/expand is a CSS-driven state (`.sidemin` class, referenced in
`Sidebar.tsx`'s comment) toggled by the imperative "collapse the left menu" domain
(`rd-app-script.ts:10440-10540`), not by React state — so the *data* is centralized but the
*presentation mode* (collapsed vs expanded) is controlled outside React, meaning React cannot
locally reason about which visual state the sidebar is in (e.g. for conditional rendering of
tooltips) without reading the DOM/class list.

### Icon sizing centralization
`ShellIcon.tsx` centralizes icon rendering for the React-owned chrome (confirmed present as a
dedicated component consumed by `Sidebar.tsx`); the legacy markup inside `.content` instead uses
raw `<i data-lucide="...">` tags hydrated by `lucide.createIcons()` calls scattered through
`initApp` (e.g. `const lucide = { createIcons: (o:any={}) => createIcons({ icons, ...o }) }` at
line ~536, re-invoked after each dynamic repaint). Icon sizing/consistency is therefore
centralized only for the React-rendered chrome; the much larger legacy-view icon surface depends
on every repaint site remembering to call `lucide.createIcons()` again after replacing
`innerHTML`, with no single enforcement point.

### Feature gating before vs after render
- **Before render (markup-level):** `feature-markup-gate.ts`'s `gateFeatureMarkup()` strips
  Budget's DOM nodes out of the HTML string at module scope, before `viewsHtml`/`overlaysHtml`
  are ever handed to `dangerouslySetInnerHTML` (`LegacyPrototypeView.tsx:14-15`). This is
  explicitly designed (per the file's own doc comment) to replace an earlier post-render approach
  ("hidden = true, Coming Soon relabelling ... depended on initialization succeeding").
- **After render (behavioral-level):** `go()` in `rd-app-script.ts` still independently redirects
  navigation to `"scope"` away from Budget (line 737-745), and Studio's tool rail still renders a
  disabled/"Coming Soon" `#toolrowBudget` button conditionally based on the same underlying
  `BUDGET_MARKERS` id set — i.e. gating is enforced at both stages for the same feature, which is
  duplicated logic rather than single-sourced, even though the stated intent was to move to a
  single before-render mechanism.
- `feature-availability.ts` (`isFeatureVisible`) is the single registry read by
  `feature-markup-gate.ts`; nothing in `rd-app-script.ts`'s own Budget-redirect branch
  (`budgetsLive()`, referenced at line 737) was confirmed in this pass to read the *same* registry
  function — **Needs runtime/source verification**: if `budgetsLive()` is a separate local
  constant/heuristic rather than calling `isFeatureVisible("budget")`, the two gates can drift
  independently.

### Post-render injection/removal
Beyond the module-scope markup gating, `initApp` performs further post-render DOM mutation for
dynamic content (recent designs list, property tree, KPI numbers, budget table rows) — these are
data-driven insertions, not feature-gating removals, but they share the same `innerHTML`
replacement mechanism, so a future feature-flag implemented via post-render removal (the pattern
the codebase explicitly moved away from for Budget) is one dangerouslySetInnerHTML call away from
being reintroduced by any engineer unfamiliar with `feature-markup-gate.ts`'s rationale.

### Badge/count data sources
Sidebar count badges (`countId: "cntProps"`, `"cntDesigns"` in `nav-items.ts:29-30`) are rendered
as empty `<span id={countId}>0</span>` by React and written to directly by the imperative
"workspace loader" domain (Properties/Designs paint sections, ~2186-2390 and ~7134-7703) via
`document.getElementById(countId).textContent = ...`-style writes — React never re-renders these
values; they are a permanent imperative write target embedded inside a React tree, another
instance of the split-ownership pattern from (a).

### Public pages inheriting authenticated shell behavior
- `v.$slug.tsx` (public presentation) imports `reveal.functions` and `reveal-render` but not
  `AppShell`/`Sidebar`/`Topbar` — no evidence found of the authenticated chrome leaking into
  public routes.
- However, `rd-reveal.ts` (the reveal/presentation imperative runtime) is a comparably sized
  monolith to `rd-app-script.ts` and is presumably mounted for `v.$slug.tsx` via its own
  `PrototypeSurface`-style wiring; this pass did not trace `v.$slug.tsx`'s full render tree line
  by line, so whether any authenticated-only assumptions (e.g. global `document.addEventListener`
  handlers registered elsewhere via `__root.tsx`'s tooltip/select/datalist init) unintentionally
  apply on public pages is **Needs runtime verification**. What is confirmed: `__root.tsx` runs
  `initTooltips`/`initSelects`/`initDatalists` globally on *every* route (lines 290-304), so any
  DOM-wide side effect those three modules perform (not audited in this pass) does apply uniformly
  to public and authenticated pages alike — this is by design, not a leak, but it does mean public
  pages are not hermetically isolated from the same imperative helper libraries the authenticated
  shell depends on.

### Canonical shell recommendation (not implemented)
Given: (1) one authoritative React chrome (`AppShell`) already exists and should remain
authoritative for structure; (2) feature/view content is split across React views (migrated
features) and legacy hash-views (unmigrated features) with no typed registry connecting a nav
item's `view` key to its actual renderer; (3) gating is duplicated across markup-strip and
navigation-redirect layers keyed by loosely-related constants (`BUDGET_MARKERS`,
`isFeatureVisible`, `budgetsLive()`); (4) badges/counts are imperative write targets with no
React-owned state — the natural target architecture is a **single view registry**: one typed table
mapping `view key -> { component | legacyMount, authRequirement, featureKey, badge data source }`
that both `Sidebar` (for what to render/gate) and the router/dispatcher (for what to mount when
navigated to) read from, replacing the current situation where `nav-items.ts`,
`feature-availability.ts`, `feature-markup-gate.ts`'s `BUDGET_MARKERS`, and `rd-app-script.ts`'s
`go()`/`budgetsLive()` each hold a partial, independently-maintained view of the same "is this view
available and what renders it" question. This is a recommendation only; no registry is implemented
as part of this audit.

---

## (e) Event & lifecycle audit findings

- **Listener volume.** `rd-app-script.ts` contains 684 combined matches for
  `window.`/`addEventListener`/`setInterval`/`setTimeout`/`location.hash`/`innerHTML =`/
  `data-v="` inside one function scope — a rough proxy for how much imperative wiring one
  `initApp()` call performs on every mount of `/app`.
- **Two `hashchange` listeners** registered in the same `initApp` call (`rd-app-script.ts:1059`
  and `:14085`) — confirmed by direct line inspection, not deduced. Both react to the same event;
  whether they are mutually exclusive by guard condition or can double-fire on the same hash
  transition was not traced end-to-end in this pass (**Needs runtime verification**).
- **Timer bookkeeping is centralized but only for `initApp`'s own `timers` array.** The wrapped
  `setInterval`/`setTimeout` shims (`rd-app-script.ts:527-535`) push every id into a local
  `timers: number[]`, cleared in the function's returned cleanup — this is a genuinely good
  pattern for *that* function's own scheduled work. But:
  - `CLIP_TIMER = setInterval(tick, 7000)` (Animate domain, line 4776) is assigned to a bare
    variable `CLIP_TIMER`, not obviously routed through the wrapped `setInterval` (needs a direct
    diff to confirm whether the module-local `setInterval` shim shadows `window.setInterval` at
    that call site or whether `CLIP_TIMER` bypasses the shim and therefore bypasses the shared
    cleanup array — **Needs runtime verification**, since both a shadowed local `setInterval` and
    an unshadowed global one are syntactically identical at the call site).
  - `rd-reveal.ts`'s `w.playTimer = setInterval(...)` (line 7136) is in a **separate file with its
    own separate timer/listener bookkeeping** (64 listener-related call sites total) — there is no
    shared timer registry between `rd-app-script.ts` and `rd-reveal.ts`, so a page that somehow
    mounts logic from both (e.g. an authenticated user previewing their own presentation) would
    have two independent, non-coordinating cleanup mechanisms.
- **Polling that survives navigation is a named risk, not fully verified.** The Animate clip
  poller (`tick` every 7000ms, line 4776) polls a job status server-side; if its interval id is
  captured by the shared `timers` array, it is cleared on `LegacyRuntime`'s unmount effect cleanup
  (i.e. on navigating away from `/app` entirely, not on navigating between hash views within
  `/app`, since hash-view changes do not unmount `LegacyRuntime`). This means the poller is
  expected to keep running for as long as the user stays anywhere inside `/app`, including on
  hash-views unrelated to Animate — **Needs runtime verification** to confirm the poller is
  actually torn down when the Animate panel itself closes rather than only when the whole `/app`
  route unmounts, since no per-view-close teardown for `CLIP_TIMER` was found near the Animate
  section (4590-4936) beyond the interval being registered.
- **Stale-closure risk from long-lived top-level `let`s.** `STUDIO_CTX` and `WORKSPACE_LOADED`
  are declared once per `initApp()` call and closed over by all ~40 domain sections; any
  asynchronous callback (fetch `.then`, `setTimeout`, `setInterval` tick) registered early in
  `initApp`'s execution and resolving late captures whatever `STUDIO_CTX`/`WORKSPACE_LOADED` value
  existed at *registration* time only if it reads them via closure without re-fetching — the code
  was not fully traced per-callback in this pass to confirm which async callbacks re-read current
  values vs. capture stale ones; this is flagged as a class of risk inherent to the shared-closure
  design rather than a confirmed specific bug (**Needs runtime verification** per callback).
- **Document-level delegated "click outside" listeners** (lines 1256, 1484, 1557, and others) are
  registered unconditionally inside `initApp` and never explicitly removed in the function's
  return cleanup (which only clears `timers`) — on the double-init edge case described in (a),
  each re-run of `initApp` adds another copy of these `document`-level listeners, since
  `root.dataset.rdInit` is the only real guard and it can reset on a genuine remount.

---

## Summary of confidence levels
- Confirmed by direct source inspection: mounting chain, section line ranges, `module-guard`
  usage count, hash-view id list, feature-gate double-mechanism for Budget, nav-items single
  source, timer-array cleanup design, two `hashchange` listeners' existence.
- Needs runtime verification: double-`hashchange` firing behavior, refresh flash-of-wrong-view
  duration, `CLIP_TIMER` shim routing, per-view Animate poller teardown, actual double-init
  reproduction via remount/StrictMode, `/v/$slug` isolation from authenticated-only listeners,
  live/dead status of `#v-lvideo` vs `/app/media/video/new`.
- Needs production-data verification: none identified as strictly data-dependent in this part
  (badge/count correctness against real Supabase data is more relevant to a data-layer audit
  part, not this runtime/shell/routing part).
