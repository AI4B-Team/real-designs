# REAL DESIGNS Closed Beta

This document is the operating manual for the controlled closed beta: what is in
scope, how gating works, how testers report problems, how support restores
credits, and the checklist that must pass before paid public access opens.

## 1. Beta Scope (Genuinely Working)

| Feature                     | Where                                |
| --------------------------- | ------------------------------------ |
| Account Authentication      | `/auth`, Supabase email + Google     |
| Photo Upload                | Studio, Media, Add More Photos        |
| Room Classification         | Upload pipeline, Change Room Type     |
| Photo Design                | Studio bulk + Canvas                  |
| Canvas Editing              | Studio Canvas                         |
| Video Builder               | Video workflow, scenes, transitions   |
| Media                       | Media library                         |
| Saved Properties / Projects | Properties, Designs                   |
| Presentations               | Presentations                         |
| Share Links                 | Presentation and video share links    |

## 2. Held Back (Hidden Or Labeled Coming Soon)

Budget, Contractor Scope, Automated Listing Import, Public API, White Label,
Retailer Product Matching, Billing And Checkout (Stripe not ready), Automated
Email (provider not connected).

Each carries an honest one-line reason from `src/lib/beta/features.ts`, shown in
the UI as a "Coming Soon" pill and, when clicked, as a toast.

## 3. How Gating Works

- `src/lib/beta/features.ts` — the single registry. Pure, unit tested.
- `src/lib/beta/guard.server.ts` — `assertBetaFeature(key, email)`; every
  held-back server action calls it first. Hidden navigation is never the only
  protection. Beta mode is on unless `RD_BETA_MODE=off`.
- `src/lib/beta/beta.functions.ts` — `getBetaState()` returns the resolved map
  for the signed-in account.
- `src/lib/beta/beta-ui.ts` — mounts the Beta badge and Send Feedback link in
  the topbar, labels held-back navigation, intercepts clicks on it, and mints
  the per-browser diagnostic ID.

### Allowlist

`public.beta_allowlist` holds invited emails. It is service-role only; the app
never reads it from the browser. Add a tester:

```sql
insert into public.beta_allowlist (email, note) values ('tester@example.com', 'Wave 1');
```

## 4. Feedback

The in-app feedback form (Help → Feedback, or the topbar Send Feedback link)
captures page, workflow, safe diagnostic ID, optional screenshot and the
tester's description. The context line is shown in the modal before sending, so
nothing is attached invisibly. Rows land in `public.feedback` with `page`,
`workflow` and `diagnostic_id`.

## 5. Onboarding

First-time users get the existing first-use flow (`src/content/rd-firstuse.ts`)
mounted at boot: pick a workflow, upload or try a sample space, then land in the
matching builder. New accounts start with no sample data.

## 6. Support Workflow For Failed Jobs And Credit Restoration

1. Tester reports the failure with the diagnostic ID (feedback form) or the
   `RD-XXXX-XXXX` reference shown on the failure state.
2. Find the job: `select * from public.ops_jobs where correlation_id = 'RD-...';`
   and the error: `select * from public.ops_error_events where correlation_id = 'RD-...';`
3. Confirm the charge in the credit ledger for that user and job.
4. If the job failed after charging and no output was delivered, restore credits
   with the ledger refund path (`refund` in `src/lib/credits.server.ts`) and note
   the correlation ID as the reason.
5. Reply to the tester with what failed, what was restored, and whether a retry
   is safe. Retries are idempotency-protected (`src/lib/obs/idempotency.server.ts`).

Full incident handling: `docs/OPERATIONS.md`.

## 7. Beta Success Metrics

| Metric                    | Definition                                              | Target |
| ------------------------- | ------------------------------------------------------- | ------ |
| Upload Completion         | Sessions reaching at least one stored photo              | ≥ 90%  |
| First Design Completion   | New accounts producing a first design within session one | ≥ 70%  |
| Saved-Project Return Rate | Testers returning to a saved project within 7 days       | ≥ 40%  |
| Video Completion          | Started videos that render successfully                  | ≥ 80%  |
| Failure Rate              | Generation jobs ending in `failed`                       | ≤ 5%   |
| Support Requests          | Feedback rows with category Problem, per active tester   | ≤ 0.5  |

## 8. Public Access Gate

Paid public access does not open until every critical flow in
`docs/BETA-CHECKLIST.md` passes and the Go/No-Go report
(`docs/BETA-GO-NO-GO.md`) records no open blockers.
