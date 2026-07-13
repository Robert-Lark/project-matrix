---
status: accepted
date: 2026-07-06
ticket: measurement-methodology
---

# Benchmark measurement methodology — fair metrics across rendering paradigms

## Context

Project Matrix builds one Discogs vinyl store across several rendering paradigms
(static-edge, Vercel-Edge SSR, server-HTML/HTMX, and a non-React Remix 3 frontier
build) and publishes their performance/UX/infra-cost tradeoffs as evidence of
staff-level architectural judgment. The entire thesis is only as credible as its
numbers: a skeptical staff engineer must be unable to call the benchmark rigged.
The hard part is *fairness across architectures that are not alike* — e.g. TTFB
means something different for a prerendered static file (≈0 server work) than for
an SSR function that renders per request and may cold-start. This ADR records the
methodology; it does not build it.

All metric facts below were verified in-session against primary sources
(web.dev / developer.chrome.com, W3C/MDN specs, the `GoogleChrome/web-vitals`
README, and the Cloudflare/Vercel/Datadog pricing pages), not from model recall.

## Decision

**1. Lab and field have split, non-overlapping roles.** Lab (synthetic, throttled,
median-of-N, pinned config) is the *comparison engine* — the only numbers compared
across variants, because determinism + reproducibility is what makes them
un-riggable. Field/RUM is the *reality check* and the honest source of INP. Field
numbers are shown per-variant as real-world spread, never as a cross-variant
ranking (traffic mix is uncontrollable). Rationale: Core Web Vitals are
"first and foremost, field metrics" but "many of them are also measurable in the
lab" (web.dev/articles/vitals); INP is field-first and Lighthouse does not measure
it — TBT "may be a reasonable proxy metric for INP, but it's not a substitute"
(web.dev/articles/inp). CWV are assessed at the 75th percentile, segmented
mobile/desktop.

**2. One ruler, injected identically everywhere.** Google's `web-vitals` library
(same build) is dropped into every variant, in both lab and field, so TTFB/FCP/
LCP/CLS/INP share one definition across variants and environments. Chosen over
Lighthouse because Lighthouse can't measure INP and bakes opinion into a composite
score. Bytes-over-the-wire (not covered by web-vitals) are read from the browser's
own resource-timing/network accounting.

**3. KB is bucketed, not a single total, with initial JS as the headline.** Split
into HTML/JS/CSS/fonts/images/data plus a per-interaction byte cost. A single lump
total would *hide* the resumability/islands win: a content-heavy Qwik page can be
heavier in total bytes than a lean React page while shipping near-zero JS. The
paradigm difference lives in the **JavaScript** bucket, so initial JS KB is the
headline number for the render-axis cells.

**4. Fairness controls.** Three published test profiles (fast-wifi+laptop,
avg-broadband+desktop, slow-4G+mid-range-phone) applied identically at the
automation layer; cold-cache and warm-cache as separate columns; median of ~7–10
lab runs (never best-of), p75 for field; and the load-bearing rule — **only one
variable changes per comparison** (compare paradigms with environment frozen;
demonstrate the environment flip with paradigm frozen).

**5. TTFB is decomposed and framed as a trade.** Every request is split into
travel-time (network) vs server think-time using the Navigation Timing sub-phases
(server wait ≈ `responseStart − requestStart`; network = phases before
`requestStart`). Warm/steady-state is the headline; cold-start is shown as a
labeled callout. Tested from two locations (near + far) to reveal the edge's
"close to everyone" advantage honestly. The narrative frames TTFB as *what each
paradigm traded away* (static skips per-request work but can't personalize / can go
stale), not a race — which is the thesis in one metric.

**6. KB fairness.** Identical compression (Brotli) and identical assets on every
host (the design-system zero-bias guarantee); our own instrumentation is stripped
from the counted total; we report compressed bytes actually transferred
(`transferSize`/`encodedBodySize`), not the decoded size.

