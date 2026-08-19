# REAL DESIGNS — Operations Runbook

Production monitoring, alerting, recovery and incident response.

## 1. Observability Building Blocks

| Concern                                         | Module                                  |
| ----------------------------------------------- | --------------------------------------- |
| Redaction (secrets, tokens, cards, signed URLs) | `src/lib/obs/redact.ts`                 |
| Correlation IDs                                 | `src/lib/obs/correlation.ts`            |
| Structured error reporting                      | `src/lib/obs/report.server.ts`          |
| Provider definitions & classification           | `src/lib/obs/providers.ts`              |
| Provider probes                                 | `src/lib/obs/health.server.ts`          |
| AI job lifecycle                                | `src/lib/obs/jobs.ts`, `jobs.server.ts` |
| Retry policy                                    | `src/lib/obs/retry.ts`                  |
| Duplicate protection                            | `src/lib/obs/idempotency.server.ts`     |
| Alert rules                                     | `src/lib/obs/alerts.ts`                 |
| User-facing failure copy                        | `src/lib/obs/messages.ts`               |

### Error record shape

Every server failure is reported through `reportServerError(error, ctx)` and written as a
single line prefixed `[rd.error]` plus a row in `ops_error_events`:

```
route, operation, workspaceId, requestId, correlationId, provider, code, severity, message, meta
```

`code` is always a short safe classification (`http_503`, `timeout`, `rate_limited`,
`forbidden`, `unhandled`, …). The message is redacted before it is written.

**Never logged:** API keys, service-role keys, bearer tokens, session cookies, passwords,
card/PAN/CVC data, and signed storage URLs (the query string is the access grant, so signed
URLs are reduced to `origin + bucket + [object]`).

### Correlation IDs

Format `RD-XXXX-XXXX`. Inbound `x-correlation-id` headers are reused when well formed.
User-visible failures show `Reference RD-XXXX-XXXX`; support traces it with:

```sql
select created_at, route, operation, provider, code, severity
from public.ops_error_events
where correlation_id = 'RD-XXXX-XXXX'
order by created_at;

select * from public.ops_jobs where correlation_id = 'RD-XXXX-XXXX';
```

## 2. Health Endpoint

`GET /api/public/health` (add `?force=1` to bypass the 15-second cache).

Returns overall state (`operational` | `degraded` | `outage`), per-provider state, probe
latency, a safe code, and current job counts. HTTP 503 when a critical provider is down.
The response contains no secrets, no environment values and no user data.

Monitored providers: Database & Auth, AI Generation, Photo Storage, Billing, Email
Delivery, Listing Data.

Point external uptime monitoring at this URL and alert on non-200 for two consecutive checks.

## 3. AI Job States

`queued → running → completed | failed | canceled | timed_out`. Transitions are guarded;
terminal states are final. Expected durations: design 90s, scope 60s, 3D plan 180s,
video 900s. A job past **2× expected** is stuck.

Sweep stuck jobs (idempotent, safe to run on a schedule):

```ts
import { sweepStuckJobs } from "@/lib/obs/jobs.server";
await sweepStuckJobs();
```

Timed-out jobs refund their credits; the user sees "Generation Took Too Long".

## 4. Retry And Duplicate Protection

Only idempotent operations retry: reads, signed-URL creation, storage upload/delete.
Generations, credit charges, webhook deliveries and email sends never auto-retry.

Duplicate generations and duplicate charges are prevented by
`ops_idempotency`: the key is `workspace:action:sha256(inputs)`. The first caller claims
the key and starts the job; concurrent callers receive the existing job and are not
charged. Keys expire after one hour and expired rows are reclaimed automatically.

## 5. Alerts

| Alert                           | Window | Threshold              | Severity |
| ------------------------------- | ------ | ---------------------- | -------- |
| High failure rate               | 15 min | ≥20% of ≥20 operations | Critical |
| Upload failures                 | 15 min | ≥25% of ≥10 uploads    | Critical |
| Generation timeouts             | 30 min | ≥5                     | Critical |
| Webhook failures                | 30 min | ≥3                     | Critical |
| Credit-ledger mismatch          | 60 min | ≥1                     | Critical |
| Unusual authentication failures | 10 min | ≥25                    | Warning  |

### High Failure Rate

Check `/api/public/health`. If one provider is down, follow that provider's section. If all
providers are healthy, inspect the top `code` values in `ops_error_events` for the window
and roll back the most recent deploy if the spike aligns with it.

### Upload Failures

Confirm the storage probe. Verify buckets `room-photos`, `reveal-videos`, `user-audio`
exist and are private, and that their policies are intact. Uploads retry safely; no credits
are charged for a failed upload.

