# Part 5 — Database & Supabase, Authentication/Authorization, Security/Privacy Sweep, External Providers

Scope note: read-only audit using static code inspection, ripgrep, and manual review of migrations under `supabase/migrations` (74 files, matches user's count) and `src/integrations/supabase/types.ts` (3,862 lines, generated). Live Supabase linter/security-scan/`get_table_schema` tools were not reachable from this sandbox session (no active project connection); findings below are therefore based on migration SQL as the source of truth and are flagged **Needs runtime verification** wherever a live schema/policy check would materially change the conclusion.

---

## (a) Database & Supabase inventory

### Migration corpus
- `supabase/migrations/` contains exactly 74 `.sql` files, timestamp-named from early 2025 through `20260823162152_*.sql`.
- Counts inside the migration corpus (via `rg`):
  - `CREATE TABLE` statements: 61
  - `CREATE POLICY`: 39 occurrences
  - `ENABLE ROW LEVEL SECURITY`: 31 occurrences
  - Files touching `storage.buckets`/`storage.objects`: 6

### Do migrations represent the current schema?
**Needs runtime verification.** With no live DB connection in this session, the only way to check drift is to diff `types.ts` (generated from the live DB) against the migrations. `types.ts` is explicitly marked "automatically generated. Do not edit it directly," meaning it is regenerated from the actual deployed schema, not derived from replaying the 74 migration files. If the live project has out-of-band changes (manual SQL run through the Studio, or a migration that was later reverted without a down-migration), `types.ts` and the migrations directory would diverge silently — the migrations directory is not provably authoritative.
- Recommended correction: run `supabase db diff` / compare `get_table_schema` output against migration replay to confirm the 74 files fully reconstruct the live schema. Phase 1, low risk of delay, but flag before relying on migrations as documentation for future engineers.

### Server functions and ownership-ID trust (createServerFn audit)
285 `createServerFn` call sites found across `src/lib/*.functions.ts` and a couple of route handlers. All function modules are paired with `.server.ts` counterparts, and per `src/start.ts` every server function is wrapped with `functionMiddleware: [attachSupabaseAuth]`, which is itself layered on `requireSupabaseAuth`-style JWT verification (see auth-middleware section below) via the request-scoped Supabase client returned in `context`.

Ownership-check pattern actually used throughout the codebase relies on **RLS + a per-request Supabase client authenticated as the calling user**, not on manual `user_id === context.userId` checks inside every handler. Example (`src/lib/reveal.functions.ts:764-798`, update/create of `video_share_links`): the handler uses `context.supabase` (the caller's own authenticated client) to `select`/`update`/`insert` against `video_share_links`, and stamps `user_id: userId` into inserts, but the actual cross-tenant protection is delegated entirely to RLS policies on `video_share_links`. **This is architecturally sound only if every table touched by every handler has a correct RLS policy** — a single missing/misconfigured policy converts every handler that queries that table into an IDOR. Given 61 tables but only 39 `CREATE POLICY` statements and 31 `ENABLE ROW LEVEL SECURITY` statements, there is an apparent gap: not every table has RLS enabled, and even where RLS is enabled, the number of policies (39) is close to but not obviously ≥ table count once SELECT/INSERT/UPDATE/DELETE are each policied separately. This needs to be checked table-by-table.
- **Finding: Possible RLS coverage gap (61 tables vs 31 `ENABLE ROW LEVEL SECURITY` statements)**
  - Severity: Critical if confirmed / Confidence: Needs runtime verification
  - Impact: any table without RLS enabled is fully readable/writable by any authenticated (or, if grants are broad, anon) key holder, defeating the ownership model that the rest of the app assumes.
  - Evidence: `rg -c "CREATE TABLE" supabase/migrations` → 61; `rg -c "ENABLE ROW LEVEL SECURITY" supabase/migrations` → 31.
  - Root cause: some tables may be intentionally public/reference tables (lookups, enums-as-tables), or RLS may have been enabled in a later migration that ALTERs an earlier table rather than in the same file as CREATE TABLE — the raw counts alone can't distinguish these cases from real gaps.
  - Recommended correction: run the Supabase security linter (`supabase--security_lint` or equivalent) against the live project and enumerate every table with `rowsecurity = false`; for each, confirm intentional public status or add RLS. Phase 0 (before any further feature work), no dependencies, test via linter output diffed against an explicit allow-list of intentionally-public tables.

### Places where server functions accept client-supplied IDs directly
Where handlers `.eq("id", data.someId)` without any user/workspace filter in the same query, the check has been delegated to RLS. This pattern was seen in `animate.functions.ts` (`.eq("user_id", userId)` — good, explicit) but other modules (e.g., `reveal.functions.ts` `video_share_links` update) filter only on `video_project_id`/`id`, not on `user_id`, relying purely on RLS to prevent updating another user's share link.
- **Finding: Ownership enforcement is single-layered (RLS-only) in several `.functions.ts` handlers**
  - Severity: High / Confidence: Strongly indicated
  - Impact: defense-in-depth is absent; a policy bug, `service_role` leak, or a future migration that weakens a policy immediately becomes exploitable with no code-level backstop.
  - Evidence: `src/lib/reveal.functions.ts:766-786` — `update`/`insert` on `video_share_links` scoped only by `video_project_id`/`id`, no explicit `.eq("user_id", userId)` guard in the query itself.
  - Root cause: architecture leans on Postgres RLS as sole authorization boundary for row-level operations, which is a defensible pattern but leaves zero margin for RLS regressions.
  - Recommended correction: add matching `.eq("user_id", userId)` (or the workspace-equivalent) filters in server-function queries as belt-and-braces, especially on mutating (`update`/`delete`) operations. Phase 2, moderate effort across ~285 call sites, test via IDOR regression suite (`src/lib/rls.integration.test.ts` already exists — extend it).

### `supabaseAdmin` (service-role) usage sites
Confirmed service-role imports/usage in: `client.server.ts`, `angles.server.ts`, `animate.server.ts` (and `.functions.ts`), `beta/guard.server.ts`, `budget.server.ts`, `cloud-import.server.ts`, `credits.server.ts`, `crm.server.ts`, `db-retry.server.ts`, `declutter.server.ts`, `feedback.server.ts`, `floorplan.server.ts`, `listing-import.server.ts`, `mask-content.server.ts`, `materials.server.ts`, `object-edit.server.ts`, `obs/*.server.ts`, `parcel.server.ts`, `pdf.server.ts`, `presentations.server.ts`, `privacy.server.ts`, `reveal.server.ts`, `room-tools.server.ts`, `scene-clips.guards.server.ts`, `scene-clips.server.ts`, `scene-frames.server.ts`, `server-config.server.ts`, `sketch.server.ts`, `stage.server.ts`, `storage-cleanup.server.ts`, `storage-health.server.ts` — i.e., essentially every `*.server.ts` module (~35 files) uses the service-role client, meaning RLS is deliberately bypassed inside these modules and **every** manual scoping check inside them is load-bearing (no RLS backstop). This is a materially different trust boundary than the `.functions.ts` layer above.
- **Finding: Service-role usage is pervasive; each site is a manual-authorization-only zone**
  - Severity: High / Confidence: Confirmed (usage), Needs runtime verification (per-site correctness)
  - Impact: any `*.server.ts` helper that forgets a `user_id`/`workspace_id` filter when using `supabaseAdmin` has an unguarded IDOR, because RLS does not apply to the service role.
  - Evidence: e.g. `src/lib/presentations.server.ts:5` — `supabaseAdmin.storage.from("room-photos").createSignedUrl(path, 3600)` is called with a caller-supplied `path` and no visible ownership check in the shown lines; the burden of proving `path` belongs to the requester falls on the caller of this helper, not on this function.
  - Root cause: signed-URL minting and other storage operations require the service role because storage RLS/policies key off `auth.uid()` in the object path, but once elevated, path validation must be re-implemented manually.
  - Recommended correction: audit every `supabaseAdmin.storage...` and `supabaseAdmin.from(...)` call to confirm the `path`/`id` argument was already validated against the authenticated user upstream in the same call chain (not just "looks fine at a glance"). Phase 1, dependencies: needs call-graph tracing per site, test via storage-path fuzzing (`storage-health.server.ts` already has a self-test pattern — extend it).

### Storage buckets & signed URLs
Buckets referenced: `room-photos`, `reveal-videos`, plus a `CLIP_BUCKET` constant (scene clips), avatars, music tracks. All `createSignedUrl` call sites found use **short, table-appropriate TTLs**: `3600`s (1 hr) for room photos/animate jobs/reveal videos/scene clips, `60`s for existence checks and health probes, `28800`s (8 hr) for avatars/music. No call site was found minting an unbounded or excessively long-lived signed URL. Storage paths observed are UUID/user-id-prefixed (`${uid}/avatars/${f.name}`, `${uid}/${f.name}`), which is the correct non-guessable pattern *provided* the `uid` segment is always the authenticated caller's own ID and never client-supplied without verification (see finding above).

### Presentation/approval token entropy
`crypto.randomUUID().replace(/-/g, "")` (`reveal.functions.ts:772`) produces a 122-bit-entropy random token used as a public share token — this is cryptographically strong and not enumerable. Good.

### Realtime, triggers, DB functions
Not independently verifiable without live schema access in this session — **Needs runtime verification**. Recommend running `get_table_schema`/linter against the live project to enumerate triggers, functions (especially any `SECURITY DEFINER` functions, which are common privilege-escalation vectors) and realtime publication membership, and confirm no table broadcasts rows across workspace boundaries over realtime without a matching RLS filter (realtime respects RLS only if configured correctly).

### Security linter / scan
The live Supabase security-linter/scan tools were not available in this sandbox session (no connected project). This is itself a gap in the audit: **Recommended correction (Phase 0):** re-run this same audit with live tool access and attach the linter's raw findings (unrestricted RLS, `SECURITY DEFINER` without `search_path`, missing indexes on FKs, etc.) as an appendix before sign-off.

---

## (b) Authentication & authorization

### Session bootstrap / auth-middleware
- `src/integrations/supabase/auth-middleware.ts` defines `requireSupabaseAuth`, a server middleware that: requires `Authorization: Bearer <jwt>`, requires a 3-part JWT shape, and calls `supabase.auth.getClaims(token)` to validate — rejecting on any error or missing `sub`. This is real server-side verification, not a decode-only check.
- However, **the actually-wired middleware in `src/start.ts` is `attachSupabaseAuth`** (`auth-attacher.ts`), which is a **client-side** middleware that reads the local session and attaches the bearer token to outgoing server-fn requests — it does not itself verify anything server-side. The verification step then happens inside each server function via `context.supabase`/`context.userId`, which — per the generated comment in `client.server.ts`/`auth-middleware.ts` — appears to be populated by Supabase's own request-scoped client using the JWT, not by explicit re-invocation of `requireSupabaseAuth` in `functionMiddleware`.
- **Finding: `requireSupabaseAuth` (real token verification) is defined but not confirmed wired into every server function path**
  - Severity: Critical if unwired anywhere / Confidence: Needs runtime verification
  - Impact: if any server function is registered without middleware that actually calls `getClaims`/`getUser` server-side, a forged/expired/absent bearer token could reach `context.supabase` unauthenticated (falling back to anon role, which is only safe if every downstream query is RLS-correct for anon).
  - Evidence: `src/start.ts:29-31` wires `functionMiddleware: [attachSupabaseAuth]` (client-only attacher) as the *global* middleware; `requireSupabaseAuth` in `auth-middleware.ts` exists but its usage/registration was not located in `start.ts`. Need to confirm whether the generated `context.supabase`/`context.userId` seen in handlers (e.g. `reveal.functions.ts`) actually derives from `requireSupabaseAuth`'s claims check somewhere in the request pipeline, or from a lighter-weight construction.
  - Root cause: the two middleware files are both "automatically generated," suggesting a Lovable Cloud-managed integration layer; the split between client-attaching and server-verifying middleware is correct in principle but the wiring must be traced end-to-end to confirm no server function bypasses verification.
  - Recommended correction: trace one full request (browser → `attachSupabaseAuth` → server fn → `context.userId`) to confirm `getClaims` (or equivalent JWT verification) executes server-side before any handler body runs, for every server function, not just a sample. Phase 0, blocking, test with a forged/garbage bearer token against a sample of server functions expecting 401.

### Protected route gate (`src/routes/_authenticated/route.tsx`)
- The gate is explicitly **client-only** (`ssr: false`, comment: "The gate runs after hydration (not in beforeLoad)"). This means the initial server-rendered/static shell for any `_authenticated/*` route is sent to the browser before any auth check runs.
- **Finding: Authenticated route shell renders before client-side auth check completes (client-only authorization at the routing layer)**
  - Severity: Medium / Confidence: Confirmed (by design, per code comment)
  - Impact: this is a UX/architecture pattern, not by itself a data leak, **provided** all real data fetches inside protected pages go through authenticated server functions / RLS-protected Supabase queries (which appears to be the case) rather than being embedded in static markup. If any protected page pre-renders sensitive data server-side without checking auth (SSR data loader unguarded by `beforeLoad`), that data would leak to unauthenticated requests. This needs per-route verification of any `loader`/`beforeLoad` data-fetching under `_authenticated/`.
  - Evidence: `src/routes/_authenticated/route.tsx:6-13` — comment explicitly states SSR redirect was intentionally avoided to prevent hydration mismatch; `ssr: false` on the layout route.
  - Root cause: trade-off between SSR/hydration correctness and defense-in-depth at the routing layer; the design compensates by not doing SSR at all for this subtree (`ssr:false`), which mitigates but should be confirmed to apply transitively to all children routes.
  - Recommended correction: confirm `ssr:false` is inherited by (or independently set on) every child route under `_authenticated/`, and confirm no child route's `loader` fetches data without an equivalent client-side or middleware auth check. Phase 1, test via curling a protected route path with no cookies/token and confirming no sensitive data appears in the HTML payload.

### Sign-out / stale session risk
The `onAuthStateChange` listener redirects to `/auth` on `SIGNED_OUT`, and the effect's cleanup unsubscribes. There is a documented race-condition guard: "A signed-in session arriving... always wins over a pending check." This is a reasonable mitigation for the classic race where an async `getSession()` call resolves after a slower `SIGNED_OUT` event, or vice versa. No stale-shell finding here beyond the SSR-gate note above; **Needs runtime verification** for multi-tab sign-out propagation (does a sign-out in tab A immediately gate tab B, or does tab B keep serving cached data until next navigation?).

### Session network-failure handling
The retry loop (3 attempts, exponential-ish backoff `400 * attempt`) explicitly avoids bouncing users on transient network failure and only redirects on a definitive missing-session or 401/403 answer. This is good UX and does not appear to weaken security (it still requires an eventual definitive "no session" before granting access — `state` starts at `"checking"` and never renders `<Outlet/>` until `"in"`).

### Workspace ownership / team roles / invites / approval-link access
Not independently traced in this pass — **Needs runtime verification**. Given the pervasive RLS-and-service-role split identified in part (a), the same two questions apply here directly:
1. Do team-role checks (e.g., "is this user an admin of this workspace") happen via RLS policies referencing a `team_members`/`workspace_members` table, or via manual code checks in `*.server.ts` files using `supabaseAdmin`? Any code path using `supabaseAdmin` to check "is user X an admin of workspace Y" must not trust a client-supplied workspace ID without independently looking up membership server-side from the *authenticated* `userId` (from `context.userId`), never from a body field the client could tamper with.
2. Approval-link access (`approval_enabled` flag seen in `reveal.functions.ts`) appears to gate a public presentation feature; confirm the "approve" action route (if it exists) checks the approver's identity/token rather than trusting a client-supplied approver ID. Recommend a follow-up pass specifically diffing every `.functions.ts` handler for `context.userId` usage vs. `data.userId`/`data.workspaceId` usage — any handler that reads an ID *from `data`* (client input) to answer "who am I acting as" instead of from `context` (server-verified) is a probable IDOR.

---

## (c) Security & privacy sweep

### XSS via innerHTML
- 75 files reference `innerHTML` (`rg -l "innerHTML" src | wc -l` → 75); 4 files use React's `dangerouslySetInnerHTML`. The user's framing ("a very large imperative runtime that injects HTML") is corroborated by the innerHTML count, consistent with a canvas/DOM-manipulation-heavy editor (image/scene editing surfaces) rather than a typical CRUD app.
- **Finding: innerHTML usage volume warrants a targeted interpolation audit**
  - Severity: Needs runtime verification (High if any site interpolates user/listing content) / Confidence: Needs runtime verification
  - Impact: if any of the 75 sites builds an HTML string via template-literal interpolation of user-controlled data (listing descriptions, product names, comments, uploaded filenames) before assigning to `innerHTML`, that is a stored/reflected XSS.
  - Evidence: `rg -l "innerHTML" src` → 75 hits; not all reviewed line-by-line in this pass given volume.
  - Root cause: likely a canvas/SVG/imperative rendering layer (staging, floorplans, sketches) that manipulates the DOM directly for performance, which is a legitimate pattern but requires strict escaping discipline.
  - Recommended correction: `rg -n "innerHTML\s*=" src` and grep each result for template-literal interpolation (`` `...${`` ) of any variable traceable to listing import, user text fields, or filenames; sanitize with a DOM-safe encoder or switch to `textContent`/DOM API construction for any that touch user content. Phase 0 if any confirmed, otherwise Phase 2 hardening pass. Test: attempt to store a listing description containing `<img src=x onerror=alert(1)>` and confirm it renders inert.

### SSRF — listing import & scene-clips
- `src/lib/listing-import.server.ts` is well-defended: strict allow-list of 6 known listing-site hostnames (`ALLOWED`), explicit `PRIVATE_HOST` regex blocking localhost/RFC1918/link-local/`.internal`/`.local`/IPv6 loopback/unique-local, protocol restricted to `http(s)`, and the code comment states the only outbound call is to "an authorized listing-data provider (a licensed API)" rather than directly fetching the third-party listing page. This is good SSRF hygiene **for the URL-validation function itself**; the actual outbound `fetch` to the licensed provider (not shown in the reviewed range) should be double-checked to confirm it never re-uses the user-supplied `url` as a proxied target.
- `src/lib/scene-clips.server.ts:62-65` (`sourceDataUrl`) calls `fetch(path)` directly on a `path` argument sourced from `p.source_path` (line 333) — a DB-stored value. If `source_path` can ever contain an arbitrary external URL (vs. always being an internal storage path), and if that field is populated from client input anywhere upstream, this is a potential SSRF vector.
  - Severity: Medium / Confidence: Needs runtime verification
  - Impact: server-side fetch of an attacker-controlled URL could probe internal network endpoints or cloud metadata services if `source_path` is not constrained to trusted storage paths.
  - Evidence: `src/lib/scene-clips.server.ts:62-65,333`.
  - Root cause: `sourceDataUrl` is a generic "fetch this string as a URL" helper without host allow-listing, unlike `listing-import.server.ts`'s dedicated validator.
  - Recommended correction: confirm `source_path` is always an internal Supabase Storage path/signed URL generated server-side, never a raw client- or third-party-supplied URL; if any code path allows a client to set `source_path` to an arbitrary string, apply the same `PRIVATE_HOST`/protocol allow-list used in listing-import. Phase 1, test with a `source_path` pointing at `http://169.254.169.254/`.

### Secrets in the client bundle
Server-only env vars (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `LISTING_DATA_API_KEY`, `PARCEL_PROVIDER_KEY`) are all read via `process.env[...]` inside `*.server.ts`/`*.functions.ts` files, which in a TanStack Start app are server-only modules and should be tree-shaken from the client bundle. Only `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (intentionally public, publishable-key by design) appear with the `VITE_` client-exposed prefix. No evidence of a secret key being referenced from a non-`.server`/non-`.functions` file in this pass. **Recommended correction:** run a build and grep the emitted client JS bundle for the literal names `SERVICE_ROLE`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY` as a final confirmation (Phase 0, cheap, high confidence gain).

### File-upload validation
Not directly reviewed in this pass — **Needs runtime verification.** Given the presence of avatar/music/room-photo upload paths keyed by `uid`, recommend confirming server-side (not just client-side) file-type and size validation exists before storage write, since client-side-only validation is trivially bypassed by direct API calls.

### Prompt injection via imported listing content
The AI generation pipeline (angles/materials/staging/etc., all in `*.server.ts`) likely feeds listing-derived text (descriptions, room labels) into prompts sent to the Lovable AI Gateway. This was not traced line-by-line in this pass — **Needs runtime verification.** Recommended correction: confirm listing-derived free text is never concatenated unescaped into a system-level instruction with elevated trust (e.g., an instruction that could tell the model to ignore prior constraints or exfiltrate other users' data); at minimum it should be clearly delimited/quoted as untrusted user content in the prompt template.

### CSRF
`src/start.ts` explicitly re-adds `createCsrfMiddleware` with a comment noting that defining `start.ts` opts out of the framework's automatic CSRF middleware, so it must be manually restored — and it has been, scoped to `handlerType === "serverFn"`. This is correctly configured and is a positive finding (a common regression point when customizing `start.ts`).

### Signed URL TTLs
Covered in (a) — all sampled TTLs (60s–8h) are reasonable and none are unbounded.

### Presentation/approval token entropy
Covered in (b)/(a) — UUID-based tokens, not enumerable.

---

## (d) External providers inventory

| Provider | Config vars (names only) | Ownership | Auth method | Notes |
|---|---|---|---|---|
| Lovable AI Gateway (image/video gen & analysis) | `LOVABLE_API_KEY` | Server-only (`*.server.ts`, e.g. `animate.server.ts` `GATEWAY` fetches) | Bearer key, server-side | `animate.server.ts:98,129,137` show direct `fetch(GATEWAY, ...)` calls with polling (`/${jobId}`, `/${jobId}/content`) — a job-polling pattern; timeout/retry policy not confirmed in this pass. **Needs runtime verification** for retry/backoff and idempotency on retried generation requests (replay risk: does re-submitting the same job create duplicate billing-relevant AI calls?). |
| Listing import (Zillow/Realtor/Redfin/Homes/Trulia/Compass licensed data API) | `LISTING_DATA_API_KEY`, `LISTING_DATA_API_URL` | Server-only | Bearer/API key, server-side | Strong host allow-list + SSRF guards (see (c)). Failure behavior returns typed `ProviderFetch` error codes (`provider_not_connected`, `provider_error`) — good explicit error surface, not a silent fallback. |
| Parcel/property data provider | `PARCEL_PROVIDER_KEY`, `PARCEL_PROVIDER_URL`, `PARCEL_PROVIDER_NAME` | Server-only (`parcel.server.ts`) | API key, server-side | Not traced for retry/timeout in this pass. |
| Email | `RESEND_API_KEY` | Server-only | API key | Used presumably for invites/notifications/reset flows; not traced for template injection risk in this pass — **Needs runtime verification** that recipient/subject/body fields are not built from unsanitized user input in a way that enables header injection. |
| Billing | `STRIPE_SECRET_KEY` | Server-only | Secret key, server-side | Client-side Stripe.js publishable key not found in the `process.env` scan (may be hardcoded or fetched from server config) — recommend confirming no Stripe secret key is ever sent to the client and that webhook signature verification is present (not confirmed in this pass, **Needs runtime verification**). |
| Google Drive / Dropbox cloud import | (no dedicated env vars matched the generic scan) | `src/lib/cloud-import.server.ts` (uses `supabaseAdmin`) | Likely OAuth token-based, server-side | Not traced for token storage/refresh handling in this pass — **Needs runtime verification**, since OAuth refresh tokens for third-party cloud storage are high-value secrets if persisted in a table without encryption-at-rest beyond DB-level defaults. |
| Analytics (PostHog) | Not found via server-side `process.env` scan — likely `VITE_`-prefixed client-side key (expected/normal for PostHog's client SDK) | Client | Public project key by design | No sensitive PII pass-through checked in this pass. |
| E2E/test credentials | `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | Server-only (test tooling) | N/A | Confirm these only resolve in CI/test environments and are never read in a production request path — **Needs runtime verification**. |
| Beta gating | `RD_BETA_MODE` | Server-only (`beta/guard.server.ts`) | Feature flag | Confirm this cannot be toggled by client input; should be an env-only server flag (evidence supports this: read via `process.env` in a `.server.ts` file only). |

### Mock/silent-substitution risk
Not confirmed in this pass whether any provider silently falls back to a mock/stub when its API key is absent (which would make the UI "look functional without credentials" per the user's question) — **Needs runtime verification.** Recommended test: unset each of `LOVABLE_API_KEY`, `LISTING_DATA_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `PARCEL_PROVIDER_KEY` one at a time in a non-production environment and confirm the corresponding feature fails loudly (visible error state) rather than returning fabricated success data. `listing-import.server.ts`'s typed `provider_not_connected` error code suggests at least that path fails explicitly rather than mocking — worth confirming the same discipline holds for the AI gateway and cloud-import paths.

---

## Summary of confirmed/high-priority items for triage
1. **Needs runtime verification, Critical if true:** confirm `requireSupabaseAuth` (real JWT verification) is actually invoked server-side for every server function, not only client-attached tokens (b).
2. **Needs runtime verification, Critical if true:** confirm RLS is enabled on all 61 tables, not just 31 (a).
3. **High, strongly indicated:** several `.functions.ts` mutation handlers rely solely on RLS with no explicit `user_id` filter in the query — add defense-in-depth (a).
4. **High, confirmed pattern:** service-role (`supabaseAdmin`) is used in ~35 modules; each is a manual-authorization-only zone requiring per-site path/ID validation audit (a).
5. **Medium, needs verification:** `scene-clips.server.ts` `sourceDataUrl` generic fetch — confirm no client-influenced SSRF path (c).
6. **Medium/needs verification:** 75-file innerHTML footprint — needs a targeted interpolation-of-user-content pass (c).
7. **Positive findings to preserve:** CSRF middleware explicitly re-enabled in `start.ts`; listing-import SSRF guards are strong; signed-URL TTLs are all bounded and reasonable; share tokens use cryptographically strong random IDs.
