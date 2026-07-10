# Project Matrix — Build Log

Running record of how this project is built *with AI* — source material for the "How this was built" page. **Append as we go; don't rewrite history.**

## Phase 0 — Prep / curation

**Origin.** A portfolio that proves depth in an age of democratized coding, feeding a conference talk (~end 2027) + a VentureBeat-tier article + staff-level job applications.

**Prompt → PRD.** Prompted **Gemini Pro** with the raw vision (one product built in many stacks — React / Qwik / vanilla / Svelte / Astro / HTMX / Next — on the Discogs API, with perf meters, CWV failure→repair, forced-colors, and a simple→complex content range). Gemini produced "PRD: The Hyper-Performance Architectural Portfolio" (PDF in `~/Downloads`). Refined to be **site-only** (talk/article deferred).

**PRD critique (Claude).** Treated the Gemini PRD as a *loose idea*, not a spec. Caught two drifts from the original vision: it dropped the simple→complex content *range* (all pages heavy), and hardened "maybe 4 variants" into exactly 4, bundling ~7 named stacks into 4 buckets.

**Grilling (Claude, `/grilling` method — one node at a time).**
1. **Thesis** = architectural judgment as differentiator; *fit, not leaderboard*. Kept as an internal rubric, not on-page copy → **pure-evidence** site.
2. **Consumption** = solo-first (blog / application link, no walkthrough).
3. **Variant axis** = architectural *paradigm*, one exemplar each — not framework-collecting.
4. **Data lib** = TanStack Query (REST-native) replaces Apollo (wrong for Discogs REST). Verified **Remix 3** (non-React, server-HTML, pre-release) and **TanStack** (Query = data axis; Start = conventional React SSR) via a Claude web-research sub-agent against primary sources.
5. **Remix 3** = fenced **frontier** showcase, labeled pre-release.
6. **Pages** reframed from "labs" to one coherent **Discogs vinyl store** with employer-relatable surfaces (editorial, PLP, PDP, checkout) + a meta page.
7. **Sparse matrix** = spine (render axis) + spotlight (data / low-level) surfaces; the villain→contender flip proves the thesis.

**Crystallized** into `decision-map.md`, with the foundations (measurement, data contract, design system, deployment) as the first tickets.

**Skills / tools used so far:** Gemini Pro (PRD draft) · Claude `/grilling` · a Claude web-research sub-agent · Matt Pocock skill suite planned downstream (`/decision-mapping`, `/grill-with-docs`, `/handoff`, `/to-prd`, `/to-issues`, `/implement`) · Claude for UI design.

**Artifacts:** `decision-map.md` (canonical) · this log · the Gemini PRD (`~/Downloads` — archive into `docs/` later).

**Published — building in public.** Crystallized planning pushed to a public repo: `https://github.com/Robert-Lark/project-matrix` (branch `main`, committed with a GitHub noreply address to keep the work email out of public history). The repo history now *is* part of the process record; each future session commits + pushes at handoff.

## Phase 1 — Foundations

### `measurement-methodology` — resolved (2026-07-06)

The credibility-root ticket: how to measure TTFB/FCP/LCP/CLS/INP, KB-transferred,
and infra-cost *comparably and fairly* across paradigms as different as static-edge,
Vercel-Edge SSR, server-HTML/HTMX, and the Remix 3 frontier — so a skeptical staff
engineer can't call it rigged.

**Method.** `/decision-mapping` → `/grilling` + `/domain-modeling`, one question at a
time, nine nodes resolved in dependency order. Metric facts were verified against
**primary sources** (not model recall) via two Claude research sub-agents:
web.dev/developer.chrome.com, W3C/MDN specs, the `GoogleChrome/web-vitals` README,
and the Cloudflare/Vercel/Datadog pricing pages. Key verified facts that shaped the
design: INP replaced FID as a stable CWV on 2024-03-12 and Lighthouse can't measure
it (uses TBT as a non-substitute proxy); CWV are assessed at p75; web-vitals'
recommended reporting is `sendBeacon` on `visibilitychange`→hidden; Cloudflare Pages
static serving is free/unlimited while Workers bill $0.30/1M req + $0.02/1M CPU-ms
and Vercel bills a blended Fluid-compute rate + egress.

**The nine decisions (full rationale + trade-offs in [ADR-0001](adr/0001-benchmark-measurement-methodology.md)):**
lab = the fair comparison engine / field = the reality check + honest INP source;
one Google `web-vitals` ruler injected identically everywhere; KB **bucketed** with
**initial JS as the headline** (a lump total would hide the resumability win) + a
per-interaction byte cost; three published test profiles, cold vs warm separate,
median-of-N / p75, **one variable at a time**; TTFB **decomposed** into travel vs
server-think-time with warm-headline/cold-callout, two locations, framed as a trade
not a race; KB fairness via identical compression + identical assets + stripped
instrumentation; cost model = measured **resource profile × swappable rate card**,
reported architecture-only *and* real-world, actual-charge (≈$0) + grounded
extrapolation, arithmetic published; RUM pipeline web-vitals → tagged beacon →
neutral CF Worker collector → CF Analytics Engine (durable, ~$0) + optional Datadog
mirror; and the anti-rigging wrapper — public harness, a receipt behind every number,
one-command reproduce, a methodology page + inline limits-of-data tooltip, pinned
cloud runner + WebPageTest cross-check, dated snapshots (not live).