### Generation Timeouts

Check the AI provider probe and the queued/running counts on the health endpoint. Run the
stuck-job sweep, confirm refunds landed in `credit_ledger`, and post to the status page if
the backlog exceeds 15 minutes.

### Webhook Failures

Inspect `ops_error_events` where `operation = 'webhook_deliver'`. Webhooks are never
auto-retried; replay them from the provider dashboard after the root cause is fixed.

### Credit Ledger Mismatch

```sql
select ca.user_id, ca.balance, coalesce(sum(cl.delta), 0) as ledger_sum
from public.credit_accounts ca
left join public.credit_ledger cl on cl.user_id = ca.user_id
group by ca.user_id, ca.balance
having ca.balance <> coalesce(sum(cl.delta), 0);
```

Any row is an incident. Freeze grants, capture the rows, and correct via
`grant_credits` with an explicit note — never by editing `credit_accounts` directly.

### Authentication Failures

A spike usually means credential stuffing. Confirm the source spread, then tighten auth
rate limits. Never log the attempted email or password.

## 6. Database Backup And Restore

- **Backups:** managed Postgres takes automated daily backups with point-in-time recovery
  on paid compute. Verify the retention window monthly.
- **Pre-migration snapshot:** every migration is additive and reviewed before apply; take a
  manual snapshot before any destructive change.
- **Logical export (quarterly, stored in the ops vault):**
  ```bash
  pg_dump --no-owner --format=custom "$SUPABASE_DB_URL" > rd-$(date +%F).dump
  ```
- **Restore drill (quarterly, into a scratch project — never production):**
  ```bash
  pg_restore --no-owner --clean --if-exists -d "$SCRATCH_DB_URL" rd-YYYY-MM-DD.dump
  ```
  Then run the app against the scratch database and confirm sign-in, a design generation
  and a presentation link.
- **Production restore:** declare an incident first, disable writes by pausing generation,
  restore to a point in time immediately before the damage, then reconcile
  `credit_ledger` against `credit_accounts` before re-enabling generation.
- **Recovery objectives:** RPO 24 hours (PITR: minutes), RTO 4 hours.

## 7. Storage Recovery

Buckets: `room-photos`, `reveal-videos`, `user-audio` — all private, owner-prefixed paths
(`<user_id>/…`, see `src/lib/storage-paths.ts`). Storage paths are the source of truth;
signed URLs are disposable and re-signed on demand.

- **Missing bucket:** recreate it as private, reapply the owner-scoped policies, then hit
  `/api/public/health` and confirm the storage probe is operational.
- **Deleted object:** the database row survives. `photo-src.ts` renders a recoverable
  failure state with Retry and Replace, so the user re-uploads into the same path.
- **Bulk loss:** restore the bucket from the provider's backup, then run the storage
  reconciliation in `src/lib/storage-cleanup.server.ts` to list database rows whose objects
  no longer exist and flag those projects for re-upload.
- **Never** repoint a row at a signed URL as a repair; always repair the path.

## 8. Incident Response

1. **Detect** — alert, health endpoint, or user report with a `RD-` reference.
2. **Declare** — name an incident lead. Severity: SEV1 core generation or sign-in down;
   SEV2 degraded or a non-critical provider down; SEV3 cosmetic or single-workspace.
3. **Communicate** — update `/status` within 15 minutes for SEV1/SEV2, then every 30
   minutes. Email affected account holders for anything over 30 minutes.
4. **Mitigate** — prefer rollback over a forward fix during a SEV1.
5. **Verify** — health endpoint green, alerts cleared, ledger reconciled, sample user flow
   completed end to end.
6. **Resolve and review** — post a status update, then write a blameless postmortem within
   five business days covering timeline, root cause, customer impact, credits refunded and
   follow-up actions.

## 9. Rollback

- **Application:** republish the previous known-good deployment. The app is stateless;
  rollback is safe at any time.
- **Database:** migrations are additive by policy, so an application rollback never
  requires a schema rollback. If a migration must be reversed, write a new forward
  migration that restores the previous behaviour — never edit or delete an applied one.
- **Feature-level:** paused features (Budget, contractor scope, payments) are gated in code
  and can be switched off without a deploy of the database.
- **After any rollback:** run the stuck-job sweep, reconcile the credit ledger, and confirm
  `/api/public/health` reports `operational`.

## 10. Status Page

`/status` reads `/api/public/health` live and shows real component state. When the endpoint
cannot be reached, the page says so explicitly instead of claiming everything is fine.
Incident history and communication policy on that page are maintained by hand.
