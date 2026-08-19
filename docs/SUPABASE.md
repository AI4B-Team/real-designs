# REAL DESIGNS — Backend Operations Guide

Everything an operator needs to run, verify and recover the backend.

## 1. Environment variables

### Server (never exposed to the browser)

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Backend API endpoint used by server functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Privileged key for admin-only server work. Never imported by a route or component module — always loaded inside a handler. |
| `SUPABASE_PUBLISHABLE_KEY` | recommended | Public key for server-side anonymous reads. |
| `LOVABLE_API_KEY` | yes | AI gateway access (design, scoring, video). |

### Browser

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Backend endpoint for the browser client. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Public key for the browser client. |

No secret may ever be given a `VITE_` prefix. `src/lib/server-config.ts`
encodes this contract; `assertServerConfig()` fails a request with a neutral
message when configuration is incomplete, and `npm run verify:backend`
reports the same thing at build/deploy time.

## 2. Storage buckets

All three buckets are **private**. Clients store the object **path**; display
URLs are signed on demand and renewed automatically (`src/lib/photo-src.ts`,
`src/lib/room-photos.ts`).

| Bucket | Contents | Object layout | Limits |
| --- | --- | --- | --- |
| `room-photos` | Uploaded and generated stills | `<userId>/<name>-<uuid>.<ext>` | image/\*, 15 MB |
| `reveal-videos` | Rendered videos and clips | `<userId>/...` | video/\*, 200 MB |
| `user-audio` | Voiceover and music uploads | `<userId>/...` | audio/\*, 25 MB |

Each bucket has SELECT/INSERT/UPDATE/DELETE policies restricting objects to
the owner's first path segment. `src/lib/storage-paths.ts` is the only place
object names are built: it sanitizes the original filename, forces a UUID and
refuses any path outside the owner's folder.

### Lifecycle rules

- Removing media from a property only clears `property_id`. The shared source
  row and its object are never deleted by a detach.
- `cleanupMyUploads` (server function) removes objects in the caller's folder
  that are older than 24 hours and referenced by no row, and marks render jobs
  stuck in `queued`/`running` as failed.
- `checkStorageHealth()` reports, per bucket: missing, public, policy gap,
  upload failure, signed-URL failure. `assertStorageReady()` guards uploads.

## 3. Database invariants

- Every table in `public` has RLS enabled.
- No table in `public` is reachable by `anon`; default privileges for new
  tables revoke `anon` as well. Signed-out client portals read only through
  token-scoped `SECURITY DEFINER` functions.
- Workspace scoping uses `auth.uid()` directly or `has_workspace_access(owner)`
  for shared workspaces, so changing an id in a request cannot cross a
  workspace boundary — the row simply is not visible.
- Server mutations re-check ownership in addition to RLS (for example
  `assignMediaToProperty` re-reads the property by `owner_id`).
- Multi-table writes that must not half-apply run inside one database routine
  (`replace_presentation_children`).
- Internal pricing tables (`markets`, `unit_costs`, `cost_mappings`) and the
  retention tables (`account_deletions`, `billing_retention`) have RLS enabled
  with no policies: they are service-role only by design.

## 4. Migrations

Files live in `supabase/migrations/` and apply in filename (timestamp) order.

```bash
npm run verify:backend        # static + live verification, read-only
npm run verify:backend -- --static   # no database connection needed
```

The verifier checks: filename ordering and uniqueness, every `CREATE TABLE` in
`public` followed by `GRANT` and `ENABLE ROW LEVEL SECURITY` in the same file,
no forbidden statements (`ALTER DATABASE`, writes to `auth`/`storage` schemas),
and — when database credentials are present — that every live public table has
RLS on, no `anon` privileges, and that the three buckets exist and are private.

It never writes, so it is safe to run against production.

## 5. Backup and recovery

- Automated daily backups are managed by the hosted database. Point-in-time
  recovery is available through Lovable Cloud → Advanced settings.
- Before a risky migration: export the affected tables to CSV, and record the
  latest migration timestamp so a rollback target is unambiguous.
- User-facing recovery: every account can download a full export of its own
  data (`src/lib/data-export.ts`) — use it to restore a single workspace
  without a full database restore.
- Storage objects are not covered by a database restore. Treat object deletion
  as irreversible; that is why cleanup only removes unreferenced objects older
  than the grace window.

## 6. Test coverage

| Area | Command |
| --- | --- |
| Unit (paths, config, policies contract) | `npm test` |
| RLS + storage policy integration | `npm run test:integration` (requires `E2E_*` credentials; skipped otherwise) |
| Browser flows including the auth lifecycle | `npm run test:e2e` |