**Design principle surfaced (Rob).** Show breadth, but cohesively without
overwhelming — favour more comparisons (3 profiles, 2 locations, both cost views,
two observability sinks) presented in a digestible way, because the range itself
communicates the depth of knowledge. And name the limits of the data in-product (the
tooltip) — pre-empting the skeptic *is* the staff-level signal.

**Skills / tools used:** `/decision-mapping` · `/grilling` · `/domain-modeling` ·
two Claude web-research sub-agents (primary-source verification).

**Artifacts:** [ADR-0001](adr/0001-benchmark-measurement-methodology.md) (new
`docs/adr/`) · ticket answer in `decision-map.md` · this entry.

**Downstream:** building the harness is a to-prd/implement job blocked by
`design-system`, `data-contract`, and `deployment-topology`. No new decision node was
needed — all its dependencies are existing tickets.

### `data-contract` — resolved (2026-07-06)

The shared-data ticket: where every variant's data comes from, the zero-bias
payload shape, the Worker/caching design, and how thin the commerce layer can be —
all under the ADR-0001 constraint that numbers stay reproducible and un-riggable.

**Method.** `/decision-mapping` → `/grilling` + `/domain-modeling`, one question at
a time, six decision nodes walked in dependency order (provenance → commerce →
endpoints → schema → Worker → caching). API facts were verified against the
**primary source** (`discogs.com/developers`) via `WebFetch`, not model recall.
Key verified facts that shaped the design: the release response carries
`lowest_price` + `num_for_sale` **inline** (so PDP is one call, and the commerce
aggregate comes free); database search **requires auth**; **image requests require
auth + are rate-limited** (forcing self-hosted assets); rate limit is **60/min**
authenticated; pagination default 50 / max 100.