**7. Cost model = measured resource profile × swappable rate card.** The measured
part (CPU-ms, bytes, requests per visit) is pure architecture and comes from the
harness; the price part is a dated, published rate card. We report two numbers: an
*architecture-only* cost (the same rate card applied to every variant, isolating
paradigm from vendor) and a *real-world* cost (each variant on its actual host).
Everything normalizes to $/1M visits at a stated cache-hit ratio and region. We
show the **actual charge to date** (honestly ≈$0 — portfolio traffic sits inside
every host's free tier, so the cost story is inherently an at-scale one) plus a
**grounded extrapolation** validated by that small real usage. The full arithmetic,
rate card, capture date, and assumptions are published so a skeptic can swap inputs
and re-run. Verified rate shape: Cloudflare Pages static serving is free/unlimited;
Workers = $0.30/1M requests + $0.02/1M CPU-ms; Vercel = $0.60/1M invocations +
~$0.13/CPU-hr + ~$0.15/GB egress.

**8. RUM pipeline.** `web-vitals` → beacon tagged with variant/surface/environment/
cache-state/location, fired via `navigator.sendBeacon()` on `visibilitychange`→
hidden (the library's own recommended pattern; page-hidden over unload) → a
vendor-neutral Cloudflare Worker collector → Cloudflare Analytics Engine as the
durable ~$0 home, with an optional Datadog RUM mirror for the enterprise-observability
evidence. The neutral collector prevents lock-in.

**9. Anti-rigging wrapper + execution environment.** The whole harness is public;
every published number links to its receipt (profile, run count, date, commit SHA,
raw results); a one-command "reproduce this" path exists; a plain-language
methodology page states every fairness rule, with an inline limits-of-data tooltip
next to the numbers. Runs execute on a pinned, documented cloud machine (steady +
reproducible) cross-checked by WebPageTest (neutral third party); all variants are
measured in one batch so a noisy moment hits them equally; numbers are published as
dated snapshots tied to commit SHAs, not live-updated (avoids presenting a noisy
run as gospel).

## Considered alternatives

- **Field-only (CrUX-style).** Rejected: a portfolio lacks the per-variant traffic
  to reach a stable p75, and results would be trivially skewed by traffic mix.
- **Lab-only.** Rejected: no honest INP, and no observability artifact.
- **Lighthouse as the single instrument.** Rejected: can't measure INP; composite
  score invites "the scoring is biased" attacks.
- **Single lump KB total.** Rejected: hides the JS/resumability story.
- **Live auto-updating numbers.** Rejected: measurement noise makes an unlucky run
  publish a misleading number; dated snapshots are more honest.
- **Commit to one RUM sink.** Rejected in favour of a neutral collector fanning out
  to a cheap durable store + an optional enterprise dashboard.

## Consequences

- Building the harness is downstream (Playwright runner + web-vitals injection +
  collector Worker + cost calculator + methodology page) and depends on
  `design-system` (identical assets), `data-contract` (payload to render), and
  `deployment-topology` (variants hosted).
- The methodology page and the per-metric fairness framing double as source content
  for the "How this was built" surface.
- Rate cards and captured pricing carry a date and will drift; the cost model is
  built to have its rate card swapped without touching the measured resource profile.

## Addendum — strategy-review clarifications (2026-07-12)

The adversarial strategy review
([`docs/reviews/2026-07-12-strategy-review.md`](../reviews/2026-07-12-strategy-review.md))
found gaps between what this ADR promises and what its mechanisms guarantee. No §1–§9
decision is reversed; the following sharpen them and bind downstream builds.

**A. Lab throttling, named honestly (review finding 1).** The lab's profiles are
applied via CDP network/CPU emulation at the automation layer — request-level
emulation above the transport stack, which does not reproduce connection setup,
request parallelism, or TCP slow-start. That limit is not paradigm-neutral: it
interacts with round-trip count, the very variable the slow-network cells measure.
Resolution: (a) the limit is stated in the methodology page's limits-of-data
tooltip and in every receipt's `methodNotes` (the sub-phase caveat there already
demonstrates it); (b) §9's WebPageTest cross-check is now specified, not decorative
— **any cell verdict that depends on a throttled profile is confirmed
directionally by a packet-shaped WebPageTest run before publication, and both
results ship with the cell.** If WPT disagrees with the runner on direction, the
cell publishes no verdict. ADR-0004 carries the matching §6 clarification.

**B. Checkout's interaction metric (finding 4).** §1 is right that field is the
only honest *population* INP and that Lighthouse cannot measure INP. But the lab
CAN measure real INP under **scripted interactions**: the injected `web-vitals`
ruler (§2) emits INP from real Event Timing entries when the runner drives the
page. The Checkout cells therefore publish **lab INP (scripted)** — named exactly
that, produced under the CPU-throttled profile with the interaction registry id in
the receipt — alongside the field INP spread as the reality check. TBT is never
presented as INP.

**C. A published noise rule (finding 17).** Receipts already carry raw runs; cells
now also publish the **median with its min–max band**, and comparative verdict
language ("faster", "wins") is permitted **only when the two bands do not
overlap**. Overlapping bands publish as "indistinguishable at this sample size."
No verdict adjectives ride on differences inside the noise.

**D. Field display gate (finding 13).** §1's per-variant field spread displays
only at or above a stated minimum sample (n ≥ 50 per variant/surface/profile
segment, shown with the n); below it the HUD shows the sample count and no
percentile — this ADR's own field-only rejection ("lacks the per-variant traffic
to reach a stable p75") applies to display, not just ranking.

**E. Cost cells (finding 11).** Three bindings on §7: (1) published cost cells
show the $/1M-visits number at a **cache-hit-ratio grid (0.5 / 0.9 / 0.99)**,
never a single chosen h; (2) **no cost cell publishes until CPU-ms comes from the
deployed plane's telemetry** (`$workers.cpuTimeMs`) — local workerd sampling
profiles are for development only, and the first armed harvest includes a one-time
calibration of sampling-profile vs platform meter; (3) §7's "grounded
extrapolation *validated* by that small real usage" is corrected to **anchored** —
free-tier traffic validates meter accounting, not at-scale behavior.

**F. Limits-of-data list, extended (findings 10, 16, 18, 19).** The methodology
page's limits tooltip additionally states: the origin computes over a ~500-release
frozen crate, so absolute server think-time and origin CPU-ms are floors, not
production magnitudes (comparisons transfer; extrapolations don't); the injected
chrome's *runtime* cost is measured once (with/without batch, one profile) and
published as a stated constant — byte-stripping alone does not remove it from
timing metrics; every lab number is a **Chromium** number (`web-vitals` + CDP);
and the page carries a privacy paragraph naming exactly what the beacon collects
(variant/surface/env/cache/location — no identifiers, no PII).
