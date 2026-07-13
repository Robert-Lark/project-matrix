# Strategy review — the skeptical staff architect pass (2026-07-12)

Adversarial review of the **decision layer only** (thesis, sparse matrix, ADR-0001..0005,
CONTEXT.md, prototype FINDINGS, and the public claims they commit the site to). Code was
verified slice-by-slice as it landed and is out of scope. Method: steelman first, then
attack, then verify every citation against source read this session; two read-only probes
ran against the live plane (nonced). Findings ranked by threat to a hiring read:
**kill-shot** (lets a skeptic call a number rigged or defeats the thesis) → **discount**
(weakens credibility or reads as a judgment lapse) → **nitpick**. Neutral order within a
tier. Dispositions are recommendations; priority and effort are Rob's call.

## Verdict

A skeptical staff architect would advance this candidate on the strength of the decision
layer: the fairness literacy is unusual (cells designed against the author's own lead,
fenced exhibits with machine-checkable labels, honest nulls in the cost model, receipts
with published raw runs), and most attacks in this review died against defenses already
written down in the ADRs. The single change that most improves the hiring answer:
**resolve the throttling self-contradiction (finding 1)** — ADR-0004 §6's own language
currently hands a reviewer the exact sentence needed to discount every slow-network
number the CDP-throttled runner will publish, and those cells carry the thesis's "flip."
Close behind it: give the thesis an on-page home (finding 2) — today "fit, not
leaderboard" exists only in internal docs, and the 90-second visitor's read rests
entirely on a landing page scoped "nothing complex."

---

## Kill-shot tier

### 1. The lab throttle is the same class of synthetic the project tells skeptics to discount

**Claim attacked:** the slow-network cells (ADR-0001 §4's three profiles; ADR-0005 §6
cells 4–5) produce fair, defensible numbers.