**The through-line (Rob's north star, hit three times).** Every choice was
pressure-tested against *"if a finding can't be replicated in the real world it
isn't worth a dime."* The answers all resolve to the same move: adopt the real
production pattern, then isolate the variable. Freezing the data is faithful
because catalog data genuinely is pre-computed in production (CDN/SSG/ISR);
normalizing is faithful because shipping raw upstream JSON to five browsers is what
no real app does (BFF/edge view-models are standard); forcing cold/warm is faithful
because they're the two real endpoints of a real hit/miss spectrum. The one thing
freezing hides — the request-time cost of *dynamic* data — is put on stage, not
hidden, via the live-origin demonstration.

**A framing bug Rob caught.** Naming the live path a "live mode" toggle implies the
default store is the fake one — exactly backwards, since the default is the rigorous
measurement. Fixed by killing the toggle framing: the default needs no qualifier,
and "live" becomes an on-demand, self-explaining *demonstration* fenced from the
numbers. Recorded as canonical vocabulary in the new `CONTEXT.md`.

**The eight decisions** (full rationale + trade-offs in
[ADR-0002](adr/0002-data-contract-and-frozen-snapshot.md)): frozen snapshot =
canonical origin; catalog-vs-commerce as the load-bearing split; a fenced
live-origin *demonstration* (not a mode); thin commerce (real frozen price,
simulated cart/checkout, no listings table); verified endpoints + a heavy curated
~500-release crate with a serve-N data-volume knob; a zero-bias two-tray payload
(`ReleaseSummary` / `ReleaseDetail`) normalized once with a data-not-UI guardrail
and a Zod contract; zero-bias = same *data* not same *access* (build-time bake vs
runtime fetch is the measured variable); and R2 origin → thin Worker → KV warm tier
with harness-driven cold/warm.

**Design principle surfaced (Rob).** Thin commerce must not quietly become thin
*interactivity* — the PDP keeps rich product interactivity (gallery/zoom,
add-to-cart, quantity, format switch) because the render-axis "interactivity earns
its JS" flip depends on it. Recorded as a guardrail propagating to `design-system`
and the PDP build.

**Skills / tools used:** `/decision-mapping` · `/grilling` · `/domain-modeling` ·
`WebFetch` (primary-source API verification).

**Artifacts:** [ADR-0002](adr/0002-data-contract-and-frozen-snapshot.md) · the
prototype contract [`docs/prototypes/data-contract/`](prototypes/data-contract/)
(`schema.ts` Zod + types, `fixtures.json`, README) · the new root
[`CONTEXT.md`](../CONTEXT.md) glossary · ticket answer in `decision-map.md` · this
entry.

**Downstream:** spun out `snapshot-capture` (Task) — the one-time capture into R2.
Resolving `data-contract` **unblocks `data-strategy-lab`** (its other dep,
`measurement-methodology`, was already resolved).

### `design-system` — resolved (2026-07-06)

The shared-presentation ticket: how one token + component system renders
byte-identically across paradigms as different as vanilla, React/Next, Astro/Svelte,
Qwik, HTMX, and the Remix 3 frontier — *without drift* — so the render-axis numbers
aren't confounded by the components themselves.

**Method.** `/decision-mapping` → `/grilling` + `/domain-modeling`, one question at a
time, down the design tree: unit-of-sharing → CSS-as-control-vs-variable → authoring
shape/token tiers → theming/forced-colors → the a11y default set → ADA-section
structure → drift enforcement → coverage/naming/fonts → aesthetic + build strategy.

**The seam Rob drew (the turning point).** I recommended holding CSS *delivery*
constant to remove it as a confound. Rob rejected it with a sharper distinction:
"you did it differently" is a valid critique for **markup** (an authoring choice) but
*not* for **CSS delivery**, because critical-CSS inlining, scoping, and tree-shaking
are genuine framework optimizations whose payoff *is the verdict*. That split the
decision at the right seam — **same declared styles + same DOM (control); native CSS
delivery/optimization (measured variable)** — the exact analogue of data-contract's
"same data, not same access," and it flips the CSS-KB bucket from noise to signal.
Two honesty guardrails fell out: *repackage don't re-value*, and *idiomatic default
not hand-tuned*.

**A11y reframed as portfolio evidence (Rob).** Rob pulled accessibility out of the
Checkout surface into its own **ADA section**: separate pages, guided walkthroughs
for the non-obvious defects, and a side-by-side compliant-vs-not comparison. The
framing that made it land: the DS *ships a11y as the default*, so failure→repair =
**DS-off vs DS-on** — what a rushed team ships without the system. A design insight
surfaced from the structure itself: a11y failures split into **element-scoped**
(honest as two live boxes) and **global page-state** (forced-colors/reflow/
reduced-motion — can't be two simultaneous live boxes, so mode-toggle demos with an
"emulation ≠ real OS mode" caveat). Spotting that split is itself an ADA-expertise
signal.

**The eight decisions** (full rationale + rejected alternatives in
[ADR-0003](adr/0003-design-system-and-zero-bias-presentation.md)): CSS + canonical
markup contract, no shared runtime (Web Components rejected; HiFi is React-only and
can't cross paradigms); presentation zero-bias = same styles not same delivery;
global token layer + per-component modules, two-tier tokens (components consume
semantic only); single theme + first-class forced-colors via the semantic seam;
a11y shipped as DS defaults with matched compliant/stripped pairs; drift *proven*
via a framework-free reference render + normalized-DOM + pixel diff in CI; aesthetic
deferred + swappable; fonts a controlled constant.

**Design principle surfaced (Rob).** The aesthetic is a distinct decision that must
not be an accident of the first prototype — so the architecture was built
aesthetic-agnostic (look = values poured into the primitive tier later), the
prototype uses a labeled neutral placeholder, and `aesthetic-direction` was spun out
for deliberate exploration (`/prototype` + frontend-design).

**Prototype self-caught a bug.** A token-consistency check (grep component `var(--…)`
against `tokens.css`) caught the prototype violating its own two-tier rule — dangling
`--space-N` refs and components reaching into the `--pm-*` primitive tier. Fixed
before resolving; the check *is* a shrunk version of the drift gate the ADR mandates.

**Skills / tools used:** `/decision-mapping` · `/grilling` · `/domain-modeling` ·
a shell token-consistency check on the prototype.

**Artifacts:** [ADR-0003](adr/0003-design-system-and-zero-bias-presentation.md) · the
prototype [`docs/prototypes/design-system/`](prototypes/design-system/) (`tokens.css`,
3 component modules, framework-free `reference/index.html`) · new `CONTEXT.md`
Presentation terms · ticket answer + reshaped matrix in `decision-map.md` · this entry.

**Downstream:** spun out `aesthetic-direction`, `a11y-section` (both unblocked), and a
`home-surface` candidate (blocked by `deployment-topology`). Resolving `design-system`
**unblocks `deployment-topology` and `remix3-frontier`**. The matrix's "Checkout/A11y"
row split into Checkout (INP) + a standalone A11y section, and a home/gateway surface
was added.

### `deployment-topology` — resolved (2026-07-06)

The last foundation ticket: where each variant is hosted, the monorepo layout, and
the contextual switcher that swaps architecture on the same route — including how
route + state survive the swap. Stakes: hosting, build, and navigation are each
benchmark-critical surfaces where a careless choice silently confounds the numbers.

**Method.** `/decision-mapping` → `/grilling` + `/domain-modeling`, one question at a
time, seven decisions down the dependency tree (hosting → monorepo → URL scheme →
swap mechanics → state partition → throttle honesty → switcher delivery). No new
external facts were needed — the ticket sits downstream of the resolved ADRs — and the
one class of unverified claim (Cloudflare composition specifics: service bindings,
Workers Static Assets, HTMLRewriter, per-paradigm adapters) was deliberately **not**
asserted as fact but fenced into a spike ticket, per the web-research discipline.

**The through-line.** Every decision was the same move applied one layer down: *hold
the layer constant so it can't confound the paradigm, unless it genuinely is a paradigm
capability.* Hosting is held constant (single CF plane) so a provider's network can't
masquerade as a paradigm difference — the direct sibling of ADR-0001's "one variable at
a time" and ADR-0003's "same styles, not same delivery." The switcher's hard navigation
isn't a limitation but the *honest* measurement (a real cold/warm load of the target
paradigm). And the URL-as-measurement-condition scheme turns every link into a
reproducible receipt, extending ADR-0001 §9's anti-rigging story into the navigation
layer.

**The honesty edge held twice.** (1) Network throttle can't be applied to a real
visitor, so rather than fake it in-browser (a lab artifact a skeptic discounts),
`?profile=` selects which *dated lab snapshot* the HUD shows, beside the visitor's own
real RUM. (2) The switcher/HUD chrome is edge-injected from a known path, so it is
byte-identical across variants *and* cleanly stripped from the measured KB — and its
core is anchor links that work JS-off, so it never injects a runtime into the no-JS
variants (the exact reasoning that killed Web Components in ADR-0003 §1).

**The seven decisions** (full rationale + rejected alternatives in
[ADR-0004](adr/0004-deployment-topology-and-contextual-switcher.md)): single canonical
CF plane (host held constant; native-host as a fenced exhibit); one monorepo pinned by
one SHA (pnpm + Turborepo, no shared component runtime, a deliberate and justified
deviation from the org 3-repo GitOps standard); single origin, path-prefixed, via a
front routing Worker; the swap is a hard navigation; the URL is the measurement
condition (cart the only stored state, UI micro-state resets); throttle is a snapshot
selector, not a live fake; and the contextual switcher is per-surface, sparse,
near-zero-JS, edge-injected chrome.

**Working-method note (Rob's steer).** Rob twice interrupted the options to ask "what
do you recommend?" — the signal being that in a decision-mapping grilling he wants the
recommendation *led* up front with its reasoning, then the options, rather than options
first. Folded into how the later questions were posed.

**Skills / tools used:** `/decision-mapping` · `/grilling` · `/domain-modeling`.

**Artifacts:** [ADR-0004](adr/0004-deployment-topology-and-contextual-switcher.md) · new
`CONTEXT.md` "Controls & instrumentation" terms + "Canonical plane" · ticket answer in
`decision-map.md` · this entry.

**Downstream:** spun out `cf-composition-spike` (verify the CF composition + adapters
before scaffolding the monorepo). **Unblocks `home-surface`** (now partially answered:
singleton, static, off the benchmarked spine). With all four foundations
(`measurement-methodology`, `data-contract`, `design-system`, `deployment-topology`)
resolved, the frontier is now the foundation-build to-prd plus the spun-out
research/prototype tickets; the per-surface builds remain fog until then.

### `cf-composition-spike` — resolved (2026-07-06)

The de-risking ticket ADR-0004 spun out: prove the Cloudflare single-origin
composition mechanism (front Worker + service bindings + Workers Static Assets +
HTMLRewriter chrome injection) and the per-paradigm adapters against **primary docs
and a runnable spike**, not model recall, before the monorepo is scaffolded.

**A resumed session.** The first attempt at this ticket built the full spike (front
Worker, three stand-in variants, an 18-assertion `test.sh`) but hung for an hour —
the dev server was run in the session's foreground — and Rob killed it. Resume cost
was near zero: the artifacts on disk *were* the state (the context-as-managed-resource
note below, vindicated in anger). The resumed session re-ran everything, debugged,
researched, and resolved.

**The spike found a real bug worth finding.** First run: 6 assertions failed — every
static asset fetched *through a service binding* returned a bare 500 (redirects
survived, content didn't). Isolation: assets serve fine when the target Worker is hit
directly; everything passes when the four Workers run as **separate `wrangler dev`
processes** (dev-registry mode). The failure is specific to the single-process
multi-`-c` dev mode — which the docs themselves label experimental. Codified in the
spike's `dev.sh` + README; monorepo consequence: one dev process per Worker (fits one
Turborepo `dev` task per workspace).

**The research pass.** A 14-agent workflow: 7 areas (service bindings, static assets,
HTMLRewriter, Next/Qwik/Astro adapters, Remix 3 status), each researcher's every claim
re-fetched and re-judged by an adversarial verifier — **73/73 confirmed, 0
contradicted**. The one thing the docs are *silent* on (does a binding fetch traverse
the target's asset-routing layer?) is exactly what the spike answered empirically —
lab and library covering each other's blind spots.

**Verdict: ADR-0004 holds; no decision reversed.** Refinements recorded in the ADR
addendum: "Workers everywhere" naming (next-on-pages archived → OpenNext; Astro
adapter dropped Pages), the one-line ASSETS-forwarder script on every static variant
(keeps every hop documented), `div#pm-chrome-slot` selector form, per-Worker dev
processes, and first-deploy smoke = re-run `test.sh` against the real origin. Remix 3
verified at 3.0.0-beta.5 with **no official CF Workers target** — `remix3-frontier`'s
question narrowed accordingly.

**Skills / tools used:** `/decision-mapping` · `/bash-scripting` · a Workflow research
fan-out with adversarial verification · the spike itself (`wrangler dev`, `curl`).

**Artifacts:** [`prototypes/cf-composition/FINDINGS.md`](prototypes/cf-composition/FINDINGS.md)
(citations, confidence levels) · runnable spike + `README.md`/`dev.sh`/`test.sh` in the
same dir · ADR-0004 addendum · ticket answer in `decision-map.md` · this entry.

**Downstream:** foundations are now **fully** resolved. Per the "when to to-prd"
judgment call below, the `/to-prd` moment for the foundation build (monorepo scaffold +
front Worker/switcher + edge Worker + measurement harness) has arrived. All six
remaining open tickets are unblocked; per-surface builds stay fog until the foundation
build exists.

### `foundation-build` — PRD published (2026-07-07)

The bridge from planning to building: the `/to-prd` moment the map had been holding
until all four foundations resolved. Scope: monorepo scaffold + composed origin
(front Worker + switcher/HUD chrome + placeholder stand-ins) + edge Worker data
plane + measurement harness, deployed, with the spike suite re-run against the
real origin as the first-deploy smoke.

**Method.** `/to-prd` — synthesize from the resolved ADRs, don't re-interview. The
one mandated checkpoint (test seams) bounced when asked in jargon ("composed-origin
HTTP seam, output seams") — Rob: "I have no idea what you are asking me." Re-asked
plainly ("test it from the outside, like a visitor" / "cardboard-cutout placeholder
pages") and both recommendations were approved. Mid-session Rob granted **standing
best-judgment authorization** for technical decisions going forward — the ADRs now
encode his intent, so checkpoints resolve against them instead of blocking on him.

**Verification before publication.** The draft PRD was adversarially reviewed by a
38-agent workflow: seven lenses (one per ADR, completeness vs the map, glossary
vocabulary, implementability) with every claimed defect re-verified by an
independent refuter. **25 confirmed, 6 refuted.** The confirmed set was dominated
by *silently dropped ADR clauses* — per-interaction byte cost, the
one-variable-per-comparison rule, Brotli identity, cost-model cache-hit/region
inputs, forced-colors/fonts obligations — plus one invented "verbatim" attribution
and a real routing gap (the contract's `/assets/img/...` paths had no route). The
implementability lens caught eight spec gaps an issue-slicing agent would have had
to guess (instrumentation path, profile spec, fixture size, warm mechanism, beacon
write observable, font files, local-vs-deployed Brotli, `/` behavior) — each
decided under the standing authorization and folded in. A final two-agent pass on
the revised PRD came back clean.

**Process note.** The workflow was cut mid-run by a session usage limit; resuming
from the run journal replayed all completed agents from cache — same
artifacts-are-the-state discipline, this time inside a single tool run.

**Skills / tools used:** `/to-prd` · a Workflow verification fan-out with
adversarial refuters · `gh` (label + issue).

**Artifacts:** [issue #1](https://github.com/Robert-Lark/project-matrix/issues/1)
(the PRD, labeled `ready-for-agent` — label created) · `foundation-build` ticket in
`decision-map.md` · this entry.

**Downstream:** `/to-issues` on issue #1 to slice it into tracer-bullet issues,
then `/implement` per issue.

## Phase 2 — Foundation build

### Issue #2 — monorepo scaffold + shared package lifts — landed (2026-07-09)

The first implementation slice: the repo is now the ADR-0004 §2 monorepo. pnpm 11
+ Turborepo, workspaces `variants`/`packages`/`workers`/`tools` (docs untouched),
CI on every push, and four shared packages lifted from the prototypes:
`@pm/data-contract` (schema verbatim, fixtures pinned by tests),
`@pm/tokens` (two-tier tokens with the forced-colors remap + reduced-motion
gating intact — the fenced system-color keyword re-verification was performed
against css-color-4 §6.2 + MDN and recorded in the file), `@pm/reference`
(the golden master, framework-free), and `@pm/measurement` (the versioned
three-profile spec; mobile/desktop pin Lighthouse's published defaults —
verified against the Lighthouse/Lantern sources, not recall — and fast-wifi is
explicitly project-defined since no published preset exists; WebPageTest's
connectivity table was checked and has none).

**Judgment calls under the standing authorization.** Placeholder face = a Latin
subset of Inter v4.1 (OFL-1.1, no Reserved Font Name) renamed **"PM Placeholder
Sans"** so the interim status is visible in the name itself; variable wght keeps
the token scale's 550 real; `tnum` kept for the metric/price text (the metric
font moved from the prototype's system-monospace stack to the sans's tabular
figures — ADR-0003 §8's "one variable sans + tabular figures"). Installs pin the
**public npm registry** in-repo (the machine's global npmrc pointed at the org
CodeArtifact mirror — a public, reproducible-by-anyone repo can't depend on
credentialed infra, ADR-0001 §9). `hoist: false` had to live in
`pnpm-workspace.yaml` — pnpm 11 silently ignores it in `.npmrc`, and the gap was
real: vitest exports a `NODE_PATH` ending in pnpm's hidden hoist dir, which was
fully populated until the setting applied.

**Verification.** Outside-in first (the reference render driven in a real
browser over file:// and HTTP — font, tokens, tabular figures all apply), then a
7-lens adversarial workflow (acceptance, lift-fidelity, ADR-conflict, isolation
skeptic, CI/tooling, font/licensing+a11y, seams). The finders returned 11
distinct findings; the refuter stage was killed by the session limit (again —
see the methodology follow-up), so refutation ran inline against the journal.
Confirmed and fixed: the demo scaffolding consumed **undefined `--space-1..6`
tokens** (inherited verbatim from the prototype — computed padding was `0px`;
now points at the `--pm-space-*` primitives); two **demonstrated Turborepo
cache-soundness holes** (the repo-checks guards read state outside their
package hash and replayed stale PASSes over a planted violation — that task is
now deliberately uncached; root-level files weren't in the `//#lint` inputs);
the isolation suite was hardened (root-dependency **allowlist contract**, a
CI-only ancestor-`node_modules` guard, failure messages that name the leaking
path) and its header now documents the two porosity channels it does NOT cover
(Node's walk-up past the repo on dev machines; pnpm's transitive bin shims —
exec-level only, module resolution stays strict); the profile spec pins its
**binary Kbps base** with a blessed ×128 bytes/sec helper so issue #7 can't
drift by 2.4%; and the reference README documents the symlink-following
requirement for issue #6's static server. Deviation ledger completeness: the
tokens.css header comment was also edited during the lift (comment-only).

**Skills / tools used:** Workflow fan-out with per-finding refuters (finders
completed; refuters re-run inline) · chrome-devtools MCP (outside-in render
verification) · a background research agent for the primary-source profile
values · fonttools/pyftsubset.

**Artifacts:** the scaffold itself (root config + `packages/` + `tools/`) ·
[issue #2](https://github.com/Robert-Lark/project-matrix/issues/2) (criteria
ticked, closed by the landing commit) · this entry.

**Downstream:** issue #3 (composed origin) unblocks; per Rob's standing
instruction sessions roll straight into the next unblocked issue.

### Issue #3 — composed origin + placeholders — code-complete; deploy leg awaits credentials (2026-07-09)

The walking skeleton: the ADR-0004 §3 composition as real code. Front routing
Worker (path-prefix dispatch over service bindings, throwaway chrome-free
index at `/`, 404 on unknown prefixes, structured JSON logs, generic-message
error posture) + two throwaway placeholders sharing one `/{variant}/sample/`
surface: `placeholder-static` (the one-line ASSETS-forwarder, spike hardening
1) and `placeholder-ssr` (per-request render carrying exactly the ADR-0003 §6
permitted noise — hydration marker, comment nodes, scoping hash — with
request-fidelity evidence in response headers so the DOM stays canonical).
Both render the reference grid verbatim from the shared `@pm/tokens` assets.
`pnpm dev` = one `wrangler dev` per Worker (the forbidden single-process mode
stays forbidden); `pnpm run origin-suite` = the 18-assertion composed-origin
suite (extends the spike's 18, chrome assertions deferred to #5) against real
cross-process dev — also driven visually in a browser through the composed
origin (styled card, loaded font, empty chrome slot).

**Verification (staged this time).** Finder-only workflow (4 lenses), refutation
inline — and the limit still ate one finder (acceptance; walked by hand
instead). Ten findings, all confirmed, all fixed pre-commit. The standouts:
the SSR placeholder's assets were riding the **undocumented binding→asset-layer
path that spike hardening 1 exists to remove** (works locally, fenced-unknown in
prod — its script now forwards misses to its own ASSETS binding, and the suite
gained SSR-asset byte-identity assertions so the post-deploy smoke covers the
one hop the spike never could); the placeholders rendered one card where the
golden master renders two (a #6 landmine — now verbatim); no `concurrency`
group on deploy (two quick pushes could interleave into a mixed-SHA plane —
now serialized); secrets were job-level (now step-scoped away from
`pnpm install`); `upload-artifact` silently drops dot-directories; and
`spawnSync` was starving the piped dev logs of exactly the failure window
(children now write straight to file descriptors).

**The one open leg:** CI's deploy job (variants → front → readiness poll →
smoke with the Brotli assertion) is wired but **gated**: no
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo secrets exist and wrangler
has no local login, so it skips with a loud warning. Arming it is a Rob task
(mint the token, register the workers.dev subdomain once — steps in
`workers/README.md`); the first armed deploy retires the spike's accepted
residual risk. Issue #3 stays open on that single criterion; per the
continue-through instruction the build rolls on to #4, whose work is local.

**Skills / tools used:** staged Workflow finders + inline refutation ·
chrome-devtools MCP (composed-origin drive) · the spike suite as prior art.

### Issue #4 — edge data plane — landed (2026-07-09)

The ADR-0002 §8 serving path as real code, end-to-end through the composed
origin. A **committed, deterministic fixture snapshot** (240 clearly-synthesized
schema-valid releases + 24 generated AVIFs + dated manifest, seeded PRNG so
regeneration is byte-stable — inspectable and one-SHA-pinned per the
anti-rigging ethos; `snapshot-capture` still owns the real crate) behind the
edge Worker: `GET /api/plp` (pagination, `?n=`, facets computed from stored
data), `GET /api/pdp/:id`, `/assets/img/*` from R2, the KV warm tier with
harness-driven `?cache=` + `x-pm-cache-state`, and the `POST /api/beacon`
Analytics Engine collector. AE semantics were **fenced re-verification done**:
a research agent confirmed against Cloudflare docs + workerd/miniflare source
that `writeDataPoint` is void/fire-and-forget, throws `TypeError` synchronously
on shape violations (1 index ≤96 B, ≤20 blobs, ≤16 KB), and is a documented
local no-op — so "success after the write call completes" is honest, and every
client-controlled blob is bounded server-side (oversized input 400s, never
500s). Origin suite grew to 35 assertions, all green through the composed
origin, twice back-to-back.

**Verification (staged finders → inline refutation): 26 raw findings, 14
distinct, all adopted.** The heavy hitters: the KV warm key was built from the
*raw decoded query* — reproduced live as cache poisoning (`%26` aliasing), key
splitting, junk-param immortal-entry minting, and a 512-byte-key 500 — replaced
with per-route keys built from the *effective measurement condition* (parsed
knobs + a documented `?run=` isolation knob); the local suite was **flaky by
silent substitution** — a leaked workerd tree from a killed `pnpm dev` held a
port while the fresh worker died on its inspector bind, and a stale process
served the suite (8/32 failed, then 32/32 "passed") — the orchestrator now
pre-flights ports, asserts children survived startup, and escalates teardown
to SIGKILL; the deployed smoke's miss→hit assertion relied on KV
read-after-write that Cloudflare explicitly documents as not guaranteed
(negative lookups are cached) — remote runs now poll for the hit within the
propagation window; smoke beacons write real, undeletable AE points — now
tagged with reserved `ci-smoke` values; `workers_dev` disabled on everything
but `pm-front`, so the deployed single origin cannot be bypassed; beacon tag
spellings became a shared contract (`BEACON_TAG_KEYS` in `@pm/measurement`)
before issue #5's sender could drift from prose ("cache-state") to code
(`cacheState`). Rate limiting on the beacon is documented as deferred to the
arming step (input caps + single-origin exposure meanwhile).

**Skills / tools used:** staged Workflow finders + inline refutation · a
background research agent (AE/wrangler primary sources, incl. workerd +
miniflare source) · sharp/pyftsubset-style deterministic asset generation.

**Deploy leg:** still credential-gated with #3's; the deploy job now also
creates/seeds the R2 bucket and deploys `pm-edge` (KV namespace id is the one
remaining paste-in — runbook updated).

## Methodology notes

Cross-cutting workflow learnings — the "how this was built *with AI*" story,
separate from the per-decision record. Prime source material for the talk / blog /
"How it was built" surface.

### Context as a managed resource (2026-07-06)

The whole point of the `/decision-mapping` discipline is that **the artifacts are
the memory**: the map, ADRs, `CONTEXT.md`, prototypes, and this log are loaded in
full into each session, so **clearing context between sessions is safe by design**.
What a session must do before clearing is externalise every decision, its rationale,
and its rejected alternatives into those files — then the only thing lost on clear
is the conversational back-and-forth, whose load-bearing parts are already distilled
into each ADR's "Considered alternatives" and this log.

Two distinct bridges, not to be confused:
- **The decision-mapping handoff** bridges *planning session → planning session*
  (artifacts carry the state).
- **`/to-prd`** bridges *planning → building* — run it only when a coherent scope
  is **resolved enough to implement**.

Judgment call recorded: **`/to-prd` was deliberately *not* run after `data-contract`.**
The foundations aren't all resolved (`design-system`, `deployment-topology` still
open), and even the most self-contained resolved piece — the data layer — depends on
`deployment-topology` (where the Worker/monorepo live) and `design-system` (image
dimensions). PRD-ing now would spec against moving ground. The to-prd moment is
*after* the foundation tickets resolve, PRD-ing the foundation build as one phase.
Knowing *when* to compress context and *when* to convert plans to specs is itself
the staff-level agentic-era signal this project exists to demonstrate.

### Long-running processes belong in the background (2026-07-06)

The first `cf-composition-spike` session hung for an hour because a dev server ran in
the session's foreground; the session died with the ticket half-done. Two learnings:
(1) agent sessions must run servers/watchers as background tasks and poll their logs —
a foreground blocking process freezes the whole loop; (2) the artifact discipline paid
out — because the spike code, tests, and map state were already on disk, the resumed
session lost only conversation, not work. The failure mode and the recovery are both
part of the "how this was built" story.

### One-shot the issues, not the project (2026-07-06)

Rob asked whether, once the ADRs + full PRD are written, the entire build could be
handed to Fable 5 to one-shot. Recorded answer: **no to one-shotting the project,
yes to one-shotting the issues** — and the decomposition we're already doing is what
makes the difference. Three reasons, in order of force:

1. **The thesis and the medium would contradict.** This portfolio argues "when anyone
   can one-shot working code, the differentiator is architectural judgment." A
   single un-verified one-shot would make the medium undercut the message; the
   disciplined decomposition (map → ADRs → PRD → issues → implement) *is* the skill on
   display, and it *is* the content of the "How it was built" surface.
2. **Credibility rests on verification, which is iterative.** The whole project stands
   on numbers being real and rendering being *provably* identical (drift tests,
   benchmark fairness, self-hosted assets, forced-colors). A one-shot *generates*
   code; it can't *verify* a variant didn't drift or that a benchmark isn't subtly
   rigged — and that verification is exactly what a skeptic attacks. Holds regardless
   of model strength.
3. **It's an ecosystem, not an artifact.** Monorepo + N framework apps + `-cd` +
   `-terraform` + Worker + snapshot capture + harness — beyond any single output
   window, and not exercisable end-to-end in one pass.

The right use: the ADR→PRD→`/to-issues` decomposition is *precisely what makes each
well-scoped issue one-shottable* (a single variant's release card, `tokens.css`, one
Worker endpoint). Let a strong model rip through each bounded, verifiable issue; keep
the human verify loop on the cross-cutting invariants. This is already the downstream
plan — `/to-prd → /to-issues → /implement`.

### Slicing the foundation PRD under a session limit (2026-07-07)

`/to-issues` on issue #1 produced seven tracer-bullet issues (#2–#8), chained
#2→#3→#4→#5→{#6,#7}→#8, each verifiable outside-in at the composed origin. The
pre-publish adversarial verification (nine lenses + per-finding refuters, the same
pattern as the PRD's 38-agent pass) hit the subscription session limit mid-run:
four of nine finder lenses completed, zero refuters ran. Per the standing
best-judgment authorization the session finished the job inline instead of blocking
on the limit reset — the seven raw findings were re-verified by hand against the
ADR sources (five distinct defects, all confirmed and fixed) and the five missing
lenses were run inline. Two learnings: (1) finder redundancy paid out — the two most
load-bearing defects (story-13 fidelity-through-the-rewriter, chrome checks joining
the post-deploy smoke) were each found independently by two different lenses;
(2) size verification fan-outs against the session budget, or stagger them — a
half-run refuter pass is worth less than a smaller pass that completes.

One structural judgment call worth recording: the drift gate (#6) blocks on the
chrome slice (#5), not just the placeholders — the gate has to hold on the
chrome-injected pages variants actually serve, and proving it against empty slots
first would have handed #5 a CI-breaking coordination hazard it doesn't own.

**Follow-up (same day):** Rob asked whether the missing verification runs were
pivotal or confirmatory. Assessment: refuters and four of the five missing lenses
confirmatory (evidence: 40% duplicate rate among completed finders, dying agents'
last greps converging on already-found defects, ADR-0002 re-read in full with
nothing new) — but the seams lens was the exception, since every confirmed defect
was a between-issues defect and the graph author had audited his own graph. Re-run
against the published issues, it found three more real seams, all fixed in place:
the edge Worker (#4) had no observability/exception requirements (story 42 was
owned only by #3, which closes before the edge Worker exists); no issue required
the SSR placeholder to actually emit the paradigm noise the drift gate (#6) must
prove it strips; and no issue required the two placeholders to share a surface
path, which the sparse switcher config (#5) silently needs — the spike's own
variants served disjoint surfaces, so prior art would have steered an implementer
straight into it. Eight seam defects total, all of one species: requirements each
slice assumed its neighbor owned.

### Verification fan-outs vs the session limit, round two (2026-07-09)

The issue #2 verification workflow was sized down from the 38-agent PRD pass
(7 finders + one refuter per finding) — and the limit still killed it, this
time surgically: all 7 finders completed, all 13 refuters died. Two learnings
sharpen the earlier note: (1) **the journal is the recovery seam** — finder
output was fully preserved in the run journal, so refutation re-ran inline at
zero re-discovery cost (artifacts-are-the-state again, now for agent output);
(2) **stage fan-outs across the limit boundary** — finders and refuters as
separately launched passes would have let the refuters land on fresh budget.
Corollary worth keeping: a workflow's *result value* can be hollow when a late
stage dies (`confirmed: []` here meant "no refuter ran", not "no defects") —
read the failure list before trusting the summary.
