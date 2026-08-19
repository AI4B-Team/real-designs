# REAL DESIGNS

REAL DESIGNS is a property visualization workspace for real estate agents, investors and renovators. It turns photographs of a space into redesigned and virtually staged images, assembles marketing videos and presentations, and shares the result with clients through branded links. Everything is organized around a property, so rooms, designs, media and presentations for one address stay together. Budget and contractor scope are Coming Soon: they turn on only once verified local cost data is licensed for a market, and no estimated numbers are shown in the meantime.

## Architecture

- **TanStack Start v1** on **React 19**, bundled with **Vite 7**, deployed to an edge worker runtime.
- **Supabase** for Postgres, auth, storage and row level security.
- Routing is file based under `src/routes`. Server logic is typed RPC via `createServerFn` in `src/lib/*.functions.ts`; raw HTTP endpoints (webhooks, cron, public APIs) live under `src/routes/api`.

Directory split:

| Path                  | Contains                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `src/routes`          | Route files, layouts and HTTP endpoints                                                            |
| `src/lib`             | Server functions (`*.functions.ts`), server-only helpers (`*.server.ts`), and pure browser modules |
| `src/content`         | The authenticated application and marketing site shells                                            |
| `src/styles`          | Global and per-surface CSS                                                                         |
| `supabase/migrations` | Schema, policies and grants                                                                        |

`src/content` modules are unusual: they export HTML strings and imperative `mount`/`bind` functions rather than JSX. The application shell is one large document whose views are toggled by `data-v` attributes, which is how the original prototype was authored and how the current interaction code is written. They are mounted by thin React route components. New shared UI should still prefer React components; the `src/content` modules are being narrowed over time, not extended.

## Required Environment Variables

Names only. Never commit values.

| Name                            | Missing means                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `SUPABASE_URL`                  | No backend connection at all                                                      |
| `SUPABASE_PROJECT_ID`           | Tooling and storage URL construction fail                                         |
| `SUPABASE_PUBLISHABLE_KEY`      | Server side Supabase calls fail                                                   |
| `VITE_SUPABASE_URL`             | Browser client cannot reach the backend                                           |
| `VITE_SUPABASE_PROJECT_ID`      | Browser client misconfigured                                                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sign in and all client reads fail                                                 |
| `LOVABLE_API_KEY`               | Every AI call fails: design generation, staging, narration, scoring               |
| `LISTING_DATA_API_URL`          | Address import returns `provider_not_connected`; users fall back to manual upload |
| `LISTING_DATA_API_KEY`          | Same as above                                                                     |

The six Supabase values are publishable/anon values that ship in the browser bundle. Protection comes from row level security, not from hiding them. `LOVABLE_API_KEY` and the listing data keys are server only and must never reach the client.

Account > System > Integrations reports which of these are present, read live from the server. It reports presence only, never values.

## Supabase Setup

Migrations live in `supabase/migrations` and are applied in filename order. Row level security is enabled on every public table with a large policy set, and every table carries explicit `GRANT` statements for `authenticated` and `service_role`. RLS must stay enabled: the anon key is public, so policies are the only access control. Any new table must ship with grants, `ENABLE ROW LEVEL SECURITY`, and policies in the same migration.

## Local Development

```bash
bun install
bun dev
```

The dev server runs on port 8080.

## Scripts

| Script              | Does                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `bun dev`           | Vite dev server with HMR                                             |
| `bun run build`     | Production build                                                     |
| `bun run build:dev` | Development mode build, used to catch prerender failures             |
| `bun run preview`   | Serve the production build locally                                   |
| `bun run typecheck` | `tsc --noEmit` on the strict project, then on `tsconfig.legacy.json` |
| `bun run lint`      | ESLint across the repo                                               |
| `bun run format`    | Prettier write                                                       |

`tsconfig.json` is strict, including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature`. `tsconfig.legacy.json` extends it and relaxes only those three noisy flags for the large legacy modules that are still being brought under type checking, one file per pass. `strict` and `strictNullChecks` stay on everywhere.

## Feature Status

| Feature                              | Status                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| Design generation                    | Live                                                                 |
| Virtual staging                      | Live                                                                 |
| Budget and contractor scope          | Coming Soon                                                          |
| Presentations and share links        | Live                                                                 |
| Media library                        | Live                                                                 |
| Video builder                        | Live                                                                 |
| Reports                              | Live                                                                 |
| CSV export                           | Live                                                                 |
| Product search and retailer matching | Sample. Records are development placeholders, flagged `sample: true` |
| Listing data import                  | Planned. Falls back to manual upload                                 |
| Stripe billing                       | Planned. No checkout, plan changes or top ups                        |
| Email delivery                       | Planned. Share links are copied and sent manually                    |
| Public API and white label           | Planned                                                              |

## Testing And Deployment

There is no automated test suite yet. End to end tests are deliberately deferred until the large modules are type checked, so that tests do not encode current defects as expected behavior.

`.github/workflows/ci.yml` runs on every push and pull request: install with a frozen bun lockfile, `typecheck`, `lint`, `build`. The typecheck step is `continue-on-error` and writes its error count to the job summary while the count is driven down; remove `continue-on-error` once it reaches zero.

Deployment is handled by the Lovable platform, which builds the app and publishes the edge worker.
