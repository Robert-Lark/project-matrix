# Handoff — smoke-snapshot-awareness landed (2026-07-11)

**Session summary:** the recorded prerequisite of the Rob-gated deploy leg
(issue #9 close-out, follow-up 4) landed as
[issue #11](https://github.com/Robert-Lark/project-matrix/issues/11): the
origin suite is **snapshot-aware** — it asks the origin which frozen
snapshot it serves and asserts THAT snapshot's committed artifacts, so the
post-deploy smoke holds whether the bucket serves the synthesized fixture
or the real crate. **No code steps remain between Rob's secrets and the
crate going live.** Full narrative: `docs/build-log.md` Phase 3; runbook:
`workers/README.md` "Arming runbook".

## What changed

- `workers/edge/src/index.js` — new `GET /api/snapshot`: a thin R2 read of
  the dated `SnapshotManifest` (ADR-0002 §1 provenance, §8 thin serving);
  method-gated GET/HEAD, outside the warm tier, no cache-state marker.
  Also: warm-tier entries keyed by a `?run=` nonce now expire after 1 h —
  they exist only to isolate one harness run, and un-TTL'd they would
  accrete in deployed KV forever (verify-slice finding); visitor-facing
  un-nonced entries keep the frozen-data infinite TTL.
- `tools/origin-suite/suite/snapshot.ts` (new) — the fail-closed resolver:
  fetches the served manifest, matches it against committed snapshot roots
  **lazily, fixture first** (CI never reads the crate artifact), requires
  full manifest equality, loads that snapshot's committed trays, and
  derives every probe value (PDP ids, missing id = max+1, image sha256
  from committed bytes or `images-index.json`). Any "couldn't tell" throws
  — the data-plane file fails, nothing skips. It logs which snapshot a run
  asserted, so exit-0 is never the only evidence.
- `tools/origin-suite/suite/data-plane.test.ts` — snapshot-parameterized
  and strengthened: PLP total `===` releaseCount (was ≥240), a full PLP
  sweep deep-equaling every page against the committed summaries, PDP
  deep-equals the committed detail plus a deterministic five-position
  sample, image identity via sha256 (+ byte-compare where bytes are
  committed), new provenance describe (served manifest == raw committed
  manifest; POST 405), a five-position image sample over ALL committed
  derivatives (a single predictable probe image was a game-able
  1-of-1,817 blind spot), and every warm-tier request — reads AND writes,
  HEAD included — rides the `?run=` nonce, so a persistent warm tier can
  never serve a previous snapshot's payload to the smoke, and the smoke
  never plants an un-nonced key a real visitor would later HIT as stale
  across the crate transition (the verify-slice standout finding class —
  it fired twice; `chrome.test.ts`'s rewriter probe now rides
  `cache=cold`). 118 assertions now.
- `tools/repo-checks/test/warm-tier-discipline.test.ts` (new) — the nonce
  discipline as an enforced guard, not a convention: every `/api/plp|pdp`
  request in the suite must be nonced, cold, or `kv-exempt:`-annotated
  with a reason. Three lenses independently found the one un-nonced
  request prose had missed.
- `tools/origin-suite/run-local.mjs` — `PM_SEED_DIR` mode: seeds another
  committed snapshot for a local verification run
  (`PM_SEED_DIR=tools/snapshot-capture/crate pnpm run origin-suite`).
  Default stays the fixture; **CI never sets it** (verified: zero
  occurrences in `.github/workflows/ci.yml`).
- Docs: `workers/README.md` (edge route list, local-dev crate mode, and
  the "Known follow-up" replaced by the five-step arming runbook),
  build-log Phase 3 entry, decision-map `snapshot-capture` follow-up line.

## Evidence (all local, definition of done)

- Fixture path: `pnpm run origin-suite` green twice back-to-back, 118/118.
- Crate path: `PM_SEED_DIR=tools/snapshot-capture/crate pnpm run
  origin-suite` green 118/118 — crate seed verified in the miniflare state
  (45 MB / 1,841 objects / crate name in the manifest blob), not inferred
  from exit 0; the resolver also names the asserted snapshot in the run
  log.
- Wrong/mixed seeds fail (all probed through the real seed path, run-local
  exit 1): fixture manifest over crate data → 4 loud failures
  (total/PDP/cache-leg/image); crate seed with ONE wrong-byte image →
  caught by the sha256 leg alone; unknown crate name → resolver throw;
  right-named manifest with stale capturedAt → resolver throw naming the
  field; unseeded plane (`/api/snapshot` 404) → data-plane file fails
  loudly ("couldn't tell" = fail, not skip).
- CI-independence probed empirically: with the crate directory moved
  aside entirely, the fixture-serving plane still verifies green.
- verify-slice ran in the background (the args-as-JSON-string gotcha fired
  and was patched on the session copy exactly as documented): 4 lenses,
  14 raw findings converging on ~8 distinct, all adopted inline
  pre-commit — the KV-staleness class (nonces + TTL + flush step + the
  repo-check), raw-vs-raw manifest equality, the PLP sweep + PDP sample,
  the image sample, and the cache-leg sub-nonce. Zero refuted as wrong;
  see the issue close-out comment for the full map.

## Rob-gated (unchanged, now with zero code steps in between)

1. Mint `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` + one-time
   prerequisites (workers.dev subdomain, KV namespace id paste-in).
2. Deploy → smoke green against the fixture-seeded bucket.
3. `pnpm capture seed --remote` → re-run the deploy job → smoke green
   against the crate.
4. Close #3, then #1.

Also still Rob's: "Prometheus Studio" label question; the two
published-data flags (image bytes in R2, commerce aggregates in the
trays); the `.claude/workflows/verify-slice.js` args-parse patch (fired
again this session, still worth landing).

## Observed anomalies (not this slice's code)

Two one-off failures in `bench.browser.test.ts` across the day's ~16
full suite runs, neither reproducing, both outside this slice's surface
(nothing here touches the bench path; the same tree ran green
immediately before and after each):

1. "one-command reproduce" burned its full 300 s budget where every
   other run finishes the whole suite in ~47 s — a stall, not a margin
   miss. Suspect surface if it recurs: the reproduce leg brackets visits
   with CDP `Profiler` sessions over the four pinned dev inspector ports
   — a hung inspector connection would stall exactly like this.
2. One crate-leg run had `webVitals.INP` null for a page target (the
   scripted-interaction vitals race in real Chromium; page targets are
   placeholder pages, so snapshot size cannot reach it).

The machine ran the suite ~5× its normal daily cadence under parallel
agent load. If either fires in CI, the uploaded `smoke-dev-logs`
artifact is the evidence to read; two flakes in one leg in one day is
worth a look if it continues.

## Housekeeping

- `caffeinate -is` PID 45961 still running (reused) — `kill 45961` when
  done.
- Scratchpad probe dirs/logs are disposable; nothing outside the repo is
  load-bearing.
- Local R2 currently holds whatever the last run seeded — the next
  `pnpm run origin-suite` re-seeds the fixture automatically;
  `pnpm capture seed` re-lands the crate in ~3.5 s.

## The map now

Open and Rob-gated: the deploy leg (#3/#1). Open and needing Rob:
`data-strategy-lab`, `a11y-section`, `home-surface` (+
`aesthetic-direction`, Rob's track). Per the map discipline: one ticket
per session, Rob picks the next node.
