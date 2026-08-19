# Beta Go / No-Go Report

Date: 2026-08-19 · Decision: **GO for controlled closed beta (allowlist only)** ·
**NO-GO for paid public access.**

## Verified Flows (Automated Coverage + Code Audit)

- Account authentication (email + Google), session handling and sign-out.
- Photo upload with path-based persistence and auto-renewing signed URLs
  (`src/lib/photo-src.ts`, `photo-persistence.test.ts`).
- Room classification and Change Room Type across the shared room registry.
- Photo Design: bulk Design Photos modal, validation, credit confirmation.
- Canvas editing: routing state machine (`canvas-route.test.ts`), style
  selection, format overrides, autosave.
- Video Builder: scenes, transitions, ending control, card menus, effects.
- Media library, saved properties/projects, presentations and share links.
- Beta gating registry and server guards (`src/lib/beta/features.test.ts`).
- Monitoring, correlation IDs, idempotency and health endpoint.

## Blockers For Paid Public Access

| # | Blocker | Owner action |
| - | ------- | ------------ |
| 1 | Stripe billing is not connected; checkout and credit purchase do not exist | Enable Stripe, then flip `billing` to in-beta |
| 2 | No transactional email provider/sender domain; no receipts, resets or job notices | Connect sender domain, then flip `automated_email` |
| 3 | Budget and contractor scope are unpriced | Verify a market before exposing any number |
| 4 | Automated listing import has no compliant provider | Keep server guard on |
| 5 | Manual beta test matrix (`docs/BETA-CHECKLIST.md`) not yet executed end to end on new accounts | Run all rows at all widths |
| 6 | Public API and white label incomplete | Keep hidden |

## Known Limitations Communicated To Testers

- Credits are granted manually during beta; nothing is charged.
- Notification emails may not arrive; check the in-app notification list.
- Retailer product matching is manual: save your own products or import CSV.
- Budget, scope and cost estimates are intentionally absent, not broken.
- Generation can fail; every failure shows a reference code for support.

## Exit Criteria

Paid public access opens only when blockers 1–5 are closed, the checklist passes
at every listed width, and beta metrics hold: failure rate ≤ 5%, upload
completion ≥ 90%, first design completion ≥ 70%.
