# Handoff — deploy leg armed, foundation closed (2026-07-11)

**Session summary:** the Rob-gated deploy leg ran end-to-end. **The
canonical plane is live at https://pm-front.robresearch87.workers.dev**,
serving the real crate (`ambient-melodic-techno-neoclassical-2006-2026`,
500 releases, 1,820 R2 objects), with the snapshot-aware post-deploy
smoke (118 assertions, Brotli asserted) gating every push to main.
**Issues #3 and #1 are closed** with AC→evidence comments; the
foundation build is complete. Narrative: `docs/build-log.md` Phase 2
"The deploy leg — armed"; runbook corrections in `workers/README.md`.

## What changed

- `workers/edge/wrangler.jsonc` — the warm tier's `kv_namespaces[0].id`
  is the real `pm-warm` namespace (`da06bf…`, created this session);
  committed as `8d9e722` after 118/118 ×2 locally.
- Cloudflare account (not in git): workers.dev subdomain `robresearch87`
  (pre-existed), KV namespace `pm-warm`, Analytics Engine enabled with
  dataset `pm_rum` / binding `BEACONS`, API token (Edit Cloudflare
  Workers template + Workers R2 Storage:Edit) → GitHub repo secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- Remote R2: fixture seeded by CI, then the crate via
  `pnpm capture seed --remote`; the clobber guard now keeps every future
  deploy from resetting it (proven in CI, exit 0 with the documented
  "refusing to overwrite" message).
- Remote KV: warm tier flushed post-transition (12 keys, all
  `?run=`-nonced suite traffic — the #11 discipline held; recount 0).
- `workers/README.md` — two runbook corrections (new one-time
  prerequisite: **Analytics Engine must be dashboard-enabled once** or
  Worker deploys binding a dataset fail with error 10089; the warm-tier
  flush incantation dropped its self-defeating `--config` flag) + the
  live-origin note.
- `docs/decision-map.md` — foundation-build resolved-and-deployed (#3,
  #1 closed); snapshot-capture: remote seed landed, "Prometheus Studio"
  resolved (Rob dropped the label, crate stands); **new `domain-cutover`
  ticket** (blocked by home-surface + aesthetic-direction).
- `docs/build-log.md` — Phase 2 deploy-leg entry.

## Evidence (definition of done)

- [Run 29170424194](https://github.com/Robert-Lark/project-matrix/actions/runs/29170424194):
  check + origin + deploy all green. Fixture smoke (first armed deploy)
  and crate smoke (after seed + flush) both 118/118 with
  `PM_EXPECT_BROTLI=1`; the resolver log names the asserted snapshot in
  each run (fixture, then crate), so exit 0 is never the only evidence.
- Hand probes against the deployed origin: variant page 200 with
  `content-encoding: br` and injected chrome (`pm-chrome-slot`,
  `data-pm-switcher`, `data-pm-hud*`, `/_pm/` assets);
  `GET /api/pdp/627110?cache=cold` → `x-pm-cache-state: bypass` with the
  committed detail; nonced PLP priming `miss` → immediate `hit`;
  `/assets/img/10098948-2.avif` byte-identical to its committed sha256.
- The spike's accepted residual risk (FINDINGS §5 — composition on the
  real plane) is retired: no architecture failure of any kind.
- Neither documented bench flake fired in three deployed-smoke runs.

## Still Rob's

- The two published-data flags (image bytes now in **public** R2 via the
  live origin; price aggregates in the committed trays) — the site is
  now genuinely public, so these are worth a decision sooner than later.
- The `.claude/workflows/verify-slice.js` args-parse patch (text in
  build-log methodology notes) — still unlanded.
- roblark.com cutover: **deliberately untouched** this session (no DNS,
  no custom domain; the legacy portfolio keeps working). Registrar/DNS
  "Netlify or Vercel, to be confirmed" — recorded on `domain-cutover`,
  which is blocked by `home-surface` + `aesthetic-direction`.

## Housekeeping

- `caffeinate -is` PID 45961 still running (reused all session) —
  Rob kills it when done.
- The chrome-devtools-mcp automation Chrome (profile
  `~/.cache/chrome-devtools-mcp/chrome-profile`) had hijacked macOS
  default-browser URL opens; killed this session. If links start opening
  in a bare automation window again, kill the Chrome process carrying
  that `--user-data-dir`.
- The workers.dev origin is public: the beacon endpoint writes real
  Analytics Engine points from any visitor. Suite traffic stays tagged
  `ci-smoke` by convention; rate limiting stays deferred to
  `domain-cutover` (WAF/zone rule needs a custom hostname).

## The map now

Foundation phase fully closed (#1–#9, #11 done; #10 resolved). Open and
needing Rob's grilling: `data-strategy-lab`, `a11y-section`,
`home-surface`. Rob's track: `aesthetic-direction`. Blocked:
`domain-cutover` (on home-surface + aesthetic-direction). Per the map
discipline: one ticket per session, Rob picks the next node.
