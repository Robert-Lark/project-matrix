# workers/

The Cloudflare Workers that compose the canonical plane (ADR-0004 §2):

- `front` — the front routing Worker (issue #3): path-prefix dispatch over
  service bindings + the throwaway chrome-free index at `/`. Routes `/api/*`
  and `/assets/*` to the edge Worker. Chrome injection and the `/_pm/*`
  instrumentation path arrive with issue #5.
- `edge` — the data plane (issue #4): the frozen-snapshot R2 origin behind
  `GET /api/plp` + `GET /api/pdp/:id` (Zod-contract trays), `/assets/img/*`
  image serving, the KV warm tier (`?cache=` bypass; `x-pm-cache-state`
  marker; `?run=` is the documented harness isolation knob folded into the
  warm key), and the `POST /api/beacon` Analytics Engine collector (tag
  contract imported from `@pm/measurement`; suite traffic uses the reserved
  `ci-smoke` tag values, excluded from any field analysis by convention).
  Local dev seeds wrangler's local R2 from `tools/snapshot-fixture/snapshot/`
  (`pnpm --filter @pm/edge run seed:local`). The seeder accepts `--dir <path>`
  to seed any other snapshot-layout directory — `pnpm capture seed` uses it to
  land the real captured crate (`tools/snapshot-capture/crate/`); the default
  stays the fixture, so CI and the origin suite never depend on the real
  crate or the Discogs API (issue #9).

  Two deliberate scope lines: **images are outside the warm tier** (the
  cache-warmth axis belongs to the tray API; image bytes are immutable R2
  reads with long-lived browser caching), and **rate limiting is deferred to
  the arming step** — the org standard wants user-input endpoints rate
  limited; the beacon currently relies on strict input caps + the single
  origin (only `pm-front` has a public hostname; every other Worker sets
  `workers_dev: false` and is reachable solely through service bindings). A
  WAF/zone-level rule is the right home once a custom hostname exists.

## Local dev

`pnpm dev` at the repo root starts every Worker — **one `wrangler dev` process
per Worker** with distinct ports (front 8787, placeholder-static 8788,
placeholder-ssr 8789, edge 8790) and inspector ports; wrangler's local dev
registry connects the service bindings across processes. Seed local R2 once
per fresh checkout (`pnpm --filter @pm/edge run seed:local`) or use
`pnpm run origin-suite`, which wipes edge state and seeds automatically. The single-process
multi-config mode (`wrangler dev -c a -c b`) is **forbidden** — it
demonstrably breaks assets-through-bindings (spike FINDINGS).

`pnpm run origin-suite` starts the same processes, runs the composed-origin
integration suite against them, and tears them down.

## Deploying (the canonical plane)

CI deploys from `main` — variants first (service bindings must resolve), then
the front Worker — and re-runs the integration suite against the deployed
origin with the Brotli assertion (the post-deploy smoke, spike FINDINGS §5).

The deploy job needs two GitHub repo secrets, minted in the Cloudflare
dashboard (an API token with Workers Scripts:Edit on the account):

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Until they exist the deploy job skips with a loud workflow warning and nothing
reaches the plane.

**One-time prerequisites before arming the secrets:**

1. **workers.dev subdomain registered** (Cloudflare dashboard → Workers
   onboarding). All Workers set `workers_dev: true`; on an account with no
   subdomain, wrangler's registration prompt cannot be answered in CI and the
   first deploy fails loudly. Register once in the dashboard (or run one
   `wrangler deploy` interactively).
2. **KV namespace for the warm tier**: run
   `wrangler kv namespace create pm-warm` and paste the returned id into
   `workers/edge/wrangler.jsonc` (`kv_namespaces[0].id` — currently an
   all-zeros local-dev placeholder; the edge deploy fails until replaced).

The `pm-snapshot` R2 bucket needs no manual step — the deploy job creates it
idempotently and seeds the committed fixture snapshot on every deploy —
**until the real crate is seeded remotely** (`pnpm capture seed --remote`, a
manual credentialed step: the crate's image bytes are deliberately not in
git, so CI cannot re-seed them). From then on the seeder's clobber guard
refuses to overwrite a bucket whose manifest names a different crate, and
deploys leave the crate in place.

**Known follow-up (recorded on issue #9):** a handful of origin-suite
assertions are fixture-coupled (`/assets/img/ph-00-primary.avif` byte
identity, PDP ids `9000002`/`1234567`). They hold against the local plane
(the suite always re-seeds the fixture) and against a fixture-seeded deploy,
but the post-deploy smoke will need snapshot-aware fixtures (ids + sha256s
read from the committed trays/images-index) before the remote bucket is
switched to the real crate. Both gates are Rob-held, so this cannot fire by
accident.
