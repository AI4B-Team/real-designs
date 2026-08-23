# REAL DESIGNS — Architecture Remediation Register

Source documents: `docs/REAL_DESIGNS_ARCHITECTURE_AUDIT.md` and every report in
`docs/audit-parts/`. This register lists **only** findings the audit rated
Critical or High. Medium/Low/Informational findings stay in the audit and are
deliberately out of scope here.

Status values: `Open`, `Verifying`, `Fixed`, `Accepted Risk`.
Phase 0A was baseline only. Phase 0B closed **H7**: every chargeable generation
entry point now runs through the canonical transaction in
`src/lib/generation-run.server.ts`, which owns the idempotency claim, the job
stage, the single charge and the single refund. Everything else remains open.

## Critical

| ID | Finding | Files | User-facing risk | Technical risk | Depends on | Phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Possible RLS coverage gap: 61 `CREATE TABLE` statements vs. 31 `ENABLE ROW LEVEL SECURITY` statements across migrations | `supabase/migrations/*.sql` | A table without RLS could be readable or writable across tenants by any key holder | Defeats the ownership model the whole app assumes | Live linter / DB verification | Phase 0 | Open — needs runtime confirmation |
| C2 | `requireSupabaseAuth` not confirmed wired on every server-function path (only the client-side `attachSupabaseAuth` is confirmed global) | `src/integrations/supabase/auth-middleware.ts`, `auth-attacher.ts`, `src/start.ts` | A forged, expired or absent token could reach data on any unwired handler | Full authentication bypass on that handler | Blocks trusting per-handler auth assumptions in Parts 4–6 | Phase 0 (blocking) | Open — trace one full request path end to end |

## High

| ID | Finding | Files | User-facing risk | Technical risk | Depends on | Phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 (Part 2 A1) | Three parallel "current step" enumerations for one flow (`DesignStep`, `PhotoStep`, `DraftStep`) | `src/lib/builder-step.ts`, `builder-nav.ts`, `design-draft.ts`, `src/content/rd-staging.ts` | None today; ad-hoc normalizers hide it | Every new feature must re-derive "current step" three times | — | Phase 2 | Open |
| H2 (Part 2 D1) | Three non-interoperable crop coordinate systems (focal+scale, pixel rect, editor rect) | `photo-crop.ts`, `crop-frame.ts`, `crop-position-dialog.ts`, `image-format-ui.ts`, `photo-editor.ts`, `rd-staging.ts`, `staging-bulk.ts` | One photo can carry two unsynchronized crops; format behavior drifts between single- and multi-photo flows | No conversion exists between the shapes; clamp/edge math duplicated | `photo_edits` schema, `project_drafts.settings` shape | Phase 2 | Open |
| H3 (Part 5) | Ownership enforced only by RLS: mutation handlers filter by row id, not `user_id` | `src/lib/reveal.functions.ts` (share-link update/insert) and ~285 `createServerFn` call sites | None today, but zero margin for error | One RLS regression becomes an immediately exploitable IDOR | C1 | Phase 2 | Open |
| H4 (Part 5) | Pervasive service-role usage (~35 `*.server.ts` modules) where RLS does not apply | all `*.server.ts`, e.g. `presentations.server.ts` signing a caller-supplied storage path | Potential cross-tenant data exposure via unchecked ids/paths | Authorization must be hand-written correctly at every site | Call-graph tracing per site | Phase 1 | Open |
| H5 (Part 5 / main §8) | 75 files using `innerHTML`, unaudited for interpolation of user-supplied text | 75 files across `src/` (canvas/staging/floorplan/sketch DOM layer) | Stored or reflected XSS from listing text, notes or filenames | Large surface; manual review is costly | — | Phase 0 | Open |
| H6 (Part 6 D7) | Expired/revoked package-link enforcement lives only inside the `get_presentation_share` RPC, with no TypeScript backstop | `presentation-packages.functions.ts`, SQL `get_presentation_share` | A revoked or expired public link could still serve confidential client data | Whole trust boundary is one unreviewed SQL function | SQL review | Phase 0 | Open |
| H7 (main §1 #3, Part 4 A3/B5/B6) | No server-side idempotency key on generation entry points; double charge on concurrent or retried requests | `generation-run.server.ts` and 12 `*.functions.ts` handlers | Double charge on a double click, retry or refresh | Money correctness | — | Phase 0 | **Fixed (Phase 0B)** — one request produces at most one job, one charge and one durable result; failures refund exactly once |

## Phase roadmap (as proposed by the audit)

- **Phase 0 — Correctness and money:** C1, C2, H5, H6, H7 plus gateway timeout/retry and SSRF constraint on scene clips.
- **Phase 1 — Containment:** H4, module isolation for `initApp` domains, server-side gating of suppressed features.
- **Phase 2 — Consolidation:** H1, H2, H3, typed runtime bridge, missing test coverage.
- **Phase 3 — Migration:** extract imperative domains into React feature modules.
- **Phase 4 — Hygiene:** documentation, a11y and visual-regression automation, dead-code removal.


## Phase 0B — Idempotent, failure-safe generation

**Primary guarantee.** One explicit user request produces at most one job, at
most one credit charge and at most one durable result. A double click, a
browser retry, a timeout, a refresh mid-flight or a route change replays the
first attempt instead of starting and charging a second one.

**How it is enforced.** `src/lib/generation-run.server.ts` exposes
`runGeneration` (single output) and `runGenerationItem` (one item of a batch).
Both derive an idempotency key from the stable request inputs plus the client's
per-click `request_id`, claim it, open a job, charge once, run the work, store
the result for replay, and — on failure — refund exactly once before releasing
the key so a genuine retry starts a fresh attempt.

**Explicit states.** Job stage is one of `draft`, `validating`, `queued`,
`processing`, `finalizing`, `succeeded`, `partially_succeeded`, `failed`,
`cancelled`. Credit state is tracked separately: `not_required`, `pending`,
`reserved`, `charged`, `released`, `refunded`, `disputed`. Progress wording
comes from `stageMessage`; no stage reports a fabricated percentage.

**Entry points routed through the transaction (12).** `design-render`,
`concept-render`, `photo-edit`, `room-tools`, `object-edit`, `walkthrough`,
`stage`, `declutter`, `materials`, `angles`, `sketch`, `floorplan`.

**Batch behaviour.** A refused charge (out of credits, daily limit, plan) stops
the batch and keeps everything that already succeeded. A failed render fails
only its own item, is refunded once, and the batch continues.

**Client identity.** `src/lib/request-id.ts` gives one id per committed click
(`requestIdFor`/`clearRequestId`) and one id per batch run (`newRequestId`), so
a retry of the same click replays while a deliberate re-run with identical
settings still produces a fresh variation.

**Still charging outside the transaction (Phase 0C).** `animate` and `reveal`
are queue-backed video renders with their own job rows and refund paths;
`estimator`, `change-detect` and `shop-detect` are analysis calls that refund
on failure but have no idempotency key yet.

**Coverage.** `src/lib/__tests__/generation-run.test.ts` — 12 tests over single
charge, replay, distinct inputs, single refund, retry after failure, refusal
before any charge, concurrent duplicate, free actions and batch item outcomes.
