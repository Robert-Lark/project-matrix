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
  warm key), the `POST /api/beacon` Analytics Engine collector (tag
  contract imported from `@pm/measurement`; suite traffic uses the reserved
  `ci-smoke` tag values, excluded from any field analysis by convention),
  and `GET /api/snapshot` — the served snapshot's dated `SnapshotManifest`
  (provenance, ADR-0002 §1; issue #11). The origin suite reads it to decide
  WHICH committed snapshot's artifacts to assert against, so the smoke holds
  whether the bucket serves the synthesized fixture or the real crate.
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
placeholder-ssr 8789, edge 8790, blog 8791, vanilla 8792) and inspector
ports; wrangler's local dev
registry connects the service bindings across processes. Seed local R2 once
per fresh checkout (`pnpm --filter @pm/edge run seed:local`) or use
`pnpm run origin-suite`, which wipes edge state and seeds automatically. The single-process
multi-config mode (`wrangler dev -c a -c b`) is **forbidden** — it
demonstrably breaks assets-through-bindings (spike FINDINGS).

`pnpm run origin-suite` starts the same processes, runs the composed-origin
integration suite against them, and tears them down. It re-seeds local R2
with the fixture every run (the CI seed, always); to run the same suite
against a crate-seeded local plane instead, set
`PM_SEED_DIR=tools/snapshot-capture/crate` — the suite asks the plane which
snapshot it serves (`GET /api/snapshot`) and asserts that snapshot's own
committed artifacts (ids + trays + image sha256s), failing closed if it
cannot tell (issue #11). run-local derives `PM_SNAPSHOT` (the build-time
snapshot selector minted by the editorial build's slice A) from
`PM_SEED_DIR`, so snapshot-parameterized variant builds (`@pm/vanilla`)
always bake the snapshot the plane serves — the one command holds either
way. CI never sets `PM_SEED_DIR`; the deploy job sets `PM_SNAPSHOT=crate`
on its build step because the deployed plane serves the crate.

## Deploying (the canonical plane)

**The plane is live (armed 2026-07-11): https://pm-front.robresearch87.workers.dev**
— serving the real crate; the runbook below was executed end-to-end and is
kept for re-arming and future re-seeds.

**Provenance backfill executed (2026-07-12):** the crate manifest's
`commitSha` was backfilled to `f60385f…` (the tray-landing commit — strategy
review finding 5 found the plane serving `"commitSha": null`), the remote
`snapshot/manifest.json` re-put to match, and `GET /api/snapshot` verified
serving it. Any future re-freeze follows the same convention: backfill the
landing commit into the manifest and re-put it remotely (see
`tools/snapshot-capture/src/normalize.ts`); trays unchanged ⇒ no KV
warm-tier flush needed.

CI deploys from `main` — variants first (service bindings must resolve), then
the front Worker — and re-runs the integration suite against the deployed
origin with the Brotli assertion (the post-deploy smoke, spike FINDINGS §5).

The deploy job needs two GitHub repo secrets, minted in the Cloudflare
dashboard (an API token with **Workers Scripts:Edit + D1:Edit** on the
account — D1:Edit joined the requirement with the blog plane's
`migrate:remote` step, ADR-0009 §8; learned the loud way when the first
post-merge deploy of `main` failed there with API error 7403 on
2026-07-18, deploying nothing):

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
   `workers/edge/wrangler.jsonc` (`kv_namespaces[0].id` — an all-zeros
   local-dev placeholder until then; the edge deploy fails until replaced).
3. **Analytics Engine enabled on the account** (Cloudflare dashboard →
   Workers → Analytics Engine → create a dataset: name `pm_rum`, binding
   `BEACONS`, matching `workers/edge/wrangler.jsonc`). Discovered on the
   first armed deploy (2026-07-11): the API rejects any Worker binding an
   Analytics Engine dataset until the account has opted in once via the
   dashboard — `pm-edge` fails with error 10089 ("You need to enable
   Analytics Engine") and a dashboard deep-link. One-time, account-wide.
4. **D1 database for the blog plane** (ADR-0009): run
   `wrangler d1 create pm-blog` and paste the returned id into
   `workers/blog/wrangler.jsonc` (`d1_databases[0].database_id`) — the
   committed id belongs to the account that armed first; on any other
   account the blog's `migrate:remote` fails loudly until replaced. The
   `pm-blog-media` R2 bucket needs no manual step (the deploy job creates
   it idempotently).
5. **Blog admin credential** (ADR-0009 §5): generate a high-entropy
   credential, keep it in the password manager, and set its hash on the
   Worker: `printf %s "<credential>" | shasum -a 256`, then
   `wrangler secret put ADMIN_CREDENTIAL_HASH` in `workers/blog`. NOTE:
   the post-deploy smoke can only prove the wall REFUSES — a missing or
   wrong secret is invisible to CI (everything correctly 401/403s), so
   **verify a real login at /blog/admin after arming**. Current secret
   set 2026-07-18; the credential lives at
   `~/.config/project-matrix/blog-admin-credential` (0600).

The `pm-snapshot` R2 bucket needs no manual step — the deploy job creates it
idempotently and seeds the committed fixture snapshot on every deploy —
**until the real crate is seeded remotely** (`pnpm capture seed --remote`, a
manual credentialed step: the crate's image bytes are deliberately not in
git, so CI cannot re-seed them). From then on the seeder's clobber guard
refuses to overwrite a bucket whose manifest names a different crate, and
deploys leave the crate in place.

**Arming runbook (the remaining Rob-gated steps, in order — no code steps
left in between; issue #11 removed the last one):**

1. Complete the one-time prerequisites above and mint the two repo secrets.
2. Push (or re-run the deploy job): CI deploys the plane and runs the
   post-deploy smoke against the fixture-seeded bucket. The suite is
   snapshot-aware — it reads `GET /api/snapshot` and asserts the committed
   artifacts of whatever snapshot the bucket serves — so this run asserts
   the fixture's, and goes green.
3. Seed the real crate remotely: `pnpm capture seed --remote`. The clobber
   guard keeps later deploys from resetting the bucket to the fixture.
   Then **flush the warm tier**: KV keys carry no snapshot identity by
   design (frozen data never needs invalidation *within* a snapshot's
   lifetime), so any canonical key warmed before this re-seed would keep
   serving the fixture forever. The smoke itself plants only
   self-expiring `?run=`-keyed entries (enforced by the repo-checks
   warm-tier guard), but the origin is publicly reachable from step 2 on
   and stray traffic cannot be ruled out. E.g.:

   ```sh
   # from the repo root; the --filter already puts wrangler in workers/edge,
   # so do NOT also pass --config (it would resolve relative to that cwd)
   pnpm --filter @pm/edge exec wrangler kv key list --binding WARM --remote \
     | jq '[.[].name]' > /tmp/pm-warm-keys.json
   pnpm --filter @pm/edge exec wrangler kv bulk delete /tmp/pm-warm-keys.json \
     --binding WARM --remote --force
   ```

   (Executed 2026-07-11: 12 keys, every one a `?run=`-nonced suite key —
   the nonce discipline held on the real plane; deleted, recount 0.)

   (An empty list is the expected result if nothing hit the plane; the
   flush is then a no-op. Any FUTURE re-seed under live traffic needs the
   same flush.)
4. Re-run the smoke (re-run the deploy job): the same assertions now resolve
   the crate's manifest and assert the crate's committed trays + its
   `images-index.json` sha256s — proven green locally against a crate-seeded
   plane before this was recorded (issue #11).
5. Close #3, then #1.
