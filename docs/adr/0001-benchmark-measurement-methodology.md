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

## Addendum — the ruler's accounting fixes (2026-08-01, issue #16 + audit)

The `bench-accounting-fix` unit (Rob's 2026-07-24 call: fix the ruler before the
first editorial batch) resolved four measurement defects, widened by a
whole-repo audit ([`docs/prototypes/audit-2026-08-01-and-next-unit-prompt.md`](../prototypes/audit-2026-08-01-and-next-unit-prompt.md)).
No §1–§9 decision changes; these sharpen §3 (KB accounting) and §6 (KB
fairness) and enforce §7 binding E in code. No benchmark number had published,
so none of these had corrupted a real result — the point was to fix the ruler
first.

**G. Inline resource bytes are attributed by uncompressed share (§3 defect 1).**

> **SUPERSEDED — the attribution rule only; see addendum O.** The carve-out
> boundaries and classifications below (executable→JS, inert→data,
> chrome→instrumentation) stand unchanged. The uncompressed-share RATIOS do
> not: the stated limit ("exact only if each part compresses at the
> document's average ratio") became measurable on the plane's own receipts —
> the injected chrome violates it hardest, the bias runs toward flattering
> the smallest published JS cells, and it scales with the chrome. Attribution
> is now leave-one-out brotli marginals at a wire-calibrated quality,
> normalised to `transferSize` (addendum O).

The document response is ONE brotli stream, so its compressed `transferSize`
cannot be split into per-part compressed sizes by measurement. It is attributed
to buckets in proportion to each part's share of the UNCOMPRESSED served bytes —
the one reproducible split that sums EXACTLY back to `transferSize` and
double-counts nothing (`decomposeDocument`, tools/bench-runner). Three parts are
carved out of what §3 previously dumped entirely into HTML: **inline executable
`<script>`** (empty/JS/module type) → the JS bucket and the initial-JS headline
(so Astro's inlined ~1.2 KB cart module is no longer reported as "0 KB JS"
against the no-runtime control); **inline non-executable `<script>`** (a type the
browser will not run: `application/json`, `qwik/json`, `importmap`, …) → the
DATA bucket (serialized resumability/hydration state is data, not runtime, and
must not inflate the JS headline a hostile reader is meant to trust); and the
injected **instrumentation markup** (§6 below). Which paradigm delivers inline
vs external, executable vs serialized, IS the render-axis variable (ADR-0003 §2)
— this split makes it visible instead of hidden in the HTML total. **Limit,
stated in the receipt and the methodology page:** the share is exact only if
each part compresses at the document's average ratio (JS and prose do not), so
it is a stated, reproducible attribution — strictly more honest than reporting
inline JS as zero — never a claim of per-byte compressed truth.

*Open cross-framework asymmetry, bound to the publication arc (verify-slice,
conformance lens).* The executable/inert split above keys on whether the
browser RUNS the script, which is correct for byte accounting but leaves a
confound the DATA-bucket rule was meant to prevent, reappearing ACROSS
frameworks: React's App Router delivers its serialized RSC hydration payload as
*executable* `<script>self.__next_f.push([…])</script>` (no type → JS bucket),
while Qwik delivers byte-equivalent serialized state as inert
`<script type="qwik/json">` (→ DATA). So react-next's initial-JS headline is
inflated by serialized data that Qwik's is not — two hydrating frameworks
printing different initial-JS purely by serialization FORMAT. No code changes
here (executable→JS is the honest byte rule, and nothing publishes this unit),
but **the cross-framework initial-JS cell must not publish as an apples-to-apples
verdict until this is decided** in the publication arc: either classify known
framework hydration payloads (React flight) as DATA by role, or publish the cell
with an explicit caveat that the JS headline includes serialized hydration data
for executable-payload frameworks but not inert-payload ones. Same class as the
CSS-delivery deferral (ADR-0003 addendum) — recorded, not silently resolved.

**H. Instrumentation markup is stripped, extending §6's known-path rule.** §6
strips our instrumentation from the counted total, but only the `/_pm/*` +
`/api/beacon` SUBRESOURCE payloads were stripped — the front Worker's injected
chrome MARKUP (`<aside id="pm-chrome">…`, its `/_pm/` head links, the
measurement script tag) rode inside the HTML byte bucket. It is now stripped the
same way and reported under `instrumentationBytes`. The document byte bucket
must not carry the instrument's own markup.

**I. Settle waits are signal-based, never a fixed proxy (§9; defects 4 + audit
collect.ts:171/:254).** Three fixed timeouts were replaced by waits on the real
signal, each BOUNDED so an absent signal surfaces honestly rather than hanging:
the per-interaction byte boundary waits for the network to go idle (a fetch of
any duration is counted, not cropped at 400 ms); the vitals-beacon flush waits
for beacon delivery to quiesce (a slow flush no longer writes a null vital that
silently shrinks the median's run count); and any post-load idle work (Qwik's
`requestIdleCallback` preloader) is awaited onto the INITIAL byte side before
the boundary snapshot, so the initial/interaction split is deterministic across
runs and profiles. This is the standing "wait for the real signal, never a
proxy" rule (tools/drift-gate/README.md) applied to the bench runner.

**J. Local CPU: serving-path attribution, binding-E enforced in code (§7 defect
2 + audit).** `LOCAL_PLANE_INSPECTORS` now registers every editorial variant
Worker (pm-vanilla 9235, pm-react-next 9236, pm-astro 9237, pm-qwik 9238), not
just front/placeholders/edge — the omission attributed ZERO CPU to whichever
variant served the page while its comparators WERE sampled. A visit's cost is
summed over its SERVING PATH ONLY — front + the variant resolved from the target
path + edge — **not** the whole plane: profiling non-serving isolates would let a
sibling suite's traffic on, say, pm-qwik contaminate a pm-vanilla number (and
unequally, since the non-serving set differs per target), and would force the
full plane up to bench one variant. That matches §7's stated "front + variant +
edge" cost model (the earlier whole-plane sum silently violated it — verify-slice,
anti-rigging lens). A missing SERVING-PATH inspector is a NAMED hard error, never
a silent under-attribution; a non-serving one need not even be up (pm-blog stays
out regardless — ADR-0009). And binding E ("local workerd sampling profiles are
development only") is enforced: `--local-cpu` against a non-loopback `--origin` is
refused, so an idle-local CPU profile can never be emitted as if it measured a
remote origin.

## Addendum — first publication: environment, chrome constant, serialization caveat (2026-08-13)

The first editorial bench batch (arc step 2) published the editorial
surface's readings. Three decisions the earlier addenda bound to "the
publication arc" are made and recorded here; no §1–§9 decision changes.

**K. Run environment for official batches (issue #16's open design
question, settled).** Official batches run OUT OF BAND on a quiet,
single-purpose machine — never inside a CI gate. The post-deploy smoke
asserts receipt SHAPE and provenance (structure, fence refusal, honest
nulls), never performance magnitudes: a magnitude asserted on a shared
runner goes red for reasons that are not regressions (the 2026-07-27
30-second goto timeout on a months-old page is the recorded instance) and
blocks the plane for none. The first published batch ran on an unpinned
local machine, labeled exactly that in every receipt's `runLocation`; §9's
pinned cloud runner, two-location protocol, and WebPageTest cross-check
remain downstream obligations. Consequence, binding until the WPT
cross-check exists (addendum A): throttled-profile timing cells publish
numbers, never verdicts — the published fit line rides bytes, which no
throttle touches.

*A second limit on the timing cells, stated because it is not obvious.*
The batch measured the plane as it served at measurement time — carrying
the PRE-publication chrome, since the publication had not shipped to it
yet. The chrome that ships with these numbers is larger (receipt anchors
and bands per cell), and its cost is the addendum-L constant. So the
published TIMING cells slightly understate what a visitor now meets, by
something bounded by that constant; the BYTE cells are unaffected, because
chrome bytes are stripped as instrumentation by known path (§6). This is
inherent to publishing measurements of a plane you are about to change,
and the honest resolution is the dated-snapshot model §9 already commits
to: **re-run the batch against the deployed plane after this ships** —
one command, and the receipts carry their own reproduce path.

**L. The chrome constant (addendum F / ADR-0008 §5 obligation, measured).**
Published as TWO figures that are not blended, because they are not the
same kind of cost: a **processing** delta and a **wire** cost. Measured on
`/vanilla/editorial/`, 7 runs per condition, slow-4g-mid-phone (the harshest
published profile), 2026-08-14 at a clean `58d5101`: **+224 ms FCP,
+216 ms LCP, 0 CLS, 0 ms long tasks, plus 1,908 bytes brotli on the wire.**
The strip's geometric-inertness claim (ADR-0008 §1) holds — zero layout
shift either way. Artifact: `/_pm/lab/chrome-constant.json`.

> **SUPERSEDED — see addendum N.** These figures were measured on a LOCAL
> composed origin. The constant that publishes is the deployed-plane
> measurement: **+104 ms FCP / +104 ms LCP / 1,913 B brotli**, against a
> byte-identical fragment. The "0 ms long tasks" figure above is a median
> that hides a one-sided signal (0–64 ms across 7 runs, every non-zero
> sample in the with-chrome condition). The "Bound obligation" closing this
> addendum is discharged — and, per N, structurally re-incurred.

*Method, and why it changed twice.* Both conditions intercept the document
and pay an identical hop; the without-condition replaces
decomposeDocument's three instrumentation regions with inert comments of
EQUAL byte length, so the document transfer term cancels and the timing
delta is the chrome's processing + subresource cost (a render-blocking
`/_pm/chrome.css`, the preloaded instrument mono, `measure.js` — all real
fetches from the real plane). What the chrome adds to the document on the
wire is measured separately with brotli and reported beside it. Metrics
come from the browser's own timeline in both conditions (the injected ruler
cannot measure its own absence) and CLS is the session-window maximum, the
definition web-vitals publishes everywhere else here.

