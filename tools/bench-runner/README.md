# @pm/bench-runner

The [ADR-0001](../../docs/adr/0001-benchmark-measurement-methodology.md)
comparison engine as a tool (issue #7): a Playwright runner that drives
composed-origin URLs under the three published test profiles and emits
**SHA-pinned receipts** with a one-command reproduce.

```
pnpm bench run --targets /placeholder-static/sample/,/placeholder-ssr/sample/ \
  --profile avg-broadband-desktop --runs 7 --local-cpu

pnpm bench reproduce tools/bench-runner/receipts/receipt-….json --local-cpu
```

Receipts land in `tools/bench-runner/receipts/` (gitignored — published
numbers ship as dated snapshots downstream, ADR-0001 §9).

## What a batch holds constant (ADR-0001 §4)

One batch = one profile + one `?n=` + all targets, runs **round-robin
interleaved** so a noisy moment hits every variant equally. Cache state is
the two **columns** inside the batch: `cold` drives `?cache=cold` (the edge
Worker's KV bypass — cold stays cold for all N runs); `warm` makes one
unmeasured priming visit (the page's own data fetches pass the KV
write-through), then measures. A `?run=` nonce keys this batch's warm state
away from every other run's. Environment flips are separate batches by
construction — the spec admits exactly one profile and one n.

## Where every number comes from (never estimated)

- **Profiles** are applied at the automation layer via CDP
  (`Network.emulateNetworkConditions` with the spec's blessed
  `kbpsToBytesPerSecond`, `Emulation.setCPUThrottlingRate`, viewport/DPR/
  mobile from the versioned spec). The receipt records the exact applied
  values and mechanism — publish the arithmetic.
- **Web vitals** come from the injected chrome's own pinned `web-vitals`
  build (THE one ruler, §2): the runner intercepts the chrome's
  `POST /api/beacon`, records the payload, and fulfills it locally with a
  204 — so **lab runs never pollute the field data** (§1) and a page with no
  chrome honestly reports null, never an invented number.
- **KB** is compressed transfer size from resource timing (§6), bucketed
  HTML/JS/CSS/fonts/images/data (§3) with initial JS as the headline and a
  per-interaction byte cost (the scripted interaction is a registry id,
  reproducible from the receipt). Every `/_pm/*` and `/api/beacon` byte is
  stripped per the instrumentation-boundary contract
  ([packages/switcher/README.md](../../packages/switcher/README.md)) —
  stripped but *reported*, so the exclusion is visible and non-vacuous.
- **TTFB** decomposes into travel vs server think-time from the
  navigation-timing sub-phases (§5), raw timestamps kept in the receipt.
  One measured caveat, stated in every receipt's `methodNotes`: Chromium
  attributes these sub-phases BENEATH applied CDP throttling (demonstrated:
  a 500ms emulated latency delivers on the wall clock while `responseStart`
  still reads ~1ms), so the decomposition reflects the plane's *real*
  serving — compare it across variants; don't read it against the emulated
  RTT. Paint/interaction metrics (FCP/LCP/INP) are wall-clock and do carry
  the applied profile.
- **Every run is a fresh browser context** (a first-time visitor): the
  browser HTTP cache is a held-constant, not a measured axis — deployed
  assets ship `immutable`/etags, and a shared context would silently zero
  later runs' transfer sizes. The cache columns measure the *edge* tier.
- **The measured resource profile** (§7 — what the cost calculator
  consumes): bytes + requests from the runner's own resource-timing
  accounting; **CPU-ms per visit** from a real V8 CPU profile of every
  Worker on the plane, captured over the workerd inspectors `wrangler dev`
  exposes (CDP `Profiler`, 100µs sampling, `(idle)` excluded — verified
  live against the edge Worker's cold path: `handlePlp`/`computeFacets`
  attribution — a *measured sampling profile*, named as such, not a
  platform counter). Against the deployed origin no inspector exists: the
  field is an honest **null naming the armed-path source** — Workers
  observability's per-invocation `$workers.cpuTimeMs`, harvestable via the
  telemetry query API (`POST /accounts/{id}/workers/observability/telemetry/query`)
  with an API token; `observability.enabled` is already on for every plane
  Worker, so the harvest activates with the deploy leg (all verified
  against Cloudflare docs + workerd/workers-sdk source, 2026-07-09 — OSS
  workerd hardcodes trace cpuTime to 0, so there is genuinely no other
  local source). Every field carries its `source` string in the receipt.

## Reproduce (§9)

`pnpm bench reproduce <receipt>` rebuilds the batch from the receipt — same
URLs, profile, run count, interactions — refuses version-skewed receipts
(profile-spec pin), runs it as one batch, and emits a **new** receipt (fresh
date, fresh nonce, current SHA). Receipts from a dirty tree say so
(`commit.dirty`).

Like `@pm/origin-suite`, no `test` script: the runner is proven at the
composed-origin seam by `tools/origin-suite/suite/bench.browser.test.ts`
(tiny batch, all acceptance criteria asserted), which also runs in the
post-deploy smoke against the real plane.