**Steelman:** profiles are "applied identically at the automation layer"
(`docs/adr/0001-benchmark-measurement-methodology.md:53-55`), so any emulation bias hits
every variant equally; and the runner already documents one emulation artifact honestly
in every receipt (`tools/bench-runner/README.md:50-56`: sub-phase attribution sits
beneath applied CDP throttling, "compare it across variants; don't read it against the
emulated RTT").

**Attack:** ADR-0004 §6 rejects synthetic throttling for visitors with this reasoning —
"a synthetic in-browser delay does not reproduce connection setup, request parallelism,
or TCP slow-start — so it is a lab artifact a skeptic rightly discounts, forbidden by
real-world-fidelity for any published number"
(`docs/adr/0004-deployment-topology-and-contextual-switcher.md:122-125`). But the
comparison engine itself throttles via CDP — "Profiles are applied at the automation
layer via CDP (`Network.emulateNetworkConditions` …)" (`tools/bench-runner/README.md:30-32`)
— which is emulation applied above the transport layer, with exactly the missing fidelity
the ADR names. The runner's own receipts prove the emulation is not transport-real: "a
500ms emulated latency delivers on the wall clock while `responseStart` still reads ~1ms"
(`tools/bench-runner/README.md:52-54`). And the "applies equally" defense does not hold
for these cells, because the distortion is not paradigm-neutral: connection setup,
parallelism, and slow-start interact with **round-trip count and payload scheduling —
the exact variable cells 4–5 measure** ("Round-trips are the currency of slow networks:
finished HTML in one trip vs shell-then-data in two",
`docs/adr/0005-plp-data-strategy-comparison.md:134`). An emulation that mis-models
connection dynamics mis-sizes precisely the loaders-vs-shell gap being published.

**Why a hiring engineer cares:** it is a one-line, quotable self-contradiction sitting on
the credibility root. "Your own ADR says request-level synthetic delay is a lab artifact
a skeptic rightly discounts — why do your slow-4G cells deserve better?" has no recorded
answer. ADR-0001 §9's WebPageTest cross-check
(`docs/adr/0001-benchmark-measurement-methodology.md:99-100`) is the natural mitigation —
WPT-class agents shape traffic at the packet level — but the strategy never says what the
cross-check checks (direction? magnitude? ordering?), so today it cannot be pointed at as
the answer.

**Disposition:** fix in docs before the PLP/Editorial builds. Two compatible moves:
(a) narrow ADR-0004 §6's wording so it rejects *re-throttling a live visitor's page*
specifically, and states why automation-layer CDP emulation is accepted for lab (the
standard lab practice, applied identically, published mechanism) **with its fidelity
limits named** in the methodology page's limits-of-data tooltip; (b) promote the
WebPageTest cross-check from a mention to a specified mechanism for throttle-sensitive
cells — e.g. "cell verdicts that depend on a throttled profile are confirmed
directionally by a packet-shaped WPT run before publication; both results ship." Either
alone helps; both together close it.

### 2. The thesis is deliberately never stated on-page, and the surface that must carry it is scoped "nothing complex"

**Claim attacked:** "fit, not leaderboard" is legible to a solo visitor in 90 seconds
(the map's own audience model: "opened alone via a blog/application link; every surface
self-explains", `docs/decision-map.md:13`).

**Steelman:** the pure-evidence stance is a deliberate, recorded preference ("no 'AI age'
manifesto copy; the demos convince", `docs/decision-map.md:12`), and every-surface
self-explanation is a standing preference with real teeth downstream (e.g. ADR-0002 §3's
mandatory live-demo copy).

**Attack:** the thesis is explicitly fenced out of the site: "**Thesis (internal rubric —
NOT on-page copy)**" (`docs/decision-map.md:9`). The one surface positioned to translate
the evidence into a claim about the builder — the gateway — is scoped away from that job:
"scoped simple per Rob: chrome + prose + CTA, nothing complex"
(`docs/decision-map.md:196`). What remains to carry "architectural judgment, fit not
leaderboard" to a 90-second visitor is per-cell copy on surfaces that don't exist yet.
The failure mode is the exact one the ticket for this review names: a superbly
instrumented site that reads as an elaborate framework benchmark — the numbers legible,
the *judgment* invisible. A staff engineer who never learns what the site is arguing
cannot credit the candidate with the argument.

**Why a hiring engineer cares:** the project's one job is transferring the judgment
signal. Every fairness mechanism below serves that transfer; if the frame never reaches
the visitor, the mechanisms are overhead.

**Disposition:** reframe the `home-surface` ticket. Not a manifesto — the pure-evidence
preference can stand — but the landing owes three sentences the internal docs already
contain in plainer form: one product, several architectures, real numbers; the point is
which fits when, not which wins; here's the receipt for every number. Treat that copy
with grilling-ticket weight, not "chrome + prose + CTA." The "How it was built" surface
can carry the longer form; the gateway carries the 90-second version.

---

## Discount tier

### 3. "Each differing by exactly one architectural move" is false for the loaders column

**Claim attacked:** "Four idiomatic exemplars, each differing from the naive baseline by
exactly one architectural move" (`docs/adr/0005-plp-data-strategy-comparison.md:38-40`).

**Steelman:** the axis is defined as "where the data layer lives," and moving the data
layer to the server genuinely implies server-rendered HTML; the mapping is recorded
openly (§2), and cells 2 and 3 are pure within-variant comparisons.

**Attack:** the loaders exemplar rides the HTMX variant
(`docs/adr/0005-plp-data-strategy-comparison.md:69`), so vs the cold baseline it changes
the renderer, the client runtime (htmx 14,996 B brotli vs the React baseline bundle
52,514 B — `docs/prototypes/data-strategy-lab/FINDINGS.md:33-37`), and the wire format
(3.6 KB HTML partial vs 11.6 KB JSON tray — FINDINGS.md:76-78) in the same move. Cells 4
and 5 therefore compare *strategy + paradigm* against *strategy*, and their verdicts
partially restate the render axis's bundle story. A skeptic reads "exactly one move" next
to the cell and calls it marketing. Note a same-variant alternative exists (Next
server-rendering + form-based PE hosts loaders inside the React variant) and was never
recorded as considered.

**Why a hiring engineer cares:** one-variable-at-a-time is ADR-0001 §4's "load-bearing
rule"; finding a two-variable cell under a one-variable label is the cheapest possible
rigging call.

**Disposition:** reframe, don't rebuild. State in ADR-0005/cell copy that the loaders
exemplar deliberately bundles the paradigm with the strategy (that *is* the real-world
choice teams face), that cells 2/3 are the pure one-variable cells, and why the
same-variant alternative was not chosen. Drop or qualify "exactly one architectural
move."

### 4. The Checkout spotlight's headline metric can't be produced under the methodology's own rules

**Claim attacked:** Checkout "Spotlights: INP under load" (`docs/decision-map.md:32`).

**Steelman:** ADR-0001 §1 is scrupulously honest about INP — field-first, "Lighthouse
does not measure it," TBT "not a substitute"
(`docs/adr/0001-benchmark-measurement-methodology.md:33-36`).

**Attack:** the same §1 rules that field numbers are "never a cross-variant ranking"
(line 33-34) and that lab has no honest INP. So the Checkout surface's headline
comparison — INP under load, across variants — is unproducible as specified: field can't
rank it by rule, lab can't measure it by tool. The interaction machinery ADR-0005 §3
builds (wall-latency + bytes per measured step) is a proxy, not INP. The gap is closable
— the one-ruler `web-vitals` build is injected in lab too, and scripted Playwright
interactions generate real Event Timing entries, so labeled lab-INP-under-scripted-
interaction is available — but no document currently claims that path, so the strategy
promises a cell it cannot yet explain.

**Why a hiring engineer cares:** a measurement-literate reviewer will ask "where does
Checkout's INP number come from?" and the docs answer with a contradiction.

**Disposition:** fix before the Checkout build ticket: specify the metric (lab INP from
scripted interactions under the CPU-throttled profile, named as lab-INP; or rename the
spotlight to interaction latency) and record it in ADR-0001 as an addendum.

### 5. The provenance anchor is null on the public plane

**Claim attacked:** "dated snapshots tied to commit SHAs"
(`docs/adr/0001-benchmark-measurement-methodology.md:102-103`); "Tied to a capture date +
commit SHA" (`CONTEXT.md:37-38`); the snapshot lands "with a dated `SnapshotManifest`
(capture date + commit SHA)" (`docs/decision-map.md:146`).

**Attack (probed live this session):** `GET /api/snapshot` on the canonical plane returns
`"commitSha": null`. The committed artifact agrees
(`tools/snapshot-capture/crate/manifest.json:6`). Mechanism: `commitSha: gitHead()`
(`tools/snapshot-capture/src/normalize.ts:290`) evaluated null at capture, and the
content-aware freeze then deliberately preserves the manifest
(`normalize.ts:269-271`), so it stays null. The first skeptic who curls the receipt
chain's root finds its one machine-readable code-to-data link empty — on a site whose
methodology page will say numbers are "tied to commit SHAs."

**Steelman:** a chicken-and-egg is real — a manifest cannot contain the SHA of the commit
that introduces it, and every downstream receipt carries its own commit SHA
independently.

**Why a hiring engineer cares:** not rigging — an honest null — but it reads as a
promise-vs-artifact gap in the exact place the project claims maximal rigor, and it's
discoverable in one request.

**Disposition:** fix cheaply: backfill a defensible value (the SHA of the commit that
landed the trays, recorded one commit later; or a content hash of the trays, which the
`images-index.json` pattern already establishes) and note the chicken-and-egg in the
manifest schema so the field is never silently null again.

### 6. The strongest fairness rules are the unenforced ones

**Claim attacked:** "Idiomatic default, not hand-tuned. Each paradigm uses the CSS
optimization a competent team normally gets from it — not a bespoke per-variant purge
tuned to win" (`docs/adr/0003-design-system-and-zero-bias-presentation.md:57-58`);
same rule for adapters (ADR-0004 §1) and configs ("hand-tuning is configuration that
exists only to win a cell", `docs/adr/0005-plp-data-strategy-comparison.md:109-110`).

**Steelman:** configs are published copy (ADR-0005 §4), the harness and repo are public
(verified this session: the GitHub repo is PUBLIC), and drift is machine-checked
(ADR-0003 §6) — so re-valuing is caught and configuration is at least auditable.

**Attack:** the drift gate enforces *pixel/DOM identity*; nothing enforces
*idiomatic-ness*. Who decides what "a competent team normally gets" from each of six
paradigms? The author — who also publishes the verdicts. "Auditable if you read six
codebases" is not a mechanism, and the project's own standard elsewhere is "proven, not
promised" (`docs/adr/0003:100`). This is the one place the project visibly grades its own
homework.

**Why a hiring engineer cares:** "how do I know you didn't quietly de-tune the villain?"
is the first question the flip framing invites ("React/Next is the *villain* on
Editorial", `docs/decision-map.md:36`), and today the answer is "trust my judgment plus
read the source."

**Disposition:** add a mechanism where one is cheap: scaffold each variant from its
framework's official starter and publish the diff-to-starter as part of the receipt
chain ("what we changed from the default, and why" — most entries will be the canonical
markup contract). That converts the rule from a claim into an artifact, and doubles as
"How it was built" content.

### 7. "Warm is reproducible everywhere" overstates KV, and the edge-flip magnitudes travel without their conditions

**Claim attacked:** KV chosen "because KV is globally replicated, so 'warm' is
**reproducible everywhere**" (`docs/adr/0002-data-contract-and-frozen-snapshot.md:120-122`);
"the globally-replicated edge cache that makes a 'warm' read reproducible everywhere"
(`CONTEXT.md:77-79`); "the live plane already shows ~400 ms R2 vs ~15 ms KV on this exact
seam" (`docs/adr/0005:133`); "edge TTFB 400ms→15ms" (`docs/decision-map.md:31`).

**Steelman:** ADR-0001 §5 decomposes TTFB into travel vs think and mandates two
locations; receipts carry a location label from day one (`docs/decision-map.md:140`); the
cache-state mechanism is real and disciplined (probed this session: fresh nonce →
`miss` → `hit` → `hit`; `?cache=cold` → `bypass`).

**Attack:** two parts. (a) KV's replication is demand-pulled to a PoP, not proactively
global — a key warmed by one priming request is hot *where it was read*; a visitor at a
distant PoP takes an uncached KV read at materially higher latency. "Reproducible
everywhere" should read "reproducible at a stated location." (This characterization
should be verified against Cloudflare's KV docs at PLP-build time — recorded here as
to-verify, not asserted.) (b) The headline numbers already circulate without their
measure or location: probed from this session's location, the same seam shows total TTFB
~119–128 ms (hit) vs ~236 ms (bypass) — a 2× flip, not 26×. "400→15" is presumably
server think-time at one location; quoted bare, it will be contradicted by the first
visitor's own HUD.

**Why a hiring engineer cares:** the edge flip is "the purest single-variable cell on the
site" (ADR-0005 §6) — its magnitude framing must survive a visitor's own curl, or the
purest cell becomes the easiest discount.

**Disposition:** language fix now (ADR-0002/CONTEXT: "reproducible at a stated location";
require any published magnitude to carry measure + location + link to its receipt), and
verify KV cold-read-at-distant-PoP behavior against primary docs before the PLP cell copy
is written.

### 8. The fat tray is a self-inflicted confound in the per-interaction byte cells

**Claim attacked:** per-interaction byte comparisons across strategies are a fair fight.

**Steelman:** recorded honestly in the prototype: "The HTML partial is SMALLER than the
JSON tray (3.6 KB vs 11.6 KB raw): the tray carries facet counts + unrendered fields on
every page… the numbers stay honest either way because both payloads are what each
strategy really ships" (`docs/prototypes/data-strategy-lab/FINDINGS.md:76-82`).

**Attack:** "what each strategy really ships" is true bytes but not a fair *design*: the
tray's shape is the project's own API decision, and it taxes only the JSON-fetching
strategies (loaders renders server-side). The counterfactual — split facets from page
data, the note ADR-0005's consequences defer to the PLP build ticket — would shrink the
hypermedia byte win the cells will publish. A skeptic frames it as: "you compare your fat
API eaten as JSON against your fat API eaten as HTML, and credit the difference to the
paradigm."

**Why a hiring engineer cares:** the per-interaction byte cost is an ADR-0001 §3 headline
number; a confound the author controls and deferred is a soft version of grading your own
homework.

**Disposition:** resolve at the PLP build, before cell copy: either split the facet
payload (and re-measure), or publish both numbers (tray as-is / facets excluded) in the
cell so the payload-design share of the gap is visible.

### 9. Freezing hides more than the docs say it hides: invalidation

**Claim attacked:** "the only thing freezing hides is the request-time cost of the
dynamic slice" (`docs/adr/0002-data-contract-and-frozen-snapshot.md:58-59`).

**Steelman:** catalog data is "legitimately pre-computable in production" (ADR-0002 §2) —
true, and the live-origin demonstration honestly stages the dynamic-fetch cost the freeze
removes.

**Attack:** frozen data also removes **cache invalidation and coherence** — "TTL is
effectively infinite since the data is frozen" (`docs/adr/0002:125-126`). In production
the edge-KV strategy's dominant cost is exactly that: TTL choice, purge-on-update,
stampede control, staleness windows. The same absence flatters the client-cache strategy
(`staleTime` on data that can never actually go stale). The benchmark shows caching's win
with the hardest part of caching deleted, and the recorded limits list doesn't say so.
The live-origin demo shows fetch cost, not invalidation complexity — it does not cover
this gap.

**Why a hiring engineer cares:** "cache invalidation is one of the two hard problems" is
the reflex objection of every senior reviewer shown a caching benchmark on immutable
data; the project should be the one to say it first.

**Disposition:** accept-and-say-so: add invalidation to the "what freezing hides" limits
(ADR-0002 + the methodology page's limits-of-data tooltip), with the honest scoping that
the catalog/commerce split (§2) is what makes the omission production-faithful for
*catalog* reads specifically.

### 10. Toy origin compute: think-time and CPU-ms numbers won't transfer, and the limit is unstated

**Claim attacked:** TTFB decomposition ("server think-time") and the cost model's CPU-ms
per visit generalize as published.

**Steelman:** the plane is a shared constant (ADR-0004 §1), so cross-variant comparisons
survive; ADR-0001 §5 frames TTFB as a trade, not a race; the heavy crate deliberately
widens the spread (ADR-0002 §5).

**Attack:** the origin "search" is a Worker filtering a 500-release frozen crate in
memory — versus a production store's real search infrastructure. Absolute server
think-time and the "loaders pays server CPU-ms per interaction" cost story (ADR-0005 §6)
are priced on toy compute; the strategy verdicts that hinge on server-work magnitudes
(loaders' cost, edge's savings) shift if origin work is 10–50× dearer. Comparisons hold;
extrapolations don't, and no doc names crate-scale compute as a limit.

**Why a hiring engineer cares:** the standing principle is "findings must replicate in
the real world — no lab artifacts" (`docs/decision-map.md:85`); a practitioner's first
"that's a lab artifact" candidate is the 500-row in-memory origin.

**Disposition:** accept-and-say-so in the limits-of-data tooltip and methodology page:
state crate scale next to every think-time/cost number; frame server-work numbers as
floors ("a real origin only widens these gaps in the direction shown" — argue it or
don't claim it).

### 11. Cost cells: the cache-hit ratio is a free parameter with no sensitivity story, and the deployed-CPU publication gate is implicit

**Claim attacked:** "$/1M visits at a stated cache-hit ratio and region"
(`docs/adr/0001-benchmark-measurement-methodology.md:79`) plus "grounded extrapolation
**validated** by that small real usage" (line 82).

**Steelman:** the calculator's discipline is genuinely strong — explicit inputs only,
measured-columns-only blending ("Nothing is modeled, only weighted",
`tools/cost-calculator/README.md:42-44`), honest UNPRICED nulls, per-rate vendor quote +
URL, declared unmeasured meters, stated marginal-rates assumption (README:58-61).

**Attack:** (a) *h* decides verdicts: the edge strategy's cost advantage is
approximately linear in the chosen cache-hit ratio, and whoever publishes the cells
picks it. "Stated" makes it auditable, not neutral — there is no recorded rule for what
h the published cells use or why. (b) CPU-ms provenance: until the telemetry harvest
arms, the only CPU source is a local workerd sampling profile
(`tools/bench-runner/README.md:62-76` — named honestly), and the deployed branch is "not
yet exercised" (`tools/cost-calculator/README.md:69-73`). Nothing in the strategy states
the gate that no cost cell publishes until CPU-ms comes from the deployed plane's
`$workers.cpuTimeMs` — leaving open the attackable path of laptop CPU-ms priced at
production rates. (c) "validated by that small real usage" overclaims: free-tier traffic
validates meter *accounting*, not at-scale behavior; "anchored" is the defensible word.

**Why a hiring engineer cares:** cost is the thesis's third leg ("what each choice costs
in… infra spend") and the easiest leg to rig invisibly — parameter choice is where
benchmarks go to lie.

**Disposition:** three doc-edits: publish every cost cell at an h grid (e.g. 0.5 / 0.9 /
0.99) instead of one stated h; record the publication gate (deployed-telemetry CPU only,
plus a one-time calibration of sampling-profile vs platform meter when it arms); swap
"validated" for "anchored."

### 12. Discogs data: "copyright caution" reasoning stops at the repo boundary while the plane publishes the images

**Claim attacked:** the data-rights posture is handled ("image bytes deliberately
git-excluded (copyright caution — local + R2 only, flagged for Rob)",
`docs/decision-map.md:147`).

**Steelman:** images self-hosted for fairness (ADR-0002 §5, hotlinking rejected on auth +
rate-limit grounds), bytes kept out of git, the concern flagged rather than ignored.

**Attack:** the caution protects the repository, not the exposure — the canonical plane
serves those 1,817 derivatives to the public internet (probed live this session: the
plane is up and serving the crate), and `domain-cutover` will put them under
roblark.com. Git-exclusion is irrelevant to that. Meanwhile Discogs API terms
(attribution, permitted-use) govern the data and images, and no doc records a check.
The inconsistency — careful about committing bytes, silent about publishing them — reads
as risk theater to exactly the reviewer demographic this portfolio targets.

**Why a hiring engineer cares:** judgment about third-party data rights *is* staff
judgment; a portfolio that benchmarks beautifully but skipped the ToS check inverts the
signal.

**Disposition:** before `domain-cutover`: read the Discogs API ToS, record the call (an
ADR note or map entry: attribution added / scope confirmed / or images swapped for
licensed alternatives), and align the two halves of the posture.

### 13. Field/RUM: the ADR both rejects and promises per-variant field display

**Claim attacked:** "Field numbers are shown per-variant as real-world spread"
(`docs/adr/0001-benchmark-measurement-methodology.md:33-34`).

**Steelman:** field is fenced from ranking ("never as a cross-variant ranking"), which
removes the worst misuse.

**Attack:** the same ADR's alternatives section rejects field-only because "a portfolio
lacks the per-variant traffic to reach a stable p75" (lines 107-109) — then §1 commits to
displaying per-variant field aggregates anyway. At portfolio traffic, that display is a
p75 of single-digit samples: statistically noise, visibly so to the target audience, and
adjacent to real numbers it could contaminate by association.

**Why a hiring engineer cares:** displaying an aggregate your own doc calls unstable is a
small self-inflicted credibility leak on the page whose whole job is credibility.

**Disposition:** doc-edit: gate the field display on a stated minimum n (show "n=4 —
too few to aggregate" below threshold), or show raw dots instead of percentiles until
volume exists.

---

## Nitpick tier

### 14. CONTEXT.md still says "five pages"; the matrix has seven surfaces

"One of the store's five pages… (Editorial, PDP, PLP, Checkout, 'How it was built')"
(`CONTEXT.md:29-32`) predates the ADR-0003 reshape that added the Home gateway and the
A11y section (`docs/decision-map.md:26-34` — seven rows; ADR-0003 consequences,
`docs/adr/0003:150-156`). The glossary that defines the ubiquitous language contradicts
the canonical map; `docs/decision-map.md:49` ("five surfaces") has the same fossil.
**Disposition:** update both.

### 15. Beacon ingestion is open and suite exclusion is by convention

`POST /api/beacon` accepts unauthenticated writes; rate limiting is explicitly deferred
("rate limiting is deferred to the arming step… A WAF/zone-level rule is the right home
once a custom hostname exists", `workers/README.md:31-34`), and CI traffic is excluded
from field analysis "by convention" (`workers/README.md:14-16`). Field never ranks
variants (the fence that matters), but a third party can salt the observability exhibit.
**Disposition:** accept for now (recorded, WAF rule tied to `domain-cutover`); consider a
minimum-viability check at analysis time (drop tag combinations that don't correspond to
real pages).

### 16. Chrome's runtime cost is stripped from bytes but not from time

The injected switcher/HUD is excluded from measured KB and "stripped but *reported*"
(`tools/bench-runner/README.md:44-47`) — but its JS still executes on every measured
page, including the no-JS variants, and its bytes still occupy the wire during load.
Identical everywhere, so comparisons hold; absolute vitals (and any "zero JS shipped"
copy for vanilla) carry an unacknowledged chrome tax. **Disposition:** measure the
chrome's own cost once (with/without batch, one profile) and publish it as a stated
constant in the methodology page.

### 17. No stated decision rule for when a difference is a finding

Median of ~7–10 runs, never best-of, raw results in the receipt (ADR-0001 §4/§9) — but
no published threshold for verdict language. When cell 5's numbers land 8% apart, what
does the copy get to say? A measurement-literate reviewer asks this first.
**Disposition:** adopt and publish a simple rule (e.g. report median with min–max band;
verdict adjectives only when bands don't overlap; otherwise "indistinguishable at this
sample size").

### 18. The one ruler is Chromium-only

`web-vitals` + CDP throttling + Playwright = Chromium numbers; INP/LCP are
Chromium-defined metrics. Standard practice and the right scope call, but no doc names
it as a limit. **Disposition:** one line in the limits-of-data tooltip.

### 19. RUM collection has no stated privacy posture

The beacon carries variant/surface/env/cache/location (ADR-0001 §8). No PII by design —
but a public site collecting visitor RUM should say what it collects and doesn't; the
methodology page is the natural home. **Disposition:** one paragraph there.

### 20. The map's internal verdict language pre-commits outcomes the receipts must be free to contradict

"React/Next is the *villain* on Editorial" (`docs/decision-map.md:36`), "Qwik shines"
(line 30), "edge TTFB 400ms→15ms" (line 31) — internal shorthand, but these documents
are also declared source content for the "How it was built" surface
(`docs/decision-map.md:16`), and ADR-0005 §6 already sets the correct standard:
"Verdicts are what the receipts say; cell copy states the *question* and the mechanism,
never a presumed winner" (`docs/adr/0005:126-128`). **Disposition:** when the build-log
and map become site content, sweep the presumed-verdict phrasing or annotate it as
hypothesis-at-planning-time.

### 21. The a11y section will publicly serve deliberately broken pages

The DS-off stripped counterparts are, by design, inaccessible pages on a public site —
real assistive-tech users can land on them directly (deep link, search index). The
ticket's honesty-caveat instinct ("emulation ≠ the real OS mode",
`docs/decision-map.md:189`) doesn't yet cover this. **Disposition:** scope note for
`a11y-section`: noindex the stripped pages, label them before the defect (not after),
and put the compliant version one obvious link away.

---

## Survived attack — defenses that held

1. **Frozen snapshot as canonical origin.** Attacked as "the numbers are from fake
   serving conditions"; held: "live marketplace data mutates between runs, would blow the
   60/min rate limit under a benchmark batch, and could 500 in front of a viewer"
   (`docs/adr/0002:50-52`), catalog/commerce split makes freezing production-faithful for
   what's frozen (§2), and the one admitted hidden cost is staged on-surface (§3). (But
   see finding 9 for the second hidden cost.)
2. **Cell 1 designs against the author's own lead.** "The site's headline strategy loses
   its own opener: anti-rigging by design" (`docs/adr/0005:131`). This is the single most
   convincing fairness artifact in the docs — a benchmark whose flagship loses a headline
   cell is hard to call rigged.
3. **Published-config rule with the default demonstrated.** The `staleTime` attack ("you
   chose the config that makes the revisit free") dies on §4: the library default's
   background refetch is *measured and shown as a labeled footnote* (11.6 KB,
   `docs/adr/0005:106-110`; `FINDINGS.md:52`), and the general rule is stated. Residue:
   "production-defensible" argues from volatility the frozen catalog doesn't have —
   minor wording.
4. **The misapplication exhibit's fairness design.** Attacked as strawman; held:
   idiomatic ecosystem REST path (`apollo-link-rest`), identical page and sequences, UX
   *matches* the lead ("revisit = 0 requests" — `docs/adr/0005:148-151`), fenced from the
   four-strategy cells, copy must state what Apollo is right for, and the
   GraphQL-façade alternative was rejected for being riggable-looking
   (`docs/adr/0005:180-183`). CONTEXT.md even bans "the Apollo strawman" as vocabulary
   (`CONTEXT.md:120-127`).
5. **Host held constant + fenced native-host exhibit.** The "Next belongs on Vercel"
   attack is pre-answered: co-location kills the cross-cloud confound, and the native
   deploy exists as an explicitly fenced exhibit (`docs/adr/0004:50-59`).
6. **KB stripped-but-reported.** The instrumentation exclusion can't hide bytes: "every
   `/_pm/*` and `/api/beacon` byte is stripped… stripped but *reported*, so the exclusion
   is visible and non-vacuous" (`tools/bench-runner/README.md:44-47`).
7. **Cache API rejected with the tradeoff stated against interest.** "per-datacenter and
   evictable, so 'warm' is not deterministic; reproducibility outranks CDN-realism here"
   (`docs/adr/0002:140-142`) — the lab-artifact cost of KV-as-warm is acknowledged in the
   ADR of record, which blunts the replication attack (finding 7 is about the
   *"everywhere"* overclaim, not the choice).
8. **Remix 3 fencing is mechanized, not aspirational.** Triple-layer labeling with
   machine hooks (`data-pm-fenced="true"`, HUD shows no lab snapshot "by policy", runner
   guard named as an obligation — `docs/prototypes/remix3-frontier/FINDINGS.md:239-254`),
   exact-pin via lockfile with the spike's `test.sh` as bump canary (FINDINGS:202-209),
   and advisory-only drift so a beta can't block the matrix (ADR-0003 addendum).
9. **URL-as-receipt and the priming design.** The "client warmth as a URL knob would be
   convenient" temptation was seen and refused for the right reason: "faking in-memory
   warmth on a first load is a lab artifact… it would make the receipt lie"
   (`docs/adr/0005:167-171`); the registry-id precedent keeps receipts complete
   (`docs/adr/0005:92-95`).
10. **Cost-model accounting discipline.** Honest nulls ("the line prices as UNPRICED and
    the total goes null… never passed off as the answer",
    `tools/cost-calculator/README.md:29-33`), per-rate vendor quote + URL, declared
    unmeasured meters, explicit-inputs-only. The *inputs* are attackable (finding 11);
    the arithmetic is not.
11. **One ruler over Lighthouse.** "Lighthouse… bakes opinion into a composite score"
    (`docs/adr/0001:41-43`) — choosing raw web-vitals over a composite preempts the
    "scoring is biased" attack cleanly.
12. **Drift proven, not promised.** Framework-free golden master (nothing privileged),
    dual normalized-DOM + pixel check, three profiles, either failure blocks CI
    (`docs/adr/0003:100-107`). The zero-bias presentation claim has an enforcement
    mechanism most benchmark sites never build.
13. **The org-standard deviation is owned, not hidden.** The 3-repo GitOps deviation is
    called out and justified in the ADR itself (`docs/adr/0004:78-84`) — exactly how a
    staff engineer should document a standards exception.
14. **Nonce discipline on the live plane.** Probed this session: fresh `?run=` nonce
    gave miss → hit → hit; `?cache=cold` gave `bypass`; and the arming runbook's flush
    audit found every stray key was a nonced suite key (`workers/README.md:130-132`).
    The isolation design works where the public can reach it.

---

## The interview sheet

Questions a hiring panel would actually ask, with the answer the docs support today.

1. **"How do I know you didn't tune each variant so your favorite wins?"** Supported:
   published configs (ADR-0005 §4), drift gate (ADR-0003 §6), public repo + harness,
   cell 1 designed against the lead. Gap: idiomatic-ness itself is self-judged
   (finding 6).
2. **"Your slow-network numbers come from emulated throttling — why should I believe
   them?"** NOT currently answerable: ADR-0004 §6's own words undercut the runner's CDP
   emulation, and the WebPageTest cross-check is unspecified (finding 1).
3. **"What does freezing the data hide?"** Supported for dynamic-fetch cost (ADR-0002
   §2/§3 + live-origin demo). Gap: invalidation (finding 9).
4. **"Isn't same-host unfair to Next, which is built for Vercel?"** Supported:
   ADR-0004 §1 — co-location as fairness control + the fenced native-host exhibit.
5. **"Show me the receipt for this number."** Supported: URL-as-condition (ADR-0004 §5),
   registry ids, SHA-pinned receipts with raw runs (bench README). Blemish: the
   snapshot manifest's null commitSha (finding 5).
6. **"Two of these numbers differ by 8%. Is that real?"** NOT currently answerable — no
   stated noise/decision rule (finding 17).
7. **"What is this site arguing, in one sentence?"** Internally crisp
   (`docs/decision-map.md:9`); on-page, currently homeless (finding 2).
8. **"Why Apollo as the misapplication — isn't that a strawman?"** Supported, strongly:
   ADR-0005 §7 + the CONTEXT.md vocabulary fence.
9. **"Where does Checkout's INP ranking come from?"** NOT currently answerable
   (finding 4).
10. **"What's your cost number's sensitivity to the cache-hit ratio, and where does
    CPU-ms come from?"** Half-supported: sources are named per-field; the h-sensitivity
    and the deployed-CPU publication gate are missing (finding 11).
11. **"Are you allowed to serve Discogs' images on your portfolio?"** NOT currently
    answerable from the docs (finding 12).
12. **"What would you cut if you had a month?"** Not a doc gap — but nothing in the map
    records the priority order of the remaining surfaces; worth having a rehearsed
    answer that cites the spine/spotlight split.

---

## Method note

Lenses completed, in order: (1) fairness/methodology, (2) hiring-signal, (3)
real-world-replication, (4) cost-model, (5) completeness critic — all five, one context,
sequential. Every citation was read from source this session and re-verified (grep or
re-read) before recording. Two read-only live-plane probes ran with a fresh `?run=`
nonce: the KV warm/cold/bypass seam (miss → hit → hit; bypass honored; hit ≈119–128 ms
vs bypass ≈236 ms total TTFB from one location) and `GET /api/snapshot`
(`"commitSha": null`). Repo visibility confirmed PUBLIC via `gh`.

Deliberately not covered: implementation code and test suites (verified slice-by-slice
as they landed, per the standing rule); the build-log's session narratives except where
the map cites them as claims; external-source verification of Cloudflare KV replication
internals and CDP throttling internals (both flagged in-line as to-verify rather than
asserted — the affected findings, 1 and 7, rest on the project's own documents and
probes); Discogs ToS text (finding 12 asks for the check, it does not presume the
outcome); the aesthetic-direction ticket (no strategy surface to attack yet beyond its
WCAG-at-token-time guardrail, which is sound).

---

## Outcome — dispositions applied same-day (2026-07-12, second session pass)

Rob's call: apply what makes sense now; the homepage and all design aspects wait for
their own session. Per-finding outcome:

| # | finding | outcome |
|---|---|---|
| 1 | throttling self-contradiction | **fixed** — ADR-0004 addendum narrows §6's scope; ADR-0001 addendum §A names the emulation limit and binds throttled verdicts to a directional WebPageTest cross-check |
| 2 | thesis has no on-page home | **deferred per Rob** to the `home-surface` session; a binding note now sits on that ticket so the finding can't be lost |
| 3 | loaders breaks "exactly one move" | **fixed** — ADR-0005 addendum resizes the claim (pure cells named; the paradigm+strategy bundle owned; the same-variant alternative recorded) |
| 4 | Checkout INP unproducible | **fixed** — ADR-0001 addendum §B: lab INP (scripted) via the injected ruler, named as such; TBT never presented as INP |
| 5 | `commitSha: null` served publicly | **fixed locally** — manifest backfilled with the tray-landing commit `f60385f`; backfill convention documented in `normalize.ts`; ⚠️ the remote R2 object must be re-put **before the next push** (runbook block in `workers/README.md`) or the post-deploy smoke fails on manifest inequality |
| 6 | "idiomatic" unenforced | **fixed** — ADR-0003 addendum adopts diff-to-starter receipts as the mechanism, binding on variant builds |
| 7 | KV "everywhere" + bare magnitudes | **fixed** — ADR-0002 addendum (Cloudflare KV docs fetched and cited: replication is demand-pulled), CONTEXT.md warm-tier entry rewritten, map table cell qualified |
| 8 | fat-tray byte confound | **fixed (bound)** — ADR-0005 addendum: no byte verdict publishes until the facet payload is split or both numbers ship |
| 9 | invalidation hidden by freezing | **fixed** — ADR-0002 addendum names it as the second hidden cost, scoped honestly to the catalog/commerce split |
| 10 | toy origin compute | **fixed** — ADR-0001 addendum §F (limits list: crate-scale compute stated; comparisons transfer, extrapolations don't) |
| 11 | cost h-sensitivity / CPU gate / "validated" | **fixed** — ADR-0001 addendum §E: h grid {0.5/0.9/0.99}, deployed-telemetry-only CPU gate + calibration, "anchored" |
| 12 | Discogs ToS unchecked | **queued** — constraint (e) added to the `domain-cutover` ticket |
| 13 | unstable field display | **fixed** — ADR-0001 addendum §D: n ≥ 50 display gate, count shown below it |
| 14 | "five pages" glossary fossil | **fixed** — CONTEXT.md surface entry (seven), map answer annotated |
| 15 | open beacon, convention-only exclusion | **accepted** — posture already recorded; WAF rule stays tied to `domain-cutover` |
| 16 | chrome runtime tax | **fixed (bound)** — ADR-0001 addendum §F: measured once, published as a stated constant |
| 17 | no noise rule | **fixed** — ADR-0001 addendum §C: median + min–max band; verdict language only on non-overlapping bands |
| 18 | Chromium-only ruler | **fixed** — ADR-0001 addendum §F limits line |
| 19 | no privacy posture | **fixed (bound)** — ADR-0001 addendum §F: methodology page owes the privacy paragraph |
| 20 | presumed-verdict shorthand | **fixed** — map Notes now carries the planning-time-hypothesis note; "400ms→15ms" cell qualified |
| 21 | public broken a11y pages | **queued** — scope note added to the `a11y-section` ticket (noindex, label-first, compliant twin adjacent) |

"Fixed (bound)" = the decision is recorded and binds a downstream build; the artifact
itself (methodology page, chrome-tax batch, facet split) is that build's work. No ADR
decision was reversed anywhere — every change is an addendum, a glossary correction, or
a ticket note, in the repo's established addendum pattern.