*A superseded figure, recorded rather than quietly replaced.* An earlier
run of this obligation published **+76 ms FCP/LCP**. It was wrong twice
over, both caught by verify-slice: it served both conditions the DECODED
document, so the chrome's ~8 KB crossed a throttled wire uncompressed and
part of the delta was an artifact of the probe; and it ran against the
DEPLOYED plane, which carries no publication and therefore renders the
EMPTY-state chrome — ~3 KB smaller than the populated strip that ships.
Re-compressing the fulfilled body is not available (Playwright's
`route.fulfill` ignores a declared `content-encoding`; measured: a corrupt
3,660-byte document with no chrome node, against 18,146 for a plain
fulfil), which is why equal-byte padding is the mechanism. The probe now
records the fragment it measured (bytes, sha256, populated) and **the
front build REFUSES a constant measured against an unpopulated chrome**.

*Origin, stated.* Because the constant must describe the chrome that
ships, it is measured against a LOCAL composed origin serving this
publication (`run-local.mjs PM_HOLD=1` — the only thing that builds every
variant with the matching snapshot selector). Local first paint is not a
production number; the DIFFERENCE is what publishes, and both conditions
ran on the same plane under the same emulated network. **Bound
obligation:** re-measure against the deployed plane once this ships, when
that plane can render the chrome being measured.

