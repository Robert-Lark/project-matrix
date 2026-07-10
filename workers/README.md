# workers/

The Cloudflare Workers that compose the canonical plane (ADR-0004 §2):

- `front` — the front routing Worker (issue #3): path-prefix dispatch over
  service bindings + the throwaway chrome-free index at `/`. Chrome injection
  and the `/_pm/*` instrumentation path arrive with issue #5.
- `edge` — the data plane: R2 read API, KV warm tier, image serving, beacon
  collection (issue #4).

## Local dev

`pnpm dev` at the repo root starts every Worker — **one `wrangler dev` process
per Worker** with distinct ports (front 8787, placeholder-static 8788,
placeholder-ssr 8789) and inspector ports; wrangler's local dev registry
connects the service bindings across processes. The single-process
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

**One-time prerequisite before arming the secrets:** the account must have a
**workers.dev subdomain registered** (Cloudflare dashboard → Workers
onboarding). All three Workers set `workers_dev: true`; on an account with no
subdomain, wrangler's registration prompt cannot be answered in CI and the
first deploy fails loudly. Register once in the dashboard (or run one
`wrangler deploy` interactively) before adding the secrets.