**M. The addendum-G cross-framework asymmetry, resolved: publish with the
stated caveat, never reclassify.** The executable→JS byte rule stands —
classifying "known framework hydration payloads" as data by role would put
a hand-maintained framework list inside the ruler, which is exactly the
kind of judgment call a hostile reader calls rigging. Instead the caveat
is published where the numbers are read: the methodology page states the
asymmetry in full (React flight state counts as JS because the browser
executes it; Qwik's inert JSON counts as data), and the reading section of
every populated chrome panel links that page directly ("How these numbers
are made — and what they can't say" — §9's inline limits-of-data
affordance). No initial-JS comparison between two hydrating frameworks is
published as a verdict without the caveat riding it; the editorial fit
line names each paradigm's own cost and makes no react-next-vs-qwik claim.

**Publication shape (ADR-0008 §3's owner obligations, discharged).**
Published receipts are committed at `workers/front/lab/receipts/` and
served verbatim from `/_pm/lab/receipts/` (the excluded instrumentation
path); the per-surface bundle at `/_pm/lab/editorial.json` is BUILT from
those receipts by the front build — the served file and the bundle the
Worker imports and hands `renderChrome` are the same artifact, so they
cannot drift. The reading table's published value is the WARM column
median (§5: steady-state is the headline; the linked receipt carries cold
beside it), and **every cell publishes that median WITH its min–max band
across the batch's runs — addendum C's first clause, which the first draft
of this publication left unimplemented**: gating only the fit line let the
table itself invite comparisons inside the noise (verify-slice measured the
consequence: two LCP medians 44 ms apart whose bands overlapped
completely). The caption names the band and names the published column, so
a page read under `?cache=cold` cannot be mistaken for cold numbers. The
fit sentence is generated from receipt-derived values and the build REFUSES
it if the receipts do not support its claims: the byte bands of every
ADJACENT pair must be separable (checking only the spread's extremes is
near-vacuous while the sentence enumerates all five), the
no-interaction-fetch clause must hold in every variant's medians in both
columns, AND every run must have RECORDED reaching network idle after the
click — zero interaction bytes is also what a swallowed settle timeout
produces, so `interactionSettled` makes the claim falsifiable from the
artifact instead of assumed. C2 discipline as build mechanism, not review
policy. The build also refuses receipts minted from a dirty tree, receipts
spanning more than one SHA, date or run location, batches whose shapes
disagree, a fit template naming variants the batch did not measure, and any
unsubstituted value reaching the published sentence. **No publication is a
legitimate state**: the bundle builds empty, the chrome keeps its designed
empty states, and both pages compose an honest "not published yet"
sentence rather than a number-shaped hole — the same rule every unbuilt
surface already follows.
The methodology page (§9) lives at `/methodology/` as a front-Worker
static singleton — the "How it was built" surface (ADR-0008 §8) is its
long-term home and is unbuilt; the standalone page is the recorded
interim.

**N. Both addendum-K and addendum-L obligations, DISCHARGED against the
deployed plane — and what the discharge did not settle.** Measured
2026-08-14 at a clean `7c5be98`, the SHA main carried when the plane served
it.

*The chrome constant, re-measured (discharges L's bound obligation).*
Same method, same profile (slow-4g-mid-phone, `/vanilla/editorial/`, 7 runs
per condition), now against the deployed origin: **+104 ms FCP, +104 ms
LCP, 0 CLS, plus 1,913 bytes brotli on the wire.** The measured fragment is
byte-identical to the local one (12,023 B, `populated: true`), so this is
the same chrome measured on a different plane.

*The superseded figure, recorded rather than quietly replaced* (the
discipline this addendum's predecessor set for its own +76 ms figure, now
applied to L's): **+224 ms FCP / +216 ms LCP / 1,908 B, measured on a LOCAL
composed origin, is superseded.** The deployed timing delta is less than
half the local one. What is NOT established is why: the obvious reading is
that local subresource service inflated the local delta, but the two probes
did not serve identical pages (18,635 B local against 18,017 B deployed),
so the comparison is not clean and the causal claim is withdrawn. The
figure that publishes is the deployed one; the local one is recorded as
superseded, not explained.

*The long-task figure carries a band, and it is one-sided.* The constant
publishes "0 ms long tasks" as a MEDIAN, and the median hides a real
signal: 2 of the 7 with-chrome runs recorded 55 ms and 64 ms, against 0 ms
in all 7 without-chrome runs. Reported honestly the figure is **0 ms
median, 0–64 ms across 7 runs, every non-zero sample in the with-chrome
condition**. Addendum C's band rule binds every published cell, and the
constant is a published cell on the same page as the reading table; it
publishes with its bands from this addendum forward.

*The batch, re-run (discharges K's obligation).* Three profiles, one nonce,
all ten effective URLs pre-warmed to compressed first, `interactionSettled`
true on every run. K predicted timing up, bytes flat. **Bytes held. Timing
did NOT move uniformly up:** across the 30 LCP medians (5 variants × 3
profiles × cold+warm) the range is **−36 to +128 ms, with 26 up and 4
down** — on slow-4g, the harshest published profile, BOTH build-time
variants moved down in both columns (warm: vanilla −20, astro −16; cold:
vanilla −24, astro −36). Request-time TTFB moved **+29.7 to +72.2 ms**.
The prediction held on the request-time variants and on the two faster
profiles, and inverted for vanilla and astro on slow-4g, where the chrome's
cost sits inside the profile's own noise. Recorded because an earlier
draft of this discharge stated "+30 to +120 ms" and "timing cells moved
up", both falsified by the receipts committed alongside them.

*What the discharge did NOT settle — two open holes, both filed.*
(1) **The constant describes the chrome measured BEFORE the deploy it
enables.** The front build regenerates the chrome fragment from the
receipts, so the fragment that ships is not the fragment the probe hashed
(here 11,931 B against 12,023 B — 0.8%, but the mechanism is unbounded and
grows with each surface added to the strip). The build's only identity
check is `populated`, which both fragments satisfy. The obligation is
therefore structurally re-incurred by its own discharge, and calling it
simply "discharged" would be the vacuous class. (2) **Nothing ties a
receipt's `commit.sha` to the code the plane was serving.** `commitPin`
reads the LOCAL checkout; with `--origin` now pointing at a remote plane
for the first time, the SHA describes the machine that drove the browser,
not the tree under measurement. Both are recorded as open work on the
`bench-instrumentation-dilution` unit's ticket, which is the next ruler
change and the natural place to close them.

## Addendum — the dilution fix: wire-priced attribution, and both addendum-N holes closed (2026-08-15, `bench-instrumentation-dilution`)

The ruler unit. It supersedes addendum G's attribution rule (marked in
place above), closes both holes addendum N filed, and invalidates every
committed receipt — the editorial batch re-runs a third time on the fixed
ruler, post-merge, per the runbook at the end of O. No §1–§9 decision
changes; G's carve-out boundaries and classifications stand.

**O. The estimator: leave-one-out brotli marginals at a wire-calibrated
quality, normalised to `transferSize` (supersedes G's uncompressed-share
ratios).**

*The defect, measured on the live plane 2026-08-15 (all figures re-derived
this session against freshly fetched bodies; the astro wire body was
byte-identical to the 2026-08-14 saved one, 5,243 B).* The instrumentation
is 12,076 B of `/astro/editorial/`'s 19,289 uncompressed bytes (62.6%) and
compresses far better than the document average, so uncompressed share
over-attributed it and under-attributed every other bucket. Against the
settled estimator below, the old rule under-reported astro's inline-JS
cell by **47.5%** (347 B → 661 B) and qwik's by **42.6%** (257 B → 448 B);
on the external-recovery probe it read **40.5% low**. The bias scales with
the chrome — the mechanism behind the published astro cell moving
0.42 → 0.37 KB between batches with no astro change — and its direction
flatters the site's smallest published cells, which is the shape a hostile
reader is entitled to call rigging. The ticket's earlier "34–47%" range
was estimator-dependent; with the estimator settled, the measured range on
the three shapes is **40.5–47.5%**.

*The decision.* `transferSize` remains the authority on the LEVEL. The
between-part RATIOS are each part's **leave-one-out marginal** — the bytes
the compressed document loses when exactly that part's regions are removed,
in document order — computed with brotli at the **quality calibrated per
document** against the observed compressed body (`encodedBodySize`): scan
q0–q11, keep the smallest absolute residual, record quality and residual in
the receipt (`kb.docAttribution`). Largest-remainder apportionment keeps the
partition exact and non-negative, unchanged. A document served uncompressed
skips estimation entirely — per-part wire cost IS the uncompressed size, and
the rule degrades to exact truth, recorded as `uncompressed-share-identity`.

*Why this estimator — measured, not argued.* Candidates were computed on
the three live delivery shapes (vanilla external-single, astro inlined,
qwik external-many + qwik/json) under two validity probes: (A) swap the
chrome fragment on a fixed page — the recorded defect's own shape — and
watch the JS attribution; (B) inline a copy of vanilla's real `cart.js`
and compare the attribution against the same file's actual external wire
cost (1,351 B as Cloudflare serves it).

| Candidate | Probe A drift (chrome swap) | Probe B error (vs external truth) |
|---|---|---|
| Uncompressed share (G) | 14.1% | −40.5% |
| Isolated-region brotli + normalise ("the fix as written") | −1.9% | −5.3% |
| **Leave-one-out + normalise (chosen)** | **0.3%** | **−2.2%** |
| Shapley over the four parts | −0.5% | −3.8% |

The decision evidence is COMMITTED, not remembered:
`tools/bench-runner/estimator-lab/` carries the candidate script and the
exact Cloudflare-served bodies it ran over (sha256-manifested), so this
table re-derives offline forever — the live pages will drift, the
evidence will not. Isolated-region compression carries the known
small-region bias (astro's 1,278 B bundle compresses 2.23× alone against
3.68× in context; the isolated parts sum to only 0.867× of the wire, a
×1.15 scale-up) and measured worst of the three replacements on both
probes — rejected on the evidence, not on principle. Shapley is order-independent and splits shared
redundancy fairly, but measured no better than leave-one-out here, costs
16 compressions per document against 5, and puts game theory on a
methodology page — rejected as machinery the numbers don't pay for.
Hard-coding q4 (Cloudflare's apparent dynamic quality) was rejected in
favour of per-document calibration: the calibration is self-verifying,
records its own residual, and follows the CDN if it changes.

*The quality mismatch, narrowed from a stated risk to a measured residual.*
Addendum N's era left "local brotli ≠ Cloudflare brotli" as an open ratio
risk (4,321 B at q11 against 5,243 B on the wire, 4.46× vs 3.68×).
Calibration closes most of it: q4 reproduces the Cloudflare wire within
**+6 B / +12 B / −12 B (0.1–0.3%)** on astro / vanilla / qwik respectively.
The residual is recorded per run, never assumed.

*The new rule's own stated bias.* Disjoint parts' marginals do not sum to
the whole — redundancy shared BETWEEN parts is saved only when the second
part goes, so it belongs to no single marginal. Measured shortfall on the
live shapes: **0.942–0.952×** of the whole, so normalisation scales every
part up ~×1.05–1.06 pro rata, slightly over-crediting parts that share
more context than average. Bounded by the probes at ~2% on the cells
measured — against 40–48% for the rule it replaces. The floors instruction
on `/methodology/` stays until the batch re-runs, because the LIVE cells
still carry old-rule numbers.

*Coda (2026-08-16): the wire changed codecs the day this landed, and the
gate caught it.* The first attested batch after the merge came back
UNPUBLISHABLE by the unit's own Q gate: every document had ridden a
**zstd** wire — Chromium negotiates zstd and Cloudflare serves it — while
every wire this addendum's evidence measured was brotli, because curl-
and undici-shaped clients request br. Both wires are real; the ruler was
fitting a brotli model to a zstd byte count and honestly recording the
mismatch it could not previously see. The estimator therefore generalizes
exactly as its own principle requires: the leave-one-out marginals are
computed with **the wire's own codec** at the calibrated setting
(estimator `loo-wire-normalised`, with `codec` recorded beside quality,
the calibration target, and the residual), and the publication gate
refuses a split whose model codec does not match the wire it claims to
have calibrated against — and one whose matched codec misses its own
recorded target by more than 2% (64 B floor): codec identity and fit
quality are independent axes, and the refused batch proved the wrong
codec can fit within ~1%. Content-coding tokens compare
case-insensitively (RFC 9110), identically in the runner's model
selection and the gate's lookup. Measured:
zstd level 2 reproduces Cloudflare's zstd serving of the same page within
**+4 B (0.08%)** — the zstd body is committed beside the brotli evidence
in the estimator lab. The q4 figures above are correct for the brotli
wire they were measured on; they are now scoped to it.

*Runbook for the re-run (the receipts this invalidates).* (1) Merge
deploys the fixed ruler, the attestation, and this publication — receipts
unchanged, floors caveat live. (2) On a quiet machine, checkout at the
merge SHA, clean: pre-warm all ten effective URLs under one nonce until
compressed, then the three profiles (~7 minutes measured). New receipts
carry `originCommit` and `docAttribution` by construction. (3) The new
receipts change the chrome fragment, so the front build's identity gate
(P) fires: re-measure the chrome constant against the local composed
plane serving the new publication (the recorded interim), commit, merge —
then re-measure against the deployed plane and commit that, the addendum
L→N cycle now enforced by mechanism. (4) The floors sentence leaves
`/methodology/` in the re-run commit, with its pin in
`published-readings.test.ts` moving in the same commit.

**P. Addendum-N hole 1 closed: the constant is bound to the fragment that
ships, by hash.** The chrome-constant probe records the measured fragment's
sha256 AND its full render context (variant/surface/pathname/search read
from the probed target and the fragment's own data attributes, including
the serving colo). The front build re-renders the fragment — the real
renderer, esbuild-bundled at build time, against the very lab-bundle
artifact the Worker imports — under that recorded context, extracts it with
the probe's own rule (`chromeFragmentOf`, single-sourced in `@pm/switcher`
so the two sides cannot drift), and **REFUSES the build when the hashes
differ**. `populated` alone could not tell a current fragment from a stale
one (both the hashed and the shipping fragment satisfied it — N's 11,931 B
vs 12,023 B); the hash can. The refusal forces the explicit two-pass
publish: build → measure against a plane serving THIS publication → commit
the fresh artifact → rebuild. When the fragment itself changed, the plane
that can serve it does not exist until deploy — the local composed plane is
the recorded interim (the addendum-L precedent, its honesty note already
rendered by the methodology page), and the deployed-plane re-measure
follows the deploy. The probe separately refuses a fragment that changes
mid-probe, and a constant whose wire quality could not be calibrated (a
plane serving identity) is flagged `wireCalibrated: false` in the artifact
rather than passed off as the deployed figure. The constant's wire figure
itself now rides the same calibrated leave-one-out principle as the ruler
(it always was a leave-one-out marginal — previously at an uncalibrated
default quality).

**Q. Addendum-N hole 2 closed: the plane attests its build, and the runner
refuses a cross-tree receipt.** The front Worker serves
`/_pm/build.json` — `{kind, sha, dirty}` — stamped by the front build and
RE-stamped by both serving paths (the deploy script immediately before
wrangler, and run-local after its turbo build), because a turbo cache
replay restores a dist carrying the SHA of the commit that built it, and
the attestation must describe the tree actually deploying. Batches and
probes fetch it before anything measures, record it in the artifact as
`originCommit` beside the local pin, and **refuse** when the origin's SHA
disagrees with the local checkout or the origin does not attest — unless
the operator passes `--allow-cross-tree`, the explicit escape for
deliberate cross-tree measurement, in which case the artifact carries the
disagreement (or the null) in plain sight. The publication build refuses
to publish a receipt whose `originCommit` is null, dirty, or different
from its commit pin; receipts minted before the attestation existed carry
no field and are grandfathered until the re-run replaces them. Both the
batch and the probe RE-fetch the attestation after their last run and
refuse when it moved — push-to-main deploys the plane, so a deploy landing
mid-measurement would otherwise leave early runs measuring one tree and
late runs another behind a start-of-batch attestation that still matches
(verify-slice, this unit). The probe additionally binds every document of
BOTH conditions to the prefetched fragment hash, judged after each visit
rather than thrown from inside Playwright's route handler, where an error
has no reliable path back to the awaiting caller. The
refusal was proven against the real plane this session: the deployed
origin (which predates its own attestation) is refused by name, and the
constant re-measured against it below carries `originCommit: null` with
the escape — the bootstrap, visible in the artifact rather than smoothed
over.

*The chrome constant, re-measured under both closed holes (2026-08-16Z
artifact, pinned clean at this unit's code commit).* The deployed plane's
fragment hashes byte-identical to what this tree's build renders (the P
gate passes on it, and refuses a sabotaged hash by the fragment's name —
proven both ways this session), so the cross-tree bootstrap measures the
right chrome by construction, not by luck. Figures: **+76 ms FCP, +76 ms
LCP, 0 CLS; long tasks 0 ms MEDIAN, 0–57 ms across 7 runs, every non-zero
sample in the with-chrome condition** — the same one-sided signal N
recorded, now composed onto the methodology page from the artifact's own
runs instead of hidden behind the median. The wire figure is **2,322 B at
the calibrated q4** (residual +12 B on the 4,705 B compressed body). The
superseded q11-default pricing understates the same fragment's wire cost
on the same body by **17.1%** (1,925 B) — the uncalibrated default was
flattering the instrument, in the same direction and for the same reason
as the dilution itself. The timing figures supersede N's +104/+104
(measured against the same plane; the deltas moved with the plane's own
run-to-run spread, which is why the constant publishes as an order of
magnitude, never a per-profile equality — addendum F's scope note stands).
