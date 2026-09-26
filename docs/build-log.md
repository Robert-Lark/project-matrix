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

### Issue #5 — edge-injected chrome + measurement client — landed (2026-07-09)

The instrumentation layer (ADR-0004 §5–§7, ADR-0001 §2/§6): `@pm/switcher`
(per-surface sparse control-set config + the chrome renderer — plain-anchor
switcher rewriting only the variant segment, HUD with `?profile=` snapshot
selection from the shared spec + the honest no-published-runs empty state,
everything HTML-escaped) and the `@pm/measurement` client (**pinned
web-vitals 5.3.0**, esbuild-bundled, `sendBeacon` on visibility-hidden with
the shared tag contract). The front Worker injects the chrome into
`div#pm-chrome-slot` via HTMLRewriter (HTML-only, edge responses excluded)
and serves all instrumentation bytes from `/_pm/*`. Chrome styling consumes
the PAGE's semantic tokens — no shipped fonts, tabular figures for free.
Origin suite grew to 52 assertions including two real-Chromium Playwright
checks: the HUD populates live vitals and the beacon payload carries the
page's actual measurement condition; the page + swap work fully JS-off.
Driven visually: TTFB/FCP populating in the injected HUD through the
composed origin.

**Verification (staged finders → inline refutation): 13 raw → 9 distinct,
all adopted.** The one that would have burned the first armed deploy: this
slice moved the front Worker's assets to gitignored `dist/`, and the deploy
job still built only the placeholders — the front deploy would have shipped
without `/_pm/*` (now an unfiltered turbo build). Also: a junk `?n=` could
push the environment tag past the collector's 96-byte cap and silently kill
a page's entire RUM — the knob vocabulary (`clampN` + `knobTags`, wire format
`n=<effective>|cache=<cold|default>`) now lives once in `@pm/measurement`,
consumed by both the chrome's tags and the edge Worker's served condition, so
tag and condition are bijective by construction; slot cardinality is a logged
contract (zero slots = silent unmeasured page, two = double-counted RUM —
both verified in workerd); the Playwright beacon check reads the payload, not
just the 204 (five "unknown" fallbacks would otherwise pass); Chromium is
cached in CI; and the **instrumentation-boundary contract** for issues #6/#7
is written down in `packages/switcher/README.md` — strip = `/_pm/*`
subresources + the slot subtree + `/api/beacon` requests; the drift gate must
REMOVE the slot subtree before pixel-diffing (it's in document flow —
region-masking can't compensate for the layout shift).

**Environment note:** the org's TLS interception blocks the Playwright CDN
locally — the browser tests fall back to the system Chrome
(`channel: "chrome"`); CI installs bundled Chromium.

**Skills / tools used:** staged Workflow finders + inline refutation ·
Playwright · chrome-devtools MCP (visual HUD verification).

**Deploy leg:** unchanged — credential-gated with #3's; the smoke now also
covers chrome injection and `/_pm/*` in production, the last composition
behaviors the spike couldn't verify.

### Issue #6 — drift gate — landed (2026-07-09)

ADR-0003 §6 as running CI: **drift proven, not promised**. New `@pm/drift-gate`
tooling (normalized-DOM extractor running *inside the driven browser* — the
browser's own parse, no second HTML parser; pixelmatch comparator; repo-root
static server on an ephemeral port) plus a **surface golden master**
(`packages/reference/surfaces/sample/index.html` — the sample surface as a
framework-free page, no demo scaffolding, no chrome slot; the component demo
stays as-is and a suite test pins the two copies' canonical grids to each
other, so a stale-copy contract fork is impossible). The checks run inside the
origin suite (68 assertions now), so the one command gates every push AND the
post-deploy smoke will drift-check the real deployed origin. Chrome exclusion
per the switcher README contract: the normalizer drops the slot subtree; the
pixel leg REMOVES the slot before screenshotting (region-masking can't
compensate for flow shift). Both placeholders pass both checks through the
composed origin with chrome injected — the SSR placeholder non-vacuously (the
raw page is asserted to carry all three permitted-noise species, and to NOT
match with an empty noise spec). The deliberate-drift fixture carries two
defects, each visible to only one check — a wrong `alt` (DOM-only) and a
re-valued `--color-text` via an extra stylesheet (pixel-only; literally
ADR-0003 §2's forbidden token re-valuation) — plus a *populated fake chrome
slot*, so exclusion is proven unable to mask drift and each check is proven
to catch exactly its class. Contexts run JS-off (served markup is what the
contract governs; no beacons from gate runs), which surfaced a runtime
discovery: `requestAnimationFrame` never fires in a JS-disabled page and an
async in-page await dies as "execution context destroyed" — font settling is
therefore Node-side polling of sync evaluates, with layout forced first
because `document.fonts.status` reads "loaded" *vacuously* before layout
triggers the fetch (CSS Font Loading spec).

**Verification (staged finders → inline refutation): 15 raw → 10 distinct,
9 adopted, 1 reframed.** Three finders independently found the gate's one
real false-pass class: the normalizer compared only body *children*, so
`<html lang>` / `<body>` attribute drift — pixel-neutral, a11y-load-bearing,
the exact class the fixture's own alt-drift rationale names — passed both
checks (now serialized through the same noise filter as every attribute, and
the extract's first line is asserted). Also adopted: React SSR's `<!-- -->`
separators would false-fail text equality (text runs now merge across
comments/dropped elements); `\s`-collapse silently blessed NBSP-for-space
drift (HTML defines insignificant whitespace as ASCII — now ASCII-only);
pixelmatch's default anti-aliasing exclusion contradicted the zero-pixel
criterion (edge-confined drift could count 0 — `includeAA: true`; same-run
determinism, not the AA heuristic, absorbs benign variance); the deploy job
discarded the very failure evidence the gate's messages point at (smoke now
uploads `.dev-logs/` on failure); and the canonical markup carried a demo
leftover — an inline list-reset `style` on `pm-grid` that React's style
object cannot reproduce byte-for-byte — moved into the component CSS module
across all six carriers in lockstep, with the gate itself proving the move
pixel-identical. **Reframed, not adopted:** dropping
`script`/`style`/`link`/`template` element categories is wider than issue
#6's "only the permitted paradigm noise" — but ADR-0003 §2 (delivery is the
measured variable) wins over issue text per the standing rule; flagged on
the issue and in the gate README's "known boundaries" (with the two other
deliberate boundaries: served-DOM-only under JS-off — a JS-on second pass
lands with the first hydrating variant — and pixel coverage being exactly
the three published profiles).

**Skills / tools used:** staged Workflow finders (4 lenses, all completed
this time) + inline refutation · Playwright · a scratch repro script for the
rAF/JS-off failure.

**Deploy leg:** unchanged — credential-gated; when armed, the smoke
drift-checks production pages against the local golden master for free.

### Issue #7 — bench runner — landed (2026-07-10)

ADR-0001 as a tool: `@pm/bench-runner` drives composed-origin URLs in real
Chromium under the three published profiles (CDP-applied — the blessed
`kbpsToBytesPerSecond` conversion, CPU multiplier, viewport/DPR from the
versioned spec; mechanism + exact applied values published in the receipt)
and emits **SHA-pinned receipts** (`pnpm bench run` / `pnpm bench
reproduce`). Batch discipline per §4/§9: one profile + one `?n=` per batch,
cold/warm as columns (cold = the edge bypass; warm = one unmeasured priming
visit through the KV write-through, keyed by a fresh `?run=` nonce),
round-robin interleave so noise hits every variant equally, median-of-N with
raw runs kept. Web vitals come from the injected chrome's own pinned
web-vitals build — the runner intercepts the chrome's `POST /api/beacon` and
fulfills it locally, so THE one ruler is reused **and lab runs never pollute
the field data**; a chromeless document (the tray API driven as a URL)
honestly reports null vitals, never invented. KB is bucketed compressed
transfer with `/_pm/*` + `/api/beacon` stripped-but-reported (non-vacuity
asserted); interactions are registry IDs so receipts reproduce them by name.

**CPU-ms per visit — the fenced re-verification done** (research agent
against Cloudflare docs + workerd/workers-sdk source, plus live probes):
OSS workerd hardcodes trace `cpuTime` to 0, so the ONLY local real
accounting is the workerd inspector's CDP `Profiler` (a genuine V8 sampling
profiler in workerd source) — the runner brackets each visit with
start/stop over all four pinned dev inspectors (wrangler's proxy demands an
Origin header; Node undici's non-standard `headers` option supplies it) and
sums non-`(idle)` deltas; proven live with `handlePlp`/`computeFacets`
attribution. Deployed, the defensible source is Workers observability's
per-invocation `$workers.cpuTimeMs` via the telemetry query API — arms with
the deploy leg, so against a remote origin the field is an honest **null
naming that source** (never estimated). Origin suite grew to 79 assertions
(receipt contract, columns observed as bypass/hit, stripping non-vacuity,
TTFB decomposition, provenance strings, reproduce), plus the CLI driven
end-to-end at slow-4G with a receipt inspected by hand.

**Verification: the staged finder workflow died whole on the session limit
(all four lenses, zero output — round three, and this time the journal had
nothing to recover), so verification ran fully inline.** Two real defects
found and fixed by hand-walking the receipt against the probes: (1) visits
shared one browser context, so the deployed plane's `immutable`/etag
assets would have silently zeroed later runs' transfer sizes — every run
is now a fresh context (first-time visitor; the browser cache is a
held-constant, the cache columns measure the EDGE tier); (2) a
slow-4G receipt showed 13ms TTFB — probing proved Chromium **rebases
navigation-timing sub-phases beneath applied CDP throttling** (500ms
emulated latency delivers on the wall clock while `responseStart` reads
~1ms), so the TTFB decomposition reflects the plane's real serving, and
every receipt now states this in `methodNotes` (limits-of-data, in the
receipt itself). Also fixed: interaction bytes counted by append-only
entry index (a name-keyed diff hid re-fetches), and the receipt gained
`harness` (browser + version + settle window) for reproduce completeness.

**Skills / tools used:** background research agent (primary sources) ·
empirical CDP probes (inspector profiler, latency attribution) · inline
four-lens verification after the workflow died · Playwright.

**Deploy leg:** unchanged — credential-gated; the smoke runs the tiny bench
batch against the deployed origin (pre-warming KV through its
eventual-consistency window) with the CPU field asserted null-and-named.

### Issue #8 — cost calculator — landed (2026-07-10)

ADR-0001 §7 as auditable arithmetic: `@pm/cost-calculator` (`pnpm cost
from-receipt`) prices a bench receipt's measured resource profile — the
per-target cold/warm `resourceProfile` columns — against a **dated,
swappable rate card**, producing $/1M visits for BOTH views (architecture-
only: one host's rates for every variant; real-world: each variant on its
stated host) plus an actual-charge view at a stated monthly volume
(free-plan fit shown as allowance arithmetic — free plans block, not bill;
paid-plan bill = base + max(0, overage − credit) with included allotments).
The §7 split is structural: the calculator has **no price knowledge in
code** — cards are data files whose every rate carries the verbatim vendor
quote + URL it was verified from, and the required inputs (cache-hit
ratio, region, architecture host, per-target host mapping) are **explicit
or refused** — no defaults hidden in code. The cache-hit ratio is not a
model: it blends the receipt's two *measured* columns
(`h × warm + (1 − h) × cold`), which is what the columns exist for. Nulls
stay honest end-to-end: a quantity whose named source couldn't account it
(CPU-ms against the deployed origin until the telemetry leg arms) yields
an UNPRICED line and a null total with the subtotal labeled partial —
with one deliberate exception, a **$0 rate prices unknown usage at exactly
$0** (zero is arithmetic here, not an estimate; an all-free static host
must not report "unknown total"). Vendor meters the profile genuinely
cannot see (Vercel Provisioned Memory, Fast Origin Transfer) are DECLARED
per host in the card and surface in the report's method notes instead of
silently vanishing.

**The rate card was re-verified at build time, as ADR-0001 required** (rate
cards drift by design): a fetch+confirm agent pair per vendor against the
live pricing pages, every figure quote-cited, each report independently
re-fetched by a second agent. Cloudflare: all 2026-07-06 figures confirmed
unchanged ($0.30/1M requests, $0.02/1M CPU-ms beyond included; egress
explicitly $0; static assets "free and unlimited"; free tier 100k req/day
with a per-invocation 10ms CPU cap — a cap the per-visit profile can't
verify, so the card states it as uncheckable). Vercel: sharpened —
"~$0.13/CPU-hr" is exactly **$0.128/CPU-hr Active CPU at iad1** (regional
to $0.221; Active CPU pauses during I/O, so measured CPU-ms is the correct
input); $0.15/GB Fast Data Transfer confirmed as the iad1 rate ($0.15–
$0.35 regional); and the confirm pass caught a dimension the first pass
missed — **Fast Origin Transfer** ($0.06/GB iad1, both directions, every
function-backed request), now declared unmeasured in the card. The card's
region vocabulary is its own (`us-east` → iad1; Cloudflare flat), so one
`--region` input resolves per-region and flat rates together.

**Assertions:** `suite/cost.test.ts` holds the arithmetic to exact
hand-computed dollars — fixtures chosen float-exact so every dollar
assertion is `toBe`, no tolerance to hide in; the fixture receipt is
parsed through the real `Receipt` contract, pinning the input shape to
what the bench runner emits. The seam leg (`bench.browser.test.ts`)
prices the REAL receipt with the SHIPPED card end-to-end; the honest CPU
null is asserted locally on every run, and the deployed branch (UNPRICED,
armed-path source named) is written into the same test but first executes
in the post-deploy smoke when the Cloudflare secrets arm. Origin suite:
79 → 113 assertions, green twice back-to-back on the final tree.

**Verification (the saved verify-slice workflow's first full outing +
inline probes): 15 raw findings → 15 adopted, 0 refuted.** The
background/foreground split earned its keep again — the lenses and the
probes caught disjoint sets. Probes (two full suite runs, a live CLI run
against a real local-plane receipt, hand-audited arithmetic, node
one-liners) caught a malformed small-number format, a $0-rate ×
unknown-usage false-unknown, and a host-mapping typo hole. The lenses
then found what reading catches: correctness — empty-string CLI values
coercing to a silent cold-only default (`Number("") === 0`), the
percent-encoded `repoRoot` (copied from bench-runner's CLI — both fixed),
parse-time card validation gaps, and prose contradicting the $0-rate
branch; conformance — the CPU provenance test read only the cold column
(an invented warm 0 would have passed every gate) and `--host`
duplicates silently last-winning; seams — "1,500 visits visits" in the
published paid-plan arithmetic and duplicate hostIds pricing
first-match-wins; anti-rigging — the visits-basis invocation meter
erasing the static-paradigm difference on Vercel (fixed in DATA: a
`vercel-pro-static` host block prices the zero-function deployment
honestly), the report unable to name WHICH receipt priced it (runNonce
now echoed), the receipt's own methodNotes not traveling with the
dollars, negative doctored profiles pricing silently (now refused
loudly), and the renderer displaying a tiny nonzero as the load-bearing
"$0".

### Foundation build — close-out (2026-07-10)

The PRD's done paragraph (issue #1), re-verified clause by clause against
the tree as landed:

- **"load a placeholder variant through the composed origin with chrome
  injected"** — `composed-origin.test.ts` + `chrome.browser.test.ts`
  assert it outside-in (path-prefixed routing, 404 on unknown prefixes,
  switcher + HUD injected into the slot, instrumentation from `/_pm/*`);
  exercised live this session by the bench batches driving both
  placeholders through `http://127.0.0.1:8787`.
- **"fetch both trays and an image from the edge Worker cold and warm"**
  — `data-plane.test.ts` asserts both trays + image serving with
  `x-pm-cache-state` bypass/hit as real, separate behaviors; the bench
  receipt's cold/warm columns observe the same distinction end-to-end.
- **"run one command to produce a benchmark receipt for it"** —
  `pnpm bench run … --local-cpu` did exactly that this session; the
  receipt carried profile + spec version, SHA pin, decomposed TTFB,
  bucketed stripped KB, chrome-harvested vitals, and real V8-profiled
  CPU-ms — then priced by `pnpm cost from-receipt` (#8), closing the
  ADR-0001 chain measurement → receipt → dollars.
- **"watch CI fail if a variant's DOM or pixels drift from the reference
  render"** — `drift.browser.test.ts` runs inside the origin suite in CI
  on every push; the deliberate-drift fixture proves each check catches
  exactly its defect class, so the gate is demonstrated, not assumed.

All of it is held by the one command: 113 assertions, green twice
back-to-back locally and in CI. Issues #2, #4–#8 closed; **#3 stays open
carrying the sole unfinished criterion — the deploy to the canonical
plane — which is Rob-gated on Cloudflare secrets** (runbook:
`workers/README.md`; the deploy job skips loudly until armed, and arming
it re-runs this whole suite as the post-deploy smoke against the deployed
origin, including the receipt-CPU-null and Brotli assertions written for
that plane). #1 stays open until #3 closes. The map is handed back to
Rob: `snapshot-capture`, `data-strategy-lab`, `aesthetic-direction`,
`a11y-section`, `remix3-frontier`, and `home-surface` are open and
unblocked — per the decision-map discipline, one ticket per session,
Rob picks the next node.

### The deploy leg — armed (2026-07-11)

The last Rob-gated step of the foundation, run as a paired session: Rob
drove every credentialed click and command (guided one step at a time, in
plain terms), the agent did everything verifiable — pre-checks, config,
CI-watching, live-origin probes, close-outs. Roughly 15 minutes of Rob's
hands, exactly as scoped.

**The runbook survived contact with reality with two corrections.** One
genuinely new one-time prerequisite surfaced: Cloudflare rejects a Worker
that binds an Analytics Engine dataset until the account has opted into
Analytics Engine once via the dashboard (`pm-edge` deploy failed with API
error 10089 on the first armed run; the two placeholder Workers, which
bind nothing, had already deployed cleanly). Enabling it is a two-field
dashboard dialog — dataset `pm_rum`, binding `BEACONS`, which the
dashboard then echoed back as a config snippet character-identical to
what `workers/edge/wrangler.jsonc` has carried since issue #4. The other
correction was an incantation bug the README had pre-declared as
"e.g."-level: the warm-tier flush commands pass `--config
workers/edge/wrangler.jsonc`, but run via `pnpm --filter @pm/edge exec`
the cwd is already `workers/edge`, so the path doubles and wrangler
throws ENOENT. Both are fixed in the README. Two other pre-registered
prerequisites turned out already satisfied or trivial: the account had a
workers.dev subdomain (`robresearch87`) from onboarding, and the KV
namespace was one command + one id paste (committed as `8d9e722` after
the origin suite ran green twice back-to-back on the final tree,
118/118 ×2, per the standing rule).

**The sequence as it actually ran:** wrangler login (the stale global
wrangler 4.35.0 died with a blank error; the repo's 4.110.0 succeeded —
one more argument for never trusting the global tool) → KV namespace +
id commit → API token (Edit Cloudflare Workers template + Workers R2
Storage:Edit added by hand; zone resources "All zones", vacuous on a
zone-less account) → two repo secrets → push → deploy failed on 10089 →
Analytics Engine enabled → re-run failed jobs → **first armed deploy
green**: fixture-seeded bucket, smoke 118/118 with `PM_EXPECT_BROTLI=1`,
resolver naming the fixture. Then the crate transition per the runbook:
`pnpm capture seed --remote` (1,820 objects, ~45 MB, zero Discogs calls),
warm-tier flush (12 keys, every single one `?run=`-nonced fixture-era
suite traffic — the #11 nonce discipline held on the real plane; recount
0), full re-run → **crate smoke green**: the same 118 assertions resolved
the crate's manifest and asserted its committed trays and image sha256s,
while the seed step's clobber guard refused to reset the bucket and
exited 0, exactly as written.

**The spike's one accepted residual risk is retired.** `cf-composition-
spike` FINDINGS §5 accepted that composition behaviors were unverified on
the real plane until the first deploy. Every one passed: prefix dispatch,
assets-through-bindings, HTMLRewriter chrome injection, passthrough
fidelity, trailing-slash 307s, unknown-prefix 404s, Brotli on the wire
(`content-encoding: br` over HTTP/2, hand-verified), and the warm tier
behaving as designed in production KV (priming `miss`, immediate `hit` —
the suite's 90 s eventual-consistency allowance wasn't even needed).
Neither documented bench flake fired in any of the three deployed-smoke
runs.

**Close-outs:** #3's last open criterion (CI deploys from main +
post-deploy smoke incl. Brotli) closed with the run as evidence; #1's
done paragraph re-verified clause by clause **against the deployed
origin** — chrome-injected variant page, both trays cold/warm with a
real release, a served image byte-identical to its committed sha256, the
bench/receipt leg, the drift gate — and closed. The plane is live at
https://pm-front.robresearch87.workers.dev, redeployed and re-smoked on
every push to main. Riders resolved in passing: Rob dropped the
"Prometheus Studio" label (no re-plan; the frozen crate stands), and
roblark.com's registrar/DNS answer ("Netlify or Vercel, to be
confirmed") is recorded on the new `domain-cutover` ticket — the session
deliberately touched no DNS and attached no custom domain; the legacy
portfolio at roblark.com is untouched.

## Phase 3 — Store data

### `snapshot-capture` — resolved (2026-07-10)

The first post-foundation ticket: ADR-0002's one-time capture as a real
artifact. One session, one issue ([#9](https://github.com/Robert-Lark/project-matrix/issues/9),
the one-shot-the-issues pattern): pull the curated crate from the live
Discogs API, self-host the images, normalize ONCE into the two trays,
Zod-validate, freeze with a dated manifest — and leave CI untouched (the
synthesized fixture stays the CI seed; nothing in CI speaks to
api.discogs.com).

**The two genuine Rob-inputs, resolved at session start.** The crate is
Rob's: ambient / melodic techno / neo-classical vinyl, 2006–2026, from his
18-label list (Erased Tapes → n5md), recorded verbatim in the issue and as
data in `crate.spec.json` — curation is deterministic from the frozen search
checkpoints (start-anchored label match, vinyl-only, client-side year window,
popularity-ranked per-label quotas, ordered substitution reserve). The token
arrived as a chat-pasted PAT, stashed immediately at
`~/.config/project-matrix/` (chmod 600) — capture-time only per ADR-0002 §1;
a post-capture sweep grepped the tree, checkpoints, and logs for it: zero
hits anywhere.

**Designed for the session limit, by construction.** ~500 releases at 60/min
across search + details + images is hours of API time, so the tool
(`tools/snapshot-capture`, `pnpm capture run`) is checkpointed like the
verification workflow: every fetched page/release/image lands on disk
(atomic rename) before the next request, a file's existence is its
checkpoint, and the final crate is a pure function of (frozen plan,
tombstones). Proven against a mock Discogs API before one real request:
SIGKILL mid-images → resume fetched exactly the one missing release; a
complete capture re-runs with **zero** API requests (the token loads lazily —
a checkpointed re-run needs no credential); a concurrent second run is
refused by a pid lockfile (added after the probe's kill-the-wrapper mistake
orphaned a node child and two runs raced one checkpoint dir — they still
converged, but the lock makes racing impossible rather than merely
survivable).

**The probes caught what code-reading never would.** Round one: image
responses carry no `X-Discogs-Ratelimit-*` headers, and `Number(null) === 0`
read as "window spent" — parking a full minute after *every image*, turning a
~30-minute sweep into ~25 hours. Round two, on real data: a Boogie Times
record arrived via the **Ki** sweep wearing a "Par-**ki**-lee Publishing"
label (hyphens defeated the word-boundary match), and a spot-audit of the
frozen crate found three Giuda glam-punk pressings riding "Surfin' Ki
Records" into an ambient store. Fixed structurally: the matcher became
start-anchored, "Ki" sharpened to "Ki Records" (best-judgment deviation from
Rob's verbatim list, recorded), and — the real fix — membership moved to an
**authoritative details-time guard** on the release's own `labels[]`,
enforced by a reconcile pass that re-guards already-landed checkpoints, so a
rule that evolves mid-capture still governs everything. The frozen plan was
re-cut once (delete `plan.json`, the documented re-plan action) from the
checkpointed searches: zero search re-pulls; 30 impostors total tombstoned
and substituted. The committed `curation.json` receipt carries the spec,
per-label stats, and every tombstone with its reason.

**API facts re-verified, not recalled.** A three-area research workflow
against `discogs.com/developers` (fetch + adversarial re-fetch per area;
auth/rate area confirmed 19/19): the exact `Authorization: Discogs token=`
header, 60/min as a *moving* window with self-throttling expected, the three
ratelimit header names, undocumented 429 semantics (backoff assumes a full
window), signed image URLs fetched verbatim with **no token** (the credential
never leaves the API host) but a mandatory unique User-Agent, `qty` as a
string, search-result `year` as a sometimes-absent string, `lowest_price`
null semantics — all encoded in `src/discogs.ts`/`src/raw.ts`.

**Verification: the resilient pattern, now routine.** verify-slice ran in
the background (the args-as-JSON-string gotcha fired as documented; session
copy patched, relaunched) while the foreground probed — and the two legs
again caught disjoint classes. The lenses' 23 raw findings deduped to ~15;
13 adopted pre-commit, the heavy hitters: a NaN `--min-interval-ms` poisoning
the pacing scheduler into a no-op (Math.max(NaN,…)); the images phase turning
retry-exhausted 429/5xx into *permanent* tombstones (a transient CDN incident
would silently rewrite crate membership — now only dead statuses persist);
manifest `capturedAt`/`commitSha` drifting on no-op re-runs (freeze is now
content-aware); the remote clobber guard failing open (now fail-closed —
"couldn't tell" never reads as "safe to overwrite"); `commitSha` attesting a
tree that demonstrably didn't produce the trays (now null unless the tree is
clean; the landing commit is the provenance); and the skeptic lens catching
the README's CC0 rationale silently covering the two *commerce* aggregates
ADR-0002 §2 says are not catalog (rationale rewritten honestly, flagged for
Rob). Two findings reframed, not adopted: name-based label membership stays
(the spec is names; recorded as a known boundary made auditable by the
receipt) and the fixture-coupled origin-suite assertions stay a documented
follow-up (double-gated behind Rob arming both the secrets and the remote
seed).

**The freeze: 500 releases, 1,817 images** (avg 3.6/release, fit-inside-600
AVIF anchored to the reference card; originals retained so the derivative
follow-up never re-pulls), captured-at 2026-07-11, ~2,200 API requests total,
zero rate-limit incidents. Facets match the brief: Ambient 193 / Experimental
127 / Modern Classical 72 / Drone 69 / IDM 63; 455 of 500 priced, $0.04 to
$515.24. Committed weight ~1.7 MB (trays + manifest + index + receipt); 43 MB
of derivatives and 150 MB of working state stay local + R2. Local R2 seeding
went through two designs: per-object `wrangler r2 object put` was fine for
the fixture's 27 objects but ~40 minutes for 1,820 — and 8-way concurrency
was probed to CORRUPT local state (miniflare persistence is not
multi-process-safe; 3 of 8 objects byte-mismatched) — so local seeding now
streams all objects over HTTP through a throwaway seed Worker sharing the
edge project's persist dir: one workerd process, one writer, **3.5 seconds**.
Both trays, images, cache states, and the 24/240 knob were then driven
through the composed origin against the real crate.

**Loose ends, named.** "Prometheus Studio" matched nothing in the window
(likely a name mismatch — re-planning is nearly free); the remote seed
shares issue #3's credential gate; the fixture-coupled smoke assertions are
recorded on the issue for whoever arms the crate remotely.

**Skills / tools used:** a research Workflow (fetch + adversarial verify per
area) · a mock-API probe harness (fresh / kill / resume / idempotence /
lock) · the saved verify-slice workflow (background) + inline empirical
probes (foreground) · Monitor-tailed background capture · sharp · the
composed origin itself.

### `smoke-snapshot-awareness` — landed (2026-07-11)

The recorded prerequisite of the Rob-gated deploy leg (issue #9 close-out,
follow-up 4): the origin suite asserted fixture literals —
`ph-00-primary.avif` byte identity, PDP ids 9000001/9000002/1234567 — so
the post-deploy smoke would have gone red the moment the remote bucket
switched to the real crate. Landed as
[issue #11](https://github.com/Robert-Lark/project-matrix/issues/11),
one session, one issue.

**The design move: ask the origin, then assert its own committed truth.**
The edge Worker gained `GET /api/snapshot` — a thin R2 read of the dated
`SnapshotManifest`, ADR-0002 §1's provenance signal served squarely inside
§8's "thin read API." A new suite resolver fetches it, matches it against
the committed snapshots it knows — fixture first, crate only when the
fixture doesn't match, so CI never reads the crate artifact — requires
full manifest equality (a right-named but stale re-seed fails on its
date), and derives every probe value from the matched snapshot's committed
files: PDP ids from the trays, the guaranteed-missing id as
max-committed-id + 1, and image byte identity as sha256 — the crate's
committed `images-index.json` carries a sha256 per derivative precisely
because its image bytes are git-excluded, which is exactly what a CI
checkout smoking a crate-seeded bucket needs. "Couldn't tell which
snapshot" throws at module load: every data-plane test fails, nothing
skips (ADR-0001 §9).

**Parameterizing made the assertions stronger, not weaker.** The old tests
checked contract-validity plus a few lengths; the new ones deep-equal the
wire payloads against the committed artifacts themselves — the PLP first
page IS `summaries.json`'s first 24 entries in committed order, the PDP
tray IS the committed detail, the PLP total IS the manifest's
releaseCount (was: ≥240). And a green run now *names* which snapshot it
asserted in the log — exit 0 stopped being the only evidence, which
mattered immediately: the first crate-leg "pass" was only trusted after
the miniflare state (45 MB, 1,841 objects, the crate name in the manifest
blob) proved the right seed had actually been under test.

**Proven all four ways (the issue's definition of done):** fixture path
green twice back-to-back (118/118 — the 113 plus two provenance
assertions and three content-coverage sweeps); the full suite green
against a crate-seeded local plane via
the new run mode (`PM_SEED_DIR=tools/snapshot-capture/crate pnpm run
origin-suite` — CI never sets it; the fixture stays the CI seed forever);
wrong and mixed seeds demonstrably failing (probe dirs seeded through the
real path: a fixture manifest over crate data fails on total/ids/sweep/
sample/image at once; a crate seed with a wrong-byte probed image is
caught by the sha256 leg alone; an unknown crate name and a stale
capturedAt both die in the resolver before a single vacuous pass); and
the unseeded plane — the "couldn't tell" case — failing loudly rather
than skipping. The
workers/README arming runbook now reads: secrets → deploy → smoke →
remote crate seed → re-smoke → close #3 then #1, with no code steps left
in between.

**Verification:** the saved verify-slice workflow ran in the background
(the args-as-JSON-string gotcha fired again, exactly as documented; the
session-copy patch + resume worked as recorded) while the foreground ran
the seed probes above — the empirical leg the lenses can't do. The
lenses' standout finding class — **the KV warm tier is persistent and its
keys carry no snapshot identity** — proved its worth by firing TWICE. An
un-nonced tray read in the deployed re-smoke could be served the
PREVIOUS smoke's warm payload (false-failing step 4 of the arming
runbook, or letting a torn re-seed false-pass behind a warm hit), and an
un-nonced *write* plants the canonical default-PLP key a real visitor
would later HIT as a stale fixture payload forever. The first sweep
nonced the data-plane file (including the HEAD probe, which rides the
write-through); then three later lenses independently caught the ONE
remaining un-nonced request hiding in a *sibling* file
(`chrome.test.ts`'s rewriter probe — now `cache=cold`, which bypasses
the tier in both directions). A convention that survives only as prose
will regress, so the discipline is now a repo-check: every tray request
in the suite must be nonced, cold, or carry a `kv-exempt:` marker naming
why it provably never touches the tier. Alongside: the Worker gives
nonce-keyed entries a 1-hour TTL (harness artifacts stop accreting in
deployed KV forever), and the runbook's crate-seed step gained an
explicit warm-tier flush — the earlier draft's "no visitor traffic
precedes it" was exactly the kind of unproven exclusion the skeptic lens
exists to kill, since the origin is publicly reachable from the first
deploy on. Other adopted findings sharpened the assertions themselves:
manifest equality became raw-vs-raw (Zod strips unknown keys, so
parsed-value equality would go asymmetric the day a manifest grows a
field); tray content coverage grew a full PLP sweep plus a deterministic
PDP sample (page 1 + one probe detail alone would have let a seed
doctored in later rows pass); image byte-identity grew a five-position
sample over ALL committed derivatives (one predictable probe image was a
game-able 1-of-1,817 blind spot — the remaining sampled-not-exhaustive
boundary is stated at the test, like the PDP sample's); and a latent
cache-leg id collision got its own sub-nonce. Notably, the old
`total ≥ 240` assertion would have *passed* on the stale-warm payload —
the exact-equality rewrite is what surfaced the whole hazard class.

**Skills / tools used:** the saved verify-slice workflow + inline seed
probes · the composed origin itself · miniflare state inspection (the
crate-seed evidence).

## Phase 4 — Variant frontier

### `remix3-frontier` — resolved (2026-07-11)

The first variant-axis ticket ([issue #10](https://github.com/Robert-Lark/project-matrix/issues/10)):
decide and de-risk the fenced Remix 3 showcase before the Editorial spine
builds it. Two legs, launched in parallel per the standing pattern — an
adversarial research workflow in the background (4 areas, finder +
re-fetch verifier per area, the cf-composition pattern scaled to fit:
**54/54 claims confirmed**) while the foreground built the spike.

**The re-verification came back "unchanged, but deeper."** Beta.5
(2026-07-01) is still the newest v3 anywhere; "not production ready" stands
unretracted; still no official deployment target beyond the Node ≥24.3
template. But the research surfaced the decisive shape of the gap: the
maintainers deliberately scoped their own Workers demo to fetch-router
("we're keeping it really simple…"), and **no official example runs the
full `@remix-run/ui` render path on Workers at all** — the exact question
the hosting decision turns on, answerable only empirically. It also
surfaced the paradigm's best-kept detail, read from the shipped dist:
`run()` installs a Navigation API listener that routes plain `<a href>`
clicks through frame reloads via `rmx-target`/`rmx-src` attributes —
progressive enhancement isn't a pattern the app author builds, it's the
runtime's default posture.

**The spike answered in one afternoon: the frontier runs on the canonical
plane.** One host-agnostic app (editorial page, `<Frame>`-composed
staff-pick partial carrying its own next-anchor, one `clientEntry` island,
the fence plaque) served by both the official Node shape and a ~15-line
hand-rolled Workers `fetch` entry — because the beta's router is
fetch-shaped, the "adapter" is nearly a pass-through. workerd ran the full
render path with **no `nodejs_compat` flag** (the core packages ship zero
`node:` imports — verified in the dists, confirmed by the research), and
both hosts emit identical HTML modulo per-render instance ids. `test.sh`:
42/42. The browser leg sealed it: one click on "Next pick" produced exactly
one network request — an HTML partial — while the island's counter state
survived the swap (the page demonstrably never reloaded), and Back restored
the previous frame without a document load. Two frictions, both small, both
recorded in FINDINGS §4: workerd leaves the bundled module's `import.meta`
empty at runtime (probed: `url === undefined` — so `clientEntry()` needs a
stable-ID fallback; the verification pass caught the first draft blaming
the bundler, and a probe pinned the real mechanism), and the template's
runtime asset server is Node-only (prebuild with esbuild instead —
code-split so islands share the runtime chunk's module instances).

**The decision, and the two judgments it forced.** Workers entry wins;
the off-plane Node host is the recorded fallback (it buys nothing the
fence doesn't already excuse and would cost a second provider, a foreign
transport stack, and exile from the composed origin). ADR-0004 gets a
second addendum. The sub-questions the ticket said not to resolve
silently, resolved loudly (FINDINGS §7): the fenced showcase **owes** the
ADR-0003 canonical-markup/shared-CSS contract — fencing excludes numbers,
not visual identity, and the spike proves the contract costs nothing
(plain `pm-` markup renders fine; `css()` stays off store components) —
and the drift gate covers the remix3 surface **in advisory mode**: drift
warns, never fails CI, because a weekly-cadence beta must not be able to
hold the benchmarked matrix's deploy hostage. Labeling is three
machine-checkable layers (plaque with `data-pm-fenced="true"` — mechanism
proven and test-asserted — switcher tag + RUM-only HUD, and the bench
runner never batching `/remix3/*`).

**Verification:** the research leg carried the rigor for the claims
(fetch + adversarial re-fetch, quotes + URLs throughout; the full 54-claim
set committed as `research/claims.json` so the number is auditable);
verify-slice ran in the background with inline probing foreground, per the
standing rule. Four lenses returned 20 raw findings (~17 distinct);
essentially all adopted pre-commit. The heavy hitters: the recorded
mechanism for the clientEntry friction blamed the bundler when the actual
wrangler bundle on disk preserves `import.meta` verbatim — an inline probe
inside the running Worker pinned the truth (workerd leaves it empty at
runtime) and five documents were corrected; the ADR-0003 drift-gate
carve-out lived only in ADR-0004's addendum, leaving the ADR of record
silently contradicted (ADR-0003 now carries its own addendum); "exact-pin
the beta" was only true through the lockfile (the metapackage carets every
sub-package — wording corrected); test.sh's cross-host headline checks
passed vacuously with both hosts down (non-empty guards added, plus a
readiness wait and an exportName assertion); and the skeptic lens demanded
the unexercised prefix-mounting seam be named in the residual-risk record
rather than discovered by the Editorial build. One finding refuted as
stale (a size figure already fixed mid-session); one partially adopted
(the exportName fallback keeps the official template's title-case
semantics rather than the proposed throw — template fidelity is the
spike's evidentiary point — but gained the test assertion).

**Skills / tools used:** a 4-area research Workflow (finder + adversarial
verifier pairs) · the spike itself (wrangler dev + node --import
remix/node-tsx, one app two hosts) · chrome-devtools MCP for the browser
leg · esbuild · the saved verify-slice workflow + inline probes.

## Phase 5 — The data axis

### `data-strategy-lab` — resolved (2026-07-12)

The PLP's data-strategy comparison, run in the newly-standing best-judgment
mode: one plain upfront question to Rob (the wrong-tool exhibit — **in**),
every other decision made solo against the ADRs, the finished package
presented as a plain-language walkthrough, one-word approval, landed.

**The reframe that organized everything:** the four strategies aren't four
libraries, they're four answers to *where the data layer lives* — nowhere,
the browser, the server, the edge. Set the naive page as the baseline and
each strategy differs from it by exactly one architectural move; the
switcher's options become (path, query) presets and the switcher IS the
scenario table. The elegant consequence: **edge-KV needs no build at all**
— it is byte-identical code to cold with the bypass dropped, making the
edge flip the purest one-variable cell on the site.

**The hard new problem — reproducible *client* warmth — dissolved into an
existing mechanism.** A browser-memory cache cannot pre-exist a hard
navigation, so a `?clientcache=warm` knob would measure a thing no real
visitor experiences; rejected as the exact lab artifact the site promises
not to pull. Client warmth is instead *produced*, by an unmeasured
**priming interaction** prefix inside a versioned registry sequence —
perfectly symmetric with the edge tier's unmeasured priming request, and
receipt-compatible by precedent (receipts have carried interaction ids
since foundation #7). The registry grows a `{ prime?, measure }` split;
URL + registry id stays a complete, shareable condition.

**The prototype earned its keep twice.** First, the mechanics: 15/15 probe
assertions against the real local composed origin — revisits genuinely
free under the client cache (0 requests / 0 bytes), full round-trips
everywhere else, `bypass`/`miss`→`hit` semantics observable through both
client fetches AND server-side loader fetches (the x-pm-cache-state
pass-through the real HTMX Worker now owes). Second, the traps: TanStack's
*default* config treats cached data as stale immediately — the revisit
paints instantly but silently refetches 11.6 KB — which would have quietly
erased the strategy's headline win in production copy. Hence the standing
fairness rule the ADR records: **client-cache config is published copy,
never a silent default** (staleTime 5min, stated next to the numbers, the
default shown as a labeled footnote).

**The exhibit came out sharper than planned precisely because it's fair.**
Apollo 4 + `apollo-link-rest` on the *identical* page delivers the
*identical* revisit UX (0 requests, cache-first) — and costs **+65.1 KB
brotli of data-layer JS vs TanStack's +9.0 KB (7.3×, measured from real
builds)**, through a REST bridge that is a pre-1.0 RC and whose package
entry (UMD `main`, no `exports` map) broke the build once en route. "The
wrong tool *works* — you pay in bytes and machinery" is a staff-level
verdict no horror-show rig could deliver.

Six published cells, each with a stated question and a fenced win — the
lead strategy deliberately loses its own opening cell (first contact),
and the volume flip's verdict is left unwritten until the bench measures
it. Fit, not leaderboard, all the way down.

**Skills / tools used:** internal grilling (no fan-outs — tight budget
session) · primary-source verification (tanstack.com, apollographql.com,
npm registry) · the throwaway prototype (esbuild + one server + Playwright
probe with the origin suite's system-Chrome fallback) against `pnpm dev` ·
veto review as the verification leg, per the ticket's mode.

## Phase 6 — The look

### `aesthetic-direction` — resolved (2026-07-12)

The deferred aesthetic, poured. Rationale + rejected candidates in
[ADR-0006](adr/0006-aesthetic-direction-catalogue.md); the exploration
artifacts at [`prototypes/aesthetic-direction/`](prototypes/aesthetic-direction/).

**The constraint became the method.** The plan had been external Claude-design
prompt exploration (the committed prompt pack); Rob ruled that out — everything
local. That forced the realization the repo is the better design tool: the look
is literally primitive-token values, so a "direction board" can be a real
candidate pour rendered against the REAL component CSS and canonical markup,
with real covers from the frozen crate — differences between boards are exactly
and only what the production pour would change. Three boards were built that
way (Catalogue / Faceplate / Runout, each from a different corner of the
crate's world), presented side-by-side as an artifact, and Rob picked
**Catalogue** by replying with the board.

**Audit before eyes, principles after.** Every candidate palette had to pass
the ADR-0003 §4 contrast pairs *programmatically* (a new `audit-contrast.mjs`,
36/36 across the three boards) before the first screenshot existed — WCAG AA
as a generator constraint, not a retro-check. Then each board took one
screenshot-critique pass against the eight classic principles (per the Expo
piece Rob sent: AI has no eyes — render, look, critique by name, revise once).
The loop caught what the numbers couldn't: card titles at 1.25rem+ fighting
the cover art (A's size-3 capped at 1.1875rem), maximum-contrast body cream
sizzling on dark (B softened), Archivo's 700 too heavy at title size (C's
bold poured as 650). Typeface candidates were disqualified by fontTools
inspection before any board was built — Hanken Grotesk fell to a missing
`tnum` (ADR-0003 §8 is unforgiving, correctly).

**The pour proved the seam it was designed for.** Production change: primitive
tier values + the two-file font swap (Familjen Grotesk subset, later widened
to ~24 KB / 524 glyphs — see the coverage finding below — vs the placeholder's
105 KB, OFL no-RFN so the real name stays) + preload filename
in the consumers. Semantic tier, forced-colors remap, motion gate, every
component module: byte-unchanged. The placeholder guard in
`structure.test.ts` — which had enforced "the stand-in must be labeled
PLACEHOLDER" since issue #2 — inverted into its mirror: the token file must
now cite ADR-0006 and contain no placeholder language. Verification:
audit 12/12 on the poured file · turbo lint/typecheck/test 20/20 forced ·
`pnpm run origin-suite` twice, 120/120 both — the drift gate re-proving every
variant against the re-poured golden master is the exact machinery ADR-0003
§6 built for this moment. Browser probes confirmed the pipeline end-to-end
(Familjen resolved as the rendered face, 400/550/700 all real via
`document.fonts.check`, prices in tabular figures) and caught the one thing
grep couldn't: the reference gallery's demo note still *claiming* placeholder
status — prose lies after a state change; probes read pages, greps read
strings.

**The limit-resilient verification design earned its keep — literally caught
a real bug from inside a session-limit death.** The first `verify-slice` run
(on Fable 5) hit the model's usage limit and all four finder lenses reported
as errored; the workflow's summary came back `findings: []`. That empty
summary is the exact trap the standing rule names — a hollow result from a
dead stage means *nothing ran*, not *nothing found*. Reading the disk trail
first (the rule) surfaced that the correctness lens had **streamed one finding
to `findings-correctness.md` before it died**: the Catalogue face (Familjen
Grotesk) has no U+26A0, but the field component's error affordance renders its
⚠ icon with `content: "\26A0"` — so the pour silently regressed that one glyph
to a per-OS fallback (colour-emoji on some platforms, ignoring the
forced-colors remap), and the new README's "plus U+26A0" claim was false for
the shipped binary. Independently confirmed with fontTools (absent in the
Familjen source; present in the retired Inter subset) and in-browser (the
rendered ⚠ measured 16.4px through the real stack vs 15.1px system-only —
proof of which glyph wins). Fixed at the font layer without touching a
component (honouring ADR-0003 §7 and the subset's own prior commitment to
that glyph): a 1-glyph ~1.2 KB monochrome Inter subset as a `"PM Warn Glyph"`
`@font-face`, `unicode-range: U+26A0`, behind Familjen in the stack, shipping
its own OFL, with a `structure.test.ts` regression guard.

That fix then surfaced a *second*, latent bug — this time in the drift gate,
and only because the origin-suite is run twice back-to-back: the field-error
drift test began failing deterministically. `captureStablePixels`
(`drift-gate/src/gate.ts`) waited for **every** registered `@font-face` to
report `loaded`, but a `unicode-range` fallback that no glyph on the page
triggers stays `unloaded` forever — so the gate timed out. The assumption was
latent since issue #6 and would have broken for any icon/CJK subset; the fix
relaxes the settle condition to "no face still *loading* and at least one
*loaded*," which ignores never-triggered ranges while still refusing to shoot
mid-swap. (The in-page probe stays synchronous — an `await` there dies on the
JS-disabled variant, a hazard the gate comment already recorded.) Two real
bugs from one glyph, both caught pre-commit. The sequential, stream-to-disk
workflow shape — adopted after three earlier fan-outs died losing everything
— is precisely why the limit death cost nothing; the run-twice rule is why
the deterministic gate failure wasn't mistaken for flake.

**The re-run (on Opus, after the model switch) found the deeper version of the
same class.** Two more real findings, both the font's *claims* vs the *frozen
crate*: (1) my ADR said "every consumed pair clears AA," but
`--color-border`/surface is 1.39:1 — fine as a border, but below SC 1.4.11's
3:1 for a control boundary; a pre-existing, deliberate airy-look choice, now
stated honestly and flagged to `a11y-section` rather than over-claimed. (2) The
bigger one: `⚠` was not the only glyph Familjen lacks — the crate's own data
uses **30 codepoints no Latin face covers**, headed by `⅓` (179×, in "33⅓ RPM"
right on the PLP card) and `℗` (74×). The CI fixture is pure Latin, so the
drift gate could never catch it; only scanning the committed crate against the
font's cmap did. Rob's call (asked — it touches his curated non-Latin
releases): ship Latin-correct now, defer the fraction/symbol/script fallback to
a new `crate-glyph-coverage` ticket. So the Latin subset was widened (Latin
Extended-A/B; 327→524 glyphs), the "one glyph" claim corrected across
ADR/README/map, and the gap frozen into `coverage.json` + a `repo-checks` guard
that fails if a re-freeze adds an undocumented uncovered codepoint (across all
three display trays — summaries, details, curation). The guard is
dependency-free: the manifest pins each font by sha256 and records its cmap, so
a Node test checks crate coverage without a woff2 parser. Its honest boundary
(itself an anti-rigging-lens finding this session): the sha pins the font
*bytes*, but the recorded codepoints are recipe-derived and NOT re-parsed from
the woff2 in CI — so the manifest must be regenerated via the README recipe,
never hand-edited, and the exhaustive proof the fonts actually render is the
drift gate (real screenshots), with this manifest the cheap tripwire for the
latent, not-yet-rendered crate. Making CI re-derive the cmap is recorded as a
future hardening on the `crate-glyph-coverage` ticket. Net: the pour ships
honest about exactly what its one Latin face does and does not render — and the
anti-rigging pass also corrected stale counts (118→120) and a stale font size
(19→24 KB) in the docs, and hardened two structure-test guards (value-level
palette assertions so a reverted pour fails the unit test, and brace-bounded
`@media` extraction so a future block can't cause a false pass).

**Workflow friction, recorded.** Getting `verify-slice` to run took two edits:
named-workflow args arrived as a JSON *string* (the script's `args.issue`
guard threw instantly), and its baked-in context pinned finders to the main
checkout with a `gh issue view` instruction — which for a worktree slice on a
GH-issue-less ticket would have them reviewing an unchanged tree and calling a
missing issue. Fixed the persisted run copy to relaunch, then **upstreamed both
fixes into the saved `.claude/workflows/verify-slice.js`**: parse string args,
a `repoDir` arg (defaulting to the main checkout), and numeric-issue detection
that switches between `gh issue view` and a decision-map ticket. Lesson: an
empty-or-instant workflow failure deserves a read of the persisted script
before a retry, and a worktree slice needs `repoDir` set.

**Skills / tools used:** frontend-design skill (direction vocabulary + the
anti-default discipline) · fontTools/pyftsubset (axis + `tnum` verification,
subsetting) · `audit-contrast.mjs` (new, committed) · chrome-devtools MCP
screenshot-critique loop · artifacts as Rob's viewing surface (briefing,
prompt pack, boards) · origin-suite ×2 + shimmed verify-slice · the Expo
eight-principles critique frame.

## Phase 7 — The front door

### `home-surface` — resolved (2026-07-16)

The gateway page, replacing the throwaway index at `/`. Rationale + rejected
alternatives in [ADR-0007](adr/0007-home-surface.md); the decision-map answer
carries the eight decisions. What the record should keep beyond those:

**Words before pixels, and the panel earned its keep.** The prompt named the
copy as the hardest problem, and recon confirmed why: the two constraints
that bind every sentence — the page ships before the store surfaces exist,
and no verdict may be pre-asserted (strategy-review finding 2 / ADR-0005 §6)
— were both violated by every first-draft hero. The deck went to a six-lens
adversarial panel (tired staff engineer, hiring manager, voice cop,
fact-checker with repo access, thesis guard, structure editor; 60 findings).
All six independently converged on the same two close-tabs (hero tense,
verdict voice) — and the fact-checker and staff-engineer lenses both caught
that the deck's short SHA `f603859` was wrong in its seventh character
(`f60385f`): a hand-transcription error headed for the hero etch of a
receipts-first page. The fix became architecture, not proofreading: the etch
is now substituted at build time from the committed crate manifest, and the
origin suite asserts the page's receipts equal it. On a site whose whole
posture is receipts, copy that carries numbers must be *generated from* the
receipt, never typed.

**The signature spends the metaphor where it's true.** The deadwax disc —
pure CSS/SVG, no images — is ADR-0006's own earmark (Runout's etch motif,
reserved for instrument surfaces) rendered with real manifest fields; the
center label's catalogue number is the commit SHA. The panel's thesis-guard
also forced a precision the first draft missed: matrix numbers name
pressings (variants), catalogue numbers name a label's listings (surfaces) —
so the gateway rows carry PM-001…PM-006 and the deadwax register stays with
the disc and the "Your visit" band. The scroll-driven rotation (the record
turns as the page is read) is compositor-only and double-gated; Firefox gets
a still disc, reduced-motion gets stillness everywhere via the same semantic
gate the components use.

**Honesty as the load-bearing design move.** The launch-state problem — a
gateway where every destination is unbuilt — resolved into the page's
strongest judgment signal instead of its apology: the hero's tense is
progressive ("being built five ways"), the status line is an inventory
("the instrument shipped first — no verdict can be retrofitted"), each
catalogue row links its dated public decision record, and "How it was
built" ships *Public today* so both status states are demonstrated on day
one. Verdict-free tradeoff lines survive C2; the one number on the page is
the fenced Apollo exhibit with its build-measured label.

**The verify pass earned its keep again — and died mid-run doing it.** The
standing verify-slice run completed two of four lenses before hitting the
session limit (the other two resume after the reset — the sequential,
stream-to-disk shape means nothing completed was lost). The two finished
lenses returned thirteen findings; the sharpest were the receipts test's
count assertion being **vacuously satisfiable** — `toContain("500")` matches
`--pm-accent-500` in the page's own inlined tokens CSS, so a hand-typed
wrong count would ship green forever (fixed: assertions anchor to the etch
string and hero copy, e.g. `"500 RELEASES · FROZEN 2026-07-11"`) — and the
**Turbo cache gap**: `@pm/front#build` read the crate manifest without
declaring it an input, so a crate re-freeze touching nothing under
`workers/front` would replay a cached dist with the old receipts onto the
deploy path (fixed: `$TURBO_ROOT$` input). Also fixed from the same pass:
the meta description hand-typing the release count the build exists to
substitute, `String.replace`'s `$`-pattern injection latent in the CSS
inlining (function replacements now), missing manifest-field validation
(`FROZEN undefined` could have shipped green), one C2 verdict slip on the
PM-002 row ("the article page couldn't justify"), the etched SOURCE field
having no visible-text twin, and two literal hexes in the disc that
contradicted the no-new-values claim (now `color-mix()` derivations of the
poured neutrals, so a re-pour moves the disc). A home-HUD browser test
(readout populates; beacon tagged `singleton`/`home`) joined the suite.
The lenses resumed after the reset (all four re-ran — the amended context
invalidated the cache — against the fixed tree) and caught a second ring of
the same drift class: the head's `theme-color`/favicon hexes (now
substituted from the token file at build), the disc's dozen paper/ink
*alpha* values (now `color-mix()` derivations — no literal color remains in
the page CSS), `list-style: none` silently stripping list semantics in
Safari/VoiceOver (`role="list"` restored on all three lists), and the
`/pm/*` canonical-font leg having no byte-identity coverage (now asserted
against the package files, mirroring the variant leg).

**Measured, not hoped (2026-07-16, local composed origin):** wire cost
≈ 37.7 KB all-in (10.5 KB HTML with all CSS inlined, brotli · 1.0 KB
fonts.css · 23.7 KB font · 2.5 KB shared ruler), zero images, zero own JS;
LCP 70 ms desktop unthrottled and 654 ms under Slow-4G + 4× CPU, CLS 0.00;
Lighthouse 100/100/100; 320 px reflow with no horizontal scroll; skip link,
focus rings on both registers (paper-white ring on the dark band), forced-
colors collapses the disc to an outline. The origin-suite `/` contract was
updated in the same change (home marker + own-HUD + receipts-match-manifest;
injected-chrome markers still forbidden — assets-first behavior untouched).

**Skills / tools used:** modern-web-guidance (scroll-driven animation
gating, font-swap stability) · frontend-design skill (signature-element
discipline; the brief pinned the palette, so the boldness budget went to
composition) · six-lens copy panel workflow · chrome-devtools MCP
(screenshot critique, trace, Lighthouse, viewport/emulation passes) ·
disc prototyped standalone in scratchpad before page integration.

## Phase 8 — The store takes shape

### `surface-design` — resolved (2026-07-17)

Every store surface plus the instrument, designed as the spec layer the
variant builds consume. Rationale + rejected alternatives in
[ADR-0008](adr/0008-store-surfaces-and-instrument.md); the decision-map
answer carries the twelve decisions. What the record should keep beyond
those:

**The panel caught the author with his own rule.** The draft justified the
gallery's 1:1 mat with "1,022 of 1,817 at 600×600" — a hand-typed number
that was a mislabeled different query (width-600-any-height). Three of
seven lenses independently reran the jq and got 653; the same pass caught a
second typed number ("max 1,762 s" — really 3,816) sitting in a code
comment. This is the ADR-0007 SHA lesson recurring at the next scale: the
discipline now extends past receipts into design justifications — the
numbers that argue a decision get derived and recorded with their query, or
they don't get written. Both wrong numbers were unforced; the corrected
data argued the same conclusions.

**Boards on the real system, again.** No mockups: the six surfaces were
rendered from the real crate through the real tokens and screenshotted for
critique — which is how the release card's silent distortion bug surfaced
(204 of 500 primary covers are non-square; the forced 1:1 box had only
ever been proven on square placeholder art; `object-fit: cover` joined the
contract). The boards also proved the two-register system at first
glance: the deadwax strip over the warm store reads as instrument-holding-
specimen, exactly as home promised.

**Receipts before decisions.** The issue-#9 derivative call waited on a
sips scan of all 1,838 retained originals (zero exceed 600 px on either
side) — the "600 is the ceiling" claim went from assumption to receipt
before the ADR asserted it. The 160 px thumb tier that scan justified was
generated through the derive phase whose own comment anticipated the
re-derivation ("re-derivation starts here, never at Discogs").

**Two limit deaths, zero lost work.** The seven-lens panel died whole on
its first launch (all lenses, session limit) and was resumed byte-identical
after the reset per the standing runbook — second run 7/7. The fixture/
thumb build agent died mid-verification hours later; its on-disk work was
complete through the index step, and the remaining probes ran inline in the
foreground. The artifacts-are-the-state discipline priced both deaths at
minutes.

**Measured, not hoped (reference renders, 2026-07-17):** a Slow-4G + 4×-CPU
trace of the crate PLP board — the heaviest surface, 24 real covers —
reads **CLS 0.00** (zero by construction holds where it matters most) with
LCP image-bound and its load delay at 627 ms (the pinned
`fetchpriority="high"` doing its job). Absolute LCP on the board server is
a floor-check only: it serves uncompressed, uncached, HTTP/1.1 — the
variants' delivery on the composed plane is the measured variable, and
those numbers belong to the variant builds' receipts. The chrome held one
line at 320 px with the reading table scrolling inside its own labelled
container; the strip's collapsed box never moved while vitals streamed.

**Skills / tools used:** frontend-design skill (the boldness budget went to
the etch grammar — the named risk) · modern-web-guidance (LCP priority,
disclosure patterns) · seven-lens panel workflow + inline refutation ·
chrome-devtools MCP (board screenshots, the throttled trace) ·
fontTools/pyftsubset (two new subset faces) · sips (the originals scan) ·
parallel build agents for the glyph and fixture/thumb slices with the main
session on the chrome.

### `editorial-build` — PRD'd and sliced (2026-07-18)

The first per-surface variant build, PRD'd and sliced per the foundation
precedent (issue #1 → #2–#8), committed as `docs/prds/editorial-build.md`
+ `editorial-build-issues.md`: six chained slices, vanilla → react-next →
astro → qwik → htmx → remix3 — vanilla first because the host variant
carries the pattern (workspace shape, snapshot-parameterized build,
composition wiring) and the obligations with no natural owner elsewhere
(the ADR-0008 §9 deployed re-render leg, the cart storage contract, the
snapshot-selector minting, the NoiseSpec behavior-attribute class).

Verification: four background lenses planned; adr-fact-checker (7
findings) and seams (8) completed before the session limit killed
zero-bias and hostile-staff — both were hand-walked inline by the main
session per the round-three learning, finding one more real defect. With
the two foreground probe finds, **17 distinct defects were adopted into
the PRD before commit**. Headline finds, all seams-shaped: **no cart
storage contract existed anywhere** (ADR-0004 §5 pins
localStorage-cart-only but nothing names the key or shape — five variants
inventing it independently would silently break cart-survives-the-swap);
**the turbo cache would have shipped fixture builds to the crate plane**
(the origin and deploy jobs share the `turbo-origin-*` cache family and
both run `turbo run build`; the snapshot selector — which didn't exist —
must be declared turbo `env`, exactly the failure mode turbo.json's
`@pm/front#build` comment records for home's receipts); **the
behavior-attribute noise class ADR-0008 demands is inexpressible in
today's `NoiseSpec`** (attrPatterns/classPatterns only — slice A extends
the type so B–F never touch shared gate code); and the inline zero-bias
walk caught my own adopted fix over-reaching (an unconditional
`[data-pm-fenced]` normalizer drop would let any core variant hide DOM
from the gate — scoped to the fenced variant's own comparison, with a
core-pages-fence-free assertion).

One process note: the session's permission gate (correctly) declined to
publish GitHub issues nobody had named publishing — the PRD and slice
specs are committed in-repo instead (artifacts are the memory), with the
publish commands in the issues file's header. The build does not wait on
the mirror.

### `editorial-build` slice A — the vanilla editorial variant (2026-07-18)

`/vanilla/editorial/` serves through the composed origin, and the first
REAL variant now stands where the placeholders stood. What the record
should keep beyond the slice spec:

**The §9 leg and the drift gate turned out to be one mechanism.** The
issue framed "first variant-vs-master comparison" and "deployed-smoke
re-render leg" as two duties; the honest implementation is one
snapshot-aware block in `drift.browser.test.ts` — re-render the editorial
master IN-PROCESS from whatever snapshot `/api/snapshot` says the origin
serves, then compare the served page by normalized DOM and by pixels
across the three profiles. In CI that resolves to the fixture (proving
fixture-equivalence, exactly what the committed master already pins); on
the deployed plane it resolves to the crate, which the committed
fixture-rendered master could never prove. Two re-render flavors were
needed: the DOM leg keeps tray-verbatim `/assets/img/*` srcs (attribute
values are contract), the pixel leg points image srcs at the origin under
test because the crate's image bytes are deliberately not in git.

**The crate mode was proven locally before any deploy.** The capture
machine holds the crate bytes, so `PM_SEED_DIR=tools/snapshot-capture/crate`
ran the entire suite against a crate-seeded plane with crate-baked vanilla
pages: 158/158, after 158/158 in fixture mode. run-local now DERIVES
`PM_SNAPSHOT` from `PM_SEED_DIR` rather than reading a second knob — the
"one command holds either way" promise stays true by construction, and the
two selectors can never disagree silently.

**The selector hazard closed as specified.** `PM_SNAPSHOT` is declared
turbo `env` with both snapshots' tray JSONs as `inputs` on
`@pm/vanilla#build`; the deploy job sets `crate` on its bare
`turbo run build` step. Without the declaration, the deploy job's restored
`turbo-origin-*` cache would have replayed the origin job's
fixture-flavored dist onto the crate plane — the exact failure mode the
PRD's verification round predicted from home's receipts precedent.

**Cart contract: constant + conformance, not convention.** `CART_CONTRACT`
lives with the shell contract (`packages/reference/render/shell.mjs`):
key, versioned value schema, count semantics, badge copy, label copy,
announcement copy, recovery rule. Vanilla re-implements it in
`src/cart.js`, and the suite's JS-on leg asserts the rendered strings
against the IMPORTED constant — five variants can no longer invent five
carts, because divergence fails a test instead of a swap. The enhancement's
data hook rides a JSON `<script>` element (delivery, not contract), so
vanilla stays the registry's NO_NOISE control with zero extra attributes.
Two contract clauses exist because verification forced them: the badge
caps at "9+" (the slot's CSS is `min-width: 2.4ch` — an uncapped
three-digit count would have the shell manufacturing post-paint CLS on
every page load, the exact kill-condition class ADR-0008 §1 bans), and
the cart anchor's `aria-label` carries the exact count (the badge span is
`aria-hidden`; masthead.css's header had named this duty and the drafted
contract missed it — the correctness lens caught the contract
contradicting the CSS it sits on).

**Content consumption: re-type, recorded.** The PRD left essay-copy
consumption to this slice; the call is variant-owned re-typed content
(`DIFF-TO-STARTER.md` records why: `@pm/reference` exposes no JS entry by
guard, and request-time paradigms would otherwise bundle reference
renderer code into served Workers). The gate polices textual identity both
ways — a rough-normalized body diff of the built page against its master
came back byte-identical for BOTH snapshots before the browser gate ever
ran.

**One foreground find, refuted-then-fixed.** The new page assertions
initially banned planned-variant hrefs page-wide; the masthead's
designated-host link (`Records → /react-next/plp/plain/`) is contract
markup that legitimately anchors to a planned variant's other surface. The
assertion is now scoped to the switcher row — the sparse-honesty rule
lives in the chrome, not the shell.

**Verification:** turbo lint/typecheck/test 20/20; origin suite 158/158
in fixture mode AND 158/158 against a crate-seeded local plane before the
adversarial pass. verify-slice ran its four lenses sequentially in the
background (no limit death this time; ~830k subagent tokens) while the
foreground probed inline: **11 findings, all refuted against source
inline, all 11 real, all adopted pre-commit.** Beyond the two contract
clauses above, the keepers: the smoke's new JS-on cart tests were
beaconing synthetic RUM for a REAL measured surface into the production
collector (route-intercepted now — the bench-runner precedent; the
chrome suite's deliberate beacons stay); `behaviorAttrPatterns` was
convention-only, so a repo-checks guard now fails any `attrPatterns`
regex that matches an ADR-named behavior-attribute shape (the label is
load-bearing, not decorative); crate-flavored TEXT was only ever compared
after merge+deploy — a Node-only repo-checks guard now renders both
renderers from both committed snapshots' trays pre-merge, closing the
"merge green, smoke red" hole against the PRD's own standing rule; the
zero-shift claim is pinned by geometry (bounding-box before/after badge
population), not just by string; and `fonts.css` joined the byte-pinned
set (the loading half of ADR-0003 §8 that settled-pixel comparisons are
structurally blind to). One test assertion was also caught twice —
foreground and conformance lens independently — hardcoding today's
one-variant state instead of deriving from the arrays; it now recounts
from `SURFACE_CONTROLS` and survives B–F's registrations unchanged.
Final state with every adoption in: origin suite 160/160 (the transport
and capped-badge tests joined it), turbo checks 20/20.

### `editorial-build` slice B — the react-next variant, OpenNext on Cloudflare (2026-07-19)

`/react-next/editorial/` serves through the composed origin: the render
baseline's planning-time villain, on the framework's own idiomatic
default (`create-next-app`, unmodified except where ADR-0008 forces a
deviation — DIFF-TO-STARTER.md records every one). What the record
should keep beyond the slice spec:

**Next 16 warns it isn't the Next you trained on, and it was right twice.**
The scaffold's own `AGENTS.md` says to read `node_modules/next/dist/docs/`
before writing code, not recall it — followed literally. Two findings
came directly from that discipline, not guesswork: Cache Components
(`cacheComponents: true`) is opt-in in v16, not the default, so the
classic `dynamic = "force-dynamic"` route-segment config still governs
this variant exactly as it always has; and `basePath` only auto-prefixes
`next/link`/`next/router` — hand-written `<link>`/asset paths need the
prefix written in, which is what makes fonts/CSS byte-identical delivery
possible at all (point 8 below).

**A genuine infinite-recursion bug, found by actually running the build,
not by reading it.** `@opennextjs/aws`'s `buildNextjsApp()` shells out to
`${packager} build` when no `buildCommand` is configured — for pnpm,
literally `pnpm build`, i.e. this package's OWN `build` script (`... &&
opennextjs-cloudflare build`). Running `pnpm run build` therefore called
itself, forever; the failure looked like a hung process re-printing its
own banner every ~15s, not an obvious stack overflow, and took several
rounds of process-tree inspection and a raw-log capture (the CLI's own
TUI redraws obscured the real error) to trace to the actual cause. Fixed
by pinning `buildCommand` on the object `defineCloudflareConfig()`
returns (its own parameter type doesn't accept the field — has to be set
after the call, not passed into it).

**Fonts/CSS as a controlled constant meant fighting the recommended
pattern, on purpose.** ADR-0003 §8 requires byte-identical files and
canonical loading markup; Next's own guidance for stylesheets
("Unsupported Metadata" table) is "import them directly," which runs the
files through the bundler — hashed, processed, no longer byte-identical
to `@pm/tokens`. `scripts/copy-tokens.mjs` copies the source files
untouched into `public/` instead, and `layout.tsx` renders a literal
`<head>` with plain `<link>` children. One wrong assumption corrected
empirically along the way: rendering those `<link>`s as children of
`<body>` (the first attempt, reasoning that React hoists `<link>`/`<meta>`
from anywhere in the tree) does NOT get them moved into `<head>` — they
stayed exactly where authored, confirmed by fetching the real served
page, not by re-reading React's docs harder. An explicit `<head>` element
is what actually places them there.

**The zero-tolerance pixel gate found a real, if invisible, difference —
and the fix was a code-quality improvement, not a tolerance threshold.**
All three profiles failed pixel comparison against the master on the
first real run, ~0.01–0.02% of pixels differing, clustered on individual
glyphs mid-paragraph. Side-by-side crops looked identical; only a pixel
subtraction revealed it. Root cause, traced to source: JSX splits
`text {expr} more text` into separate DOM text nodes joined by React's
own empty `<!-- -->` hydration-boundary comments (confirmed in real
served output), and Chromium's text shaping produces measurably different
sub-pixel antialiasing across that extra node boundary than across the
master's single continuous text node — same visible characters, same
CSS, different glyph-edge rounding. `comparePixels`' zero-tolerance
policy is deliberate spec (`includeAA: true`, same-run determinism —
tools/drift-gate/src/pixels.ts's own header), so the fix was in the
essay content, not the gate: every prose block became one combined
template-literal string per side of any embedded `<em>` (matching the
master's own single-text-node shape exactly), JSX used only to wrap the
actual `<em>` element. Zero pixels differ now, across all three profiles,
both snapshots.

**A framework-residue class the existing registry couldn't express, so
the registry grew a new kind of entry.** App Router's own SSR streaming
wraps the body in an empty `<div hidden><!--$--><!--/$--></div>` marker —
real, unavoidable, measured from actual served output. The comments are
already-permitted noise (stripped unconditionally); the wrapping ELEMENT
had no equivalent case — `NoiseSpec`'s three fields only ever strip
attributes/classes on elements that exist in both master and variant, not
elements that exist only in one. `dropElementSelectors` generalizes the
drift gate's own hardcoded chrome-slot removal into registry policy: any
future variant with the same kind of structural-wrapper residue registers
a CSS selector instead of the gate needing another one-off carve-out.

**verify-slice ran all four lenses sequentially in the background while
the foreground probed inline and built the remaining registrations: 8
findings, all verified against source before adopting, all real, all
fixed pre-commit.** Beyond the pixel-gate and recursion findings above:
an origin-suite raw-string assertion used the decimal HTML entity form
(`&#39;`) for the featured release's title/artist, but React's SSR
serializer uses the hex form (`&#x27;`) — verified against the installed
`react-dom` source, not assumed; both decode identically so the real
(DOM-parsed) drift gate was never at risk, but the raw `.toContain()`
check would have false-failed the moment a future curated pick's
title/artist contained an apostrophe, quote, `&`, `<`, or `>` (the current
picks happen to have none) — fixed with a React-specific escape helper
for that one assertion. The pre-merge variant-master-identity guard's
`dropElementSelectors` registration was never actually exercised by its
own mechanism (`renderToStaticMarkup` doesn't produce the streaming
wrapper `PAGE_NORMALIZE` is supposed to strip), a silent no-op a future
selector typo or framework version bump could hide behind — closed with a
dedicated case that normalizes a literal wrapper fixture through the
registered spec and asserts it disappears. The interactive cart suite
(`cart.browser.test.ts`) was the only JS-on end-to-end coverage and was
hardcoded to vanilla; react-next's cart islands had zero automated
click-through proof despite DIFF-TO-STARTER.md claiming the behavior
works — parametrized over every live editorial variant instead of adding
a one-off twin. `@pm/react-next#build`'s turbo task declared no `inputs`
for the fixture `manifest.json`/`curation.json` it statically imports at
build time (the featured-id policy resolution) — a fixture regeneration
touching neither file under `variants/react-next/` would have replayed a
stale cached bundle, the exact hazard `@pm/vanilla#build`'s own inputs
declaration already exists to prevent, just from a narrower cause here
(one variant-owned data import, not the whole tray). And the most
consequential: the `deploy` script never ran `copy-tokens.mjs` — CI's
"deploy" job invokes `pnpm --filter @pm/react-next run deploy` directly,
entirely outside turbo's cache, and since that job's turbo cache for the
"build" task is a guaranteed hit on a normal push (shared cache key with
the already-run "origin" job, same SHA), `public/assets/pm/` — git-
ignored, not a declared turbo output — would never have existed on the
deploy job's runner at all. Undetected, the very first real deploy would
have shipped a Worker with all nine CSS files and both fonts 404ing: a
completely unstyled production page. Fixed by making `deploy`
self-sufficient, the same way `build` already was. The anti-rigging
lens's two findings closed the arc: `dropElementSelectors` removed a
whole subtree by POSITION only, with nothing proving it was actually
content-free — traced to Next's own source, the exact div it targets is
the framework's streaming-METADATA boundary (`MetadataWrapper()`), empty
today only because this page's `generateMetadata()` returns nothing but
an auto-hoisting `<title>`; a future icon or `alternate` link added there
would render as a real child inside the SAME div and be silently erased
before the drift gate ever compared it — fixed with a content-emptiness
guard (`childElementCount === 0`) plus a pinned exact-substring assertion
that fails the moment the div stops being empty. And: nothing forced the
one failure path this, the FIRST request-time variant in the whole
matrix, actually has — an unreachable or non-2xx `pm-edge` had no error
boundary at all, meaning a visitor would land on Next's generic unbranded
default (confirmed by tracing the compiled bundle, not assumed) instead
of the store's own chrome. Added `app/editorial/error.tsx` reusing `Shell`
directly, verified end-to-end by temporarily sabotaging the edge fetch
path and checking the ACTUAL rendered DOM via Playwright (the failure
path streams an RSC payload a raw curl can't resolve into visible text),
then reverting — disclosed as a manual verification, not a committed
automated test (DIFF-TO-STARTER.md records why: the alternatives were a
test-only fault-injection hook in production code, or stopping the edge
Worker mid-run and destabilizing the shared composed-origin suite).

**Verification:** turbo lint/typecheck/test 22/22 (root `eslint.config.mjs`
gained `.next/`/`.open-next/`/generated-`.d.ts` ignores along the way —
found by actually running the repo-wide lint, which had picked up ~16,000
errors from Next's and OpenNext's own bundled/generated output before
that fix). Origin suite 199/199 in fixture mode AND 199/199 against a
crate-seeded local plane. Narrative in this entry; DIFF-TO-STARTER.md
carries the full deviation-by-deviation record, including two items
(the Brotli/`localhost`-vs-`127.0.0.1` wrangler-dev gotcha, and the
`esbuild`/`pnpm-workspace.yaml` `packageExtensions` fix for
`@opennextjs/cloudflare`'s own incomplete dependency declaration) verified
empirically rather than assumed from the library's documentation.

**Postscript: a CI-only failure, invisible on every local machine, was a
real hydration bug — not flakiness.** After the slice B commit pushed
green through `check` and 209/209 locally in both snapshot modes, CI's
"origin" job failed exactly once, on `suite/cart.browser.test.ts`'s
geometry assertion for react-next: the masthead cart link's bounding box
moved 45px between the pre-add and post-reload measurement. Unreproducible
locally across many runs — the actual cause was a genuine race, not
environment drift, confirmed by launching Playwright's Chromium with
`Emulation.setCPUThrottlingRate: 4` locally: throttled, the same
assertion failed 4/8 runs with the exact CI signature. A body-tree
bounding-box dump at 100ms intervals isolated it to `div#pm-chrome-slot`
(`src/lib/render.tsx`'s `Shell`): the front Worker's HTMLRewriter injects
the switcher/HUD chrome into this div by rewriting the HTTP response in
transit, so the browser's initial HTML parse already contains it — but
React's own vdom for the element has zero children. Traced into
`react-dom`'s own hydration source (`popHydrationState` in
`react-dom-client.development.js`): when a host component hydrates with
no expected children but unclaimed DOM nodes remain, it calls
`throwOnHydrationMismatch` and React's mismatch-recovery re-renders that
subtree from the client's (empty) output, silently deleting the injected
chrome. On any fast machine this resolves within the same frame as paint
— invisible; CPU-throttled (i.e. a loaded CI runner), it's delayed long
enough for the geometry test's two measurements to straddle the collapse.
Also a real, currently-shipped production bug independent of the test:
the switcher/HUD visibly vanishes on this variant a moment after every
page load, on any visitor's machine slow enough to notice. Fixed with the
one escape hatch that actually works — confirmed by reading
`shouldSetTextContent`'s source, not assumed: `dangerouslySetInnerHTML`
with a non-null (even empty-string) `__html` makes React treat the host
component as having "set" content, which is the specific condition
`popHydrationState` checks to skip the mismatch walk entirely.
`suppressHydrationWarning` alone does not do this — it only silences a
value-diff warning one level deep, and does not stop the extra-children
walk (verified in the same source read, not by trial and error).
Re-verified 8/8 under the same throttle with the fix applied, then
209/209 in both fixture and crate modes at normal speed. Unrelated
discovery made while chasing this down: this development machine had
accumulated dozens of orphaned `wrangler dev`/`workerd` processes across
many past sessions (`run-local.mjs`'s teardown only ever kills its own
run's children, never a prior run's orphans if the parent was killed
uncleanly) — real contributor to a red herring 522s suite run before the
actual fix was isolated; cleared manually, not a code change.

### `editorial-build` slice C — the astro variant, islands with no island (2026-07-24)

`/astro/editorial/` serves through the composed origin. Static output, no
adapter, and — a first for this build — **nothing added to the shared
tooling**: no new `NoiseSpec` field, no new normalizer behavior, not even a
`PERMITTED_NOISE` entry. What the record should keep:

**The slice's flagged judgment call was settled by measurement, and the
measurement inverted the intuition.** ISSUE C says to make Add to cart an
island "if that is Astro's idiomatic shape for one interactive button".
Before deciding, a throwaway Astro project with `@astrojs/preact` was built
with the same button behind `client:load`. It emits the button wrapped in an
`<astro-island uid=… component-url=… renderer-url=… ssr client="load"
await-children>` custom element. That element has element children — so
`PAGE_NORMALIZE`'s content-aware `dropElementSelectors` guard
(`el.childElementCount === 0`, minted by slice B for exactly the opposite
reason) refuses to remove it, and no registration could excuse it without
first widening the guard until it could hide real divergence. The sharp
detail worth remembering: `astro-island` carries `display: contents`, so the
wrapper is visually transparent and **the pixel leg would have passed** —
only the DOM check catches it. A paradigm's hydration wrapper is invisible
to pixels and loud in the DOM, which is precisely the division of labour the
two-check gate was designed for.

The chosen mechanism is a plain bundled `<script>` importing
`src/scripts/cart.ts`, which is what Astro's own docs put first for
interactivity "without the need for a UI framework like React, Svelte, or
Vue" — Astro still compiles the TypeScript, resolves imports and minifies
it, so this is a real paradigm delivery path, not a hand-written blob. The
honest finding underneath: on prose with one button, the islands paradigm
has **no island to place**. One click handler is not a component boundary.

**"Astro registers no noise" is an outcome, not a design choice — so it is
asserted, not assumed.** Vanilla registers nothing because it IS the
`NO_NOISE` control. Astro registers nothing because both of its noise
species turned out to be opt-in and this page opts into neither:
`data-astro-cid-*` scoping attributes are emitted only for components
carrying a `<style>` block (measured — a probe component with one `<style>`
stamped a cid on `html`, `body` and every element in the component), and
`<astro-island>` only around framework components with a `client:*`
directive. Because it is an outcome it could silently stop being true, so
`editorial.test.ts` and the drift leg both grep the RAW served bytes for
`data-astro-cid-` and `<astro-island`. Adding either later fails loudly
instead of letting a NO_NOISE comparison quietly start lying.

**Astro's escaping is byte-identical to the reference renderer's — verified,
and it changed the shape of the slice.** Astro escapes through
`html-escaper` (v3.0.3 installed), which maps the same five characters to
the same entities as `packages/reference/render/lib.mjs`'s `esc()`,
apostrophe included: `&#39;`, decimal. React emits `&#x27;`, which is why
slice B needed a second `reactEsc` helper for its raw-string assertions.
Astro also renders bare boolean attributes and does not self-close void
elements, so `crossorigin` stays `crossorigin` and `data-pm-cart-count`
stays bare. Consequence: slice C's font-leg assertion is the strict
string-for-string form vanilla uses, with none of the renderer-shaped
tolerances slice B had to add, and the whole page is byte-comparable to the
master rather than merely DOM-comparable. The normalized DOM matched the
master on the FIRST build, for both snapshots.

**Where the identity guard lives, and why it moved.** ISSUE C's pointer said
`tools/repo-checks`, where slices A and B put theirs; the instruction to
read Astro's own container/compiler APIs first is what changed the answer.
Astro ships a real render-to-string entry point — the Container API
(`experimental_AstroContainer` from `astro/container`, `renderToString(…,
{ props, partial: false })`) — but loading a `.astro` file requires Astro's
compiler, i.e. `getViteConfig` in the vitest config. Hosting that in
`repo-checks` would route every repo-wide structural check through Astro's
Vite plugin, so an Astro upgrade could break guards with nothing to do with
Astro. The guard therefore lives in `variants/astro/test/`, still reached
pre-merge by the `check` job's `turbo run lint typecheck test`, with
`@pm/astro#test` declared `cache: false` — its real inputs span the
reference renderer and both committed snapshots, a set easy to
under-declare, and an under-declared input means turbo replays a stale PASS
while crate copy has actually drifted.

**The `deploy` script is deliberately the OPPOSITE of slice B's, for the
same underlying reason.** Slice B learned that CI's deploy job runs
`pnpm --filter … run deploy` entirely outside turbo, so its `deploy` had to
re-do the token copy itself or ship an unstyled page. Slice C's `deploy` is
bare `wrangler deploy` and must NOT rebuild: the deploy step does not set
`PM_SNAPSHOT` (that env is scoped to "Build worker dists"), so a rebuild
there would default to `fixture` and overwrite the crate-baked dist with the
fixture essay moments before uploading it — publishing "the fixture never
leaves CI" prose to production. Relying on the turbo-built dist is safe here
in a way it was not for slice B, and for a specific reason: everything astro
serves lands inside the declared `outputs: ["dist/**"]` (the copied tokens
included, because Astro copies `public/` into the output), so a cache hit
restores a COMPLETE dist, whereas react-next's `public/assets/pm/` was an
undeclared git-ignored input a cache hit never recreated. Same hazard class,
opposite correct answer — the reason each variant's deploy script has to be
reasoned about rather than copied.

**Astro's `compressHTML` strips whitespace the master has; the pixel leg is
what proves that is fine.** Astro removes inter-element whitespace (the
newlines between the masthead nav's two anchors, the footer nav's four) that
the reference serialization carries. Legitimate — whitespace-only text nodes
are dropped by the normalizer, and both navs are `display: flex` with `gap`,
so whitespace-only children never become flex items — but the zero-tolerance
pixel comparison across all three profiles is what actually establishes it.
The reverse risk is the one that needed designing against: Astro emits a
template's whitespace AS AUTHORED, so any element whose inline content is
whitespace-sensitive is authored on one line in `Shell.astro` and
`EditorialArticle.astro`. A reflowed line break inside an inline run would
insert a space mid-sentence — slice B's text-run hazard arriving through a
different door.

**A pre-existing harness defect surfaced while verifying this slice, and it
is not slice C's code.** `bench.browser.test.ts`'s INP assertion failed on
two of three local suite runs. Root-caused in web-vitals' own source rather
than treated as flake: `initMetric` starts INP at `-1`, and `bindReporter`
gates every emission — including a forced one — behind
`if (metric.value >= 0)`, so an INP that was never computed is not reported
as `0`; nothing is sent and the run records `null`. INP is only computed
once an entry reaches the InteractionManager, and that hop runs inside
`whenIdleOrHidden`, a requestIdleCallback while the page is still visible.
The `event` observer cannot supply the entry: it uses web-vitals' default
`durationThreshold: 40` and a trivial click on a static page measures ~8ms
(verified in Chromium — one `pointerdown` entry, duration 8), so INP depends
ENTIRELY on the buffered `first-input` observation, which arrives
asynchronously. `tools/bench-runner/src/collect.ts` waited a FIXED 400ms
settle before forcing visibility-hidden, so on any loaded machine the
browser could still be producing the entry when the window elapsed.
Load-sensitive in the failing direction, which is why it showed up now:
nothing in slice C touches the bench runner, the measurement client, the
placeholder pages the test drives, or the click target (`#pm-chrome` is
`position: relative`, so the chrome gaining one switcher anchor and one
reading-table column shifts `main h1` down but cannot occlude it). Fixed by
waiting for the interaction's `first-input` entry to EXIST before flushing
— bounded, and placed after the byte accounting so nothing measured moves;
a timeout is swallowed on purpose so a genuinely absent interaction still
surfaces as `INP: null` for the suite to judge rather than being disguised.
Worth recording that this was never only a CI-green problem: the bench
runner produces PUBLISHED receipts, so the same race could have emitted a
null INP into a real benchmark number (ADR-0001 §9's own ethos). Flagged as
a defect found during slice C rather than caused by it — it arguably wanted
its own commit. The first version of that fix was itself incomplete, and
verify-slice caught it: waiting for the `first-input` entry to EXIST proves the
browser produced it, but web-vitals defers the computation into
`whenIdleOrHidden` (a `requestIdleCallback`), and the only emission that can
ever fire is the FORCED `report(true)` inside INP's own hidden handler — a
non-forced `report()` at the default `reportAllChanges: false` emits nothing at
all (`bindReporter`'s inner `if (forceReport || reportAllChanges)`). Because
`getVisibilityWatcher`'s listener is registered first, that forced report can
run BEFORE the deferred idle work sets `metric.value`, so the entry we waited
for changes nothing. Closed by additionally awaiting one idle callback of our
own before the flush: idle callbacks run in request order, so ours cannot run
before the one queued earlier.

**Three measurement-credibility findings were ESCALATED rather than fixed, and
the reasoning matters more than the list.** The four lenses returned 12
findings; nine were adopted, three deliberately left alone because fixing them
means deciding methodology, which the PRD fences a slice from doing ("a slice
that thinks the spec is wrong records an ADR addendum question, it doesn't
improvise"). The headline one: **Astro inlines the cart bundle, so the render
axis would publish "astro: 0 KB initial JS" while the page ships 1,247 B of
JavaScript.** Measured — one `<script type="module">` of 1,247 B, zero external
script `src`s — and structural in cause: `collect.ts` derives `buckets.js` and
`initialJsBytes` from resource-timing entries classified by URL extension, and
an inline script produces no resource-timing entry, so its bytes land in
`buckets.html` instead. The consequence lands exactly where it hurts most: the
editorial table would report vanilla, the NO-RUNTIME control, as shipping ~1 KB
of initial JS and astro as shipping none, for the same enhancement, on the one
surface whose thesis is how much machinery prose needs. It is discontinuous too
— grow the cart module past Vite's inline threshold and the number jumps from 0
to its true value with no change in the paradigm.

The available workaround was rejected on principle: forcing
`vite.build.assetsInlineLimit: 0` so Astro emits a file the instrument can see
would invent a request the paradigm would not make — rigging the variant to fit
the harness, the same error mirrored. The real fix belongs in the harness (count
inline `<script>` bytes as JS, stop counting them as HTML) and is an ADR-0001 §3
decision, because it changes every variant's published numbers and must settle
double-counting. Nothing in this build publishes a receipt, so no false number
ships from here; the obligation is that none ships from the publication step
either. Escalated alongside it, both PRE-DATING slice C: the bench runner's
`LOCAL_PLANE_INSPECTORS` omits every real variant's inspector (`pm-vanilla`
9235 and `pm-react-next` 9236 as well as `pm-astro` 9237), so a LOCAL bench
attributes zero CPU to whichever Worker served the page — not a one-line fix,
since `CdpConnection.open` throws on an absent inspector, so the list and its
failure tolerance have to be decided together; and ADR-0003 §2's "CSS its native
way" is satisfied only nominally, since all three editorial variants ship the
shared stylesheets as raw verbatim copies, so astro's CSS cell will equal
vanilla's exactly and Astro's bundling pipeline will appear to buy nothing.

Also adopted from the same pass, each verified against source before being
believed: the starter's `AGENTS.md` — symlinked as `CLAUDE.md`, so it
auto-loads as project instructions — told future agents to run `astro dev`,
which serves no injected chrome, no `/_pm/*` client, and 404s every image while
looking fine (section replaced, docs links kept); nothing exercised
`src/pages/editorial/index.astro` pre-merge, so a crate-only page-wiring bug
could merge green (the guard now renders the page and asserts faithful
pass-through, proven by sabotage); `@pm/astro#build` under-declared its outputs,
so a cache hit replayed `dist/` without the generated snapshot module
(declared, restore verified); `prepare-build.mjs`'s own header claimed it runs
before deploy when it deliberately does not — a false claim sitting exactly
where a maintainer would decide whether to "align" `deploy` with slice B's
shape and thereby publish the fixture essay to the crate plane; and the
`compressHTML` whitespace justification named two containers when the page has
six, now generalized to the real invariant (every inline-child container here is
flex or grid, so whitespace-only children never become items — and a
tokens-tier edit taking any of them out of flex is what the pixel leg catches).

### `editorial-build` slice D — the qwik variant, resumability (2026-07-26)

The fourth editorial column, and the second REQUEST-TIME one: `variants/qwik`
serving `/qwik/editorial/` on Qwik v1 stable (`@builder.io/qwik@1.20.0`) with the
official `cloudflare-workers` integration, fetching trays per request through
its own `pm-edge` service binding via a `routeLoader$`. Copied from
`variants/react-next` rather than the two build-time variants, exactly as the
slice-B precedent requires: the front Worker's `EDGE` binding does not reach a
variant server-side, so a request-time variant binds edge itself.

**The slice's big structural question was settled by measurement before a line
of the variant was written.** Qwik has no `<html>` element in its source — the
framework emits one, and puts its container attributes on it: `q:container`,
`q:version`, `q:render`, `q:route`, `q:base`, `q:locale`, `q:manifest-hash`,
`q:instance`, alongside `lang`. That lands squarely on contract surface, because
the drift-gate normalizer serializes the document element's OWN attributes
deliberately (a dropped `lang` is pixel-neutral a11y drift). So the question was
whether this is slice C's `<astro-island>` problem again — an element no
registration can excuse — or a registration question. A throwaway scaffold
answered it: **Qwik adds no wrapper ELEMENT anywhere.** Everything it adds is
either an attribute (registrable) or a comment (already dropped
unconditionally). The registration is therefore the first one in the registry
that is ALL mechanism — `behaviorAttrPatterns: ["^q:", "^on:",
"^on-document:"]`, with `attrPatterns` and `classPatterns` empty and no
`dropElementSelectors` — which is what ADR-0008's behavior-attribute class was
minted for, and what `noise-class-discipline.test.ts` keeps honest (registering
any of it as inert residue fails the build). `^on-document:` is a separate
prefix that `^on:` does not match; registering only the latter would have left
`on-document:qinit` on the page for the DOM check to fail on.

The same scaffold answered the rest of the slice's unknowns, and two of them
inverted the expectations carried in from earlier slices. **Escaping is
byte-identical to the reference renderer's `esc()`** — all five characters,
apostrophe decimal — so this variant reuses vanilla's escaper unchanged, where
slice B needed a second one. **Qwik does not split `text {expr} text` into
separate text nodes** for non-reactive interpolation: no comment markers, one
continuous run, the master's own shape (the essay is still authored as one
template literal per run, but for reflow-immunity rather than slice B's
marker problem — a smaller claim, recorded as such). Void elements and boolean
attributes stay bare, so the canonical font markup matches VERBATIM modulo base
path with none of slice B's renderer tolerances — one marker attribute aside
(`q:head`, appended to everything Qwik manages in `<head>`). And attribute names
pass through verbatim, so `datetime` is authored lowercase to match the master
byte-for-byte where react-next's `dateTime` does not.

**Prefix mounting is the nicest thing this paradigm did.** Slice C had to keep
Astro's `base` and `outDir` in agreement by hand. Qwik derives everything from
one `base: "/qwik/"`: qwik-city's router `basePathname` defaults to vite's base,
the optimizer computes the client's public output directory as `clientOutDir +
base` (so `dist/qwik/…` matches the URL space with no `outDir` override), the
served container's `q:base` follows, and `import.meta.env.BASE_URL` gives the
asset root. Verified against the scaffold, not inferred — and an earlier attempt
to force the layout with `build.outDir` is recorded as a trap, because it applies
to BOTH vite builds and the SSR build's `emptyOutDir` then wipes the client
output the previous step wrote.

**Two starter defects, one latent and one fatal, both fixed with evidence.** The
`cloudflare-workers` integration names its assets binding `ASSET`, while
qwik-city's own cloudflare-pages middleware calls `env.ASSETS.fetch(request)`
for any path its build-time static-path list matches — so the binding would have
thrown on the day that fallback was reached. It is not reached today (Workers
Static Assets serves those paths before the Worker runs; measured with the
mismatched name in place, a build chunk still returned 200), which is exactly
what would have made it a latent failure rather than an obvious one. Renamed to
`ASSETS`, which is also what every other variant here calls it. The fatal one is
one layer down: **`@builder.io/qwik-city@1.20.0` declares `@builder.io/qwik` in
neither `dependencies` nor `peerDependencies`** — it relies entirely on being
hoisted, which ADR-0004 §2's zero-bias isolation deliberately prevents, so the
post-build SSG step dies with `ERR_MODULE_NOT_FOUND`. Declared via
`packageExtensions`, the slice-B precedent (`@opennextjs/cloudflare` needing
`esbuild`). The framework's own CLI is a third instance of the same class and was
dropped from the pipeline instead: it needs `ignore`, then `semver`, neither
declared, and chasing that would let one framework's dependency hygiene shape the
whole repo's install graph while nothing in build/deploy/test needs the CLI.

**Where resumability does not get to defer — and the slice's own worst
over-claim, caught by its adversarial pass.** The cart contract requires every
shell page load to populate the masthead count slot from storage, because that is
what makes the cart survive a variant swap (ADR-0004 §5). Reading client storage
at load is eager work by definition. The first draft of this section, and of the
receipt, and of two source comments, called that "one lazy chunk at startup" and
said no JavaScript for the click behaviour is downloaded until the click. Both
were wrong in the variant's favour, which is the direction that matters.

Measured against the composed origin with JS on, from resource timing (the same
source the bench runner reads): qwik fetches **7 files, 26.83 kB encoded /
62.16 kB decoded, at load — and nothing at all on the click.** vanilla fetched
1.35 kB in the same run, astro 0 requests (its bundle is inlined — the issue-#16
accounting defect reproducing itself independently), react-next 145.05 kB.

The causal chain is the real result, and it is more interesting than the
rounding: the contract forces a load-time storage read, that read is a QRL,
resolving any QRL requires the framework core (50,917 B), and rollup co-located
`src/lib/cart.ts` so the chunk behind the `useOnDocument` statically imports the
add-to-cart chunk as well. Resumability genuinely defers the BINDING — no
listener is attached at load — while on this surface the contract pulls the BYTES
forward regardless. The mechanism is still `useOnDocument("qinit", …)` rather
than `useVisibleTask$`, because `eslint-plugin-qwik`'s own rule prefers it and a
visible task blocks interaction until it has run. None of this is a Qwik defect;
it is the number the reading table has to publish.

**The paradigm also removed machinery the last two variants needed.** Cart state
is one Qwik store behind a context id: no `CustomEvent` bus (react-next needed
one because its cart pieces are separate hydration islands with no common client
ancestor), no `document.querySelectorAll` (vanilla's only option). And `Shell`
PROVIDES that store while deliberately never READING it — which is not tidiness
but the fix for slice B's shipped CLS bug: Qwik subscribes a component to exactly
the store properties its render function touches, so a cart change re-renders
the badge and the live region and never the component hosting
`#pm-chrome-slot`. Slice B lost that subtree on every slow-CPU load because
react-dom's hydration walk discarded children React had not authored. Here there
is no hydration walk at all — and a browser test asserts the injected chrome
survives a click rather than trusting the argument.

`EditorialArticle` and `ReleaseCard` are Qwik INLINE components (plain functions
returning JSX), which its docs put first for small presentational markup: not a
lazy boundary, so no lazy chunk and no serialized props, and neither has
interactivity to defer. That does NOT make inline markup free of Qwik's
bookkeeping attributes — an earlier draft of this section and of the receipt both
claimed it did, and the served page disproves it: `<article>`, the essay's
`<blockquote>` and `<li class="pm-release-card">` all carry a `q:key`. An
element's `q:key` comes from its JSX node's key, and the OPTIMIZER assigns node
keys for its own bookkeeping, so which elements carry one is not predictable
from component boundaries at all — measured at seven elements plus `q:id` on
four, including two masthead links with no listener. It is registered noise, not
a reason to avoid inline components. The three pieces that
do are real `component$` boundaries, so the lazy chunks the page ships are the
interactive ones and nothing else. No JSX `key` sits on anything the drift gate compares, and
that is measured rather than stylistic: **Qwik serializes a JSX key as a `q:key`
ATTRIBUTE** where React's does not render at all, so a key on the essay's
paragraph list put variant-authored noise on contract elements (verified by
removing them — those `<p>` elements lost their `q:key`). `RouterHead`'s
head.meta/head.links loops keep theirs; `<head>` is a declared freedom the
normalizer drops whole. The same
measurement forced `fonts.css` out of the stylesheet `.map()` and up beside the
two font preloads — Qwik reorders an element's attributes and stamps a generated
`q:key` when the element is an ARRAY child, which would have broken ADR-0003
§8's "verbatim modulo base path" for the one canonical stylesheet line.

**The pre-merge master-identity guard is the most direct of the four**, because
Qwik ships a genuine `renderToString`. Slice A could call a string-returning
render function; slice B had to drive `react-dom/server` over a deliberately
framework-neutral module; slice C needed Astro's Container API; this one just
asks the framework to render. Three measured details shaped it: Qwik rejects
`containerTagName: "body"` ("its parent is not a `<html>` element"), so the
render uses a `<div>` container the test UNWRAPS as a DOM operation — string
surgery on the serialized output got the indentation wrong, which is how that was
found; outside a production build no chunk exists for a QRL, so the render aborts
until `symbolMapper` supplies one (a deterministic stub is honest here, because
bundle layout is a build concern this guard makes no claim about, and the REAL
chunk names are proven against the served page by `editorial.test.ts`, which
fetches every chunk an `on:*` attribute actually names); and comparison runs
through the drift gate's own `PAGE_NORMALIZE` over linkedom, because Qwik emits
`class` last and stamps `q:key` on component hosts. Proven non-vacuous by
sabotage: one word changed in the CRATE essay fails the crate leg and only the
crate leg.

The route loader PROJECTS its payload, and the reason is narrower than it first
looked — measured, not assumed. The initial page's inline resumability state does
NOT carry loader results: it is 339 bytes, holding only the cart store and the
props of the three `component$` boundaries. What carries the whole loader result
is the route's client-navigation payload, `q-data.json` (955 bytes with the
projection). An earlier code comment claimed the inline state was the reason and
was corrected once the numbers existed.

Local proof BOTH snapshot modes, and the crate leg needed the git-ignored image
bytes copied into the fresh worktree before `PM_SEED_DIR` could seed at all.
`variants/qwik/DIFF-TO-STARTER.md` records 23 numbered deviations plus a
measured-behaviours section, including the delivery shape the scheduled
bench-accounting work (issue #16) will want: Qwik ships MANY EXTERNAL `.js`
chunks, making it the third distinct shape across the editorial columns after
vanilla's single external file and astro's inlined bundle — exactly the spread
that fix needs to validate against.

### `editorial-build` slice E — the htmx variant, hypermedia (2026-08-09)

The fifth editorial column, completing the surface: `variants/htmx` serving
`/htmx/editorial/` from a hand-written Worker — the third REQUEST-TIME variant
(its own `pm-edge` service binding, the slice-B precedent) and the second
starterless one. For hypermedia there is nothing to scaffold: htmx's
documented install IS a script tag, so the paradigm here is "the server
renders complete HTML per request," and the Worker's template literals ARE
the variant. That had a pleasant consequence for verification: the renderer
mirrors the master's own serialization directly, so the pre-merge
master-identity guard is the vanilla MECHANISM (byte-strict after the
delivery strip, both snapshots, in `tools/repo-checks`) rather than a
normalized-DOM approximation — and it passed on the first probe, both
snapshots, before any wiring existed. Because the guard assembles the
renderer's request-time data shape ({ isFixture, capturedAt, featured DETAIL
tray }) from the committed trays and compares against a master rendered from
the SUMMARY tray, it also proves per snapshot that the card fields are
tray-identical between the two trays instead of assuming it (the qwik
projection precedent, made checkable).

**The slice's one real judgment call is recorded, not optimized away: the
htmx runtime ships on a page that uses none of it.** Editorial's one
interaction is client cart state, which hypermedia does not own (there is no
server cart by contract — ADR-0004 §5: localStorage holds the cart ONLY, so
it survives a variant swap), so the served page carries ZERO `hx-*`
attributes — ISSUE E's "honest hypermedia statement," and like slice C's
astro the variant registers NOTHING in `PERMITTED_NOISE`, with the emptiness
asserted against raw served bytes in both the origin suite and the drift leg
(the comparison runs under `NO_NOISE`). *[2026-08-29: the registration is no
longer empty — the PLP build put three `hx-*` attributes on one paginator and
registered `^hx-` under `behaviorAttrPatterns`, which this slice's own note
predicted in so many words. The EDITORIAL page still carries zero `hx-`
bytes, and that is still asserted against the served response rather than
inferred from the registry, so nothing in the paragraph below changes.]* But the runtime still ships, because
a hypermedia site includes its library site-wide and spends attributes where
the server owns the interaction — dropping the script would have made the
column a second vanilla and stopped measuring the paradigm; inventing an
`hx-*` server-cart would have broken cart-survives-the-swap and misstated
it. Measured, tool-derived: `htmx.min.js` (pinned EXACT 2.0.10 — 4.x exists
only as alpha/beta and would be a fenced exhibit under ADR-0003's first
addendum, the qwik-v2 logic) is 51,238 B raw, **14,996 B brotli** — the
paradigm's site-wide cost landing between vanilla (1.35 kB) and qwik
(26.83 kB) on the surface whose thesis is how much machinery prose needs.
The runtime is VENDORED from the lockfile-pinned npm package into the
variant's own assets and served same-origin (a CDN include would fail the
drift leg's request tracker and add an uncontrolled third-party variable);
the origin suite asserts the SERVED file byte-identical to the installed
package, resolved through the variant's own dependency graph.

**Completing the surface had registry consequences beyond the usual move.**
`SURFACE_CONTROLS.editorial.plannedVariants` is GONE (the PRD's "empty or
gone"), which surfaced two latent assumptions: four pre-existing suite
assertions called `.not.toContain(...)` on the now-absent key and crashed
(hardened with `?? []` — caught by the fixture run, 5 failures, all one
class), and the switcher unit guard proving "a planned cell is a disclosure,
never an offer" was pinned to editorial, which no longer has planned cells
to disclose — retargeted to checkout, the sparse frontier, where it keeps
meaning something. The chrome's reading table now shows five live columns
and "Served by 5 of 5," both recounted from the array. Slice E's second
completion duty, **the ADR-0007 §4 home catalogue row flip**, is the
designed one-token edit: editorial's row goes `In build · decision map` →
`Public today · open the surface`, linking the designated host
`/vanilla/editorial/` (the PM-006 pattern: the Public state links the public
thing itself); the publication-time tense/verdict flips stay out of this
build, exactly as the PRD fences them.

Wiring worth naming: pm-htmx takes ports 8796/9239, and the
`LOCAL_PLANE_INSPECTORS` entry is load-bearing rather than bookkeeping —
after issue #16, CPU is summed over the SERVING PATH per visit and a missing
serving-path inspector is a NAMED hard error, so a local bench of
`/htmx/editorial/` would refuse to run without it. The Worker's slashless
redirect emits a RELATIVE Location (RFC 9110 §10.2.2) so the composed origin
stays host-agnostic. The featured-id policy imports the fixture's committed
manifest/curation with `with { type: "json" }` — loads identically under
wrangler's esbuild and plain Node; unlike qwik there is no turbo input
declaration for those files because nothing turbo-cached embeds them
(wrangler bundles src at dev/deploy time, outside the build task).

Also reconciled while verifying from the world (the Task-0 discipline):
decision-map still carried `bench-accounting-fix` as "pending merge" — PR
#20 merged as `d561677` (2026-08-02 UTC) with the deploy job green, verified
against GitHub before editing the line.

Local proof, re-run on the FINAL tree after every adopted finding: origin
suite **291/291 fixture** and **290/291 crate-seeded** (the 1 miss is
`/assets/img/9861004-primary.thumb.avif` 404 — the git-ignored crate thumb
absent from this checkout, the known local gotcha the 2026-08-01 session
recorded, unrelated to this slice); turbo lint/typecheck/test **28/28**;
`wrangler deploy --dry-run` bundles the Worker clean (15.15 KiB upload);
turbo cache-hit restores dist from a wiped tree; the identity guard was
sabotage-proven on crate copy (a one-word essay edit fails exactly the
crate leg, reverted and re-proven).

**verify-slice: 4 lenses, 11 raw findings deduping to 7 distinct — 6
adopted, 1 refuted.** The four-way duplicate was the humbling one: the
DIFF-TO-STARTER's decision 4 recorded a script order the served page does
not use (the JSON hook renders FIRST) — all four lenses independently
caught the receipt misdescribing its own page, the exact
record-not-code defect class slice D's pass was full of. The two that
mattered most:
(a) **the branded-503 boundary didn't cover the render** — a
malformed-but-200 detail tray (a future re-freeze shipping the featured
release with zero images) would throw during template interpolation and
surface as pm-front's unbranded plain-text 502, the exact page the
fallback exists to prevent; the render moved inside the guard, and the
whole branch got its first test anywhere
(`tools/repo-checks/test/htmx-worker-fallback.test.ts` drives the
Worker's fetch in-process with stub EDGE bindings: dead plane → branded
503, degenerate tray → branded 503, committed fixture trays → the real
page).
(b) **the identity guard never executed `snapshot.mjs`** — the crate
featured-id and essay-selection policy would first run against the crate
on the deployed plane, so a typo'd `CRATE_FEATURED_ID` merges green and
turns the smoke red, precisely the hole the guard family exists to close
(and the module's own comment claimed the guard was its runner); the
guard now derives id and essay selection THROUGH the variant's module and
cross-checks both against the recorded constants.
Also adopted: the zero-`hx-*` assertion couldn't see `hx-on:*` (colon in
the name), valueless `hx-disable`, or the `data-hx-*` prefix form — all
real htmx 2.0.10 mechanisms, proven empirically by the lens — widened in
both suites to any whitespace-preceded `(data-)hx-` token; the vendored
runtime's same-origin claim rested on a quote-sensitive `src="https?://`
regex that a single-quoted or protocol-relative CDN include would slip
(and the drift tracker can never see script fetches — its contexts are
JS-off), replaced with a parsed-subresource origin check over every
script/link/img URL (18 on the served page, JS-injected subresources
recorded as outside the gate until the JS-on pass lands); and completing
the surface had left the mixed live+planned chrome state unit-covered
nowhere until PDP's first slice — now a synthetic-registration test in
the switcher workspace. REFUTED: "the crate count was recorded before the
run finished" — the number was patched in after the run completed, and
the later render.mjs mtime was the sabotage probe, reverted
byte-identical; the finding's discipline held anyway, since adopting the
fixes changed suite files and both modes re-ran on the final tree.

### `editorial-build` slice F — the remix3 fenced frontier exhibit (2026-08-11)

The last editorial column, and the one that was never a column: `/remix3/
editorial/` serves the canonical page from a hand-rolled Cloudflare Workers
entry — Remix 3 has no official Workers target, so the ~40-line
`src/worker.ts` IS the adapter (ADR-0004 second addendum; the spike is prior
art, and its two recorded frictions resolved differently here: no
`clientEntry()` ships so the workerd stable-id friction never engages, and
the client runtime is prebuilt by esbuild because the template's asset
server is Node-only). The beta pin was re-verified before any code, the
ISSUE F duty: `3.0.0-beta.5` is still the newest v3 anywhere (npm `next`
dist-tag; GitHub `remix@3*` tags end at beta.5; every `@remix-run/*`
sub-package last modified 2026-07-01, the beta.5 publish date — a fresh
install resolves exactly what the spike verified), so the spike's canary
never had a bump to fire on.

**Serialization was measured before a line of variant code existed** (the
slice-D scaffold discipline, done here with two probes against the spike's
own pinned install). What the probes settled: Remix reorders attributes
(`class` always serializes last), escapes only `&<>` in text (quotes stay
raw — the master's `&#39;` can never match byte-for-byte, so the byte-strict
vanilla/htmx guard mechanism is impossible and the react-next normalized-DOM
mechanism is the recorded fallback), self-closes voids, and emits the
doctype from `createHtmlResponse`. Frames add NO wrapper element — comment
pairs only — so slice C's `<astro-island>` problem never materializes. And
one expectation from the spike INVERTED on measurement: the `#rmx-data`
hydration script disappears entirely when frames resolve as streams during
SSR (the spike's probe resolved them from strings and got one), so the
FINDINGS §7(b) noise list shrank to nothing — `PERMITTED_NOISE` registers
NOTHING for remix3, the third earned-emptiness after astro and htmx, with
the reasoning recorded in the registry comment: comments are freedoms,
`css()` is deliberately unused on served markup, and `rmx-target`/`rmx-src`
appear only inside the fenced demo subtree, where registering them would be
exactly the vacuous-excuse class slice D's non-vacuity scoping exists to
reject.

**The fence is mechanism at all three layers** (FINDINGS §7(c)), and the one
new comparison-scope primitive is deliberately narrow: `dropFencedSubtrees`
is a CALL-SITE flag on `PAGE_NORMALIZE` (plus the `neutralizeFenced` pixel
twin), never a `NoiseSpec` field — no `PERMITTED_NOISE` registration can
smuggle it in, core comparisons never pass it, and the origin suite asserts
every core editorial page carries zero `[data-pm-fenced]` elements while the
remix3 page carries exactly TWO, count-pinned. Those two are the plaque (the
DS component's canonical fenced form, top of main, label before content —
the a11y-section principle; its version string is tool-derived from the
variant's own package.json and cross-checked in three places, so a bump
cannot leave a stale number without going red) and the frames demo (after
the article — the store wins the page; its copy declares itself "exhibit
apparatus, not store content", which keeps the article's canonical
only-interactive-element note honest). The demo is what makes the exhibit an
exhibit: without it the committed §5 browser coverage — the other FINDINGS
§8 hand-off — would have had nothing to drive. That coverage now exists
(`remix3.browser.test.ts`): one click on the demo anchor fetches exactly ONE
HTML partial with no document navigation (a sentinel survives the swap), the
URL updates through the Navigation API, Back restores the previous card
without a reload, and with JS off the same anchor is a plain full-page
navigation to the same content. The chrome layer got the variants-axis
counterpart of the PLP strategy fence: `SurfaceControls.fencedExhibits`, a
tagged `--fenced` switcher anchor that is never a reading-table column and
never counts into "Served by N of M" (both derive from `variants` alone —
putting remix3 there would have corrupted both, which is why the distinct
field exists), plus a HUD note naming the RUM-only policy. The receipts
layer turned policy into a wall: `assertBenchableTarget` in `runBatch`
refuses any `/remix3/*` target before a browser launches — placed in the
library, not the CLI, so the reproduce path and direct imports hit the same
wall — and `pm-remix3` stays out of `LOCAL_PLANE_INSPECTORS` (the blog
precedent, belt over mechanism).

**Advisory means advisory, and the suite encodes it rather than skipping the
check**: the remix3 drift legs run the same normalizer against the same
re-rendered master and write the same evidence files, but route through
`advisoryDomEqual`/`advisoryPixelsEqual`, which wrap the throwing helpers
and warn instead — and a mechanism-proof test feeds them deliberate drift to
prove they cannot block CI. Non-vacuity stays HARD: page serves, chrome
injected, fenced count exact. Green-by-default held empirically (no advisory
evidence files after the run). The pre-merge identity guard BLOCKS,
deliberately, and the distinction is argued in DIFF-TO-STARTER decision 8:
the lockfile exact-pins the whole render path, so the guard's outcome
changes only when a commit changes the tree — the weekly-beta weather the
advisory fence exists for cannot reach it. The guard renders through the
REAL Worker path (stub EDGE serving the committed trays, both snapshots), so
the snapshot policy, controller, middleware, and serializer all execute
pre-merge (the slice-E lesson), and a divergence complement proves the
fenced drop excuses something real.

Two smaller finds worth their lines. `@remix-run/render-middleware`'s
published `dist/lib/render.d.ts` carries an inline import type escaping into
a SIBLING package's raw TS source, which imports `@remix-run/route-pattern`
— undeclared, so unresolvable under the repo's `hoist: false` isolation:
the third `packageExtensions` instance (after OpenNext's esbuild and
qwik-city's core), types-only, proven by a full node_modules wipe (the
slice-D sabotage lesson — `--force` lies). And the frames PARTIAL exposed a
gap in the front Worker's page contract: a partial is `text/html` with no
chrome slot by design, so injection would have error-logged healthy
operation on every frame reload — partials now pass through untouched (the
q-data.json precedent), variant-scoped rather than a plane-wide `/frames/`
convention, with the generalization recorded as the PLP build's call (htmx
loaders+PE will serve HTML partials too).

Worker discipline: the response is DRAINED before the first byte leaves
(deviation from the streaming template, recorded with its tradeoff — frames
still stream on reload, which is the flagship behavior), so a render-time
throw on a malformed-but-200 tray lands in the branded-503 guard instead of
truncating a committed 200; `worker-fallback.test.ts` proves all three
failure classes plus the route shapes (relative-Location 301, clean 404,
405, HEAD-as-GET) and that `?pick=` — the demo's JS-off state — swaps ONLY
the fenced card, the canonical page byte-invariant around it.

Mid-build proof (the pre-verify-slice tree): origin suite **323/323
fixture** (baseline before this slice was 291), full turbo
lint/typecheck/test **30/30**, switcher 24/24, `wrangler deploy --dry-run`
clean (144 KiB Worker, EDGE resolves), and a workerd smoke through the real
EDGE binding before any suite wiring existed. **A self-inflicted record
lesson, kept**: this entry briefly claimed the crate count before the crate
run finished — the exact record-not-code class every verify-slice pass has
caught — and the run then came back 37-failed, all `page.goto` 30-second
timeouts (including the untouched htmx block that had just passed fixture
mode), because the crate plane's 1,817 real images, three Playwright
suites, and the concurrently running verify-slice agent fleet were fighting
for one machine: 580 s wall-clock against fixture's 65. Not drift — load.
The final-tree numbers, from quiet runs after every finding below was
adopted, close this entry. Merge is Rob's call — merging deploys
`/remix3/editorial/` to the plane, and the editorial build closes with it.

**verify-slice: 4 lenses (correctness, issue/ADR-conformance, seams,
anti-rigging skeptic), 14 distinct findings — 12 adopted, 1 informational,
1 partially refuted — plus a 6-item refuted-sweep record.** The pass
survived a mid-run session-limit death (3 lenses done; resumed next
morning, cached lenses replayed, the anti-rigging lens re-ran against the
already-hardened tree — the workflow's limit-resilient design doing exactly
its job). The headliners, each caught by making a claim empirical:

- **The fence was bypassable** (correctness): `assertBenchableTarget` split
  the raw path while `effectiveUrl` resolves it through `new URL()`, so
  `"remix3/editorial/"` (no leading slash) or `"/./remix3/editorial/"`
  measured the fenced exhibit and minted the receipt the mechanism claims
  is impossible. Fixed by resolving in the guard; then the SEAMS lens
  caught the same class twice more (receipt variant/surface labels, the CPU
  source's serving-path derivation), which forced the real fix — every
  target path canonicalized ONCE at `runBatch` entry, one derivation for
  all consumers, bypass shapes pinned as tests. The lens re-verified the
  fix against backslash, absolute-URL, and protocol-relative shapes.
- **The plaque shipped visually broken and nothing could catch it**
  (conformance): `components/plaque.css` was never linked — the core
  editorial CSS list has no plaque — and the fenced subtrees are by
  construction the one region every DOM and pixel comparison drops, so the
  exhibit's headline boundary label would have rendered as bare paragraphs
  on the deployed plane forever, silently. Fixed, suite-asserted (the link
  itself is now pinned — the one class of plaque breakage the fence can
  never surface), and screenshot-verified against the real crate.
- **A "measured" record was false, and the fix proved it** (anti-rigging →
  correctness chain): the noise-registry comment cited "probe +
  worker-fallback tests" as evidence that `#rmx-data` is absent with
  stream-resolved frames — but no such assertion existed, and the moment
  the lens forced the citation to become a real test, the test FAILED: the
  script IS in the served document, end of body. The "measurement" had been
  a misread of a post-strip test dump. Gate design unaffected (a script is
  delivery, dropped everywhere); four records corrected; the element's
  presence is now positively pinned so the record can never drift from the
  page again. The record-not-code class, five slices running.
- **`batch.ts` was a binary blob** (anti-rigging): four literal NUL bytes
  (pre-existing, the samples-map key separator) made git classify the file
  as binary — `git diff` renders "Bin", so the fence mechanism's change
  history was unreviewable. Detoxed to `\0` escapes (identical runtime
  strings); this slice ships as TWO commits so the detox diffs binary once
  and the slice's `batch.ts` changes diff text-to-text (the slice-D
  reviewability precedent for a second commit).
- Also adopted: `advisoryPixelsEqual` gained its own deliberate-drift
  mechanism proof (only the DOM funnel had one — the pixel funnel would
  have first exercised its catch in CI on the day real beta drift
  appeared); HEAD answers carry no body on ANY worker exit (404/503 sent
  content under an unverified platform premise; the 405 half of that
  finding was refuted — 405 fires only for non-GET/HEAD methods); the
  `crossorigin` record misquoted the spec (missing-value default is No
  CORS, not Anonymous — the bare attribute is the EMPTY-value form, which
  is why deleting it would break preload reuse); `rmx-target`/`rmx-src`
  joined the noise-class-discipline probes ahead of need; and the two fence
  registries (runner refusal set, chrome `fencedExhibits`) got a
  cross-check pin in the suite so the next fenced exhibit cannot register
  in one and not the other.
- Informational, flagged for review rather than inferred: ISSUE F's literal
  text says "register the FINDINGS §7(b) noise list"; the implementation
  measured every species absent-or-excluded on compared content and
  registered nothing (the astro/htmx earned-emptiness precedent) — the
  deviation is recorded in the registry comment, DIFF-TO-STARTER decision
  9, and the decision map.
- The refuted-sweep (kept so nobody re-probes): HTMLRewriter on a null-body
  HEAD response never fires `end()` (miniflare probe — no spurious
  slot-count error, matching the live front-log check); the beacon
  collector accepts remix3 RUM (no variant allowlist); the lockfile churn
  is the remix tree + esbuild only; builds precede deploys everywhere; the
  root lint task covers the new workspace.

One more fix came from looking at the real page rather than any lens: the
fenced switcher cell rendered "REMIX3PRE-RELEASE…" — the tag's leading
space is collapsible at the start of an inline formatting context —
caught on a screenshot, fixed with `&nbsp;`, and the exhibit page,
plaque, demo, and chrome bar are all screenshot-verified against the real
crate data.

**Final-tree proof, quiet machine, every finding adopted first**: origin
suite **324/324 fixture** (13/13 files; the first attempt had one transient
browser-leg failure whose name my own `| tail -8` wrapper on the background
run destroyed — the diagnosis-destroying truncation is its own lesson,
recorded; the immediate quiet re-run and every run since were clean) and
**323/324 crate**, where the single failure is byte-for-byte the KNOWN
pre-existing miss — `/assets/img/9861004-primary.thumb.avif` 404s because
that git-ignored thumbnail is absent from this machine's crate copy, the
same file behind the recorded 290/291 baseline; nothing this slice touched.
The advisory drift legs passed clean in BOTH modes (the evidence directory
carries only the mechanism-proof's deliberate artifacts), so green-by-
default holds against the real crate as well as the fixture. Full turbo
lint/typecheck/test **30/30** on the final tree; variant guards **14/14**
after the finding adoptions.

### Phase 8.1 — Fixing the ruler (bench-accounting-fix, issue #16; 2026-08-01)

Before the first editorial number could publish, the ruler itself had to be
fixed — Rob's 2026-07-24 call, deliberately its own session between slice D and
slices E/F. Four known defects, widened by a 2026-08-01 whole-repo audit that
surfaced more of the same class. The through-line: an instrument that can't see
a cost is worse than no instrument, so every fix here makes the measurement
*see more*, never look nicer.

The load-bearing one was **inline bytes**. `collect.ts` bucketed bytes by URL
extension, so an inline `<script>` contributed zero and its bytes hid in the
HTML bucket — Astro inlines its ~1.2 KB cart module, so the render axis would
have printed the islands variant at "0 KB initial JS" against vanilla, the
no-runtime control, on the one surface whose thesis is how much machinery prose
needs. The honest fix has to survive a hostile reader, and the hard fact is that
a document is ONE brotli stream: you cannot *measure* a per-part compressed size.
So `decomposeDocument` attributes the document's single compressed `transferSize`
to buckets by each part's share of the UNCOMPRESSED served bytes — the one split
that sums back EXACTLY and double-counts nothing (HTML is the remainder). Inline
*executable* script → JS (Astro's bundle is no longer zero); inline
*non-executable* typed script (`application/json`, `qwik/json`, …) → data,
because serialized resumability/hydration state is data, not runtime, and calling
it JS would hand the skeptic "you inflated Qwik's JS." The Astro editorial page
validated the model on its own: it ships exactly one executable module AND one
`application/json` cart-item, so the executable/data split isn't theoretical. The
same decomposition strips the front Worker's injected chrome markup
(`<aside id="pm-chrome">`, its `/_pm/` head links, the measurement script tag)
out of the byte buckets — the audit's find that the instrument's own markup rode
in the HTML total, an extension of §6's known-path strip. Method and its stated
limit (the share is exact only if each part compresses at the document average)
live in an ADR-0001 §3 addendum and the receipt's own `methodNotes`.

The other three: **CPU attribution** listed only front/placeholders/edge, so a
local bench of an editorial variant scored ZERO CPU for the Worker that served
the page while its comparators were sampled — the port list is now complete
(9235–9238), and CPU is summed over the SERVING PATH per visit (front + the
variant + edge), not the whole plane, so a non-serving isolate's traffic can't
contaminate a number and benching one variant needs only its own path up
(verify-slice, anti-rigging lens). A missing serving-path inspector is a *named
hard error*, never a silent under-attribution (pm-blog stays out, ADR-0009). Binding E got teeth: `--local-cpu` against a remote origin is refused,
so an idle-local profile can't be emitted as if it measured production.
**Settle-by-signal** replaced three fixed timeouts — the interaction byte
boundary waits for network-idle (a slow fetch no longer vanishes from both
`interactionBytes` AND the total), the vitals flush waits for beacon delivery to
quiesce (a slow flush no longer writes a null that silently shrinks the median's
run count), and Qwik's `requestIdleCallback` preloader is awaited onto the
INITIAL byte side before the snapshot so the same build stops yielding two
receipts. That is the standing "wait for the real signal, never a proxy" rule
(drift-gate README) reaching the bench runner, its third home.

The audit also found the **drift gate** — the mechanism that proves zero-bias —
had two blind spots of its own, so they rode along. The pixel check claimed
zero-tolerance but ran at pixelmatch's `0.1` default, which lets a uniform token
re-valuation of ~26 neutral levels pass with ZERO differing pixels; same-run
rendering is deterministic, so the honest threshold is `0`, pinned by a
`solidPng` unit proof that a single-level shift is caught. The self-hosted-only
check was an undelimited `startsWith(ORIGIN)` (it accepts `origin.evil.tld`)
asserted once at load, before `@font-face` fetches even begin — now a delimited
origin match re-asserted after the shot forces those late fetches. And
`dropElementSelectors` excused an element on `childElementCount === 0`, which
would erase a stray text run inside it; it now rejects any real text too.

Two smaller honesty repairs: `SnapshotManifest.source` was a single literal that
forced the synthesized fixture to claim it came from the Discogs API — widened to
a union so the fixture can say `synthesized-fixture` (the real crate keeps
`api.discogs.com`, truthfully). And a Task-0 pass reconciled the state of record
the audit found stale: the blog has been live since 2026-07-19, slice D merged
(PR #18), the arming runbook's "goes green" step is a guaranteed red until the
crate seed now that editorial variants bake `PM_SNAPSHOT=crate`, and a dead
decision-map pointer.

The adversarial `verify-slice` pass (four sequential lenses) earned its keep. It
independently caught the `scriptAttr` attribute-boundary bug an inline probe had
just found (both fixed by a proper attribute tokenizer), and surfaced four more,
all adopted: a `hasChrome`/`servedBody` coupling that would let one body-read
failure null a run's web-vitals (now read from the live DOM); the missing
end-to-end non-vacuity — no test drove a REAL variant through the runner, so
`/astro/editorial/` and `/qwik/editorial/` are now benched with
`initialJsBytes > 0` asserted; a `decomposeDocument` rounding path that could
drive the HTML bucket negative (now largest-remainder apportionment); and, the
deepest, that the CPU source summed the WHOLE plane rather than the serving path,
so a sibling suite's traffic on pm-qwik could contaminate a pm-vanilla number and
benching one variant forced the full plane up — re-worked to sum front + the
served variant + edge only, matching §7's model. It also flagged, as a
bound-to-publication note rather than a fix, that React's RSC flight ships as
executable JS while Qwik's state is inert `qwik/json`, so the cross-framework
initial-JS cell must not publish as a verdict until that asymmetry is decided
(ADR-0001 addendum G).

Proven: turbo 28/28; the full origin suite **269/269 in fixture mode** (254 + the
13 `decomposeDocument`/`comparePixels` unit assertions + 2 real-variant editorial
integration assertions), and **268/269 in crate mode** — the sole miss a
`data-plane` image test hitting a git-ignored crate thumbnail absent in this
environment (the crate originals to regenerate it are absent too), which fails
identically on clean `main` and touches nothing this unit changed; CI runs
fixture mode, `check` + `origin` green. No bench PUBLISHED here — that is the
next arc step — and the blog/edge security findings the audit also raised are a
separate track, deliberately untouched.

One CI-only failure, found and fixed (the fourth instance of the settling rule).
The first push went `check` green but `origin` red on a single assertion — a
placeholder's CLS/INP read null. The new vitals-beacon wait was the culprit: it
had waited for delivery to QUIESCE (no new beacon for 150 ms), but web-vitals
sends each metric as its own `sendBeacon`, and on the 2-core CI runner the later
ones (CLS/INP) land >150 ms after the early ones (TTFB/FCP/LCP) — so the wait
exited in that gap and dropped them, the exact null-vitals failure it was written
to prevent, reintroduced in a subtler form. The old fixed 300 ms had spanned the
gap by luck. Fixed by waiting for the EXPECTED metric SET to arrive (TTFB/FCP/LCP/
CLS, plus INP when the visit scripts an interaction), bounded — a real signal, not
a proxy for one, and strictly more robust than either the fixed window or the
quiescence heuristic. Local runs never caught it (a fast machine delivers the
beacons with no gap); the loaded CI runner is the reproduction, same class as the
hydration/decode races before it.

### `editorial-build` — narrative moved from the decision map (2026-09-25)

The decision map's `editorial-build` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **ALL SIX SLICES LANDED — the editorial build is CLOSED and FULLY DEPLOYED** (A–D 2026-07-18/19, 2026-07-24, 2026-07-26; E 2026-08-09, merged PR #21 + deployed; F 2026-08-12, merged PR #22 as `db626cb` + deployed — the once-per-variant deploy flake hit its predicted third signature, live plane probed healthy, `gh run rerun --failed` → all green; verified against GitHub by the bench-batch session 2026-08-13). **Slice F (remix3 — the fenced frontier exhibit)** serves `/remix3/editorial/` from a hand-rolled Workers entry (ADR-0004 second addendum; the spike is prior art; NO nodejs_compat, client assets prebuilt with esbuild), the fourth request-time variant — and the first FENCED one: excluded from every benchmark number, by mechanism at all three labeling layers (FINDINGS §7(c)). Beta pin re-verified at build time: `3.0.0-beta.5` still newest (npm `next` tag + GitHub tags; every sub-package unchanged since 2026-07-01), exact-pinned with the committed lockfile as the real pin. (1) On-surface: the DS plaque's canonical fenced form, version tool-derived from the variant's own package.json; (2) chrome: new `SurfaceControls.fencedExhibits` — a tagged `--fenced` switcher anchor, NEVER a reading-table column and never counted in "Served by N of M" (adding it to `variants` would corrupt both — measured before deciding), HUD note names the RUM-only policy; (3) receipts: `assertBenchableTarget` in the bench runner REFUSES `/remix3/*` targets before any browser launches (in `runBatch`, not the CLI, so the reproduce path and library imports hit the same wall), with tests; `pm-remix3` stays OUT of `LOCAL_PLANE_INSPECTORS` (the blog precedent, belt-over-mechanism). Drift is ADVISORY as decided (ADR-0003 first addendum) and the suite encodes the distinction rather than skipping the check: `advisoryDomEqual`/`advisoryPixelsEqual` wrap the same throwing helpers (one evidence path), warn instead of throw, and a mechanism-proof test feeds them deliberate drift to prove they cannot block; non-vacuity stays HARD (page serves, chrome injected, fenced-subtree count exactly 2). The normalizer extension is scoped at the CALL SITE — `dropFencedSubtrees` is a PAGE_NORMALIZE flag + `neutralizeFenced` pixel helper, deliberately NOT a NoiseSpec field so no registration can smuggle it in; core comparisons never pass it, and the suite asserts every core editorial page carries zero `[data-pm-fenced]` elements. The page serves the CANONICAL markup + cart contract around exactly TWO fenced subtrees (count-pinned): the plaque (top of main, label-first) and a frames DEMO (after the article, self-declared "exhibit apparatus" — the paradigm made visible, and what the committed §5 browser coverage drives: run() anchor interception with ONE partial fetch and no document navigation, Navigation-API URL push + Back restore, JS-off full-page fallback — the FINDINGS §8 hand-off closed). `PERMITTED_NOISE` registers NOTHING (measured-empty, the astro precedent — htmx was the other one when this was written and is no longer, having registered `^hx-` for the PLP paginator in 2026-08-29's `plp-htmx`): remix's residue is comments (freedoms), `#rmx-data` does NOT appear when frames resolve as streams (measured — the spike's string-resolved probe had it), css() is deliberately unused, and `rmx-target`/`rmx-src` live only inside the fenced demo — registering them would be the vacuous-excuse class slice D's scoping rejects. The pre-merge identity guard is the react-next MECHANISM (normalized DOM over linkedom) in the VARIANT's workspace (astro precedent), driven through the real Worker path with stub EDGE, both snapshots, with a divergence complement proving the fenced drop is load-bearing — and it BLOCKS deliberately: the lockfile pins the render path, so only a commit can change its outcome (the weekly-beta weather the advisory fence exists for cannot reach it). Serialization measured before code (probe, slice-D discipline): attributes reorder (class last), text escapes only `&<>` (quotes raw — byte-strict impossible), voids self-close, doctype from `createHtmlResponse`; frames add NO wrapper element (comments only — not slice C's `<astro-island>` problem). New shared touch: remix3 frame PARTIALS pass through the front Worker untouched (variant-scoped; the q-data.json precedent; generalizing to a `/frames/` convention is recorded as the PLP build's call). Starter defect found: `@remix-run/render-middleware`'s published d.ts leaks a relative import into a sibling's raw TS source needing undeclared `@remix-run/route-pattern` — the third `packageExtensions` instance (OpenNext, qwik-city), types-only, proven by full node_modules wipe. Local proof, final tree, every verify-slice finding adopted first: origin suite **324/324 fixture** and **323/324 crate** (the one miss is the known pre-existing git-ignored thumbnail, `9861004-primary.thumb.avif` — the 290/291-baseline file; advisory drift legs clean in BOTH modes), turbo **30/30**, variant guards 14/14, switcher 24/24, workerd smoke green through the real EDGE binding; full narrative + the verify-slice postscript (4 lenses, 14 distinct findings, 12 adopted — headliners: the fence was URL-normalization-bypassable, the plaque shipped unstyled where no gate can look, and a false "measured" record was disproven by making its citation a real assertion) in build-log. Wiring: 8797/9240, REMIX3 binding + VARIANTS entry, CI deploys `@pm/remix3` after htmx behind pm-edge, turbo `@pm/remix3#build` + uncached `#test`. Earlier record of A–E follows. **Slice E (htmx — hypermedia)** is the third request-time variant and the second starterless one: a hand-written Worker renders the page per request (the paradigm IS the template — plain template literals, byte-identical to the master after the delivery strip, proven pre-merge by the vanilla-mechanism guard in repo-checks, both snapshots, first probe), with the pinned `htmx.org@2.0.10` runtime vendored from the npm package into the variant's own assets and served same-origin (asserted byte-identical to the lockfile-installed file; 4.x exists only as alpha/beta and would be a fenced exhibit under ADR-0003's first addendum). The served page carries ZERO `hx-*` attributes — ISSUE E's "honest hypermedia statement": editorial's one interaction is client cart state, which hypermedia does not own, so like astro the variant registers NOTHING in `PERMITTED_NOISE` and its drift comparison runs under `NO_NOISE`, with the emptiness asserted against raw served bytes in both the origin suite and the drift leg. The runtime still ships (site-wide install is the paradigm's real shape; dropping it would make the column a second vanilla) — measured 51,238 B raw / **14,996 B brotli**, external-file JS the fixed ruler already decomposes correctly, slotting between vanilla (1.35 kB) and qwik (26.83 kB) on the surface whose thesis is how much machinery prose needs. Slice E also completed the two completion duties: `SURFACE_CONTROLS.editorial.plannedVariants` is GONE (five live columns, "Served by 5 of 5" — which retargeted the switcher unit guard for planned-cell disclosures onto checkout, the sparse frontier), and **home's editorial catalogue row flipped to `Public today · open the surface`** (ADR-0007 §4's designed row-by-row flip, linking the designated host `/vanilla/editorial/`; the publication-time tense/verdict flips stay out). New wiring: pm-htmx on ports 8796/9239 (run-local + `LOCAL_PLANE_INSPECTORS` — the CPU sum is serving-path per visit, so the inspector entry is load-bearing, not bookkeeping), CI deploys `@pm/htmx` with the request-time group behind pm-edge. verify-slice: 4 lenses, 11 raw findings deduping to 7 distinct, **6 adopted, 1 refuted** (headliners: the branded-503 boundary didn't cover a render-time throw on a malformed-but-200 tray — moved inside the guard, and the branch got its first test anywhere; the pre-merge identity guard never executed `snapshot.mjs`'s crate featured-id policy — a typo'd constant would have merged green and turned the deployed smoke red; full narrative in `build-log.md`). Slice D's status narrative below stands as the record of A–D. — `/vanilla/editorial/`, `/react-next/editorial/`, `/astro/editorial/` and `/qwik/editorial/` all serve through the composed origin today; slice D (qwik) merged via **PR #18, 2026-07-26**. Slice A minted the pattern (PM_SNAPSHOT selector, CART_CONTRACT, NoiseSpec.behaviorAttrPatterns, the first drift comparison, the ADR-0008 §9 re-render leg). Slice B (the OpenNext-on-Cloudflare variant, the render baseline's planning-time villain) added what a REQUEST-TIME variant needs that a build-time one didn't: its own pm-edge service binding (+ the CI deploy reorder that follows from it), `NoiseSpec.dropElementSelectors` (a content-aware whole-element noise class, generalizing the chrome-slot removal — App Router's own SSR streaming wrapper needed it), a linkedom+react-dom/server pre-merge identity guard for a paradigm with no synchronous render-to-string entry point, and the matrix's first error boundary for a live per-request data-fetch failure. verify-slice: four lenses, 8 findings on slice B (headline: the deploy script would have shipped an unstyled production page — a turbo cache-sharing gap between the "origin" and "deploy" CI jobs), all verified against source, all adopted pre-commit (narrative in `build-log.md` Phase 8). DIFF-TO-STARTER.md per variant records every deviation + why. **Post-push CI-only failure found and fixed:** react-next's chrome slot (`div#pm-chrome-slot`) had zero React children, so hydration's mismatch recovery silently deleted the front Worker's injected switcher/HUD chrome moments after every page load — invisible on a fast machine, caught by a CI runner slow enough to expose the race, reproduced locally via CPU-throttled Playwright, root-caused in `react-dom`'s own hydration source, fixed with `dangerouslySetInnerHTML` (the one escape hatch that actually skips React's child-mismatch walk — `suppressHydrationWarning` does not). Re-verified 209/209 both snapshot modes (narrative in `build-log.md` Phase 8 postscript). **Slice C (astro — the islands paradigm)** is the first variant to add nothing to the shared tooling: static output, no adapter, and no `PERMITTED_NOISE` entry at all. The slice's flagged judgment call — island or not for one button — was settled by measurement rather than taste: a `client:load` island wraps its content in an `<astro-island>` custom element that HAS element children, so `dropElementSelectors`' content-aware guard (slice B's own contribution) could not excuse it, and the DOM gate would have failed while the pixel gate passed (`display: contents` makes the wrapper invisible). The idiomatic Astro answer — a bundled `<script>`, which Astro's docs put first for interactivity without a UI framework — costs zero contract DOM. Astro's escaping turned out byte-identical to the reference renderer's (`html-escaper`, `&#39;` decimal, where React needed a second escaper), so this variant's page is byte-comparable to the master rather than merely DOM-comparable, and its font-markup assertion is the strict form. The pre-merge identity guard uses Astro's OWN render-to-string path (the Container API + `getViteConfig`) and therefore lives in the variant workspace rather than `tools/repo-checks`, so an Astro upgrade cannot break unrelated repo guards. Merge to main deploys — Rob's call. **Slice D (qwik — resumability)** is the second REQUEST-TIME variant (its own pm-edge binding, trays per request through a `routeLoader$`) and the first whose registered noise is ALL mechanism: `^q:`/`^on:`/`^on-document:` under `behaviorAttrPatterns`, nothing under `attrPatterns`, no `dropElementSelectors`. It is also the first variant needing a registration for attributes on the `<html>` ELEMENT — Qwik emits `<html>` itself and puts its container attributes there, which the drift gate compares deliberately. The slice's structural risk (was this slice C's `<astro-island>` problem again — an element no registration can excuse?) was settled by a throwaway scaffold BEFORE the variant was written: Qwik adds no wrapper element anywhere, only attributes and comments. Two expectations carried in from earlier slices inverted on measurement: Qwik's escaping is byte-identical to the reference renderer's (so no second escaper, unlike react-next), and it does NOT split `text {expr} text` into separate text nodes. Prefix mounting is derived from ONE value (`base` in vite.config.ts feeds the router, the on-disk output layout, `q:base`, and the asset URLs), where slice C had to keep two config values in agreement by hand. Two starter defects fixed with evidence: the integration's assets binding is named `ASSET` while qwik-city's own middleware calls `env.ASSETS.fetch` (latent, not yet reached), and `@builder.io/qwik-city@1.20.0` declares `@builder.io/qwik` in neither `dependencies` nor `peerDependencies` — fatal under ADR-0004 §2's no-hoisting isolation, fixed via `packageExtensions` (the slice-B precedent). The honest cost recorded rather than hidden: the cart contract's load-time storage read is eager work by definition, so this variant downloads one lazy chunk at startup that a zero-JS page would not — a real property of resumability on this surface, and it belongs in the reading table. The pre-merge identity guard is the most direct of the four (Qwik ships a real `renderToString`) and is sabotage-proven on crate copy. Slices E–F next (spec: `prds/editorial-build-issues.md`; pattern: `variants/vanilla`/`variants/react-next`/`variants/astro`/`variants/qwik` + their `DIFF-TO-STARTER.md`s). **Next unit after slice D is the `bench-accounting-fix` session (issue #16), by Rob's explicit 2026-07-24 call** — qwik ships MANY EXTERNAL chunks, making it the third distinct delivery shape after vanilla's single file and astro's inlined bundle, which is the spread that fix needs to validate against. **GitHub publication still pending** (the issue commands are in the issues file's header).

**Answer:** All six slices landed (verification narrative in `build-log.md` Phase 8; 17 distinct defects adopted into the PRD before its commit; each slice carried its own adversarial pass, recorded per-slice above). The surface serves in five core paradigms plus the fenced Remix 3 frontier exhibit; every PRD acceptance criterion is met — the drift gate proves the five against the master with remix3 advisory, `SURFACE_CONTROLS.editorial` lists five live variants plus one fenced exhibit, every variant's noise registration is measured (three earned-empty), six DIFF-TO-STARTER receipts + the three-layer remix3 labeling exist, and the ADR-0008 §9 re-render leg holds on the plane. Slice F merged per Rob via PR #22 (`db626cb`, 2026-08-12) and production serves the complete editorial surface. Next: the first editorial bench batch (arc step 2 — its accounting prerequisite, issue #16, is merged), resolved 2026-08-13 as `editorial-bench-batch` below.

### `bench-accounting-fix` — narrative moved from the decision map (2026-09-25)

The decision map's `bench-accounting-fix` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **RESOLVED, merged and deployed** — implemented in worktree `bench-accounting-fix` off `main` after slice D merged (issue #16); merged via PR #20 as `d561677` (2026-08-02 UTC), main CI green including the deploy job (state verified against GitHub by the slice-E session, 2026-08-09 — the "pending merge" note this line used to carry was stale). The fixed ruler is what the first editorial bench batch runs on; slices E/F follow.

**Ran as its own session (2026-08-01), after slice D merged (PR #18, 2026-07-26).** Rationale for that slot held: Qwik ships the most JavaScript of any paradigm here and has its own delivery shape, so fixing the accounting straight after D validated it against three genuinely different shapes at once (vanilla = external file, astro = inlined, qwik = external-many) while only four variants existed to re-verify. Doing it after all five would have doubled the re-verification surface for no extra information; doing it before D would have validated against one delivery shape and likely needed revisiting.

**Answer:** Resolved 2026-08-01 (worktree `bench-accounting-fix`). Bytes that arrive inside the document are attributed to buckets by **uncompressed content share** of the one compressed `transferSize` — the only reproducible split that sums exactly and double-counts nothing (`decomposeDocument`): inline executable script → JS (Astro's inlined bundle is no longer "0 KB JS"), inline non-executed script → data, injected chrome markup → stripped instrumentation. The CPU gap is closed by completing `LOCAL_PLANE_INSPECTORS` (a summed metric, so an absent inspector is a named hard error, not a silent partial) and enforcing ADR-0001 §7 binding E (`--local-cpu` refused against a remote origin). The CSS-delivery gap is a cross-variant question deferred to the PDP/PLP builds, with the CSS cell barred from publishing as a paradigm verdict until then. Method + limits in the **ADR-0001 addendum (G–J)** and **ADR-0003 addendum (CSS delivery)**; the settle/idle and drift-gate integrity fixes ride along. Full narrative in `build-log.md`.

Three measurement-credibility defects were found by slice C's adversarial pass and deliberately NOT fixed inside it, because each is a methodology decision the PRD fences a slice from making unilaterally. **None may be left unresolved when the first editorial bench batch publishes** — each would put a false or incomparable number in the reading table.

1. **Inline JS is invisible to the KB accounting (ADR-0001 §3 addendum question).** `tools/bench-runner/src/collect.ts` derives `buckets.js` and `initialJsBytes` from resource-timing entries classified by URL extension, so an INLINE `<script>` contributes zero and its bytes are absorbed into `buckets.html`. Astro inlines its cart bundle, measured at 1,247 B — so the render axis would publish "astro: 0 KB initial JS" against vanilla, the NO-RUNTIME control, at ~1 KB, for the byte-identical enhancement, on the surface whose whole thesis is how much machinery prose needs. Also discontinuous: past Vite's inline threshold the number jumps to its true value with no change in the paradigm. The fix is in the harness (count inline script bytes as JS, stop counting them as HTML) and must settle double-counting; rigging the variant instead (`assetsInlineLimit: 0`) was rejected as inventing a request the paradigm would not make. Details in `variants/astro/DIFF-TO-STARTER.md`. **Slice D added the third delivery shape the fix must handle:** qwik ships MANY EXTERNAL `.js` chunks under `/qwik/build/`, referenced by `modulepreload` plus an `async` module script — so the editorial columns now span external-single-file (vanilla), inlined (astro), and external-many (qwik), which is exactly the spread that makes a harness fix verifiable rather than plausible.

2. **Local CPU attribution omits every real variant.** `tools/bench-runner/src/cpu.ts`'s `LOCAL_PLANE_INSPECTORS` lists only `pm-front`, `pm-placeholder-static`, `pm-placeholder-ssr`, `pm-edge` — so a LOCAL bench of `/vanilla|react-next|astro|qwik/editorial/` attributes zero CPU to the Worker that actually served the page while the placeholder targets it is compared against are sampled. Pre-dates slice C: the full missing set is now **pm-vanilla 9235, pm-react-next 9236, pm-astro 9237, pm-qwik 9238** (slice D added the fourth, and deliberately did NOT add it alone — a partial port list still needs the failure-tolerance decision below, and making it while the decision is open would just move the gap). Not a one-line fix: `CdpConnection.open` throws on an absent inspector, so the port list and its failure tolerance have to be decided together (hard error vs recorded gap). The blog's inspector must stay OUT — ADR-0009 puts it outside every measurement fence.

4. **A qwik-specific, NON-DETERMINISTIC accounting hazard (raised by slice D's adversarial pass, deliberately not fixed inside the slice — where the byte boundary sits is this ticket's own methodology decision).** Qwik is the only live variant that fetches anything after the `load` event: its preloader runs inside `requestIdleCallback(…, {timeout: 2000})`. `collect.ts` snapshots `initialEntries` after `waitForLoadState("networkidle")` (500 ms of quiet) and computes `interactionBytes` as a POSITIONAL slice past that snapshot's length — so under the bench's own CPU-throttled profiles, or on a loaded runner, the idle callback can be starved past networkidle and the same page/build yields two different receipts: `initialJsBytes` under-reporting qwik's load cost while `interactionBytes` over-reports the cost of one localStorage write, with nothing failing. The fix that removes the class rather than the instance: await an in-page `requestIdleCallback` before the snapshot — the trick `collect.ts` already uses for the INP flush — so any framework's post-load idle work lands on the load side by construction. Measured context for the same fix: at load, encoded JS is vanilla 1.35 kB, astro **0 requests** (inlined — defect 1 reproducing independently), qwik 26.83 kB, react-next 145.05 kB; all four fetch nothing on the click.

3. **"CSS its native way" is currently nominal (ADR-0003 §2 addendum question).** All FOUR editorial variants (vanilla, react-next, astro, qwik) ship the shared component/surface stylesheets as raw verbatim copies, so their CSS cells are byte-identical by construction and Astro's, Next's, and Vite's bundling pipelines all appear to buy nothing. §8 forces this for the FONT files and `fonts.css` only; the other eight sheets are raw by choice, for cross-variant comparability. Whether each variant should deliver them its own way — and how the byte-identity assertions adapt if so — is a cross-variant question, not an astro one.

## Phase 9 — The writing home (blog + CMS)

The domain grew its second inhabitant: Rob's personal blog and the CMS he
writes it with — 1000% separate from the benchmark by construction
(ADR-0009, ticket `blog`). Kickoff was a live interview (web CMS from any
device · drafts-over-days · essay/photo/note/link with series as grouping ·
curated art-direction knobs · the Tumblr as photo-post mood reference only ·
secret preview links · login identity robresearch87@gmail.com · masthead
"Rob Lark"); every remaining call was made autonomously and recorded.

**The plane.** A sibling Worker `pm-blog` behind pm-front at the single
claimed prefix `/blog/*` — the complete production diff to the benchmark is
a SIBLINGS table entry, one service binding, and a byte-identical
passthrough guard (BLOG responses skip chrome injection exactly like EDGE).
First D1 database in the repo (`pm-blog`: posts, revisions, post_tags,
media, sessions, login_attempts, redirects) and a second R2 bucket
(`pm-blog-media`). Markdown is the source of truth; body_html is a cache
column recomputed on save by the ONE unified pipeline (remark-gfm +
remark-directive + rehype-sanitize + Shiki/Everforest) that also renders
the admin live preview, the preview-link page, and the full-content RSS —
the preview cannot drift from the blog because it is the same function.
Words are never locked in: one-request JSON export of every post/revision,
plus `wrangler d1 export` out-of-band.

**The wall (ADR-0009 §5).** Cloudflare Access can't path-scope on the
workers.dev hostname without walling the benchmark, so the blog carries its
own: one 256-bit credential stored only as a SHA-256 hash in a Worker
secret (constant-time compare, no username dimension to enumerate),
server-side revocable sessions hashed in D1 under an HttpOnly/Secure/
SameSite=Lax cookie scoped to /blog, custom-header CSRF on every mutation
(+ Sec-Fetch-Site check; login/logout forms carry the token as a field),
D1-backed per-IP login lockout, no state change on GET anywhere, and an
admin that renders a login wall and nothing else to unauthenticated eyes.
Access joins in FRONT of this wall at `domain-cutover`, not instead of it.

**The CMS.** CodeMirror 6 markdown editor built for re-entry: dirty-tracked
autosave (1.5 s idle + 15 s heartbeat + keepalive flush on tab-hide),
localStorage mirror with a restore bar for the crash case, revisions with
one-click restore (a restore snapshots first), cursor/scroll position saved
per post and put back on open. Slash commands at line start insert the
directive vocabulary; paste/drop uploads straight to R2 with dimensions
sniffed at upload time so plain markdown yields zero-CLS pages; the split
preview iframe renders the real public page. The desk leads with a
"Continue writing" card — the drafts-over-days front door.

**The look ("Sleeve & Shelf", `docs/prototypes/blog-design/NOTES.md`).**
Liner-notes typography as the identity: every post carries a SPINE — the
record-sleeve edge, colored by the per-post accent knob — and a Fragment
Mono catalog line; the contents page is the shelf (Fraunces year numerals,
spine ticks, mono dates). Fraunces + Literata + Fragment Mono, self-hosted
latin subsets, zero face overlap with the store. The accent discipline is
load-bearing: an arbitrary per-post accent may never color text (two leaks
caught in critique and repaired), so AA holds under any knob value —
measured 6.05:1 muted / 15.56:1 ink light, 6.28:1 / 12.97:1 dark,
Everforest code 5.18:1+. Honest method note: the planned four-board
adversarial exploration died wholesale on a session limit; the direction
was designed single-handed with the same screenshot-critique loop (six
concrete defects found and fixed on screen evidence — sanitize stripping
data: images, the gallery paragraph collapse, the margin-aside overflow
math, two accent leaks, dot geometry).

**Proof.** `pnpm run check` 21/21; the FULL origin suite green with the
blog composed in (8 files, 164 tests — blog write-path tests gated on
`PM_BLOG_CREDENTIAL` so the deployed smoke never writes to production);
20 unit tests on the pipeline/slug/dimension contracts; editor exercised
in a real browser (login → desk → editor → slash menu → autosave →
publish); Lighthouse accessibility 100 on contents + essay, CLS 0.00 on
the trace. The first real post — "A quiet room", on why this room exists —
flowed CMS → publish → public page → feed end to end. The standing
verify-slice pass ran all four lenses (surviving one session-limit death
mid-run; completed lenses replayed from the journal): 35 raw findings, and
the adopted set closed two real data-loss paths (restore snapshotting the
wrong text; the publish/autosave race), three gates that existed only in
the browser bundle (draft-slug publish, art-direction whitelists,
original_date shape), the unpublished-rename redirect gap, gallery-hoist
word loss, excerpt double-escaping, DOM-clobbering protection restored
with collapsed footnote prefixes, the editor bundle moved behind the wall,
sign-out-everywhere, and smoke assertions decoupled from author prose.
Known limit, recorded in ADR-0009 §8: CI can prove the wall refuses, not
that it accepts — verifying login after arming is a runbook step.

**Skills / tools used:** grilling (the kickoff interview) ·
frontend-design skill (the spine is the boldness budget) · chrome-devtools
MCP (editor drive + dark-mode pass) · headless-Chrome screenshot loop ·
Fontsource subsets · the origin suite as the non-contamination gate.

### Phase 9.2 — the editor made luxurious (2026-07-18, worktree-blog-phase2)

A second session against the landed plane (`022e307`, merged to origin/main
between sessions), closing ADR-0009's recorded follow-ups and the phase-2
handoff. First act was operational, not editorial: the first post-merge CI
deploy of `main` had failed — `wrangler d1 migrations apply --remote` 7403'd
because the deploy token carried Workers Scripts:Edit but not **D1:Edit**, so
nothing reached the plane and production `/blog/` still 404s. Recorded the
re-mint in `workers/README.md`, deployed `pm-blog` locally (sanctioned;
production can't reach it until merge), and verified the wall's **accept**
side with a real credential login on the preview origin — the one thing CI
structurally cannot prove (a missing secret 401s exactly like a working
wall). The full origin suite ran green against the preview (164), the fence
that the benchmark stayed untouched.

Five upgrades, each inside the fences:
- **Media library** — a `<dialog closedby="any">` (with a light-dismiss
  fallback for Safari) over the `media` table: browse everything in R2 with
  where-it's-used counts, insert an existing image without re-uploading, and
  edit alt after the fact. Inserts use the empty-alt form so the row's alt
  flows through `mediaLookup` at render; since `body_html` is a cache, an alt
  edit re-renders every referencing post server-side — `updated_at`
  untouched, so an open editor keeps its optimistic-concurrency baseline.
  Proven in the browser end to end: an empty-alt insert surfaced as
  `alt="a better dot"` on the published page.
- **Scheduled publishing** — the mechanism decision (ADR-0009 addendum): a
  **cron trigger** (`*/5`), not a read-time check, because "published but not
  visible" would have to be threaded through every public query and one
  missed clause leaks unpublished words. A scheduled post is an ordinary
  draft until `publishDue` publishes it through the same `publishPost` gates;
  `published_at` carries the author's chosen instant, not the tick. The gate
  is enforced when the schedule is made, and an un-honorable schedule drops
  rather than retrying forever.
- **Zip-of-markdown export** (§2's recorded variant) — a ~90-line STORE-only
  ZIP writer (`src/zip.js`), no new dependency; proven against real macOS
  `unzip -t`/`zipinfo`, CRCs and content round-tripping.
- **AVIF** — re-allowed once `dimensions.js` could sniff it: an ISOBMFF walk
  to the **primary** item's `ispe` (an alpha AVIF carries a second ispe, so
  "first ispe" is wrong on exactly those files), `irot` transposing 90°/270°.
  Verified against a real `sips`-encoded 320×200 landscape and 240×380
  portrait, not only hand-built boxes.
- **Public luxuries** — footnote hover-popovers as a ~2 KB dependency-free
  enhancement served only on pages whose *generated* markup carries footnote
  refs (CSP `script-src 'self'` intact, WCAG 1.4.13 implemented directly,
  aria-hidden because it duplicates reachable content); print polish (page
  margins, break-avoidance, ink-colored underlines, dark-dim reset on paper).

The four never-judged design boards were finally judged
(`boards/JUDGMENT.md`): a workflow inventoried all four (40 evidence-cited
devices) before the three-lens panel died on a session limit; judgment
finished inline against the committed system with a screenshot probe of the
one near-miss (liner-notes' tracklist dotted leaders — held, not adopted:
on-register but busy against essay deks). **Sleeve & Shelf stands unchanged.**
Proof: repo `check` 21/21, the full origin suite green with the blog composed
in (**173**, was 164 — +9 covering the media library round-trip, the markdown
zip, the AVIF upload, and the cron firing a due schedule through
`--test-scheduled`), 40 blog unit tests (was 20 — AVIF box-walk incl. the
alpha/rotation cases, the zip writer against a hand-walked central directory,
export front-matter). One real regression caught by the suite and fixed
before commit: a missing `seriesNeighbors` re-export 500'd every public post
page. Verify-slice ran the standing sequential-lens pass while the main
session probed inline (the zip and AVIF real-file probes above).

**Skills / tools used (phase 9.2):** modern-web-guidance (dialog
`closedby`, popover/interest-invoker survey — the platform pattern was
considered and rejected on polyfill weight) · chrome-devtools MCP (the full
editor + public browser pass) · headless-Chrome screenshot probe · the
verify-slice workflow · the origin suite as the non-contamination gate.

## Phase 10 — The first numbers (editorial bench batch, 2026-08-13)

The moment the site stopped being pure instrument. Until this session every
reading-table cell was a designed em-dash; the chrome's empty state promised
"when a number lands here it carries its receipt — or it doesn't land at
all." This unit made that promise come due for the editorial surface.

**Order of operations was the whole design, and it decided the commit
count.** A receipt records `commit.dirty` as the tree stood WHEN IT WAS
MEASURED, and the publication build refuses a dirty receipt — so every
artifact has to be minted from a committed tree, and the code it measures
has to be committed before it. That makes this unit **eight commits**, each
one a measurement boundary rather than a preference: arm the harness →
build the pipeline → mint the receipts → fix the constant's method → mint
the constant → drop zero-width bands → re-set the byte budget → re-mint
the constant against the chrome that change produced. They cannot be
squashed, and this decided the MERGE STRATEGY: the receipts pin `85b97c4`
and the constant pins `58d5101` by SHA, so a rebase or squash merge would
rewrite both into hashes absent from main's history — a skeptic cloning
the repo could not check out the commit a published number names. The
branch therefore merges with a MERGE COMMIT, preserving every pinned SHA,
which is the first time this project's linear-history habit has lost to a
correctness requirement.
That is a real tension with the one-commit-per-branch habit, flagged
rather than papered over. The rule paid for itself twice — editing docs
while a batch ran produced three unpublishable receipts, and the constant's
own artifact file, left in the tree from a previous run, dirtied the tree
for the next one. Commit A arms the harness
(the `editorial-add-to-cart` interaction — the surface's ONE designed
interaction, clicked with no warm-up so the first click's latency is what
lands — though see the verification postscript: the harness settles idle work
BEFORE the click by design, so this measures handler resolution, not handler
download, and the first draft of that claim overreached; a `--nonce` override
so the exact effective URLs can be pre-warmed against the slice-C
first-hit-uncompressed class; the addendum-F chrome-constant probe), and only
then does anything measure. Commit B
publishes — receipts, bundle pipeline, methodology page, home flips, this
record.

**The chrome constant (ADR-0001 addendum F).** Final figures, after the
verification pass rewrote the method twice (see the postscript):
**+224 ms FCP, +216 ms LCP, 0 CLS, 0 long-task ms, plus 1,908 bytes
brotli on the wire** — 7 runs per condition, slow-4g, `/vanilla/editorial/`
against a local plane serving this publication, clean `58d5101` (re-measured
once more after the band element changed: a constant must describe the chrome
that actually ships, which is the whole point of the guard). The
geometric-inertness claim (ADR-0008 §1) held exactly: zero layout shift
either way. The timing figure is what byte-stripping structurally cannot
remove — a render-blocking `/_pm/chrome.css`, a preloaded mono, and the
ruler itself, all real fetches on a slow connection. It is ~3× the first
figure this unit produced, and the honest reading is that the first one
was measuring a smaller chrome through a distorted lens. First probe run
also failed on the corp TLS proxy (`route.fetch` runs in Node, which
doesn't trust the MITM CA; the browser uses the system keychain) — the
documented NODE_EXTRA_CA_CERTS pattern fixed it.

**The batches:** a throwaway 1-run warm-up batch first (gets every page's
subresources cached at this colo; receipt discarded), then curl pre-warm of
all ten effective URLs until `content-encoding: br` (the batch nonce is
batch-constant, so the URLs are knowable in advance — that is what the
`--nonce` flag is for), then three official batches back-to-back on the
quiet machine: 5 variants × cold+warm × 7 runs per profile, one nonce
across all three so the only variable that changes between batches is the
profile. Every receipt: `dirty: false` at `23a0e7e`.

**The warm-up receipt earned its keep before the official runs spent
anything.** Its numbers "disagreed" with the recorded ground-truth table
(astro 0.42 KB vs "~1.2 KB inlined"; vanilla 1.69 vs 1.35; qwik 29.5 vs
26.8; react-next 154.8 vs 145.1) and every delta had a mechanism, not a
bug: astro's inline bundle is attributed by COMPRESSED share of the
document's transferSize (addendum G), and the deployed plane's
`transferSize` includes CF response headers, which scale with request count
(qwik +2.7 KB over 7 files, react-next +9.7 KB over ~21 requests). The
astro arithmetic was reproduced against the live page rather than asserted:
1,278 B of inline executable script in a 15,033 B served document = an 8.50%
share; the document's compressed transferSize is ~5.0 KB (4,509 B brotli
body + ~0.5 KB CF response headers); 8.50% of that is the 425 B the receipt
records, published as 0.42 KB. Direction and magnitude both match;
the local-plane ground truth was measured without CF headers. This is the
citation-vs-measurement discipline doing its job in the cheap direction.

**What the published receipts say** (warm medians, avg-broadband-desktop,
from the final batch at `85b97c4`): initial JS — astro **0.42 KB**,
vanilla **1.69**, htmx **19.38**, qwik **29.48**, react-next **154.88**.
TTFB splits the build-time variants from the request-time ones cleanly
(~120 ms vs ~226 ms), which carries into LCP (412/428 ms against
536/552/552). CLS **0.00 everywhere** — the surfaces were designed for
that (ADR-0008 §8's sized image slots) and the instrument is inert by
construction. INP (scripted) 24–32 ms across the board: the surface's one
interaction is a storage write by design, so this cell is honest about
measuring almost nothing — the interesting INP number belongs to the
checkout surface, where the ADR puts it. Interaction bytes **0 on every
variant, both columns, every run settled**. Under slow-4G the LCP order
holds and the spread narrows (astro 776 · vanilla 796 · htmx 832 · qwik
864 · react-next 876) — 154 KB of JavaScript costs less than a naive
reading expects on a page whose LCP is text, which is exactly the kind of
result the fit line must not overstate.

**Publication is a build mechanism, not a review policy.** The front build
generates `/_pm/lab/editorial.json` from the committed receipts — the
served file and the object the Worker imports and hands `renderChrome` are
one artifact, so they cannot drift. The build REFUSES: a dirty receipt, a
mixed-SHA publication, disagreeing batch shapes, a missing default-profile
reading, and any fit sentence whose claims the receipts don't back (band
non-overlap on the headline metric's extremes; the no-fetch-on-click
clause re-verified in every variant's medians, both columns). The chrome
gained exactly two behaviors: the populated hud-lab line (receipt framing
+ the §9 limits link to /methodology/) and a lockstep guard — a bundle
whose profile doesn't match the renderer's own ?profile= resolution
renders as em-dashes, never as mislabeled numbers.

**Judgment calls owned and recorded (ADR-0001 addenda K–M):** official
batches run out of band, never in CI gates (K — the issue-#16 design
question); throttled timing cells publish numbers, never verdicts, until
the WPT cross-check exists (K, binding addendum A); the chrome constant is
stated on the methodology page (L); the addendum-G serialization asymmetry
is resolved as publish-with-stated-caveat, never a hand-maintained
framework list inside the ruler (M). The qwik framing call: the fit line
names each paradigm's own cost in the locked axis order — "resumability's
29.48 KB (up front — deferred binding, not deferred bytes)" — and makes no
react-next-vs-qwik apples-to-apples claim.

**Final-tree proof:** origin suite **335/335 fixture** and **334/335
crate** (the one miss is the known pre-existing git-ignored thumbnail,
`9861004-primary.thumb.avif`, 404 on this machine — the same single miss
every slice since D has recorded), turbo lint/typecheck/test **30/30**,
`wrangler deploy --dry-run` clean, switcher units 29/29. Eleven of those
suite tests are new: the publication is asserted outside-in — the served
bundle's every reading carries a complete receipt, every receipt URL
dereferences to a clean SHA-pinned v1 receipt whose warm medians DERIVE
the served value, all receipts pin one SHA, the chrome renders those exact
numbers under each `?profile=`, the fenced exhibit reads the benchmarked
columns without gaining one, the methodology page's stated constant equals
the served artifact, home's spread equals the bundle's min/max, and the
populated fragment stays inside its budget on every profile.

**The methodology page** (ADR-0001 §9) lives at `/methodology/`, a
front-Worker static singleton on the home-surface delivery precedent;
every number on it is substituted at build from a committed artifact
(chrome-constant probe, receipts, crate manifest) — the home-receipts
anti-drift rule, applied to prose about the method itself.

### Phase 10 postscript — the verification pass that rewrote the unit

**The near-miss worth recording first.** verify-slice was launched against
the finished publication and came back with four EMPTY findings arrays —
which reads exactly like a clean pass. It wasn't: all four lenses had died
on a model limit. The journal said it plainly (`4 started, 0 result`, no
findings files on disk), and the workflow's own diagnostics warn to read it
before believing an empty result. Had that been taken at face value, the
first published numbers on this site would have shipped with no adversarial
pass at all, and the build log would have carried the sentence
"verify-slice: 0 findings" — the record-not-code class, self-inflicted, on
the one unit where credibility is the product. Resumed on a different
model; the standing rule (`verify-slice-limit-resilience`) is now also a
rule about how its results are READ.

**The resumed pass: four lenses, 26 findings, 18 distinct, all adopted.**
It changed the unit's shape, not just its details — three findings
invalidated artifacts that were already "done":

1. **The chrome constant was measured wrong, twice over.** The probe served
   both conditions the DECODED document with `content-encoding` stripped,
   so the ~8 KB of chrome markup the two conditions differ by crossed a
   throttled wire uncompressed where the plane sends it inside one brotli
   stream — the interception hop cancels, the size term does not. And it
   ran against the DEPLOYED plane, which carries no publication, so it
   measured the EMPTY-state chrome (~3 KB smaller than the populated strip
   that now ships). Both fixed: both bodies are re-compressed with brotli
   before fulfilment, and the probe now records the fragment it measured
   (bytes, sha256, populated) while the build REFUSES a constant measured
   against an unpopulated chrome. The lens also caught that the probe
   summed layout shifts into a running total where web-vitals — the site's
   one ruler — uses the session-window maximum; both read 0 here, but the
   field was wrong by definition, so it now computes the window.
2. **The reading table published bare medians.** ADR-0001 addendum C says
   cells publish the median WITH its min–max band; only the fit line was
   gated on non-overlap. The lens computed the consequence from the
   committed receipts: vanilla 448 ms vs astro 492 ms LCP, bands
   [440–544] and [432–544] — fully overlapping, a 44 ms "difference"
   entirely inside the noise, on a table ADR-0008 §3 makes the comparison
   interface. Every cell now carries its band, and the caption says what
   the second figure is.
3. **The fit line's strongest claim was unfalsifiable from the artifact.**
   "None of them fetches another byte for the click" rests on
   `interactionBytes === 0` — but zero is also what a swallowed settle
   timeout produces, since a request still in flight never appears in
   resource timing at all. The runner now records `interactionSettled` per
   run and the build refuses the claim unless every run proves it. That
   forced the batches to be RE-RUN on the fixed harness rather than
   published from receipts that could not support their own sentence.

Also adopted: the methodology page claimed the runner refuses the Apollo
exhibit's URL — it does not (the fence is a variant-prefix set; Apollo is a
path under a live variant), so the copy now claims only the mechanism that
exists and names the PLP build as the place the rest lands; the advertised
reproduce command said "same URLs" while `specFromReceipt` discarded the
nonce (copy corrected, `--nonce` threaded through, and the receipt now
states its own pre-warm precondition in `methodNotes`); `INTERACTIONS` was
a bare record lookup, so `--interaction valueOf` would have passed both
guards, clicked nothing, and minted a schema-valid receipt with null INP
and zero interaction bytes; batch integrity pinned SHA and shape but not
date or run location, while the page asserts both "in every receipt" (this
batch ran 28 minutes after UTC midnight); a null or renamed delta would
have published as "−0 ms" or "−NaN ms"; the fit template's five variant
keys were validated by nothing, so a rename would publish "islands
undefined KB" as the site's only verdict; the band guard compared only the
spread's extremes — the one pair that can hardly overlap — and now checks
every adjacent pair; and home published a lab-derived spread with no
receipt link, contradicting §9 and the methodology page one click away.

Two copy overclaims died the same way the slice-F record did: "clicked
cold, so a paradigm that defers handler binding pays that cost in the open"
is negated by the harness's own idle-settle before the click (it measures
handler resolution, not download — the page now says so, and the limits
list gained the settle rule it was missing), and "this constant rides every
timing cell equally" generalized a one-page, one-profile measurement into a
guarantee.

**Sabotage-proven before commit** (the slice-D discipline): a receipt with
`dirty: true` refuses the build; a receipt whose medians contradict the
fit's no-fetch-on-click clause refuses the build; runs edited so the
compared byte bands overlap build `bandsOverlap: true` with the fit
DROPPED (the chrome renders "Indistinguishable at this sample size"), and
restoring the receipt restores the fit. The populated panel and the
methodology page were both screenshot-verified — five receipt-linked
columns each carrying its band, the derived fit line with its receipt, the
limits link, remix3 tagged in the switcher with no table column.

**The byte budget, which the bands blew.** ADR-0008 §5 set the fragment
budget at 12 KiB when the populated state was still an estimate ("headroom
for populated readings"). With a receipt anchor AND an addendum-C band per
cell, the real fragments measured 11,723–12,396 B across the three
profiles — the largest (remix3, whose fenced note is extra) 108 bytes OVER,
and vanilla passing with 5 bytes to spare, which is not headroom, it is
luck. Two fixes, both recorded in an ADR-0008 addendum: zero-width bands
are omitted (a band whose min equals its max says only what the median
said — 7 of 30 cells here, 306 bytes), the band element is `<small>` rather
than `<span>` (the element for fine print, 11 bytes cheaper per cell), and
the budget moves to 13 KiB. The raise is justified by measurement, not
assertion: the fragment's cost on the wire is 1,908 B brotli, and the
chrome's timing cost is dominated by its subresources, not its markup.

### `editorial-bench-batch` — narrative moved from the decision map (2026-09-25)

The decision map's `editorial-bench-batch` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: resolved (2026-08-13)

**Answer:** Three official batches — five variants × three profiles × cold+warm × 7 runs, one clean SHA (`85b97c4`), driven against the live origin from a quiet local machine labeled honestly in every receipt (`local-dev`, unpinned; the pinned runner + WPT cross-check stay downstream, so **throttled timing cells publish numbers, never verdicts**). Every effective URL pre-warmed until compressed; every run records `interactionSettled`, so the fit line's "fetches nothing on the click" clause is backed by the artifact rather than assumed. **Published (warm medians, avg-broadband): initial JS astro 0.42 · vanilla 1.69 · htmx 19.38 · qwik 29.48 · react-next 154.88 KB; TTFB ~120 ms build-time vs ~226 ms request-time; CLS 0.00 everywhere; INP (scripted) 24–32 ms; interaction bytes 0.** Receipts committed at `workers/front/lab/receipts/`, served verbatim from `/_pm/lab/receipts/`; `/_pm/lab/editorial.json` is BUILT from them and IMPORTED by the Worker from `dist`, so served artifact and embedded bundle cannot drift. Every cell publishes its median **with its min–max band** (addendum C's first clause, which the first draft left unimplemented — zero-width bands omitted, since they say only what the median already said, and 30 of them nearly blew ADR-0008 §5's 12 KiB fragment budget: 12,283 of 12,288 before the fix, 11,977 after). The build REFUSES: dirty receipts, receipts spanning more than one SHA/date/location, disagreeing batch shapes, a fit sentence naming variants the batch did not measure, unsubstituted values, overlapping bands between ANY adjacent pair, bands from an incomplete run set, an unsettled no-fetch claim, a non-finite chrome-constant delta, and a constant measured against an unpopulated chrome. **Chrome constant (addendum F), re-measured after verify-slice found the first attempt wrong twice over: +224 ms FCP / +216 ms LCP, 0 CLS, 0 long-task ms, plus 1,908 B brotli on the wire** — processing and wire costs kept apart, measured against the POPULATED chrome on a local plane (the live plane cannot render it until this deploys; re-measurement there is a bound obligation). Methodology page at `/methodology/` (front-Worker static singleton — recorded interim until `how-it-was-built`). Home flips (ADR-0007 §4/§5) carry a receipt link. Qwik framing (the open call this unit owned): the fit line names each paradigm's own cost in the locked axis order — resumability's 29.48 KB "up front (deferred binding, not deferred bytes)" — and makes no react-next-vs-qwik claim; the addendum-G serialization asymmetry is resolved as **publish with the stated caveat, never silent reclassification** (addendum M). **verify-slice: 4 lenses, 26 findings, 18 distinct, ALL adopted — and the pass had to be run twice: the first died on a model limit and returned four EMPTY findings arrays that read exactly like a clean pass.** Six commits, each a measurement boundary (receipts and the constant pin SHAs by hash, so the history cannot be squashed). Decisions of record: ADR-0001 addenda K–M.

1. **Re-measure the chrome constant against the DEPLOYED plane** (it could not render the populated chrome until this shipped). Done at a clean `7c5be98`, 7 runs/condition, slow-4g, `/vanilla/editorial/`: **+104 ms FCP / +104 ms LCP / 0 CLS / 0 long-task ms, plus 1,913 B brotli** — against the local figures of +224/+216 ms and 1,908 B. The measured fragment is byte-identical (12,023 B, `populated: true`), so the **timing constant is less than half** what the local plane reported. **Why is NOT established** (corrected 2026-08-14 — this line previously asserted "the local figure was inflated by local subresource service", a causal claim the artifacts do not support): the two probes did not serve identical pages (18,635 B local against 18,017 B deployed), so the comparison is not clean. The deployed figure is the one that publishes; the local one is recorded as superseded, not explained. The methodology page's local-origin caveat paragraph now renders itself away (`ccLocal` is false for an https origin) — the obligation discharges in the copy, by mechanism. **Two holes the discharge did not close**, both now recorded in ADR-0001 addendum N and owned by the ruler unit below: the constant describes the chrome measured BEFORE the deploy it enables (the front build regenerates the fragment from the receipts — 11,931 B ships against the 12,023 B hashed, and only `populated` is checked, which both satisfy), and nothing ties a receipt's `commit.sha` to the code the plane was serving (`commitPin` reads the LOCAL checkout while `--origin` is now remote). Also: the constant publishes "0 ms long tasks" as a median that hides a one-sided signal — 55 ms and 64 ms in 2 of 7 with-chrome runs against 0 in all 7 without.

2. **Re-run the batch against the deployed plane**, which now serves the populated chrome the first batch could not measure. Same nonce discipline (one nonce, all ten effective URLs pre-warmed to compressed first), same shape, clean `7c5be98`. **The addendum-K prediction held in direction but NOT uniformly** (corrected 2026-08-14 — the first draft of this line said "timing cells moved up, LCP +30 to +120 ms across variants, TTFB +30 to +55 ms", and the receipts committed in the same commit falsify all three). Tool-derived from the two receipt sets, across the 30 LCP medians (5 variants × 3 profiles × cold+warm): **LCP moved −36 to +128 ms, 26 cells up and 4 DOWN.** The four that moved down are both build-time variants on slow-4g, in both columns (warm vanilla −20, astro −16; cold vanilla −24, astro −36) — the harshest published profile is where the chrome's cost sits inside the profile's own noise. Request-time TTFB moved **+29.7 to +72.2 ms** (qwik warm avg-broadband is the +72.2). Byte cells: four of five unchanged to within measurement (vanilla 1.69 → 1.69, htmx 19.38 → 19.38, qwik 29.48 → 29.46, react-next 154.88 → 154.78 KB) — **and astro moved 0.42 → 0.37 KB, −12%, which is the ruler defect below, not a byte change.** The published timing cells are now measurements of the plane a visitor actually meets.

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

**Round three (2026-07-10, issue #7):** the fan-out was already staged down
to finders-only (4 lenses, the #6 pattern that had just completed cleanly) —
and the limit killed all four at once, mid-flight, with nothing in the
journal to recover (`findings: []` × 4 was pure hollowness; the failure list
was the only truth). The fallback that worked: **inline verification by the
main session** — hand-walking each lens against live probes instead of
agents. It found the two realest defects of the slice (the browser-cache
confound and the nav-timing-rebase-under-throttling discovery), arguably
*because* the prober could iterate empirically — run a receipt, disbelieve a
number, write a probe — where a finder agent reads code. Sharpened learning:
near a limit boundary, don't stage smaller fan-outs — go inline first and
spend the budget on probes, not agents.

**Round four (2026-07-10, issue #8) — the resilient design pays out:**
the limit hit again mid-run and, for the first time, cost almost nothing.
The saved sequential workflow had lenses 1–2 durable in the journal
(refuted and fixed inline BEFORE the wall — another dividend of
launch-early); lenses 3–4 died and were resumed after the reset with
`resumeFromRunId`, replaying the completed lenses from cache. Two
operational lessons for the pattern's runbook: (1) **resume with
byte-identical args** — the first resume attempt updated the context
string ("these findings are already fixed…") and silently invalidated
the prompt cache for ALL lenses, restarting lens 1 from scratch; caught
by checking which lens the live agent transcript was running, stopped,
re-resumed with the original args verbatim. (2) **the harness can
deliver workflow `args` as a JSON string** rather than an object — the
saved script's guard rejected it; hardening the saved script mid-session
was (correctly) blocked by the permission classifier as agent-config
self-modification, so the run used a hardened session copy. Proposed
patch for `.claude/workflows/verify-slice.js`, pending Rob's review:
accept both (`const input = typeof args === 'string' ? JSON.parse(args)
: args` at the guard, with a try/catch falling through to the error).

**The fix, encoded (2026-07-10):** the root cause is that `parallel()`
fan-outs fail *correlated* — near the wall no agent has returned yet, so
one kill takes everything — and that verification runs at end-of-slice,
exactly when the rolling window is most depleted. The repo now carries
[`.claude/workflows/verify-slice.js`](../.claude/workflows/verify-slice.js),
the standing verification workflow: lenses run **sequentially** (every
completed lens is durable in the journal before the next starts; a kill
loses at most the in-flight one), every finder **streams confirmed findings
to a scratch file as it goes** (so even the in-flight lens leaves a
recoverable trail), and a limit death is resumed after the reset with
`resumeFromRunId` (completed lenses replay from cache — "lost" becomes
"delayed"). Wall-clock cost is irrelevant: the workflow runs in the
background while the main session does inline empirical probing in the
foreground — the two verification legs that, per rounds #6 and #7, catch
*different* defect classes (code-reading lenses found the NBSP/includeAA
class; probes found the caching/timing class). Refutation stays inline, per
the standing rule. Note #6's evidence against shrinking the pass: keep the
four lenses — three of them independently found the `<html lang>` blind
spot, and that redundancy is what makes an adopted finding trustworthy.

## Phase 11 — The PDP, and a ruler that flatters (2026-08-14)

Arc step 3, on branch `pdp-build` off `7c5be98`. The unit's brief was the
thesis flip: build the PDP in four paradigms and let the numbers say whether
React/Next is a contender on a surface where interactivity is genuine. Three
commits landed; the flip is **not** measured, and the reason is the most
useful thing this session produced.

### The two obligations, discharged first

The editorial publication bound two obligations it structurally could not
discharge: the chrome constant and the batch both had to be re-measured
against the deployed plane once that plane could render the populated chrome.
Both ran first, from a clean tree, before any code was written.

**The constant is less than half what the local plane reported.** Deployed:
**+104 ms FCP / +104 ms LCP / 0 CLS / 0 long-task ms, plus 1,913 B brotli**,
against the local **+224 / +216 / 1,908**. The measured fragment is
byte-identical (12,023 B, `populated: true`), so this is not a different
chrome — it is the same chrome measured through a truthful lens. The local
figure was inflated by local subresource service, which is exactly why
ADR-0001 addendum L bound the re-measure rather than treating the local
number as final. The methodology page's local-origin caveat paragraph now
renders itself away, because `ccLocal` is false for an https origin: the
obligation discharges in the copy, by mechanism, not by an editor
remembering.

**The batch confirmed addendum K's prediction in direction, not uniformly.**
(Corrected 2026-08-14: this read "Timing cells moved up (LCP +30 to +120 ms,
TTFB +30 to +55 ms on the request-time three); byte cells did not" — the
receipts committed in the same commit falsify it.) Across the 30 LCP medians
the range is **−36 to +128 ms, 26 up and 4 down**; the four that moved down
are vanilla and astro on slow-4g in both columns. Request-time TTFB moved
**+29.7 to +72.2 ms**. Byte cells held for four of five variants — astro
moved 0.42 → 0.37 KB, which is the ruler defect below and not a byte change.
Published timing is now a measurement of the plane a visitor actually meets.

### What the re-run found: the instrument flatters its own best number

astro's initial-JS cell moved **0.42 → 0.37 KB with no astro change**. Chased
to root cause rather than shrugged at:

`decomposeDocument` apportions the document's compressed `transferSize`
across html/js/data/instrumentation **by share of UNCOMPRESSED bytes**.
ADR-0001 addendum G states the limit — the split is exact only if each part
compresses at the document's average ratio — but nothing had measured how far
from true that is. Measured on the live `/astro/editorial/`: the document is
19,381 B uncompressed of which the injected chrome is **12,168 B (63%)**, and
4,290 B on the wire of which the chrome is **1,885 B (44%)**. The chrome
compresses **6.46×** against the document average of **4.52×**, so it is
handed a share proportional to its uncompressed size, takes more compressed
bytes than it really occupies, and **every other bucket is under-attributed**.
For astro's inline cart bundle the current rule yields 282.9 B where a
wire-exact split yields 426.1 B: the published cell **under-reports by 33.6%**.

The bias scales with the chrome, which is why growing it from the empty state
to the populated one moved the cell. And it runs in the direction that
flatters the site's leading claim — the smallest JS cell is the fit sentence's
opener and the minimum of home's published spread. That is precisely the shape
a hostile reader is entitled to call rigging, so it is filed as
`bench-instrumentation-dilution` with the measurements, and it is a **hard
prerequisite for any PDP byte publication** — the same rule that held the
first editorial batch behind issue #16.

It was deliberately NOT fixed here. A ruler change is a methodology decision
that belongs in its own unit (Rob's 2026-07-24 precedent), it invalidates
every committed receipt, and folding it into a surface build would have
invalidated the two obligation artifacts this unit was bound to produce.

### The spec layer owed the PDP two things

**The degenerate branches were ungated by construction.** ADR-0008 made them
contract and made the fixture branch-covering, but `render/build.mjs`
rendered exactly ONE PDP master, from the featured id — the rich path. The
drift gate only ever compares a variant against a master, so the three
degenerate arms — the COMMON path, 439/500 single-format, 44/500 unpriced,
90/500 one-image — had no master to be compared against. There are now four
masters, nested under the one surface, with `pdpMasterIds` as the single
derivation shared by the reference build, every variant build and the gate's
re-render.

Each degenerate master **isolates one branch**. The first draft did not, and
the flaw was concrete: "lowest id exhibiting the branch" resolves
`single-format` and `unpriced` to the *same* fixture release (9000001 is
both), which would have gated two branches together and neither apart. The
selector now refuses a duplicate set, the isolation is asserted for both
snapshots, and the guard is sabotage-proven — reverting the predicate fails
three tests with an error naming the duplicate ids.

Asserted: per-axis coverage with isolation. Deliberately **not** asserted:
full combination coverage — three binary axes span **8** combinations, the
crate populates **7** and the fixture **4**, against a master set of 4.
(Corrected 2026-08-14 from "the crate has 16 combinations", which was
derivable from nothing; the counts are now derived in the test rather than
typed.) Also not asserted, and now named rather than implied: the three
NON-structural branches `pdp.mjs` takes — absent notes, null track duration,
null year — which `pdpRenderClass` does not model and no fixture master
exercises. Claiming either would be the record-not-code class. The
`priceFrom == null ⟺ numForSale === 0` equivalence that `pdp.mjs` leans on
(it reads two fields for one branch) is asserted against the trays: zero
violations in both snapshots.

**The qty steppers were not actually named.** ADR-0008 §8 requires "named qty
steppers" and the master named them with a visually-hidden span — but left
`−` / `+` as bare text nodes, so the accessible names computed to
"−Decrease quantity". Two lines above, the tracklist header hid its own `#`
glyph exactly the right way, so the master was internally inconsistent about
the same technique. Fixed in the master before the first variant copied it.

### Vanilla ships the surface

The designated host, and the first re-implementation. It matches all four
masters exactly after whitespace collapse and the delivery strip, so every
rendering branch is proven rather than the featured one standing in for the
rest.

The build emits **a page per release** — 240 fixture, 500 crate. That is what
static generation costs on a catalogue surface, and it is published rather
than avoided: build time and dist size scale with the crate where the
request-time variants pay per visit. Building only the releases the bench
measures would have been rigging the variant to fit the instrument, the
rejected `assetsInlineLimit` precedent.

The recorded per-variant trap was real: every vanilla asset URL was the
literal `"../"`, correct only for a page exactly one level deep. The asset
base is now derived from page depth, and all 16 relative refs from a built
PDP page were CHECKED to resolve on disk.

**Corrected 2026-08-14: "are asserted" claimed a standing gate that does not
exist.** The check was a one-time manual one; nothing re-runs it. `@pm/vanilla`
contributes ZERO tasks to `turbo run lint typecheck test` (`--dry=json`: 30
real commands, none of them vanilla's), so "Turbo 30/30 on the final tree" is
the same 30 tasks that were green before the PDP existed — it cannot cover
this variant at all. *[Closed 2026-08-29: the `checkout-vanilla` unit gave
`@pm/vanilla` a `test` script and the merge-review pass made it
`"cache": false`, so the workspace is covered and the real-command count is
33 across #36/#38/#39, not 30. Derive that number, never type it —
`--dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'` — a
bare `.tasks | length` is 75.]* The failure that invites: a later surface at depth 1
copies `{ depth: 2 }` from `build.mjs:84`, and every stylesheet, both font
preloads and `pdp.js` 404 on 240–500 pages with nothing red. The vanilla PDP
also has no pre-merge variant-master identity guard — the mechanism every
other variant×surface pair has — so its "matches all four masters" rests on a
one-time in-process check too. (Re-verified 2026-08-14: all four masters and
in fact all 740 pages still match in both snapshots. It is an unguarded TRUE
statement, which by this repo's own record-not-code standard is the defect.)
Both gaps are owed by the PDP's remaining work.

### What did NOT land, and why

The unit is **not** complete. Landed: both obligations, Task 0, the spec
layer, and the vanilla variant. Not landed: react-next, astro and qwik; the
drift-gate and origin-suite legs for the PDP; the publication pipeline's
generalisation off `editorial-`; the interaction registry entries and the
batches.

Two of those have reasons beyond time. The **PDP byte publication is blocked**
by `bench-instrumentation-dilution` — publishing a byte headline through a
ruler now proven to under-report small cells by a third would be the confident
wrong number this project exists not to produce. And the **live-origin
demonstration cannot complete on this machine**: ADR-0002 §3 makes it the only
serve-time Discogs call, the edge Worker has no live route today (verified —
its routes are `/api/plp`, `/api/pdp/:id`, `/api/snapshot`, `/api/beacon`,
`/assets/img/*`), and arming it needs a Worker secret, which leaves this
machine and is Rob's to set. The button is wired and its output slot states
the absence plainly rather than doing nothing visible — the same rule every
unpublished number on this site follows.

The astro decision is recorded but unbuilt: **stay static, `getStaticPaths`
over the catalogue, no `@astrojs/cloudflare`**. astro is the islands exemplar
on the locked render axis; an SSR adapter would change what the column means
and confound the cross-surface comparison with a paradigm change rather than a
surface change. Its snapshot bake needs a second generated module and a
matching turbo `outputs` entry, or a cache hit ships a page importing a module
that isn't there.

The CSS-delivery ambiguity in ADR-0003's addendum ("the PDP/PLP builds",
plural, no owner) is resolved: **the PLP owns it.** Components genuinely
multiply there, and landing it here would move astro's and Next's LCP for a
reason that is not interactivity — confounding the one comparison this surface
exists to make.

---

## Phase 12 — Two controls that did nothing (2026-08-15)

The PDP had shipped. It served 200 on ~500 URLs in production, it matched all
four masters, and turbo was 30/30 on the tree that produced it. Two of its four
advertised interactions did nothing at all.

That is the phase in one sentence, and the interesting part is not the bug. It
is that **every single check this repo owns was green while it was true.** The
drift gate compared the served markup and found it identical, correctly — the
markup *was* identical, and correct. The masters regenerated and matched. The
identity guards passed. What none of them could ask was whether pressing the
button did anything, because the gate runs **JS-off by construction** (that is
the right choice for a rendering benchmark) and because `@pm/vanilla`
contributes **zero package tasks** to turbo's 30, so nothing pre-merge had ever
read `pdp.js` at all.

### The decision, and where it went against its instructions

The handoff framed the unit as a binary per control — make them real, or cut
them explicitly — and recommended: take the cut for zoom if you must, **never**
for format, because "a store that takes the wrong format is a correctness bug".

Zoom was easy and the recommendation held: five lines, the stylesheet already
implemented the pressed state, and `aria-pressed` is not CSS-settable, so the
button had been announcing a state it could never enter. WCAG 4.1.2, live, on
the site that ships an accessibility exhibit.

Format went the other way, and it is worth being precise about why, because the
argument came from data nobody had looked at. **A Discogs `formats` array is
not a menu.** It is the composition of one physical release — what is in the
package. The repo says so in its own sources: the schema types `format` as the
*primary* label, capture builds it from `formats[0]`, and `priceFrom` and
`numForSale` are one apiece **per release**. Crate release 896191 is a single
$30.00 product whose three entries are two vinyl variants *and* a CD. Thirty-
nine crate releases carry a component literally named **"All Media"**, which is
Discogs' marker for exactly this.

So there was no wrong format to take an order for. There was no choice at all.
Wiring the group as specified — price, stock, meta and cart payload following
the selection — would have required **inventing a price per component**, which
is a fabricated number sitting beside a real one on a site whose whole claim is
that nothing publishes without a receipt. That is worse than a dead control,
and it is the precise shape of rigging this project exists to be unable to do.

The counter-argument the handoff raised was that cutting it guts the PDP's
claim to be where interactivity is genuine. Counting says otherwise: gallery
switch, zoom, quantity and add-to-cart remain, and both of the surface's
**planned** interactions are untouched — `pdp-gallery-switch` and
`pdp-add-to-cart`. Planned, not registered: the bench registry holds `none`,
`body-click` and `editorial-add-to-cart`, and neither PDP id exists in the
codebase yet, so the cut removed nothing the instrument was going to measure. And the cut removes nothing but the
lie: the composition now renders as data in the meta list for *every* release,
where before only single-format ones showed a format at all. The 61
multi-format crate releases gain information they never had; the 130 whose tray
records a quantity finally show it. For a single component of quantity 1 the
composition reproduces the tray's own `format` string byte-for-byte, which is
why 309 of 500 meta lines did not move while 191 did — and that equality is
now asserted rather than assumed, because two derivations of one string is two
opinions. (439 is the single-format COUNT and it is a different number; 130 of
those 439 gain a quantity prefix. This paragraph said 439 twice, three lines
below the 130 that refutes it.)

### The guards, and the one that was quietly worthless

Four landed, and all four were sabotage-proven against the tree that actually
shipped rather than against a hypothetical:

- The **controls-wired** repo-check — every script-only state attribute the
  master renders must be written by the enhancement — fails **nine ways**
  against the `pdp.js` on `main`. It is in the 30, so it blocks a merge.
- The **PDP identity guard** compares both renderers over **every** detail tray
  in **both** snapshots: 740 pages in ~90 ms. Sabotaged, it reports 1 of 240
  fixture and 152 of 500 crate.
- The **bare-glyph** guard finds **seven** instances in the masters on `main`.
- The **JS-ON browser leg**, which did not exist, headlined by a deliberately
  generic sweep: no button may change nothing when pressed.

It also found something bigger than what it was written for, and only against
a **crate-seeded** plane. The gallery's thumb strip was a flex row with no
wrap, so it could never be narrower than its content; a grid item's default
`min-width: auto` then grew the gallery column to match and pushed the whole
document sideways. Four 72 px thumbs plus gaps want 312 px in a 280 px column,
and **316 of the crate's 500 releases carry four or more images**. That is
WCAG 1.4.10 failing on the majority of deployed PDP pages, and it had survived
everything — because the fixture's probe release has **two** images, so CI had
never once reached the case. One line of `flex-wrap: wrap` takes the document's
scrollWidth at 320 px from 332 to 320 on a four-image release and from 412 to
320 on a five-image one. The leg now probes the *widest* gallery in whatever
snapshot is served, and fails closed if that is under four images. **The
fixture is not a scale model of the crate**, and a test pointed at "some
release with a gallery" was proving nothing.

That last one is the phase's second lesson, and it was self-inflicted. Its
first draft compared `document.body.innerHTML` before and after each click —
and it **passed against the build with the dead Zoom button**. The injected
chrome's HUD writes a live LCP readout after the first interaction, so *every*
click changed the body. Measured, not guessed: the first difference was
`data-pm-hud-live="LCP"` going from "–" to "60ms". A guard written to catch
this exact class of defect was itself vacuous, in this exact class of way,
against this exact defect.

The repair was to scope the probe to `.pm-page` — the same boundary the drift
normalizer draws, for the same reason — and to add the assertion that should
have been there first: **the probe must be still when nothing is pressed.**
With that, the sweep immediately produced a *second* false positive, flagging a
decrement button clicked at its input's minimum. That is a control correctly
refusing, not an inert one, so the sweep now primes each control before probing
it — number inputs to mid-range, an exclusive selector's siblings switched
first — with both rules stated in terms of what the markup is rather than which
control it is, so they keep working for controls nobody has written yet.

### The pass caught a regression this phase INTRODUCED

The most useful thing the adversarial pass did was not confirm the work. It
found a defect created by the repair.

`.pm-sr-only` — the class that makes a named glyph *hidden* — lived in
`components/gallery.css`, and **only the PDP links that sheet.** The moment
the glyph repair put visually-hidden text on the PLP master (five instances)
and checkout's cart total, those pages had no rule to hide it with: text
written exclusively for screen readers would have rendered as visible
"— No price listed". A repo-wide grep would have said the class existed. It
did. It just did not exist on the page using it.

The utility moved to `surfaces/shell.css`, which every surface links, and the
general guard is now `master-styles-resolve`: **every `pm-` class a master
renders must resolve to a rule in a sheet that master links.** That is the
`pm-pdp__scroll` defect made impossible, and it is sabotage-proven against
both — remove the scroll rule and four masters fail; rename the utility and
six do. Its own first draft got two things wrong that are worth keeping on the
record: it matched class names with `String.includes`, so `.pm-sr-only` was
"defined" by `.pm-sr-only-MOVED` and the sabotage proof PASSED; and it matched
inside CSS comments, where this package names classes constantly.

The same pass also found that the INSTRUMENT still advertised the cut control
— `SURFACE_CONTROLS.pdp.proves` read "gallery, cart, quantity, format" and is
served into every measured page — and that all three new guards were
vanilla-hardcoded, invisible today and worthless the moment a second PDP
variant lands. The browser leg now iterates the registry; the pre-merge guard
fails outright if a live variant has no registered enhancement.

### What it cost, in bytes, because a published cell moved

Two of these changes land on pages whose numbers are published, so they are
measured rather than waved at. The cart contract's uniqueness clause costs
**+262–294 B raw / +80–105 B brotli-q11** across the six cart files; vanilla's
`cart.js` ships raw and goes 1,122 → 1,205 B brotli (+7.4%). Moving the
hidden-text utility into the shell stylesheet puts **+629 B raw / +243 B
brotli on EVERY page**, editorial included — these sheets are copied to the
wire without a minifier, so a contract comment is real bytes on a real
connection, and the comments were trimmed to their load-bearing form before
the number was taken. The editorial re-run the ruler unit already owes
re-measures all of it.

### Swept up, because it is the same class

`CART_CONTRACT` had always *stated* "one entry per release id" and had never
*checked* it, so a duplicate passed validation and the two implementations then
disagreed about it: one add gave **3** on editorial (which bumps the first
match) and **4** on the PDP (which bumps every match). No writer here can
produce that value, which is exactly why it survived — an unguarded true
statement, the same shape as the 740 pages that matched. The rule now checks
what it always claimed, in all seven implementations.

And the bare glyphs: `${price ?? "—"}` and `${d.year ?? "—"}`. A lone em dash
announces as "em dash", or at the common verbosity default as silence, so
"nothing for sale" and "the price failed to render" become the same
experience — the reasoning the tracklist had applied to empty duration cells
since surface-design, never applied to its neighbours. The year arm was
invisible to every check that exists because all four resolved masters have
years.

Decisions of record: **ADR-0008 addendum A**, which also amends ADR-0002's
propagated interaction guardrail. The next unit is unchanged:
`bench-instrumentation-dilution` — the ruler — which still hard-blocks any PDP
byte publication.

### `pdp-controls` — narrative moved from the decision map (2026-09-25)

The decision map's `pdp-controls` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **RESOLVED (2026-08-15)** — branch `pdp-controls` off `5f26a6e` (main after PR #25 merged `record-repair`). Turbo **30/30**; `@pm/reference` **37/37**; origin suite green in BOTH modes on the final tree.

- **Format radio group → CUT.** *This reverses the handoff's explicit recommendation ("never take the cut for format"), on evidence that recommendation did not have.* A Discogs `formats` array is the **composition of one physical release**, not a menu: `schema.ts:45` types `format` as the *primary* label and `normalize.ts:127` builds it from `formats[0]`; `priceFrom`/`numForSale` are **one per release**; crate `896191` is one $30.00 product whose three entries are two vinyl variants and a CD; **39** crate releases carry a component named "All Media". Wiring price/stock/cart to the selection was therefore **impossible without inventing per-format prices** — a fabricated number beside a real one, on a site whose first rule is that nothing publishes without a receipt. The interactivity claim survives the cut: gallery switch, zoom, quantity and add-to-cart remain, and **both PLANNED interactions are untouched** (`pdp-gallery-switch`, `pdp-add-to-cart`). Precise, because an earlier draft said "registered": `INTERACTIONS` (`collect.ts:33`) holds `none`, `body-click`, `editorial-add-to-cart` and nothing else — neither PDP id exists in the codebase yet, so the cut removed nothing the instrument was going to measure. The DATA survives too, and grows: the meta list now carries the full composition for **every** release (`lib.mjs formatComposition`), where before only single-format ones showed a format at all. For one component of quantity 1 the composition reproduces `format` byte-for-byte, so **309 of the crate's 500** meta lines are byte-unchanged and **191 move** (239/1 in the fixture) — computed over every tray, not reasoned. (An earlier draft of this line said 439, which is the single-format COUNT, not the unchanged count: 130 of those 439 gain a `N × ` prefix. Caught by re-deriving instead of re-reading — the class this repo keeps paying for.) **ADR-0002's propagated guardrail is amended, not dropped:** the measured interaction set is now gallery/zoom, add-to-cart with client cart state, and quantity.

- **The gallery thumb strip → WRAPPED (found by the new guard, on CRATE data only).** The strip was a non-wrapping flex row, so the gallery column grew to its content and pushed the **document** sideways: four 72 px thumbs plus gaps need 312 px in a 280 px column. **316 of the crate's 500 releases have ≥4 images** (1–5: 90/64/30/71/245), so this was live WCAG 1.4.10 on the majority of deployed PDP pages. Measured at 320 px, `scrollWidth` goes **332 → 320** (4-image) and **412 → 320** (5-image). It survived because the fixture's probe release has **two** images — CI never reached it. The reflow leg now probes the **widest** gallery in the served snapshot and fails closed under four images (fixture 9000016 has five). **The fixture is not a scale model of the crate.**

**The gap that let them ship, and the three guards that close it.** The drift gate is **JS-OFF by construction** — both dead controls had correct, identical, gate-passing markup the whole time — and `@pm/vanilla` contributes zero *package* tasks to turbo's 30, so no pre-merge check read `pdp.js` at all. All three guards are **sabotage-proven against the tree that shipped**:

1. `repo-checks/pdp-controls-wired.test.ts` — every script-only state attribute the master renders must be written by the enhancement; every control must be named by it or listed in a reasoned native-behaviour registry. Against the `pdp.js` on `main` it fails **nine** ways. In the 30, so it **blocks a merge**.

2. `variant-master-identity.test.ts` gains a fourth describe: `renderPdp` vs `renderPdpPage` for **every** detail tray in **both** snapshots — **740 pages in ~90 ms**. Sabotage-proven (1/240 fixture, 152/500 crate).

4. `repo-checks/master-glyph-names.test.ts` — no committed master ships a bare glyph as an element's whole content. Against the masters on `main` it finds **seven** across three sites (the PDP's unpriced amount, five PLP release-card prices, checkout's cart total). It does NOT find the null-year site — no committed master renders that arm; that one was found by reading, and the file says so.

5. `repo-checks/master-styles-resolve.test.ts` — **every `pm-` class a master renders resolves to a rule in a sheet THAT MASTER LINKS.** (CSS cost of the move, recorded because it lands on a published cell: `shell.css` +629 B raw / **+243 B brotli-q11 on EVERY page**, `gallery.css` +822/+376 on PDP pages only. Sheets are served raw, so a contract comment is wire bytes; comments were trimmed to load-bearing form first.) Added because the verification pass caught a regression this slice INTRODUCED: `.pm-sr-only` lived in `components/gallery.css`, which only the PDP links, so `namedGlyph`'s hidden text would have rendered VISIBLY on the PLP (5×) and checkout (1×). The utility moved to `surfaces/shell.css` (linked by `head()` everywhere). Sabotage-proven against both instances, including the original `pm-pdp__scroll`. Three pre-existing unstyled classes sit in a frozen `OWED` registry that itself fails if it stops matching reality.

**The instrument advertised it too:** `SURFACE_CONTROLS.pdp.proves` — rendered into every measured page — said "gallery, cart, quantity, format" and is now "gallery, zoom, quantity, cart". Amending the documents and leaving that string would have had the chrome advertise an interaction the surface lacks, served to visitors. The three new guards were also vanilla-hardcoded: the browser leg now runs `describe.each(SURFACE_CONTROLS.pdp.variants)` (the cart-suite idiom) and the pre-merge guard keeps a variant→enhancement map with a completeness assertion that FAILS when a live variant has no entry — sabotage-proven by moving astro live.

**The generic sweep was vacuous on its first draft, and that is worth recording:** scoped to `document.body`, it PASSED against the dead-zoom build, because the injected chrome's HUD writes a live LCP value after any interaction (measured: `data-pm-hud-live="LCP"` "–" → "60ms"). Scoping it to `.pm-page` — the same boundary the drift normalizer draws — plus an explicit **quiescence assertion** (the probe must be still when nothing is pressed) makes it real. It then flagged a second false positive, a decrement button at its input's minimum, which is a control correctly refusing rather than an inert one; the sweep now **primes** each control (number inputs to mid-range; an exclusive selector's siblings switched first) using rules stated in terms of what the markup is, never which control it is.

**Also landed:** `CART_CONTRACT` gains a **uniqueness** clause — it had always *stated* "one entry per release id" without checking it, so a duplicate passed validation and one add gave **3 on editorial** (first match) and **4 on the PDP** (every match). Now checked in all seven `read()` implementations. Cost, re-derived over all six cart files: **+262–294 B raw / +80–105 B brotli-q11**. Vanilla's `cart.js` ships raw and goes **1,122 → 1,205 B brotli-q11 (+7.4%)**, ~+5% of the published 1.69 KB editorial cell. Two limits: react-next/astro/qwik are BUNDLED, so their source delta is an upper bound on wire bytes; and Cloudflare compresses worse than local q11 (3.68× vs 4.46×) — the mismatch `bench-instrumentation-dilution` exists to settle. That unit's re-run absorbs it. Bare glyphs repaired in `pdp.mjs` (price, year), `shell.mjs` `releaseCard`, `checkout.mjs`, and the five variants' re-typings of the card — the card and checkout repairs are **byte-neutral on every page served today** (no featured release is unpriced in either snapshot), so no editorial receipt is touched by them.

**verify-slice: 4 lenses, 23 findings (8 / 7 / 3 / 5), ALL adopted** (run `wf_7911d7e7-416`; tool-derived from the journal). It earned its keep on this slice more than on any before it, because three of the findings were defects the SLICE ITSELF created or claims the slice's own artifacts refuted: (1) the `.pm-sr-only` regression above — a BLOCKER, caught before merge; (2) the served chrome still advertising the cut control; (3) a string of numbers I had written and not re-derived — "439 unchanged" (twice more, after I thought I had fixed it), the byte cost stated for 6 files from a 3-file sample, "seven masters" for a six-master sabotage, and an ADR-0002 section cite that was §4 not §5. Also closed: the guards were vanilla-hardcoded; `SCRIPT_ONLY_STATE` omitted `aria-current`, the second script-only state on the page it guards; nothing compared a variant's STYLESHEET LIST to the master's — the exact axis this unit changed — which is now a sabotage-proven test; and the build-log narrative omitted the fifth guard, the introduced regression and the CSS cost. **`findings-<lens>.md` files WERE written this run** (3 of them, structured, with "VERIFIED TRUE" and "ALREADY FIXED" sections the journal never carries) — the first time the disk-streaming resilience has actually engaged.

## Phase 13 — The ruler stops flattering the house (2026-08-15)

This unit's entire product is a more honest number, and its failure mode is
publishing a differently-wrong one with more confidence. The defect it
existed to fix was already stated on the methodology page: the byte ruler
split the document's compressed transfer by each part's share of the
*uncompressed* bytes, which is exact only if every part compresses at the
document's average ratio. The injected chrome — 62.6% of the astro page's
uncompressed bytes, and the most compressible thing on it — violated that
hardest, so the instrument over-charged itself and quietly discounted every
cell it measured, most of all the small JavaScript numbers this site leads
with. That is the shape a hostile reader calls rigging, and it was visible
in the site's own receipts: astro's published cell moved 0.42 → 0.37 KB
between batches when only the chrome had grown.

### The estimator was the unit's open question, and measurement closed it

The handoff recorded the fix as unsettled between two methods that
disagreed by a third (34–47%). Neither won. The settled rule: transfer size
stays the authority on the total; each part's share is its **leave-one-out
marginal** — what the compressed document loses when exactly that part is
removed — computed at the brotli quality that reproduces the observed wire
body, re-derived per document and recorded per run with its residual. Two
probes decided it, both built from the live plane's own pages: swap the
chrome on a fixed page (the recorded defect's shape) and the old rule moves
the JS cell 14.1% while leave-one-out moves it 0.3%; inline a copy of
vanilla's real `cart.js` and the old rule reads 40.5% below what the
identical file costs served externally, while leave-one-out lands within
2.2%. The runner-up mattered too: the "fix as written" (compress each
region alone, normalise) carries a measured small-region bias — the astro
bundle compresses 2.23× alone against 3.68× in context — and lost on both
probes. Shapley attribution was computed and rejected: no better, three
times the work, game theory where a marginal will do. And the
local-vs-Cloudflare compressor mismatch the ticket carried as an open risk
collapsed under calibration — q4 reproduces the Cloudflare wire within
0.1–0.3% on all three delivery shapes. The old rule's under-report, with
the estimator settled: **40.5–47.5%** on the measured cells.

### The two holes addendum N filed are closed by mechanism, not memory

The chrome constant used to describe whatever fragment was serving when
the probe ran, while the build regenerated a different one from the
receipts — its own `populated` gate structurally re-incurred the staleness
it existed to prevent. The probe now records the fragment's hash and full
render context; the front build re-renders the fragment it will actually
ship — the real renderer against the very lab bundle the Worker imports —
and refuses to build when the hashes differ. And nothing used to tie a
receipt's commit SHA to the code a remote plane was serving: the plane now
attests its build at `/_pm/build.json` (re-stamped at both serving paths,
because a turbo cache replay carries the SHA of the commit that built it),
and the runner records the attestation beside the local pin and refuses a
cross-tree batch or probe unless the escape is passed explicitly — in
which case the artifact shows the disagreement in plain sight. The refusal
was proven against the real plane, which predates its own attestation and
is refused by name.

Every committed receipt is invalidated by the ruler change; the cells stay
live behind the methodology page's floors caveat (caveat, never pull), and
the third batch re-run — post-merge, on a quiet machine, one nonce, ~7
minutes — replaces them with numbers that carry their own attribution
record and origin attestation by construction.

Decisions of record: **ADR-0001 addendum O/P/Q**, with addendum G's
attribution rule superseded in place.

### The re-run, and the codec the wire changed to (2026-08-16/17 coda)

The ruler merged, deployed green, and the owed third batch promptly proved
the unit right in a way nobody predicted: the first attested batch came
back unpublishable because every document had ridden a **zstandard** wire.
Chromium negotiates zstd and Cloudflare serves it; every wire the
estimator's evidence had measured was brotli, because curl-shaped clients
ask for br. The gate built against a hypothetical gzip proxy caught the
actual CDN on its first real run — which is the difference between a rule
and a reflex. The estimator generalized the way its own principle demands
(the marginals are priced by the wire's own codec — zstd level 2
reproduces Cloudflare's zstd serving within 0.08%), a second batch paid
the dirty-pin trap, and the third ran clean at the merge SHA: one date,
one attested SHA, 210 conforming runs. The corrected cells published:
astro's headline moved 0.37 → 0.76 KB — the dilution, undone in public,
with the receipt chain to prove it. The floors caveat left the
methodology page in the same commit as the receipts that made it false.

### `bench-instrumentation-dilution` — narrative moved from the decision map (2026-09-25)

The decision map's `bench-instrumentation-dilution` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **CLOSED (2026-08-17). Ruler landed (ADR-0001 addendum O/P/Q + the codec coda), merged and deployed; the third batch re-ran on the fixed ruler at the attested merge SHA and the corrected cells are published (astro 0.37 → 0.76 KB — the dilution undone in public). The wire itself changed codecs mid-unit (Chromium negotiates zstd) and the unit's own gate caught it — the estimator now prices by the wire's own codec.** The estimator is settled and implemented, both addendum-N anti-rigging holes are closed by mechanism, and the PDP byte-publication block dissolves on merge: any receipt minted from here on carries the fixed ruler (`kb.docAttribution`) and origin attestation (`originCommit`) by construction. The LIVE editorial cells still carry old-rule numbers until the re-run (runbook in addendum O; ~7 minutes measured, plus the two-pass chrome-constant cycle addendum P now enforces); the `/methodology/` floors caveat stays up until then.

**Measured on the live plane, 2026-08-14, RE-DERIVED 2026-08-14 against the served body** (`/astro/editorial/`). The first draft of this paragraph mixed two rulers: it quoted node-brotli-q11 re-compressions (document 4,290 B, instrumentation 1,885 B) as if they were the wire, and derived a "current rule yields 282.9 B" that contradicts the receipt's own published cell. Corrected, with the three quantities kept separate:

- **Uncompressed**: document 19,289 B, of which instrumentation is **12,076 B (62.6%)**, astro's inline cart bundle 1,278 B.

- **Cloudflare wire body** (`curl -H 'Accept-Encoding: br'`, saved and byte-counted): **5,243 B** — the document compresses **3.68×**.

- **node-brotli-q11 of the same body**: 4,321 B (4.46×). **Cloudflare compresses materially WORSE than local brotli at q11**, so any ratio taken from local brotli carries a quality mismatch. This is why the earlier figures were wrong and why the fix's normalisation claim below needs narrowing.

The defect is unchanged and real: the rule hands instrumentation a share proportional to its *uncompressed* size, so instrumentation is over-attributed and **every other bucket is under-attributed**, and the bias scales with the chrome.

**The magnitude is NOT settled, because it depends on the estimator — and that is the ruler unit's central decision.** Measured on the served body above:

| Estimator | astro's JS cell | under-report |

|---|---|---|

| Current rule (uncompressed share) | 347 B | — |

| **The fix as written** (brotli each region in isolation, normalise to `transferSize`) | **660 B** | **47.4%** |

| Ticket's earlier `(T − I_wire) × J / (D − I)` under node-brotli ratios | — | 33.6% |

So the honest range is roughly **34–47%**, and the two methods disagree by a third. **Isolated-region brotli has a known upward bias for small regions**: astro's 1,278 B bundle compresses only 2.2× alone against the document's 3.68× in context, because compressing it in isolation throws away the shared context it actually rides. The isolated parts also sum to only 0.868× of the wire total, so normalisation scales every part up by ~1.15. A leave-one-out marginal estimator removes that bias and is the obvious alternative; it needs care, since the carve-outs are non-contiguous and the marginals do not sum to the whole either.

**Correction to the fix's own claim:** "local brotli gives the ratios, `transferSize` stays the authority on the total, so no local-vs-Cloudflare quality mismatch leaks into the published number" is **too strong**. Normalising to `transferSize` fixes the LEVEL. It does not fix the between-region RATIOS, which are still taken from a compressor demonstrably different from the one that served the bytes (3.68× vs 4.46×). The ruler unit must either measure at Cloudflare's actual quality, or publish the residual ratio risk as a stated limit.

The bias is not static: it scales with the chrome. That is directly observable in this project's own receipts — astro's published initial JS moved **0.42 → 0.37 KB between the first batch and the 2026-08-14 re-run with no astro change**, because the chrome the plane serves grew from the empty state to the populated one. The direction flatters the site's leading claim (the smallest JS cell is the fit sentence's opener and the minimum of home's published spread), which is exactly the shape a hostile reader is entitled to call rigging.

**Scope of the fix** *(as first drafted — the isolated-region rule this paragraph proposed was rejected by measurement; see the Answer above)*. Attribute each part by its OWN compressed size rather than its uncompressed share — brotli each carved-out region locally and normalise so the parts still sum exactly to `transferSize`. Keep largest-remainder for exactness and non-negativity. Needs an ADR-0001 addendum superseding G's rule, and it **invalidates every committed receipt** — the editorial batch re-runs a third time on the fixed ruler, which is cheap (~7 minutes for all three profiles, measured this session).

## Phase 14 — The flip's build-out: three more PDPs (2026-08-21 — )

The pdp-variants unit continues the `pdp-build` ticket: react-next, astro
and qwik PDPs against the four-master spec layer, one variant per slice on
one branch (the pdp-build multi-commit precedent), with the shared PDP test
scaffolding landing in slice 1 parameterised over
`SURFACE_CONTROLS.pdp.variants` — plus registry-completeness ties in every
new guard, so a later slice extends the coverage by registering, never by
remembering to edit test files.

### Slice 1 — react-next (the villain flips first)

The route is the settled URL contract made Next-shaped:
`/react-next/pdp/{slug}/` is `force-dynamic`, parses the leading id, fetches
the tray through the variant's own EDGE binding, and 404s a slug mismatch —
with **no `loading.tsx` and no `Suspense` anywhere on the route**, because
streaming locks the HTTP status before `notFound()` can set it (Next's own
docs; DIFF-TO-STARTER point 28). One Next 16 behavior had to be measured
around: `notFound()` thrown during METADATA resolution bails to the
`__next_error__` document instead of the segment boundary, so the metadata
function titles the 404 and the page component owns the throw. With
multiple root layouts the 404 body is Next's own error shell either way
(the branded boundary reaches hydration only) — accepted and recorded
rather than worked around, because the alternatives (middleware, React 19
precedence-hoisted styles) change the EDITORIAL serving path whose
published receipts are pinned, and the STATUS is the whole cross-paradigm
contract.

The stylesheet parameterisation is the astro `css`-prop precedent in this
framework's idiom: route groups `(editorial)`/`(pdp)`, each root layout
passing its surface's list to one shared `Document`. The interactions are
three client islands — gallery (thumb switch + zoom, stage width/height
pinned to the first image), purchase (an UNCONTROLLED qty input, the DS
state-on-native-attribute rule, clamped on the NATIVE change event), and
the live-origin plaque button with vanilla's copy verbatim.

**The headline finding — no gate covers this class, and it was caught by
measuring:** adding the PDP route grew the EDITORIAL page's served chunks
by **7,984 raw bytes** of PDP island code, on the variant whose editorial
initial-JS cell (154.98 KB) is published and pinned. The mechanism is
Turbopack grouping client components by their importing SERVER module —
one `render.tsx` importing all six islands put the PDP's code into
editorial's shared chunks. Three measured splits brought it to byte-parity:
`PdpArticle` + islands into their own server module (`pdp.tsx`); a fully
SELF-CONTAINED `pdp-cart.ts`, because merely importing cart.ts's helpers
kept `announce`/`CART_KEY` from being tree-shaken out of editorial's chunk
(+494 raw, prettified-diff-verified); and `pdp-format.ts` split out plus an
INLINED shell skeleton in the PDP error boundary, because a second client
importer of `Shell` registered it as a named export (+76 raw). Final
state, tool-verified against production: 7 of 8 editorial chunks
NAME-identical (content-hash names ⇒ byte-identical), the 8th
SIZE-identical at 4,703 bytes with exactly one renumbered Turbopack module
id — the irreducible floor of adding a route. The leak CLASS is now a
suite leg: no editorial chunk may carry a PDP island marker.

The slice also paid down what pdp-build left owed for BOTH live variants:
`pdp.test.ts` (serving legs, fail-closed arm derivation, URL-contract 404s,
per-variant slash/encoded-spelling pins — vanilla 307-normalises what
react-next's decoded params accept as 200, the same platform class as
307 vs 308, pinned as measured — transport parity, and the
stylesheet-list-from-served-bytes leg) and the drift-gate PDP legs (the
four masters re-rendered from the RESOLVED snapshot via the one
`pdpMasterIds` derivation; the fenced plaque is CANONICAL content on this
surface and is COMPARED, never dropped; pixels run rich×3 profiles +
degenerates×1, a recorded scope choice).

**verify-slice earned its keep twice on one slice** (run `wf_86c59859-909`;
the first pass died on the session limit after ONE lens and the
sequential-durability design held — the dead lenses' empty findings arrays
were read as dead runs, not clean passes, and re-ran after the reset). Six
distinct findings adopted: the pdp.test.ts "rich" arm resolving to the
fixture's UNPRICED release (the price assertion guarded into silence in
CI, and no leg anywhere asserting an ENABLED add-to-cart — the two-arms-
one-page shape); the qty clamp riding blur where vanilla rides the native
change event (reproduced as an Enter-commit divergence, 2501 vs 99, fixed
natively, and the browser suite now presses Enter per variant so the
rejected draft cannot return green); two record-not-code corrections in
DIFF-TO-STARTER (the byte-freeze sentence overclaiming "unchanged" against
the measured 7-of-8 state, and the superseded blur-clamp text the next two
slices would have implemented from); the PDP error boundary shipping the
cart badge slot with nothing able to fill it (CART_CONTRACT's populate
clause — a self-contained badge read now runs, keeping the chunk freeze);
and the missing PDP transport-parity leg. One finding refuted with
evidence: the claim that the stylesheet-list wiring "cannot block a merge"
— CI's origin job runs the full suite pre-merge, and the served-bytes leg
fails a mis-wired layout there.

Slice-1 tree state, tool-derived: turbo **30/30**; repo-checks 95 passed /
1 skipped (react-next PDP identity guard: every tray, both snapshots,
sabotage-proven at 240/240 + 500/500 drift on a one-word change);
pdp.test.ts + pdp-controls.browser **37/37** on the held fixture plane;
full fixture origin-suite count recorded at commit time in the handoff log.

### Slice 2 — astro (the islands variant renders the whole catalogue)

The second baked module is the slice's structural move: `prepare-build.mjs`
resolves EVERY detail tray into `src/data/pdp.json`, `getStaticPaths` mints
one static page per release — 240 fixture pages in 331 ms, the build-time
paradigm's honest cost, measured and published rather than avoided — and
the module is BOTH turbo-outputs-declared and gitignored. Both halves
matter, and verify-slice caught the second missing: the snapshot.json
lesson had been applied by half, and an untracked-but-not-ignored build
output feeds the build's own turbo input hash (`$TURBO_DEFAULT$` hashes
untracked files), so every fixture↔crate flavor switch would have
invalidated the very cache the outputs entry exists to serve — plus a
558 KB generated payload sat one `git add` from being the stale-committed-
copy hazard the .gitignore names.

The editorial byte-freeze rule from slice 1 held mechanically here:
`scripts/pdp.ts` re-implements the whole enhancement self-contained (the
vanilla pdp.js precedent — a module shared between two page entries is a
chunk-extraction candidate, and extraction would flip editorial's INLINED
0.76 KB bundle to an external fetch outright). Proof, both directions: the
built editorial HTML is byte-identical before/after the bake (cmp), and an
independent probe found the served vanilla and astro PDP article regions
byte-identical (5,269 chars) modulo the declared whitespace freedom. The
suite leg guarding the freeze pins DELIVERY SHAPE — exactly one inline
module script, zero non-`/_pm/` external scripts — because verify-slice
showed markers alone cannot catch extraction: extracted CART code carries
no PDP marker.

Guards, all sabotage-proven or fail-closed: the Container-API identity
guard covers every tray in both snapshots in ~2.2 s (240/240 + 500/500
drift on a one-word sabotage), the stylesheet-list leg, a page-level
pass-through proof (the editorial page-test's twin — getStaticPaths
enumeration + page-vs-component render equality), and a slug-uniqueness
guard for the assumption three derivations had been leaning on unguarded.
The registry-completeness ties did their job in the mechanical direction:
moving astro `planned → variants` failed the drift and serving suites
until both gained their astro legs, which is the direction the ADR-0008
addendum A §4c discipline was built for.

verify-slice `wf_30f57d1a-197` ran in two passes — the session limit
killed two lenses mid-run for the SECOND time this unit, and the
sequential-durability design held both times. Seven distinct findings
adopted (the gitignore half-application, the missing astro encoded-slug
pin, DIFF point 27 undercounting the `set:html` seams, the freeze guard's
marker-only weakness, the records obligation, and the anti-rigging lens's
two LOWs — slug uniqueness and the page-level pass-through). The
conformance lens's full criterion walk passed; the seams lens returned a
genuine empty (its probe artifacts on disk distinguish it from the
dead-run empties the limit produces).

Two environment incidents, recorded because the next session will meet
them: the held plane WEDGED after ~6 hours (connections hung with no
refusal — the long-held wrangler tree class, second data point; kill and
restart is the whole cure), and the provenance gate refused a bench leg
after the slice-1 commit moved HEAD past the plane's stamped attestation —
addendum Q demonstrating itself against its own author, cured by
re-stamping.

Slice-2 tree, tool-derived: turbo **30/30**; full fixture origin suite
**431/431** (16 files); repo-checks identity + wired guards green with the
astro entries; astro workspace tests 9/9.

### Slice 3 — qwik (the resumable variant closes the set)

The route is the smallest of the three — `routeLoader$` does the
leading-id parse, the slug-mismatch `fail(404)` (BRANDED, unlike
react-next's accepted error-shell 404 — statuses shared, bodies recorded
as a divergence), and the edge-throw `fail(503)` — but the document root
was the slice's real problem. `root.tsx` renders ABOVE the router, so
`useLocation` does not exist there; the stylesheet pick reads
`useServerData("url")` — qwik-city's own mechanism, the same key its
`useLocation` reads — and derives the surface segment from
`import.meta.env.BASE_URL` rather than a hardcoded split index (the
one-prefix-declaration rule; verify-slice killed the `[2]` form).
Rejected alternatives, argued not assumed: `DocumentHead` links land
AFTER the design-system sheets and break cascade order, and wrapping the
head in a `component$` adds a serialization boundary the drift gate would
meet as noise. Editorial requests take the same `STYLESHEETS` array
through the same JSX call-site as before — served head bytes verified
identical, because that cell is published and pinned.

Two measured qwik behaviors are now recorded where the next author will
look: `aria-current` removal on client re-render needs `null`, not
`undefined` (the deselected thumb kept its attribute and two thumbs
announced selected — caught by the browser leg's exactly-one assertion;
the first "null didn't work" was a STALE BUILD from a broken `&&` chain,
re-verified from compiled chunk bytes before concluding), and `onChange$`
IS the native commit event, so the qty clamp rides Enter/spinner/blur
with no extra listener.

The byte-freeze rule held by measurement, not luck: a JS-on load of
`/qwik/editorial/` fetches the same 6 chunk files with the same
content-hash names and the same 62,635 raw bytes before and after the
PDP route joined the build — rollup did not re-group. The probe JSON
artifacts behind those numbers were purged by a tmp cleaner during a
5-day session gap, so the record now carries its own provenance: the
POST state is re-derivable live (the suite's chunk-freeze leg enumerates
every referenced chunk and pins the count at 6), the PRE state needs a
rebuild at `6daa15d`. The freeze leg itself was the completion run's
biggest finding — see below.

verify-slice ran as two workflows this slice: `wf_e15bd1af-15a` (the
session limit killed it after two lenses — the THIRD kill this unit; the
durable-journal design held a third time) and completion run
`wf_55ab9563-9c0` (a fresh two-lens launch: the tmp purge ate the resume
args file, and resume requires byte-identical args). Six adopted from
the first run's lenses: the regex-anchored ` disabled` needle (the
qwik/json state script carries the bare substring on EVERY page), exact
gallery needles (the `<ul>` substring and the chrome's own
`aria-current` made the drafts unfalsifiable), the unrendered `slug`
dropped from the PDP projection, the chunk leg's second reference
channel, the `BASE_URL`-derived surface pick, and the records
obligation. Five distinct adopted from the completion run, none refuted:
the chunk-freeze leg's THIRD channel (the state script serializes QRLs
the attribute parse never sees — `on-document:qinit="#0"` is a state-REF
whose chunk name lives only in `<script type="qwik/json">`) plus a
closure over rollup's chunk-to-chunk imports and an exact pin at 6 (the
react-next twin's `toBe(8)` idiom); the astro bake guard upgraded from
id-list to DEEP equality (a field-level shrink — stripped notes,
truncated tracklists — kept every id and passed every gate; one line
closes the class the guard's own comment claimed to close); the qwik
masthead needle restored to the composite byte-form the other three
variants pin (each split half was satisfied by a DIFFERENT element — the
back-link's href, the chrome's aria-current); and the two record gaps
(freeze provenance, the decision-map paragraph). Sabotage-proving the
adopted chunk-leg fix caught a bug IN the fix: a `\b` before `q-` never
matches behind the state script's literal `\u0002` escape, which would
have silently re-limited the sweep to attribute occurrences — the exact
co-location luck the fix exists to remove.

Environment, recorded for the next session: the provenance gate refused
a bench leg for the THIRD time this unit after commits outran the
plane's stamped attestation (re-stamp `workers/front/stamp-build.mjs` is
the whole cure), and the 5-day usage-limit gap plus tmp cleaner
established the durable-notes rule — resume state lives in the home-dir
session folder now, never the scratchpad.

Slice-3 tree, tool-derived: turbo `check` **30/30** (a first run failed
while this log was being edited mid-hash — detail lost to a tail pipe,
rerun on the settled tree clean); full fixture origin suite **16 files,
468 passed, 0 failed, 24 environment-gated skips** (blog credential,
published-readings, bench REMOTE gates — the standing fixture-plane
skips); `pdp.test.ts` 82/82 against the held plane; qwik workspace tests
7/7; astro 10/10 (the tenth is the bake-completeness guard).

Unit-end crate-mode run (the re-run owed since slice 1): **447 passed,
21 failed, 24 env-gated skips** — every failure ONE root cause. The
frozen crate capture predates the `.thumb.avif` derivative class
pdp-build introduced for the gallery: 0 of its 1,817 committed
derivatives are thumbs, where the fixture holds 29 of 58 (minted when
it was regenerated). So the previously recorded ONE-failure baseline
(the data-plane sample 404 on `9861004-primary.thumb.avif`) now
surfaces through every crate PDP pixel leg whose page renders a thumb
list — 20 legs, failing on the broken-image fail-closed guard, five
404s each. The one-image master's legs PASS, being the only PDP page
with no thumb list, which confirms the mechanism from inside the
failure set. Everything else is green on the 500-tray catalogue: the
serving floor, content legs, URL contract, identity guards, and the
chunk-freeze leg. The fix is capture-tooling work — regenerate the
derivative set WITH a receipt into the provenance-managed capture, not
a quiet 900-file drop into a frozen directory — and is flagged for the
next unit rather than folded in here.

### The merge that did not deploy (2026-08-28)

PR #30 merged red, and nobody had looked. Both CI runs — the PR's own
and the merge commit's — failed the `check` job the same way: the two
react-next PDP identity sweeps (740 trays each rendered twice, React
SSR against the reference master, normalized through linkedom) timed
out at vitest's 5,000 ms default, measured 9,648 ms (fixture leg) and
8,903 ms (crate leg) on the ubuntu-latest runner against ~1 s each
locally. The `deploy` job was therefore SKIPPED, so the plane kept
serving the pre-merge `28d01fc` state — probed to confirm:
`/qwik/pdp/` 404s in production while `/vanilla/editorial/` serves.
The handoff line "the merge triggered a deploy" was written from the
merge event, not the CI result; the post-deploy smoke it owed forward
could never have run.

The cliff is runner speed, not the guard. Two drafts of this fix were
wrong before the third was right, and both errors are the same error:
**extrapolating a runner time instead of measuring one.**

Draft one copied the qwik sweeps' existing `60_000` onto the
react-next and astro legs, sizing it from a "~8× slowdown" derived
from a test that had TIMED OUT. A test killed at its timeout reports
the time it was killed at — a lower bound, not a duration — so that
ratio had no basis. Draft two fixed the method (take the ratio from a
test that ran GREEN in the same run: `@pm/reference`'s `renderAll`,
450 ms on the runner against 50 ms here, 9.0×) and then over-trusted
the result, projecting every sweep at that one scalar and concluding
that qwik's crate leg sat at 58.3 s against its own 60 s budget — a
1.0× margin, and therefore a second cliff nobody had hit.

**The PR's own CI run falsified that.** This is the first run in which
these legs have ever executed, and it measured them directly:

| sweep | local | PROJECTED at 9.0× | ACTUAL CI | real ratio |
|---|---|---|---|---|
| vanilla fixture | 35 ms | 0.3 s | 0.52 s | 14.9× |
| vanilla crate | 66 ms | 0.6 s | 0.68 s | 10.3× |
| react-next fixture | 878 ms | 7.9 s | **13.61 s** | 15.5× |
| react-next crate | 1,771 ms | 15.9 s | **15.44 s** | 8.7× |
| astro fixture | 739 ms | 6.7 s | 2.78 s | 3.8× |
| astro crate | 1,676 ms | 15.1 s | 3.96 s | 2.4× |
| qwik fixture | 2,748 ms | 24.7 s | **26.07 s** | 9.5× |
| qwik crate | 6,480 ms | **58.3 s** | **13.51 s** | 2.1× |

Three claims this log made are retracted against that table. The qwik
crate leg is 13.51 s, not 58.3 s, and had **4.4× margin** under the
old 60 s budget — it was never near a cliff. "Fixing repo-checks alone
would have moved the red one package down" is therefore **false**:
`@pm/qwik:test`'s worst leg is 26.07 s, well inside 60 s. And astro's
legs, which draft two said the 5 s default would fail, actually come in
at 2.78 s and 3.96 s — *under* the default, though the crate leg's
1.26× margin is a flake waiting to happen rather than a pass.

What survives is the original diagnosis and a better reason for the
number. react-next's legs genuinely exceed the 5 s default at 13.61 s
and 15.44 s: that IS the failure that skipped PR #30's deploy. And the
real ratios span **2.1× to 15.5× on one runner in one run**, which is
the durable finding — a single scalar cannot model this, so no
per-test budget fitted to a local timing can be trusted. The ordering
even inverts: qwik's crate leg is slower than its fixture leg here and
FASTER on CI, because first-test compile cost dominates on the slower
machine.

So the budget is set to catch a HANG rather than fitted to an
extrapolation the data shows cannot be done reliably. All four heavy
catalogue sweeps take the bench runner's existing `300_000`: **11.5×
margin on the measured worst leg** (qwik fixture, 26.07 s) while still
failing a genuinely stuck render in five minutes. Vanilla stays on the
default at 0.52/0.68 s measured, 7.4× margin, and a budget it cannot
need would be noise. No assertion changes anywhere; turbo `check`
30/30 locally and green in CI.

One commit on branch `ci-sweep-timeouts`, unpushed. It blocks
everything: the PDP variants reach production only after this lands
green, and the units below stack on it.

### The crate's missing thumbs, and what "missing" turned out to mean (2026-08-28)

The unit was scoped as "regenerate the derivative class the frozen
capture predates" — and the first discovery corrected the diagnosis
in the record. The capture does NOT predate the thumb tier: the
committed `images-index.json` has carried all 1,817 thumb entries
(sha256, bytes, true dimensions) since `a886de1`, the 2026-07-17
ADR-0008 spec-layer commit that introduced the tier, and the deployed
R2 bucket serves the thumbs today (probed: the very sample the
crate-mode suite 404s on locally answers 200 in production, bytes
matching the index pin). Only this machine's untracked `img/`
directory lacked the files. How it came to lack them is not
established — the likely story is that the spec-layer session's
worktree held the real `img/` directory and was cleaned away, so the
main checkout never received the minted files, but no deletion event
is on record and this is conjecture, labeled as such.

That reframing made the unit smaller and the proof stronger. The
committed index is a bit-level SPEC for the missing files, so
regeneration is not "mint something plausible with the same recipe" —
it is "reproduce the pinned bytes or explain why not". A one-file
probe first: minting `9861004-primary.thumb.avif` from its retained
original with the derive recipe (sharp `.rotate()` → 160×160
fit=inside, no enlargement → AVIF q50 effort 4) reproduced the index
pin exactly. Then the real tool — `pnpm capture run --until derive`,
stopping BEFORE normalize on purpose: normalize rewrites committed
artifacts (trays, index, curation) and unlinks orphans, and this unit's
contract is add-only into a frozen directory. The landed capture's
earlier phases no-op from checkpoints, and `derivePhase` mints exactly
what `exists()` says is absent: `[derive] complete (1817 new)`, 62
seconds of mtime window. (An earlier draft of this sentence said "zero
API requests", quoting the CLI's own doc comment — verify-slice caught
that the `[run] done (N API requests this run)` counter line only
prints after normalize, so under `--until derive` the claim was
asserted, not measured. What IS provable: the run's log carries no
fetch lines, the 62 s wall clock fits 1,817 local AVIF encodes and
not one rate-limit-paced request, and every minted byte re-derives
from already-retained originals, so no fetch was needed.)

The proof, all tool-derived. Add-only: sha256 manifests of `img/`
before (1,817 files) and after (3,634), compared with `comm` over
LC_ALL=C-sorted lines — 0 lines left the before set, 1,817 appeared,
every one a `*.thumb.avif`. (The first comm ran on filename-ordered
manifests and returned garbage counts — comm wants line-lexical order;
re-sorted and re-derived.) Index identity: all 3,634 files on disk now
match `images-index.json` — 0 sha256 mismatches, 0 byte-size
mismatches, 0 missing, 0 extra — so today's toolchain (node v24.13.0,
sharp 0.34.5, libvips 8.17.3, libaom 3.13.1) reproduces the
2026-07-17 provenance bit-for-bit rather than re-deriving beside it.
One receipt hazard caught mid-write: the first draft of the receipt
carried a hand-typed full SHA for the code commit and an approximated
mint timestamp — both replaced with tool-derived values (`git
rev-parse`; the minted files' own mtimes). The receipt lands as
`crate/regenerations.json`, an event log beside `curation.json`,
because the capture's own receipt covers the capture — this is a
different event class and a frozen directory should name every hand
that touched it.

Definition of done, measured: crate-mode origin suite (PM_SEED_DIR →
crate, held plane) **16 files, 468 passed, 0 failed, 24 env-gated
skips** — exact fixture parity, up from 447/21; the fixture suite
re-run untouched at 468/24/0; turbo `check` 30/30. The 21-failure
baseline recorded at the pdp-variants unit end is superseded, and the
2026-07-11 one-failure baseline (the `9861004` data-plane sample) is
retired with it — that failure was this same absence all along, it
just only had one leg to surface through before the PDP pages
rendered thumb lists.

verify-slice ran clean for once — `wf_f365845a-a57`, four lenses, all
completed, no session-limit deaths (a first for this workflow across
four units). Eleven raw findings consolidating to five distinct, ALL
adopted, none refuted outright — and every one was a receipt/record
defect, not a code defect, which on a slice whose whole product is a
receipt is exactly where the risk was: (1) the receipt's add-only
clause pinned a manifest hash an auditor could not reproduce from the
clause's own words (the hash is of the filename-ordered manifest; the
text implied line-sorted — the recipe is now stated and both before
AND after hashes pinned, the after having been missing entirely behind
a plural label); (2) the DoD's records clause was half-met at review
time — the handoff log still carried the 21-failure baseline as
standing (appended now, with the corrected diagnosis); (3) the
receipt's framing note claimed the log "exists to prevent" quiet
drops, which nothing mechanical makes true — reworded to what is
true (the log records; the crate-mode suite legs are the enforcement,
and a full disk-to-index parity guard was considered and REJECTED:
CI never holds the crate img bytes, so it could only ever pass
vacuously there, the exact guard smell ADR-0001 §9 names);
(4) "zero API requests" above; (5) `servedSample` lacked the host,
status, and date that make one-sample re-derivation possible.
One adjacent guard gap adopted from the seams lens: `.gitignore`'s
dir-only `img/` pattern did not match the worktree SYMLINK, leaving
the never-stage-this rule honor-system — the trailing slash is
dropped, proven by `git check-ignore` in both directions (symlink
ignored in a worktree, real contents still ignored in main, the
receipt file still trackable). The lenses also re-derived the
receipt's numbers independently (the before hash from the CURRENT
disk's non-thumb subset — an add-only re-proof that needs no retained
manifest) and confirmed the deployed-plane smoke path.

### The publication pipeline stops being editorial's (2026-08-28)

One line was the whole gate: `build.mjs` refused any receipt whose
filename did not start with `editorial-`, and hardcoded `"editorial"`
as the surface, `FIT.editorial` as the template, and
`_pm/lab/editorial.json` as the one artifact it wrote. That is what
held PDP byte cells behind the ruler unit's bar even after the ruler
landed — the numbers could be minted, but nothing could publish them.

The generalisation is registry-driven, not filename-driven. A new
`labBundle` flag on `SURFACE_CONTROLS` is the whole registration:
the build derives its surface roster from the flagged entries, emits
`/_pm/lab/{surface}.json` for each, and the Worker embeds each one.
Choosing the switcher registry over a new list was the ADR-0008
addendum A §4c discipline applied again — the same array that already
drives the reading-table columns, the serving floor and "Served by N
of M" now drives publication, so a surface cannot be live in the
chrome and invisible to the pipeline. The alternative considered and
rejected: infer surfaces from the receipt filenames present. It reads
simpler and needs no registry edit, but it makes a TYPO a new surface
— `edtiorial-fast-wifi-laptop.json` would silently publish a table
nothing renders, which is the vacuous-guard shape this repo keeps
paying to remove.

Surface identity is now checked three ways that must agree, replacing
the one filename check: the filename's surface half must be a
registered lab surface, its profile half must equal the receipt's own
`profile.id`, and every target's own `surface` field must equal the
surface it is filed under. The third is the one that matters — a
receipt's targets record what was actually measured, so a PDP batch
misfiled as editorial is refused by its own contents rather than
published under the wrong table. A fourth refusal was added for the
same reason the fit templates exist: a surface with no `FIT.{surface}`
entry cannot publish, because ADR-0001 addendum C wants the sentence
written WITH the batch that backs it, never ahead of it.

Batch integrity MOVED and widened. It used to run inside the
`published` branch, so it only checked when an editorial publication
existed; it now runs per surface, over every surface holding receipts.
Deliberately per-surface and never across: editorial's batch and a
later PDP batch are separate publications minted on their own days at
their own SHAs, and a cross-surface SHA check would refuse that
legitimate state.

**The pinned-cells rule, proven rather than asserted.** The whole
front `dist` was hashed before and after: of 18 artifacts, 17 are
byte-identical — `editorial.json`, all three receipts, home,
methodology, the chrome constant, fonts, the measurement bundle — and
the eighteenth is the new, empty `pdp.json`. The published editorial
cells are not "unchanged as far as the tests can tell"; they are the
same bytes. (The one volatile file, `_pm/build.json`, is the build
stamp and is excluded by name.)

Ten sabotages, each watched failing and restored. Build-side: an
unregistered surface prefix, a filename whose profile half disagrees
with the receipt, a receipt whose targets name a different surface, a
surface with no fit template, and a mixed-SHA batch (which now names
its surface in the refusal — "published editorial receipts span more
than one commit SHA"). Suite-side: unflagging editorial (the
non-vacuity leg AND the stale-artifact reverse tie both fire),
flagging `plp` without wiring it (the completeness leg fails — the
PDP_SERVING idiom doing its job), a build that emits only editorial
(the pdp bundle leg 404s), a stray bundle for an unflagged surface,
and the empty-state leg pointed at a published page to prove it is not
vacuous. An eleventh fired by accident and was worth keeping:
mislabeling a bundle's `surface` field breaks the chrome-constant
fragment-identity gate, so that pre-existing guard already covers the
class from a second direction.

A process failure worth recording, because it cost real work: the
first mislabel sabotage was restored with `git checkout --
workers/front/build.mjs`, which reverted the file to the last COMMIT —
wiping every uncommitted edit of the unit's central file. All of it
had to be re-applied. Sabotage restore now goes through a backup copy
taken before the first sabotage; `git checkout` is only safe for files
whose work is already committed, which is exactly not the case
mid-slice.

**What did NOT happen, deliberately.** No PDP receipts were minted and
no PDP cell publishes. The decision map assigns the batches to the
interaction-registry unit, and this unit generalises the pipeline
only — the PDP bundle ships empty, which is the designed state every
surface sits in between registration and its first batch, and the
suite now proves an empty bundle renders the same chrome empty state
an unregistered surface does. Home's spread still reads editorial
explicitly: the front door's measured row is the editorial batch
(ADR-0007 §4/§5), so that read is content, not pipeline, and it is
commented as such.

**verify-slice earned this slice outright** (`wf_5e2e486a-eec`, four
lenses, all completed — the second clean no-death run). Sixteen raw
findings, seven distinct, ALL adopted, none refuted. Two were defects
in the slice's own new work, and one of those was unanimous across all
four lenses:

**The registry tie stopped at SERVING and never reached the EMBED.**
The first draft kept a hand-written import list in `src/index.js`, and
nothing tied it to the registry. The proof is brutal: delete both
import lines and all 478 legs still pass, because the bundle is served
assets-first (so the served-bundle leg is satisfied) and an unembedded
surface renders the identical empty state an empty one does. So the
slice's own Worker change was unguarded, and the failure it invites is
the worst kind — a future surface publishing a receipt-backed table
that its own pages render as "No published runs yet", with a green
suite and the site's linked artifact contradicting the page. The fix
removes the class rather than guarding it: `build.mjs` now GENERATES
`workers/front/generated/lab-bundles.js` from the same `LAB_SURFACES`
roster that emits the bundles, so `labBundle` really is the whole
registration. It lands outside `dist/` (dist is served, and a module
there would be downloadable bytes on a measured plane), gitignored,
and declared in turbo's `@pm/front#build` outputs — the astro
`src/data` precedent, whose comment already documents the
undeclared-output cache trap.

**The new empty-state leg reproduced the DESCRIBED_VARIANTS
anti-pattern this repo removed once already** — while citing
PDP_SERVING as its authority. It skipped any PUBLISHED surface, so
`SURFACE_PAGE.editorial` was never dereferenced on any run: a typo'd
path passed. Worse, it was scheduled to self-disable — the day the PDP
batch lands, both surfaces are published, the loop `continue`s on
every one, and the leg passes having asserted nothing, still counting
among the green. Its own non-vacuity line was
`expect(Array.isArray(empties)).toBe(true)`, true for every possible
value including the empty array it was meant to catch. Replaced with a
both-directions per-surface leg that fetches every registered
surface's page on every run and asserts it against whatever its own
bundle carries — today editorial exercises the published branch and
pdp the empty one, so the leg proves itself on the same run.

Five more adopted. A dead guard REMOVED rather than kept: the
per-surface duplicate-receipt refusal became unreachable the moment
the filename check forced `file === {surface}-{profile}.json` (two
distinct files would both have to equal one string), and a guard that
cannot fire cannot be sabotage-proven while still advertising
coverage. Surface parsing became LONGEST-match, because first-match
would parse a future `pdp-compare-…` receipt as `pdp` and refuse it
with an instruction to rename a correct file to a wrong one. A
COLUMN-AXIS check now runs before the band-overlap early return and
compares the batch's variants to the surface's registered `variants`:
without it, a batch measuring 3 of 4 PDP variants whose bands
overlapped would publish a partial column set, every page rendering a
permanently em-dashed column under the line "Every number above links
its receipt". `labBundle` on a `singleton` surface is now refused
(ADR-0007 §5 — a singleton renders a sentence, never a table, so the
bundle could never be shown). And the completeness leg moved to
`Object.hasOwn`, the repo's idiom for client-shaped keys.

**One finding adopted as a RECORD, not a code change**, because it
belongs to the next unit: `/methodology/` states editorial's batch as
though it were the whole site's ("The current published batch ran … 5
variants × 3 profiles"). This slice is what makes a divergent second
batch legal, so the moment the PDP batch publishes, a reader on a PDP
page follows that link and reads a description of a batch that is not
the one behind the numbers they just read — falsified by the receipt
links on those very cells. **Bound obligation on the
interaction-registry unit: publishing the PDP batch requires the
methodology page's batch statement to become per-surface first.** The
copy is not changed here on Rob's 2026-07-24 precedent — a methodology
decision belongs to the unit that creates the condition, not to the
build that makes it possible.

Four more sabotages, on the adopted fixes: breaking the embed half
(the new render leg fails generically, so PDP's embed is covered the
day it publishes), a typo'd `SURFACE_PAGE` row (now fails where it
passed), `labBundle` on the a11y singleton, and a receipt missing a
variant. The longest-match fix was proven directly rather than through
a build, since today's registry has no name that prefixes another.

Tree, tool-derived: turbo `check` **30/30**; fixture origin suite
**16 files, 479 passed, 0 failed, 24 env-gated skips**; crate-mode
suite **identical at 479/0/24**. Up from 468 by 11 registry legs (2
flagged surfaces served + 5 unflagged 404s + 2 per-surface render legs
+ 2 structural; the registry holds 7 surfaces, not the 5 a first grep
suggested — `a11y` and `how-it-was-built` do not match `^  [a-z]+:`).
A correction to the standing record while counting them: all 24
env-gated skips are `blog.test.ts` credential gates, not the
"blog-credential, published-readings, and bench REMOTE" mix the
handoff prompt describes.

### `pdp-build` — narrative moved from the decision map (2026-09-25)

The decision map's `pdp-build` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **PARTIALLY LANDED — branch `pdp-build` off `7c5be98`, FOUR commits (`git rev-list --count 7c5be98..39cda09` = 4; the "three" this said was written from inside the fourth and counted only its predecessors — the same error `88bf2a2` already had to correct once), MERGED to main 2026-08-14 as `1f91d89` via a merge commit and deployed green (CI run 31836566192; `/vanilla/pdp/{slug}/` serves 200 in production).** Landed: both inherited obligations discharged + Task 0 (`b12b8d9`), the PDP spec layer — four branch-isolating masters, the `pdpMasterIds` derivation, the qty-stepper a11y fix, ADR-0008 addendum (`83effeb`), and the **vanilla** variant, matching all four masters (`c38f458`). Turbo 30/30 on the final tree. NOT landed at that merge: react-next / astro / qwik; the drift-gate + origin-suite PDP legs; the publication pipeline's generalisation off the `editorial-` filename gate; the interaction registry entries and the batches. **The branch must NOT be squashed or rebased** — `b12b8d9` carries receipts pinning `7c5be98` by hash.

**CONTINUED as the `pdp-variants` unit (branch `pdp-variants` off `28d01fc`, 2026-08-21/22; MERGED to main 2026-08-27 as `607b66c`, PR #30, a merge commit — deliberately not squashed, `6daa15d` stays reachable as the qwik freeze-proof PRE point. The merge went in RED: both CI runs (PR and main, 33132628047) failed the `check` job on the two react-next PDP identity sweeps — 740 trays through React SSR + linkedom take 9,648/8,903 ms on the ubuntu-latest runner against vitest's 5 s default (~1 s locally) — so the deploy job was SKIPPED and the live plane kept serving the pre-merge `28d01fc` state, no PDP routes. Fix on branch `ci-sweep-timeouts`, 2026-08-28 (PR #31): all four heavy catalogue sweeps take the bench runner's existing `300_000` — a budget sized to catch a HANG, not fitted to an extrapolation. **Two drafts were wrong first, and the correction is the finding: extrapolating a runner time instead of measuring one.** Draft one sized the budget from a TIMED-OUT test (whose reported time is a lower bound, not a duration); draft two fixed the method (ratio from a CI-GREEN test — `@pm/reference` renderAll, 450 ms CI / 50 ms local = 9.0×) then over-trusted that single scalar and concluded qwik's crate leg sat at 58.3 s against its own 60 s budget. **PR #31's own CI run — the first in which these legs ever executed — falsified that.** Measured CI: vanilla 0.52/0.68 s, react-next **13.61/15.44 s**, astro 2.78/3.96 s, qwik **26.07/13.51 s**. So the qwik crate leg is 13.51 s with **4.4× margin under the old 60 s** (never near a cliff), "fixing repo-checks alone would have moved the red one package down" is **FALSE**, and astro's legs actually sit *under* the 5 s default (though the crate leg's 1.26× margin is a flake risk). What survives: react-next's legs genuinely exceed the default at 13.61/15.44 s — that IS the failure that skipped PR #30's deploy — and the real ratios span **2.1×–15.5× on one runner in one run**, which is the durable finding: no single scalar models this, so no per-test budget fitted to a local timing can be trusted. `300_000` gives **11.5× margin on the measured worst leg** (qwik fixture, 26.07 s). No assertion changes; turbo 30/30 and CI green. **Unit-end crate-mode baseline WIDENED and recorded:** 447/492 with 21 failures of ONE root cause — the frozen crate capture predates pdp-build's `.thumb.avif` derivative class (0 of 1,817 files are thumbs vs the fixture's 29 of 58), so the old one-failure baseline (the `9861004` data-plane sample) now surfaces through every PDP pixel leg whose page renders a thumb list; the one-image master's legs pass, confirming the mechanism from inside the failure set. Regenerating the derivatives is capture-tooling work with a receipt, owed forward — not a quiet file drop into a provenance-managed directory. **RESOLVED 2026-08-28 (branch `crate-derivatives`), with the diagnosis corrected:** the capture does NOT predate the thumb tier — `images-index.json` has carried all 1,817 thumb pins since `a886de1` (2026-07-17, the spec-layer commit) and deployed R2 serves them (sample probed, bytes == pin); only this machine's untracked `img/` lacked the files (mechanism of loss unrecorded — likely a cleaned worktree held the real dir; conjecture, labeled). Re-minted via `pnpm capture run --until derive` (normalize deliberately NOT run — it rewrites committed artifacts and unlinks orphans): 1,817 new files in 62 s, add-only proven by before/after sha256 manifests (0 mutated, 1,817 added, all thumbs), every disk file matching the committed index bit-for-bit (0 hash/byte mismatches over all 3,634), receipt at `crate/regenerations.json`. Crate-mode suite **468 passed / 0 failed / 24 env-gated skips — fixture parity**, fixture suite unchanged at 468/24/0, turbo 30/30. Remaining for the NEXT units, deliberately not folded in: ~~the crate derivative regeneration~~ (done, above), ~~the publication pipeline's generalisation off the `editorial-` filename gate~~ (**RESOLVED 2026-08-28, branch `publication-pipeline`**: `labBundle` on `SURFACE_CONTROLS` is the whole registration — the build derives its surface roster from the flagged entries, emits `/_pm/lab/{surface}.json` per surface, and the Worker embeds each; surface identity is checked three ways that must agree — filename surface half against the registry, filename profile half against the receipt's own `profile.id`, and every target's own `surface` field against the file it is filed under — plus a refusal for any surface with no `FIT.{surface}` template, and batch integrity moved out of the `published` branch to run per surface over every surface holding receipts, never across them. **Pinned cells PROVEN, not asserted: 17 of 18 front `dist` artifacts byte-identical** — editorial.json, all three receipts, home, methodology, chrome constant — the eighteenth being the new empty `pdp.json`. Ten sabotages watched failing and restored, plus one accidental (a mislabeled bundle `surface` breaks the chrome-constant fragment gate). New suite legs are the registry tie: a flagged surface with no page entry, no served bundle, or a stale bundle after unflagging all fail. **No PDP receipt was minted and no PDP cell publishes — the batches stay with the interaction-registry unit per this map.** **verify-slice `wf_5e2e486a-eec`: 4 lenses, all completed, 16 findings → 7 distinct, ALL adopted, 0 refuted** — two of them defects in this slice's own work. **The unanimous one (4/4 lenses): the registry tie stopped at SERVING and never reached the EMBED** — a hand-written import list in the Worker meant deleting both import lines left all 478 legs green (the bundle is served assets-first, and an unembedded surface renders the identical empty state), so a future surface could publish a receipt-backed table its own pages render as "No published runs yet". Fixed by GENERATING `workers/front/generated/lab-bundles.js` from the same roster that emits the bundles (outside `dist/` so it is not downloadable, gitignored, turbo-outputs-declared) — `labBundle` is now genuinely the whole registration. **The second: the new empty-state leg reproduced the DESCRIBED_VARIANTS anti-pattern** while citing PDP_SERVING as its authority — it skipped published surfaces (so a typo'd `SURFACE_PAGE.editorial` passed) and was scheduled to reach ZERO assertions the day PDP publishes; replaced with a both-directions per-surface render leg that proves itself on every run. Also adopted: the now-unreachable duplicate-receipt guard REMOVED rather than kept dead; longest-match surface parsing (first-match would misname a future `pdp-compare` receipt); a COLUMN-AXIS tie to the surface's registered `variants` running BEFORE the band-overlap early return (a 3-of-4-variant batch with overlapping bands would otherwise publish an em-dashed column under "Every number above links its receipt"); `labBundle` on a `singleton` refused (ADR-0007 §5); `Object.hasOwn` for the registry lookup. **One finding adopted as a RECORD and BOUND FORWARD: `/methodology/` states editorial's batch as the whole site's, and this slice makes a divergent second batch legal — publishing the PDP batch REQUIRES making that statement per-surface first** (Rob's 2026-07-24 precedent: a methodology decision belongs to the unit that creates the condition). Fourteen sabotages total across the unit, each watched failing and restored. turbo 30/30; fixture AND crate suites both **479/0/24**), then the interaction registry entries and PDP batches — **now unblocked: the pipeline no longer gates them** (carrying the methodology obligation above).

**The vanilla PDP shipped with TWO of its advertised interactions dead, found by the first verification pass it ever had** (it merged without one — the earlier verify-slice run's context named only the two spec-layer commits). **ALL THREE ARE RESOLVED by the `pdp-controls` ticket below (2026-08-15, ADR-0008 addendum A): zoom WIRED, the format group CUT, `pm-pdp__scroll` STYLED.** The record of what was found is kept below because the reason each was invisible is the durable lesson; the fix and the argument are in the new ticket.

1. **The Zoom button can never toggle.** `pdp.mjs` renders `<button class="pm-gallery__zoom" aria-pressed="false">Zoom` and `gallery.css:64-67` implements the pressed state, but `pdp.js` never references it (`grep -c zoom` = 0). `aria-pressed` is not CSS-settable, so a JS-on visitor hears "Zoom, toggle button, not pressed", presses it, and gets the same result forever — **WCAG 4.1.2 name/role/value, live on 500 deployed pages**, on the site that ships an accessibility exhibit.

2. **The format radio group is inert.** `pdp.js`'s only two matches for "format" are `body.formatted`, the live-origin field. Selecting format 2 on the rich master (3 formats) leaves the price, stock line, meta list and the `#pm-cart-item` payload on format 0 — the store takes an order for a format the visitor did not pick. Index 0 is `checked` and the group is keyboard-operable, so it reads as live.

3. **`pm-pdp__scroll` is styled by nothing.** `pdp.mjs:83` emits `role="region" tabindex="0"`, the scrollable-region pattern, but the class matches 0 lines across `packages/tokens/css/`. Every PDP page with a tracklist gives keyboard users a focus stop on a container that cannot scroll, and the horizontal-reflow protection the wrapper exists for (WCAG 1.4.10) is absent.

**Why this is a benchmark problem and not only a bug.** ADR-0002 §153 and this map's own guardrail made "gallery/zoom, add-to-cart with client cart state, quantity, format switch" the propagated interaction set the render-axis flip is measured over (both AMENDED 2026-08-15 — format switch is out). react-next, astro and qwik will read that guardrail and implement all four. If vanilla implements two, **vanilla's JS and INP cells are artificially low on the exact surface whose thesis is "interactivity earns JS"** — an unintentional but real rigging shape. Either the controls become real in all four variants, or the scope cut is taken explicitly and the dead controls are REMOVED from `pdp.mjs` and `gallery.css` so no variant copies them. Shipping them inert is the "falsely interactive" state `pdp.js:3-4` explicitly disclaims.

**Also owed, same pass — ALL CLOSED by `pdp-controls`:** the vanilla PDP had **no pre-merge variant-master identity guard**, the mechanism every other variant×surface pair has; `@pm/vanilla` contributes ZERO *package* tasks to turbo's 30 (`--dry=json`; its files ARE reached by the root `//#lint` task, so the precise gap was "no test and no typecheck", not "no coverage at all"). All 740 pages did still match in both snapshots — an unguarded TRUE statement, which by this repo's standard is the defect. **Two cart implementations also disagreed on a schema-valid input:** the contract said "one entry per release id" but never checked it, so `[{"id":7,"qty":1},{"id":7,"qty":1}]` plus one add gave 3 on editorial and 4 on the PDP. Now checked.

- **Degenerate gating (the unit's named open question), settled:** four masters nested under `pdp/`, each isolating ONE branch, derived by `render/lib.mjs pdpMasterIds` — one derivation for the reference build, every variant build and the gate. Per-axis coverage with isolation is asserted and sabotage-proven for both snapshots; full combination coverage is deliberately NOT claimed — three binary axes span **8** combinations, of which the crate populates **7** and the fixture **4**, against 4 masters. (Corrected 2026-08-15: this bullet still said "16 crate combinations", the hand-typed figure `deca3f9` had already corrected in ADR-0008 and elsewhere — the record-not-code class, surviving in the one place nobody re-read.)

- **astro's paradigm question, decided but unbuilt:** stay `output: "static"` with `getStaticPaths` over the catalogue; **no `@astrojs/cloudflare`**. astro is the islands exemplar on the locked axis, and an SSR adapter would confound the cross-surface comparison with a paradigm change rather than a surface change. Its snapshot bake needs a second generated module AND a matching turbo `outputs` entry.

- **The live-origin demonstration (ADR-0002 §3) is externally blocked.** The edge Worker has no live route today (verified: `/api/plp`, `/api/pdp/:id`, `/api/snapshot`, `/api/beacon`, `/assets/img/*`), and arming it needs the Discogs token as a Worker secret — that leaves this machine and is **Rob's to set**. The plaque renders as contract and its button states the absence plainly rather than being a silent no-op.

## Phase 15 — The instrument was the thing that was wrong (2026-08-28)

This unit set out to register the PDP's two scripted interactions and
publish its first numbers. It found two defects in the ruler instead,
one inherited from the session before it and one that only became
visible because the first had been fixed. Both had been live on every
run the project has ever published. Neither moved a published number,
and that sentence is a measurement below, not a reassurance.

**The first: the post-click settle never waited.** The interaction byte
boundary used `page.waitForLoadState("networkidle", { timeout:
settleCapMs })`. That is a document-load-lifecycle LATCH, and
Playwright's own typings say so — "If the state has been already
reached while loading current document, the method resolves
immediately" (`playwright-core@1.61.1` `types/types.d.ts:5020`), with
`networkidle` marked **DISCOURAGED** at `:5024`. No navigation happens
across a scripted interaction, and the runner's own pre-click settle
loop closes the latch, so the call could never observe anything.
Measured on the deployed plane, all four PDP variants: **0–1 ms**
re-timed this session, against the **24–49 ms** the discovering session
measured from inside the runner. A real 500 ms quiet window cannot
resolve in under 500 ms, so either timing alone is the proof.

What it cost: `pdp-gallery-switch` fetches a 25,194 B image and the
runner recorded `interactionBytes: 0` with `interactionSettled: true`
— the flag whose entire job (ADR-0001 addendum M) is to make "nothing
was fetched for the click" falsifiable from the artifact. It was
proving only that a latch was already closed.

**Why it survived every check, which is the part worth keeping.** Every
`interactionId` any test had ever driven was `body-click` or `none`.
Both fetch nothing, and the assertions on them are `interactionBytes
=== 0` — which a working boundary and a broken one produce
identically. No test had ever driven an interaction that fetches. A
guard proven only against inputs that cannot distinguish pass from
fail is not proven, and the fix for that is a test, not a fix.

**The second, found by probing a number rather than reading code.** With
the boundary fixed, the runner measured qwik's gallery switch at
**52,032 B** against 25,194 B for the other three. The predecessor
prompt framed that as the unit's central fairness question: is the
extra 26,838 B — all five thumbnails, re-fetched — inherent to qwik's
renderer, or a defect in `PdpGallery.tsx`'s factoring? Publishing it
as a paradigm cost if the answer were the second would be rigging
AGAINST qwik, the mirror of the dilution defect that flattered the
smallest cells.

It is neither. A standalone probe of the same click, on the same
release, on the local crate plane AND the deployed plane, measured
**25,194 B on qwik** — identical to the others. One variable separated
the probe from the runner: the runner registers
`page.route("**/api/beacon", …)` to capture the chrome's vitals
beacons without delivering them, and **Playwright documents that
"Enabling routing disables http cache"** (`types.d.ts:4063`). Its
routing is not URL-scoped at the browser — every request is paused so
the glob can be matched in JS — so one beacon route took the HTTP
cache away from every request of every measured visit.

Adding that one line to the probe reproduced 52,032 B exactly, byte
for byte, on qwik and on no other variant. Qwik re-writes `src` on all
five thumbs with the value each already holds (9 mutations against
react-next's 4; the `<img>` nodes survive, so it is a re-render, not a
replacement). With the cache on that costs nothing. With the cache off
it is five real downloads. **The instrument was manufacturing a
26,838 B paradigm difference no visitor can experience.**

So Gate 1's answer is neither branch the prompt posed, and the right
action is to change nothing in the variant: `PdpGallery.tsx` stays as
it is. Factoring the thumb list into its own `component$` to chase the
phantom would have added serialized state to a published initial-JS
cell for no measured benefit.

**The replacement, and what was rejected.** `armBeaconCapture` pauses
only the beacon URL, at the browser, through CDP's own pattern filter,
and always fulfils with 204 — a paused request never emits
`requestfinished`, so leaving one paused would wedge the very
quiescence tracker the first fix installs.
`Network.setCacheDisabled({cacheDisabled: false})` was tried and does
NOT restore the cache while routing is on, before or after the route
is registered: 52,032 B either way. An `addInitScript` stub over
`navigator.sendBeacon` does work (25,194 B, all five metrics), and was
rejected for monkey-patching the measured page's own JS environment
and for failing silently the day the chrome changes transport.

**Cost to published numbers: none, and it is measured.** Editorial,
five variants, five runs, `avg-broadband-desktop`, same plane, before
and after: initial-JS medians 1808/1808, 154084/154084, 737/736,
29119/29119, 18846/18846 — every one within 1 B, which is the
leave-one-out attribution's own rounding — and every interaction
median 0 in both columns both ways. A `sendBeacon` request never
appears in resource timing in any capture mode (measured with routing,
with CDP interception, and with no capture at all: zero `/api/beacon`
entries in all three), so the swap cannot move `instrumentationBytes`
either.

**Gate 2: qwik's INP flatters it exactly where it does the most work.**
On the same click qwik measures INP **8 ms** against 24 ms for the
other three. A number that flatters one paradigm precisely where it
does more work has to be explained before it publishes. It is
explained, and the explanation is a limit on the metric, not a
correction to a cell.

Chromium closes an interaction's event-timing entry at the first paint
after the handler's SYNCHRONOUS processing returns. Medians of five
fresh visits per variant, runner-exact profile, ms from the event's own
`startTime`:

| variant | INP (event duration) | handler returned | DOM changed | painted after the DOM change |
|---|---|---|---|---|
| vanilla | 24 | 0.7 | 1.3 | 18.4 |
| react-next | 24 | 1.3 | 2.8 | 19.5 |
| astro | 24 | 0.6 | 1.1 | 18.2 |
| qwik | **8** | 0.7 | **9.9** | **34.6** |

The three synchronous paradigms mutate the DOM inside the handler, so
the next paint carries the result. Qwik's resumed handler returns at
0.7 ms having only SCHEDULED the render; the ~8 ms paint that closes
its entry carries nothing; its DOM change lands at 9.9 ms, after it;
and its visible update arrives at 34.6 ms, **the latest of the four**.
The cell reads lowest where the work finishes last.

Then the check that decided how to publish it: the same probe on
EDITORIAL. Qwik's DOM change there lands at 22.0 ms against 1.0–3.5 ms
for the others — the same asymmetry — but it falls inside the measured
window and the cell reads 24 ms like everyone else's. The earlier
session's "~104 ms for qwik's DOM change" was measured under the
cache-disabled instrument; under the fixed one it is 9.9 ms.

**And then the measurement that changed the decision.** This unit's
first answer was "publish it with the limit stated", on addendum M's
precedent. Two more batches refuted that. Against the deployed plane,
qwik against the other three (which read 24 ms throughout):
gallery-switch reads **8 ms** on average broadband and **0 ms** under
slow 4G (runs 0, 8, 0); add-to-cart reads **8 ms** on average broadband
and **24 ms** under slow 4G. One column swinging 0 → 24 across
conditions while the others hold still is not measuring a property of
the paradigm, and switching interactions does not escape it — so this
belongs to the surface's handlers, not the chosen click. **0 ms is not
a number a caveat rescues**: a reader sees "instant" for the paradigm
whose visible update lands last.

**So the PDP publishes no INP row.** Declared in its fit template
(`interactionTiming: {publish: false, reason}`), dropped at BUNDLE time
so the value a reader must not read is not in the artifact either, and
withheld LOUDLY rather than quietly — which is the whole difference the
predecessor prompt asked for. The row carries the reason, the fit
sentence refuses the timing comparison in its own words,
`/methodology/` carries the mechanism with these figures, and a suite
leg proves both directions. Editorial KEEPS its row, and that is
measured too: all five variants at 24 ms across every profile, seven
runs each. Withholding a stable row would be over-correction; the
criterion is per-surface, declared, and checkable.

**The publication pipeline, generalised rather than loosened.**
`bundleFromReceipt` refused any receipt whose interaction medians were
non-zero — hardcoded, not driven by the fit sentence — which made a
surface whose interaction legitimately fetches unpublishable by
construction rather than publishable with the fetch STATED. Surfaces
now declare `interactionFetch` in their fit template: `"none"` (assert
zero in both columns) or `{kind:"constant", toleranceBytes}` (assert
the variants AGREE, and publish the figure in the sentence). A
declaration that cannot fail is not a generalisation, it is a
loosening, so: the declaration is REQUIRED, a constant that measures
zero everywhere is refused by name, and the clause moved AHEAD of the
band-overlap early return so a surface cannot skip its own declaration
by having overlapping bands.

`FIT.pdp` is written with its batch, and its headline is the
interaction: the gallery switch costs every paradigm the same bytes,
because that is image mass and not architecture, while the JavaScript
each ships to run it is not the same at all. The sentence refuses the
timing comparison in the sentence itself and says where to read why.

**Two interaction families, one receipt slot — decided.** The CLI
applies one `--interaction` per batch and the pipeline keys receipts
by `{surface}-{profile}.json`, so `pdp-gallery-switch` and
`pdp-add-to-cart` cannot both publish under one profile. A second
pseudo-surface is blocked by design (`target.surface` derives from
path segment 2, and a receipt whose targets disagree with its filename
is refused — that check is doing its job). Extending the receipt key
to carry the interaction was weighed and rejected as too large for
what it buys: the surface parse becomes ambiguous and the chrome would
have to render two tables per surface. Merging both families into one
bundle was rejected because `READING_METRICS` has no interaction-bytes
row at all, so the published "interaction cell" IS the INP row.

Taken: **publish one family, and make the INP row name its
interaction.** `pdp-gallery-switch` publishes — the interaction the
surface genuinely owns; `pdp-add-to-cart` is measured and recorded
here as unpublished, with its numbers and its reason. And a receipt
carrying more than one `interactionId` is now refused outright, so the
constraint is a named failure rather than an accident waiting.

**The bound obligation from PR #33, discharged.** `/methodology/`
composed both its batch statement and its run count from the editorial
receipts alone. That was true while editorial was the only publication
and becomes a correctness bug the moment a PDP cell publishes — a
reader follows the link from a PDP page and reads a description of a
batch that is not the one behind the numbers, falsified by the receipt
links on those very cells. Both are per-surface now, each naming its
surface's own interaction, and the run count stays a bare number only
while every published surface agrees on one.

**A cost this unit created and paid.** Naming the interaction in the
INP row grows the injected chrome fragment by 59 B (12,072 → 12,131),
and the addendum-N hole-1 identity gate correctly refused the
committed chrome constant for describing a fragment the build no
longer ships. The gate had never fired on a real chrome change before;
it did exactly what it was built for. The artifact is REMOVED on the
branch rather than replaced, and the site says so — an absent constant
is a legal state the build already renders honestly, and the suite leg
that asserted only the populated direction now proves BOTH, so that
state is covered rather than merely tolerated. It was measured against
the local plane, clean, purely to prove the gate discharges: sha256
`a289f9f8b1c1`, 12,131 B, +236 ms FCP/LCP, 0 CLS, 0 long-task ms, wire
2,199 B at a calibrated q5. **That +236 is not publishable as the
site's constant**: this project's own record has local-plane constants
at +224/+216 and deployed-plane ones at +76 to +104, so the gap is the
plane, not the label. The publishable artifact is re-measured against
the deployed plane at the merge SHA, in the same pass as the batches.

**The verification pass, and what it cost to be wrong twice.** Two
lenses, twelve findings, all twelve verified against source before
being adopted — and three of them were defects in this unit's own new
work, which is the pattern every verify-slice run since `pdp-controls`
has repeated.

The two that mattered most were both about the difference between a
guard and the appearance of one. `{kind:"constant"}` with a misspelled
`toleranceBytes` made `max - min > undefined` a NaN comparison, false
for every spread — so the declaration built to catch a manufactured
paradigm difference would have caught nothing, silently, while looking
exactly like a working check. And the `"none"` clause compared MEDIANS
where the attestation beside it compared runs: at seven runs, three
fetching ones still publish "none of them fetches another byte for the
click". Both are the same shape as the latch this unit exists to fix,
one layer up.

The lens also found the latch itself in a second place, which is the
finding this unit would most have regretted missing:
`chrome-constant.ts` closes its settle with two
`waitForLoadState("networkidle")` calls and no navigation between them,
the second returning in a microtask while its comment promised "one
more quiet check". That is the probe that mints the published chrome
constant, and late paint/shift entries are exactly what the with-chrome
arm has more of. Fixed with the same real quiescence wait, and a
cap-out now throws — the probe has no honest degraded mode.

**And a claim on `/methodology/` that the site's own bundle falsified
one click away.** The first draft of the INP limit typed "all five
variants read 24 ms across every profile". The receipts say
react-next's warm median is 32 ms on average broadband and runs span
24–32. On a page whose every other number is build-substituted, that
was the class this pipeline exists to prevent — and it would have gone
stale at the next batch even had it been right. It is derived now, from
the receipts, through a marker.

**Three defects in this unit's own new work, all caught by sabotaging
rather than by reading.** The `interactionTiming` refusal fired as a
raw `TypeError` from the column loop, which dereferenced the
declaration before the named check could run: it failed closed, so
nothing could have published, but it failed with a stack trace instead
of a sentence, and a sabotage that produces *some* failure is not proof
a guard works. The new zero-fetch leg pointed at the fixture's
`pdpDetail`, which is unpriced — caught within a minute by the
fail-fast the same pass had just added, where Playwright's actionability
retry would have taken 30 s a visit to say nothing useful. And the
13 KiB fragment-budget leg hardcoded `/{variant}/editorial/`, so it was
scheduled to miss the PDP fragment the day it published (measured once
driven from the registry: 10,639 B against the 13,312 B budget).

**One finding adopted but SEQUENCED, and it is this unit's bound
obligation.** The `interactionSettled` gate has no date cutoff, so
editorial's three committed receipts keep certifying the site's
strongest claim with a flag this unit proves was vacuous. The fix is a
cutoff that refuses the flag as evidence for receipts dated before
2026-08-28 — and it cannot land on this branch, because it would make
the front build red until editorial is re-run, and editorial cannot be
re-run until the branch MERGES: the provenance gate refuses a local
checkout measuring a plane on a different SHA, by design, and this unit
changes the ruler. So it lands in the same commit as the re-run
receipts that satisfy it, which is what turns "we recommend a re-run"
into a mechanism. If the re-run is declined, the cutoff cannot land and
the weaker attestation stands, recorded in the ADR and on
`/methodology/`.

### The last surface, specified rather than built (2026-08-28)

This unit wrote `docs/prds/how-it-was-built-build.md` and no code. The
constraint was not caution: `/how-it-was-built/` is a front-Worker
singleton, `workers/front/**` was held by a concurrent measurement pass,
and `commitPin` treats any porcelain output — untracked files included —
as a dirty tree. One stray file there makes a batch of receipts
unpublishable. So the deliverable is a decision-complete spec, and the
honest caveat rides at the top of it: **nothing here was verified against
a running origin.** Three agents held ports 8787–8797 for the session, so
`run-local.mjs`, `pnpm run dev` and `wrangler dev` were all out. Every
serving claim in the PRD is read from source, and the executing session
owes the before-and-after probe — the before-shot is what makes the
"it serves 200" leg non-vacuous.

**Most of this surface was already decided, and saying so was part of the
work.** ADR-0008 §8 (`:223-227`) fixes the URL, the owner, the layout, and
assets-first serving via the home precedent. A spec that re-litigated
those would have spent its weight on the settled half. Four rows of a
table say what is shut; the rest of the document spends itself on the
drift tie, `/methodology/`, and the duties.

**The drift tie was the real question, and the sabotage answered it in
two directions.** The only thing tying this surface to the documents it
renders is a phase INDEX pin (`packages/reference/test/reference.test.ts:196-207`);
`:157-164` records that the prose is deliberately unpinned. Both arms were
tested against this worktree, and they disagree:

- Appending `## Phase 16 — sabotage probe (delete me)` to
  `docs/build-log.md` and running `pnpm --dir packages/reference run test`
  failed **1 of 37**, with the message the guard was written to give:
  `committed how-built is missing Phase 16 — re-run: node render/build.mjs`.
- Creating `docs/adr/0010-sabotage-probe.md` with valid frontmatter and a
  `# Title` and running the same command gave **37 passed**. A tenth ADR
  the committed master has never listed, and nothing went red.

Both restored from a backup copy taken first, never `git checkout --`;
`git status --porcelain` empty and 37/37 green afterwards. The ADR arm is
the identical shape to the defect `:188-195` records paying for once
already — "adding a phase silently left the committed master a phase
behind" — reproduced on the arm the fix never covered. It is worth being
precise about why that is bad: the surface's whole claim is that the
record is the evidence, and the index of the record could fall behind the
record with every check green.

**A larger gap sits behind it: nothing ties the SERVED page to the
master at all.** The masters-health block (`drift.browser.test.ts:497-526`)
lists `how-it-was-built` among eleven masters but proves only normalizer
self-consistency and pixel stability — its own comment says "No variant
comparisons yet — no variant serves these surfaces". Every other surface
closes that loop with a variant-vs-master drift leg. A hostless singleton
never gets one, so the loop was never going to close by that route. The
spec's answer is to remove the class rather than guard it: `@pm/front`
renders the surface with the same function that renders the master
(`@pm/reference` as a declared dependency, the way ADR-0007 §6 made
`@pm/tokens` one), with `renderHowBuilt` gaining `ref` and `head` options
that change nothing when omitted. The alternative — re-implementing the
body in `workers/front/build.mjs` behind `%%` markers, the way home and
methodology are built — was rejected for being two renderers over one
source, which is the shape this log keeps recording.

**`/methodology/` stays where it is, and one line of the chrome decided
it.** The page's own header comment (`:17-18`) has promised since it
shipped that its long-term home is this surface. Against that:
`packages/switcher/src/chrome.ts:288` renders `href="/methodology/"` into
the populated chrome fragment injected on every measured page, and
`workers/front/build.mjs:947-957` hashes that fragment and refuses the
build when it stops matching the committed chrome constant. A redirect is
therefore a `chrome.ts` edit, a fragment-hash refusal, a chrome-constant
re-measure under addendum P's two-pass cycle, and a rebuild — paid to move
a link that a canonical index entry leaves working. That gate fired for
real one unit ago, on the interaction-registry slice, when naming the
interaction in the INP row grew the fragment 12,072 → 12,131 B. It is not
a hypothetical cost.

The prompt this unit was handed framed the marker question as "more than
four", and re-deriving it was the point: `grep -o '%%[A-Z_]*%%' … | sort
-u | wc -l` gives **11 unique markers in 13 occurrences**, and five of
them are not content at all — `%%TOKEN_PAPER%%`, `%%TOKEN_VINYL_URI%%`
(twice, both inside the favicon data-URI), `%%TOKEN_PAPER_SUNK_URI%%`,
`%%PM_TOKENS_CSS%%` and `%%PM_METHODOLOGY_CSS%%` are theme-color, favicon
and stylesheet-inlining markers whose destination page has a different
head and a different CSS set. A spec that had moved "the four numbers"
would have shipped a page with no favicon and no stylesheet.

**Three citations in the handoff prompt were wrong, and re-deriving them
rather than repeating them is the only reason the spec is right about
them.** The 13 KiB populated-fragment budget is `toBeLessThan(13312)` at
`published-readings.test.ts:405` — one occurrence in that file
(`grep -n '13312'`), inside the "chrome renders the published readings"
describe at `:365-408`, not at `:337,348`, which are two `toContain` calls
about receipt-linked editorial cells. `SURFACE_PAGES` is at
`packages/reference/render/build.mjs:69-83`, not `:96-110`. And the
methodology page's header comment spans `:11-18`, not `:12-18`. The
budget mis-citation mattered most, because it also carried a wrong
implication: that leg iterates `LAB_SURFACES`, so it can never cover a
surface `workers/front/build.mjs:521-527` forbids from ever carrying
`labBundle`. A chrome-free page receives no injected fragment and pays no
fragment budget. The right answer to "which legs move" is **none** — and
the honest addition is that one of them was never in scope.

**Scale of the thing being fixed, since it is easy to read this surface as
cosmetic.** `/how-it-was-built/` returns 404 today: nothing writes that
dist path (`workers/front/build.mjs:53-56,1133,1237`) and an unmatched
prefix falls to `src/index.js:95-98`. The canonical footer links it
(`shell.mjs:163`) and all six variants re-type the link. Over a
500-release crate (`jq '.releaseCount' …/crate/manifest.json`) that is
6 editorial pages + 4×500 PDP pages = **2,006 served store pages, each
carrying a footer link to a 404**.

**Two stale claims found and deliberately not fixed**, both outside this
unit's file boundary and both recorded in the PRD as duties of the
executing session: the methodology page's `:17-18` promise of a move this
spec declines, and `packages/tokens/css/surfaces/how-built.css:5`, which
says content is generated from "ADR excerpts, decision-map rows,
build-log phases" — no decision-map row has ever been rendered, and this
spec does not add them.

**What could not be settled, recorded rather than smoothed over.** The
404-then-200 pair is unobserved. The wall-clock cost of a chrome-constant
re-measure is reasoned from the refusal in the source, not timed — the
methodology decision does not depend on its magnitude, only on its being
non-zero against a benefit an index entry already delivers. And whether
the frame prose should change at all is left open on purpose: this
master's prose is the one thing `reference.test.ts:157-164` deliberately
leaves unpinned, which cuts both ways, and is why the spec states the
limits as required content instead of leaving them to taste.

Verification on the final tree: `pnpm run check` 30/30, exit 0; `node
packages/reference/render/build.mjs` followed by `git status --porcelain
packages/reference/surfaces/` shows nothing — the changes are docs only,
and no `## Phase` heading was added, so the phase-index pin has nothing to
repair.

### The checkout, and a guard a comment could satisfy (2026-08-28)

The vanilla checkout is built and serves `/vanilla/checkout/`, its
normalized DOM equal to the committed master. The interesting part is
not the page. It is that `pdp-controls-wired.test.ts` — the guard this
repo added *because* two PDP controls shipped dead — passed a sabotage
it was written to fail.

**The guard read comments.** Its state checks were
`script.includes("aria-invalid")` over the RAW enhancement file.
Rewiring every `aria-invalid` write in `checkout.js` to `data-invalid`
took five occurrences down to two, both of them prose, and the suite
stayed green. This is PRE-EXISTING, not something this unit introduced:
`pdp.js:90` and `:97` name `aria-pressed` in the comment block directly
above the zoom toggle, so deleting that toggle and keeping its
explanation would have passed the very guard written to catch the dead
zoom. It is the same defect `master-styles-resolve.test.ts:66-73`
already fixed one file over — "a class NAMED in a contract comment is
not a rule" — arriving by the other door. `codeOnly()` now strips
comments, string-aware so a `"https://…"` literal does not lose its
tail. All four PDP variants still pass unchanged; the sabotage now fails
with the message it was written to give.

**The surface renders no script-only state, and that nearly made the
whole rule vacuous.** The PDP legs assert `rendered.length > 0` to prove
they are biting. A served checkout form correctly renders zero — no
`aria-pressed`, no `aria-expanded`, no `aria-current` — so the same
assertion would fail on a correct page, and exempting checkout from it
would have been the vacuous pass this file exists to refuse. Two changes
instead. `SERVES_NO_SCRIPT_STATE` turns the exemption into a CHECKED
CLAIM: a checkout master that ever renders one fails until someone wires
it or removes the entry. And the bite comes from the STYLESHEETS instead
— `field.css:45` styles `.pm-field__control[aria-invalid="true"]`, a
rule nothing but script can ever match, over twelve controls. That is
`pm-pdp__scroll` in mirror image: markup promising behaviour no sheet
implements, versus a sheet promising a state no script produces. Neither
guard sees the other's case. Scoped to `<main>`, because the masthead's
`[aria-current="page"]` is the SERVER's (`shell.mjs` decides `current`
at render time) and demanding a script write it would be demanding a
lie. The PDP passes the new leg unchanged — its own sheets promise
exactly the two states its markup already renders.

**A submit button is excused structurally, never by class.** The browser
routes the press to the form's `submit` event, and that event is where
the whole invalid-submit contract lives. A `NATIVE_BEHAVIOUR` row would
have had to name `pm-button`, which is also the PDP's add-to-cart —
blanket-excusing the control the guard was written for. The structural
rule applies only when the enhancement reaches the FORM, and
sabotage-proving it by unbinding the form reports the button by name.

**The cheap half was not enough on this surface, so the expensive half
was built without a browser.** `pdp-controls-wired` proves an
enhancement can REACH a control; its own header admits it "would pass a
script that mentions a class and does nothing with it". For the PDP the
other half is the origin suite, which cannot gate a merge. Checkout has
no browser leg at all, so `checkout-controls-behave.test.ts` drives the
REAL `checkout.js` against the REAL served master in linkedom,
pre-merge, no ports: card grouping, MM/YY, blur validation writing and
clearing `aria-invalid`, the error summary's heading and per-field links
and FOCUS MOVE, the summary not stacking on a second submit, the cart
populating, and the shipping radio moving the total by exactly the
$12.00 its own label states. Three limits are stated in the file rather
than implied: no layout, so it says nothing about CLS; no timing, so it
is not evidence about INP; and it is a DOM emulation, not a browser.

**linkedom matches `:checked` on the ATTRIBUTE, not on checkedness** —
verified directly, and it does not reflect a property assignment either.
The first draft of `shippingCost()` selected
`.pm-format__input:checked`, which is correct in a browser and
unprovable anywhere else. It now walks the group and reads `.checked`.
Both are right; only one can be proven before merge, which is the
standard every other claim here is held to.

**The catalogue is fetched, not baked, and the reason is the ruler.**
Cart is `localStorage`, so no paradigm can SERVE cart contents (ADR-0008
§7) and every checkout variant must resolve ids client-side;
`cart-summary.css:15-18` pins what a line needs — thumb, title × qty,
price. Inlining that index was measured and rejected: **50,892 B raw /
8,571 B brotli-q11** for the crate's 500 releases (fixture 25,970 /
2,490), landing on the flagship INP page to serve a state the
measurement never enters, since the canonical served state IS the empty
cart. That is a manufactured paradigm cost — the shape PR #35 had just
finished removing from the ruler. It is a separate asset, fetched only
when the cart is non-empty, and a test asserts the empty-cart page
fetches nothing at all. Cost of the build-time alternative is published
above rather than hidden; the request-time checkout variants will face
the same choice and can be compared on it.

**Served bytes, measured on the fixture build:** `checkout/index.html`
9,149 B raw / 1,748 B brotli-q11; `assets/checkout.js` **18,965 B raw /
5,754 B brotli-q11**, which is 1.7× `pdp.js` and ships RAW, comments
included, on the surface whose numbers are about interaction. Comment
share is 48%, against `pdp.js` 49% and `cart.js` 42% — house-normal, not
a regression, and stated because a contract comment on this variant is
wire bytes.

**Turbo is 31, not 30, and that is the honest number.** `@pm/vanilla`
gained a `test` script — the precise gap `pdp-controls` recorded — so
`@pm/vanilla#test` is a real command where there were none. Verified by
`--dry=json`: 31 real commands, 75 nodes, the delta exactly one taskId.
The 30 was a snapshot of a tree in which this variant was unguarded;
reporting 30 after closing that gap would have been the lie. The test is
dependency-free — `node --test`, no vitest, no linkedom — so the
lockfile is untouched and the no-toolchain control stays one.

**A disclosed weakness in that new task.** It inherits turbo's default
`cache: true` with inputs limited to `variants/vanilla/**`, so a change
to `packages/reference/render/checkout.mjs` plus a master re-render can
replay a stale PASS. Every sibling variant guard buys out with `"cache":
false` (`turbo.json:129`, `:181`, `:198`). That one-line entry is OWED
and not applied — `turbo.json` is a shared root file with four agents in
the tree — so the same comparison also lives in `@pm/repo-checks#test`,
which is already uncached and always runs. That copy is what makes the
claim true today.

**Three stale or thin claims found in files this unit may not edit**,
each written into the handoff with an exact diff. `checkout.css:14`
shows `<form class="pm-checkout__form" novalidate>` in its contract
comment, which `checkout.mjs:9-12` explicitly contradicts and the master
does not render. `pm-cart__what` is named in `cart-summary.css:17` and
has no rule anywhere. And no field in the master carries `required`, so
the page's own JS-off statement — "labels, hints, native validation" —
is thinner than it sounds: native validation is `type="email"` and
nothing else. The enhancement's rules are deliberately a superset, which
is the designed consequence of the `novalidate` handover, but the served
markup could support more than it does.

**The `OWED` retirement is blocked, and blocked in one direction only.**
`pm-checkout__form` still has no rule; the rule must live under
`packages/tokens/`, which is in nobody's boundary this round. The two
changes are coupled — the completeness leg fails if the rule lands and
the entry stays, and the per-surface leg fails if the entry goes without
the rule — so they land together at integration or not at all. The exact
CSS diff is in the handoff, unapplied.

**Eight sabotages, each watched failing with its own message and
restored from a backup COPY, never `git checkout --`** (the process
failure recorded at :4222). Removing the `aria-invalid` write; removing
`.pm-field__control` (reports all twelve fields by name); unbinding the
form (reports the submit button); giving the master an `aria-expanded`
it never enters; drifting one word in the variant renderer; flattening
the card formatter; deleting the error summary's focus move; and zeroing
`EXPRESS_SHIPPING`, which fails in two files at once. The identity
test's failure output was two 6 KB blobs until the fifth sabotage showed
it — a guard whose failure cannot be read is a guard that gets muted —
so it now prints a first-divergence excerpt.

**Owed, and NOT done here:** checkout has no origin-suite leg of any
kind. The cart suite parameterises over the EDITORIAL surface only
(`cart.browser.test.ts:103`, and `shell.mjs:66-67` says so in the
contract), the PDP's controls have their own browser file, and checkout
has neither — so a checkout cart that diverges from editorial's is
exactly as invisible today as the dead PDP controls were. The three
interaction-registry ids ADR-0008 names — `checkout-type-card`,
`checkout-submit-invalid`, `checkout-fix-and-submit` — are still absent
from `collect.ts:33`, whose `INTERACTIONS` holds five keys, none of them
checkout's; that file belongs to the measurement pass. Nothing is
published from this surface, so no receipt is invalidated.

Tree, tool-derived: `pnpm run check` **31/31, exit 0**;
`@pm/repo-checks` **150 passed / 1 skipped across 13 files**;
`@pm/vanilla` **4 passed**; `node packages/reference/render/build.mjs`
leaves `git status --porcelain packages/reference/surfaces/` EMPTY — all
eleven masters byte-identical, Unit 4's `how-it-was-built/index.html`
included; `pnpm install --frozen-lockfile` clean.

### The checkout's two served falsehoods, and what a browser said about them (2026-08-29)

A five-lens merge review held this PR back. The page was correct in every
way a test on this branch could see, and wrong in two ways a visitor could:
it told them their card never left the browser while shipping a form that
would POST it, and it told them native validation worked with JavaScript
off while carrying no constraint that could gate a submit. Both claims sit
in the reference master, so both variants that copy it would have inherited
them. Neither was a subtle bug — they were confident sentences printed
beside markup that contradicted them, which is the one failure mode this
whole project cannot survive.

**The card fields were live wires.** `field()` stamped `name="${id}"`
unconditionally, the form is `method="post" action=""`, and the only
`preventDefault()` in the tree is at `checkout.js:382` inside a `defer`red
script. So JavaScript off — or blocked, or one failed request — and "Place
order" natively POSTs card number, CVC, expiry, name and the full postal
address to the origin. The `cc-number`/`cc-exp`/`cc-csc` tokens are what
make a browser offer a **real saved card**, so the values at risk were
never demo junk.

The fix is one rule, applied structurally so a later variant cannot opt
out of it: **`field()` emits no `name` at all.** A submittable control
without a name is not a successful control — it is not serialized, at all,
ever. That leaves `method="post"` and the form's realism untouched, which
matters because the JS-off story is what this surface is partly for. It was
not reasoned about; it was measured. Real Chromium, every field filled with
a real-looking card and address, JavaScript off, submit clicked:

    POST body: shipping=standard

Card, CVC, expiry, email, address: none of it in the request. `name`
survives on exactly one control group, the shipping radios, because radios
group *by* name and without it both options can be checked at once — and a
shipping tier is not something anyone types. The four payment fields also
dropped their `cc-*` tokens for `autocomplete="off"`: nothing is sent
either way now, but a demonstration page has no business asking a browser
to put a real PAN in its DOM in the first place. ADR-0008 §8's "every field
with label/autocomplete/inputmode" still holds — `off` is the correct token
for a field that must not be autofilled.

**The native-validation claim was thin, not absent, which is worse.** The
page said "With JavaScript off, every field here still works — labels,
hints, native validation." The count, not the impression:

    grep -c 'required\|pattern=' packages/reference/surfaces/checkout/index.html
    # → 0

`type="email"` was the only constraint in the document, and it only fires
on a non-empty value, so a completely blank form submitted clean. The
branch knew: `checkout.js:256-261` disclosed the asymmetry in a comment and
the build log recorded it. Disclosing a falsehood in a file the visitor
never opens is not the same as not telling them one.

Taking the claim out was the cheaper option and it was the wrong one,
because the master's own docblock already says what this page is supposed
to be — *"No `novalidate` in the served markup: JS-off, native constraint
validation is the real behavior the page claims"*. The code had simply
never implemented its own spec. So `required` now lands on exactly the ten
fields `checkout.js`'s `RULES` requires, and `pattern` on the three with a
shape test, mirroring the JS regexes: `\d{13,19}`, `(0[1-9]|1[0-2])/\d{2}`,
`\d{3,4}`. JS-off validation is now the same set of rules as the
enhancement's, not a weaker cousin.

The obvious hazard — `required` firing before the submit handler and
killing the error summary the surface exists to measure — does not happen,
and the reason is a line that was already there: `checkout.js:220` sets
`novalidate` at hydration, *before* the card formatter binds at `:253`. So
with JS on the browser validates nothing and the enhancement owns it all;
with JS off the browser owns it all. Both halves measured in Chromium
against the real master with the real script:

| condition | form valid | outcome |
|---|---|---|
| JS off, empty, submit | `false` | no request at all |
| JS on, empty, submit | `false` | `novalidate` set, error summary renders 10 errors, focus moves to it, 10 `aria-invalid` |
| JS off, all fields filled, submit | `true` | POST body `shipping=standard` |

Two attributes were considered and rejected. `title` on the three patterned
fields is IN, because the browser's unhelped message is "Please match the
requested format"; `disabled` on the card group was rejected outright —
it stops the POST but it also stops the typing this surface measures.

**A guard that could replay a stale pass, and the 73 lines that existed
because of it.** `@pm/vanilla#test` inherited turbo's default `cache: true`
with inputs limited to `variants/vanilla/**`, so a change to
`packages/reference/render/checkout.mjs` plus a master re-render — exactly
what this session did — moves both sides of the comparison and none of the
declared inputs. The guard would have replayed green through its own blind
spot. The branch had spotted this and written the one-line fix into its
handoff rather than applying it, fearing a `turbo.json` conflict with the
two PLP PRs; `git merge-tree` says that fear was unfounded (distinct keys,
hunks 108 lines apart, zero markers). `"@pm/vanilla#test": { "cache": false }`
is applied, matching every sibling variant guard. With it, the 73-line
duplicate of the checkout identity comparison in
`tools/repo-checks/test/variant-master-identity.test.ts` — which the file's
own comment says exists *only* because the vanilla task could go stale —
is deleted. Its one unique assertion (twelve `pm-field__control`) moved into
`variants/vanilla/test/`, along with three new ones that hold the fixes
above to the wall: two `name=` attributes in the whole form, zero on the
select, ten `required`. **Net −73 lines.**

**The dead control.** `SURFACE_CONTROLS.checkout.variants` was still `[]`
while this PR makes `/vanilla/checkout/` real, so `chrome.ts:184-190`
rendered "Served by 0 of 3" on a page that was being served. Now
`["vanilla"]` with `plannedVariants: ["react-next","htmx"]`, landing in the
same commit as the routes it makes true — and each of the three surface
registrations this batch owes is correct at the moment it lands, never
before. Measured after: "Served by 1 of 3". It also retires a vacuous
guard: `pdp-controls-wired.test.ts`'s "every LIVE checkout variant has a
registered enhancement" was ranging over an empty array and could not have
failed; it now ranges over `vanilla`.

Not taken, and recorded in the decision map rather than quietly skipped: the
JS-off 405 dead end, the phone-profile CLS from the late-populating cart
summary, the third byte-identical copy of `read`/`count`/`renderCount`, and
the duplicated PDP block in `pdp-controls-wired`. None blocks a merge; all
four are cheaper before the first checkout batch than after.

### The PLP's react-next arm: three data strategies over one contract (2026-08-28)

Unit 1 of four working in parallel. It builds the catalogue grid in the
react-next variant, where the measured variable is not the rendering
paradigm but **where the data layer lives** (ADR-0005). **Three ROUTES,
covering FOUR of the five switcher presets**: `plain` serves two of them
(cold and edge-cache — the difference is `?cache=`, not the path),
`tanstack` and the fenced `apollo` exhibit one each. Only the htmx
loaders preset is outstanding, and it is Unit 2's. Counting routes as
presets understates what is live by one, and the preset count is what an
integrator reads for scope.

**The design fork this unit had to take, and it is a real one.**
ADR-0005 §1 describes the cold arm as "plain client fetch on render and
on every interaction", and §6 cell 4 contrasts "finished HTML in one
trip" against "shell-then-data in two". That is a shell-first shape, and
the canonical markup contract forbids it: every variant's served DOM
must equal `packages/reference/surfaces/plp/index.html` (ADR-0003 §1),
and a shell does not. The contract wins — all three routes SSR the full
catalogue at request time — and the strategy axis moves entirely onto
the interaction path, which is where ADR-0005 §3 already put the
client-warmth claim. **Cell 4's copy is therefore wrong as written**:
on FIRST load the React arms now also arrive in one trip, so that cell
no longer separates them from loaders on round-trips. Recorded here
rather than absorbed, because a cell whose premise the build changed is
exactly the kind of thing that publishes quietly.

**What the three arms actually differ by.** `PlpPlain` holds no cache
and refetches on every page change. `PlpTanstack` mounts a QueryClient
seeded with the server's tray under the served condition's key, at the
**published** `staleTime: 5min` of ADR-0005 §4. The claim that buys — a
revisit adds no request — is ASSERTED rather than described: the guard
checks that the seeded entry is not stale under the published window and
IS stale under the library's default, which is the difference §4 exists
to record. An earlier draft of this sentence quoted `isPending: false,
isFetching: false` "measured under SSR", read off a throwaway probe that
no longer existed — a runtime claim living only in a comment, which is
the exact shape this section catches 19 times below. Staleness is
also the right seam and fetch counts are not: `renderToStaticMarkup`
runs no effects, so NO arm fires a request during it and an
`isFetching() === 0` assertion would have passed whatever the config
said. `PlpApollo` does the same through
`@apollo/client` 4.2.12 + `apollo-link-rest` 0.10.0-rc.2 under
`cache-first`, whose window is NOT the lead's — Apollo has no staleTime
knob at all, so the exhibit's cache is unbounded where the lead's is a
published five minutes. Stated as a difference rather than parity; see
the finding below.

**The exhibit's cost, measured on the real build rather than the
prototype.** Summing each route's client-reference-manifest chunk set
plus `rootMainFiles`, brotli q11, from `pnpm exec next build` at this
SHA:

| route | chunks | raw B | brotli B | Δ brotli vs plain |
|---|---|---|---|---|
| `/plp/plain/` | 7 | 528,513 | 129,143 | — |
| `/plp/tanstack/` | 8 | 560,912 | 138,040 | **+8,897 B** |
| `/plp/apollo/` (fenced) | 8 | 759,456 | 190,095 | **+60,952 B** |
| `/editorial/` (control) | 7 | 521,901 | 127,168 | — |

That is **6.85×**, against the prototype's build-measured 7.3× (+65.1 vs
+9.0 KB, ADR-0005 §7). Same order, same verdict, slightly cheaper on the
real build.

**The DELTAS are the measurement; the absolutes are not, and that took
five builds to learn.** Three earlier drafts quoted rounded KiB and the
rounded ratio flipped between 6.8× and 6.9× — a figure that changes with
rounding is not a measurement, least of all in a table about somebody
else's byte cost. So the table moved to bytes. But the ABSOLUTES then
moved too, on every source edit the verification pass produced: five
builds gave `/plp/plain/` 527,753 / 528,052 / 528,160 raw. What did not
move is what is being claimed — the deltas held at **+8,897 to +8,915 B**
and **+60,949 to +60,993 B** across all five, a spread under 0.3%, and
the ratio at **6.84–6.86×**. Quote the deltas and the ratio; the
absolutes are a property of the build, not of the strategy.

`/editorial/` is carried as a CONTROL, and it earned its place: its
figure is byte-identical (521,901 / 127,168) across every build in this
session, INCLUDING the builds where the PLP routes moved. That is what
says these deltas are the PLP's and not the toolchain's — and the
verification pass proved the control works, by re-deriving the whole
table independently from the record's stated method and matching the
control to the byte while finding the PLP absolutes had moved under it.
Re-derive by building and summing each route's
`page_client-reference-manifest.js` chunk set unioned with
`build-manifest.json`'s `rootMainFiles`, brotli quality 11; if your
`/editorial/` figure matches, your method matches. It is a LOCAL build
measurement, not a receipt — the bench runner mints those, and it cannot
mint one for this surface yet (below).

**The RC's packaging broke the build in three different resolvers, which
is why ADR-0005 §7 pins its exact version.** `apollo-link-rest@0.10.0-rc.2`
declares `"type": "module"` with `"main": "bundle.umd.js"`,
`"module": "index.js"` and no `"exports"` map, and separately imports
`rxjs` (`restLink.js:7`) while declaring it in neither `dependencies`
nor `peerDependencies`. Measured failures, each distinct:

1. Node's ESM loader picks the UMD bundle → `TypeError: Cannot read
   properties of undefined (reading 'utilities')`.
2. Its ESM entry then uses extensionless relative imports (`./restLink`)
   → `ERR_MODULE_NOT_FOUND` under plain Node even when pointed at
   `index.js` directly.
3. Turbopack honours `module` for the server graph but falls back to
   `main` for the browser one → `Export RestLink doesn't exist in target
   module … The module has no exports at all`.
4. Under ADR-0004 §2's no-hoisting isolation the undeclared `rxjs`
   import fails outright → `Module not found: Can't resolve 'rxjs'`.

Three fixes, none of them a patch of the library: a fourth
`packageExtensions` entry (the OpenNext/qwik-city/remix-render-middleware
class, declared as a PEER for the qwik-city reason — two rxjs instances
would be worse than none), one `turbopack.resolveAlias` naming the file
the package's own `module` field already names, and one
`ssr.noExternal` line so vitest resolves it the way a bundler does.
A future bump re-runs all four as its canary.

**What the identity guard is, and why it lives in the variant.**
`variants/react-next/test/master-identity.test.ts` — the package's FIRST
test, which is what takes turbo from **30 to 31** tasks (measured:
`--dry=json` non-`<NONEXISTENT>` commands, 30 → 31, the only delta being
`@pm/react-next#test`). react-next's editorial and PDP guards live in
`tools/repo-checks/`, because `render.tsx` needs no compiler; this
surface is the first react-next one that needs workspace-local
machinery, since the fenced exhibit is only loadable through a bundler.
So react-next's guards are now **split across two homes**, deliberately,
and consolidating them is an integration call rather than a silent one.

The guard does something the repo did not have: it drives the **real
edge Worker** in-process over a stub R2/KV and feeds its actual tray to
the React render. That is not convenience. `renderPlp` computes facet
buckets (`plp.mjs:28-41`) and the Worker computes them again
(`index.js:101-119`); the renderer's own comment at `plp.mjs:22-27` says
the two comparators "must match the Worker byte-for-byte or the
crate-plane drift leg diverges", and **no test anywhere compared them**.
Re-derived precisely rather than repeated from the survey that first
flagged it — that survey said "two definitions plus one unrelated
comment", which is imprecise. **Pinned to a SHA, because the first
correction was itself falsified by writing it down:**
`git grep -c computeFacets ae97f8e` finds **8** hits at this branch's
base commit — two DEFINITIONS (`workers/edge/src/index.js:101`,
`plp.mjs:28`), two call sites (`index.js:139`, `plp.mjs:74`), four prose
mentions (`plp.mjs:23`, `cpu.ts:13`, `bench-runner/README.md:66`,
`build-log.md:664`) — and not one assertion. An earlier draft of this
sentence said "four prose mentions" of the WORKING TREE, and the working
tree now has seven, because this record, the decision-map ticket and the
guard's own comment are three of them. A count of "the tree" is falsified
by the act of recording it; a count at a SHA is not. **That is the third
time in this unit that an edit moved a citation the same edit was
making** — the other two were the sixteen-line insert into
`normalize.ts` shifting two of its own references — and pinning to a
commit is the durable form, not more care. Comparing the rendered rail against the
reference's now pins that agreement as a side effect, on both committed
snapshots, which is where the ICU disagreement the comment records was
found.

Coverage: both snapshots × both ends of the `n` knob (24 and 240) — the
axis is the CONDITION, not the tray, because `renderPlp` slices
`snapshot.summaries` and the PDP guards' per-tray sweep would prove one
page many times. Plus the committed master artifact, the stylesheet
list, the fence, the seeds, the clamp, page ≥ 2, crate facet encoding,
the cold arm's request ordering, the address-bar duties, which stylesheet
list each route GROUP actually passes, whether each cache arm READS its
cache at the condition's key, and whether a pagination click is really
intercepted, and whether the seeded entry is stale under the published
window. **37 tests / 155 `expect` calls, 1.07 s local** (derived:
`vitest run`, `grep -c 'expect('`). The budget is the bench runner's `300_000` on the
catalogue legs, per the standing rule that a timeout catches a HANG and
is never fitted to a local timing — measured local→CI ratios on this
repo span 2.1× to 15.5× on one runner in one run.

**That sentence was FALSE when it was first written, and it is worth
more than the fix.** The record claimed the budget for hours while the
file carried none: the heaviest leg is 107 ms here, comfortably under
vitest's 5 s default, so nothing local could ever have shown it — and
the default is exactly what failed PR #30's `check` job and skipped its
deploy while the merge event looked successful. Caught only by going
back to check the claim against the file after the PR was opened. The
budget exists now, on the four catalogue legs and on the library canary
(155 ms and the slowest leg in the file, but two recursive greps over a
package tree, so a cold CI filesystem is the case it is for), and it is
proven in BOTH directions rather than asserted: a deliberate 6 s delay
inside a budgeted leg passes, and the same delay in an unbudgeted one
fails with `Test timed out in 5000ms`. A claim about a timeout that no
local run can falsify is the same shape as the sixteen vacuous guards
above — a true-sounding statement with nothing underneath — and it got
into the record by the same route: written from intent rather than from
the file.

**52 sabotages, no crashes — and 19 of them PASSED against the
guard as it then stood, every one of those 19 a vacuous guard this unit
had written.** (Counts derived from the table below with `awk` after the
final edit, not tallied by eye — an earlier draft of this sentence said
"thirty-five" against thirty-three tabulated rows, which is the same
class of error as everything else here.)

**Where the vacuous-guard count comes from, so it is not a second
tally.** It IS the table's "passed" column: 19 sabotages that a guard
claiming to cover them did not catch. One further vacuous guard earned
no row — the route-wiring gap, found by looking for the pattern rather
than by tripping over it — and a couple of the 16 are the same guard
vacuous on two independent axes, so "distinct guards" is a slightly
smaller number than 16 and "instances" is 17. The honest headline is the
one the table supports: **19 tabulated sabotages passed against a
guard written to catch them.** Green is not proof, so each
leg was broken on its own axis and watched to fail with the message it
was written to give, then restored from a copy (never
`git checkout --`), then re-verified byte-identical:

| sabotage | caught by | not caught by |
|---|---|---|
| image boundary `i < 4` → `i <= 4` | identity, at card 5 exactly | — |
| style facet cut 12 → 11 | identity, on the rail's title | — |
| facet href gains `&cache=cold` | identity, on the first facet | — |
| tanstack seed removed | the seed leg | the markup legs |
| apollo seed removed | the seed leg | the markup legs |
| `PLP_CSS` drops `facets.css` | the stylesheet leg **only** | identity |
| exhibit sheet list == benchmarked | the exhibit-sheet leg | — |
| `clampPlpN` max 240 → 200 | the clamp leg | — |
| plaque loses `data-pm-fenced` | all three fence legs | — |
| facet param list drops `q` | the condition leg | — |
| `plpHistoryUrl` drops `cache` | the condition leg | — |
| apollo island renders nothing | strategy parity + fence-drop | — |
| ordering gate dropped on success | the cold-arm ordering leg | everything else |
| ordering gate dropped on failure | the cold-arm fallback leg | everything else |
| `plpHistoryUrl` drops `n` | the condition + round-trip legs | — |
| Apollo "adds" staleTime (token swap) | the library canary | — |
| the canary's sweep path is wrong | its non-vacuity control | the canary itself |
| pagination window re-anchored at 1 | the page sweep, at page 6 exactly | the page-2 guard |
| plaque version hardcoded to 9.9.9 | the installed-pin leg | — |
| declared range floated to `^4.0.0` | the installed-pin leg | the leg's FIRST draft |
| tanstack loses its popstate CALL | the wiring leg | **its first draft — passed** |
| apollo loses its error-floor CALL | the wiring leg | **its first draft — passed** |
| plain loses its navigate fallback | the wiring leg | — |
| the hook stops removing its listener | the wiring leg | — |
| Next anchor hardcoded to page 2 | the page-2 leg, once fixed | **its first draft — passed** |
| benchmarked layout takes the exhibit's sheets | the layout-wiring leg | **the sheet legs — passed** |
| exhibit layout drops the plaque sheet | the layout-wiring leg | — |
| `PLP_CSS` reordered, same members | the stylesheet leg (order counts) | — |
| `encodeURIComponent` dropped from facet hrefs | 9 legs, named | — |
| the committed master truncated to 30 lines | the artifact leg | the renderer legs |
| a route stops reading its query | the route-wiring leg | everything else |
| a route drops `force-dynamic` | the route-wiring leg | everything else |
| repeated param takes the LAST value | the searchParams leg | — |
| tanstack per-query `staleTime` → 0 | the query-options leg | **the seed leg — passed** |
| apollo `fetchPolicy` → `network-only` | options + cache-read legs | **its first draft — passed** |
| apollo ignores its cache, renders `initial` | the cache-read leg | **the markup legs — passed** |
| tanstack `queryKey` pinned to one page | the cache-read leg | **the seed leg — passed** |
| `preventDefault()` removed from the click | the interception leg | — |
| modified-click guard removed | the interception leg | — |
| `push` → no-op in `PlpPlain` | the wiring leg | **its first draft — passed** |
| `assign` deleted from `useNavigateOnError` | the hook-body leg | **its first draft — passed** |
| plaque added to the BENCHMARKED plain route | the plaque-exclusivity leg | **the fence legs — passed** |
| the published window set to the library default | the staleness leg | **the seed leg — passed** |
| `run` dropped from the tray URL | the nonce leg | **the round-trip leg — passed** |
| `run` dropped from the address bar | the nonce leg | **the round-trip leg — passed** |
| `run` validation dropped (junk reaches KV) | the nonce leg | — |
| cache arms push on the CLICK again | the wiring leg | **its first draft — passed** |
| `usePushWhenSettled` pushes duplicates | the wiring leg | — |
| `navigateOrReload` always assigns | the hook-body leg | **its first draft — passed** |
| the mount latch removed | the hook-body leg | **its first draft — passed** |
| condition compare → string compare | the hook-body leg | **its first draft — passed** |
| `retry` back to TanStack's default | the seed leg | **its first draft — passed** |

The stylesheet row is the useful one: dropping a stylesheet passes the
normalized-DOM compare, because the normalizer serializes the BODY only
and never the head (`normalize.ts:406-411`). That citation was
`:392-396` in an earlier draft, which is the delivery-element drop
inside `serializeChildren` — wrong, and wrong in a specific way worth
recording: it was correct when written and this unit's OWN sixteen-line
comment in the same file shifted it. Re-derived by re-opening the range
rather than by adding sixteen. The separate stylesheet leg is the
only thing between that and a route served unstyled — the
`format-switch.css` failure mode, reproduced deliberately.

**One of this unit's own guards was vacuous first, and the fix is the
point.** The seeded-cache leg originally asserted that the islands
render 24 cards on the server. Both islands render `data ?? initial`, so
it passed whether or not the cache held anything — a cache that never
held the tray would fire a request the server had already paid for on
every load, and "a revisit costs 0 requests" would be false with nothing
red. The seeding is now an exported function the guard calls directly,
asserting the entry through the SAME key and document the components
read, plus the complement that a DIFFERENT condition does **not**
resolve from the seed. Rows 4 and 5 above are that fix being proven.

**Six more things the verification pass changed, all but one in this
unit's own code.**

1. **A fairness defect in the cold arm, fixed.** Two quick paginate
   clicks raced: the LAST RESPONSE won rather than the last click, so
   clicking 2 then 3 could land on page 2 with the URL pushed to match.
   TanStack and Apollo both get request ordering FREE from their
   libraries (each re-keys on the condition and renders whatever the
   current key holds), so leaving cold without it would have made the
   baseline look worse for a reason that is not its data strategy —
   rigging in the punishing direction, which ADR-0001 §9 forbids exactly
   as much as the flattering kind. The fix is a ticket compared against
   the newest request, gating BOTH the success commit and the navigation
   fallback. It is not a cache: every navigation still pays a full
   fetch, and a superseded response is dropped after its bytes are
   already spent, so the byte cell is untouched. The whole request path
   is extracted to a `paginate()` function precisely so a test can drive
   it — `renderToStaticMarkup` runs no handlers and no effects, so an
   inline version would have been an untested claim about the arm the
   `plp-paginate` cell will measure. Sabotage-proven both ways.
2. **The degenerate page is now pinned, and on the FIXTURE it is one
   click away.** At `?n=240` the fixture holds ONE page (240 releases),
   so the master's own unconditional `rel="next"` links `?page=2&n=240`
   — the very next click. The crate is NOT the same and an earlier draft
   of this line said it was: 500 releases at n=240 is THREE pages, so
   its first empty page is 4, three clicks out (`totalPages` re-derived
   from the Worker for both snapshots rather than reasoned). The defect
   is identical either way — the link is unconditional, so it appears at
   the LAST page of every `n` — but "one click" is a fixture fact, and
   the guard is correctly fixture-scoped.
   Measured: an empty grid, an honest `0–0` count rather than a
   fabricated range, and ZERO `aria-current` in the pagination, since no
   page in the 1..5 window equals the served page. The earlier draft of
   this record called that an n=240 curiosity; it is reachable from a
   served page in a single click, and mirroring the reference means it
   appears at the LAST page of every `n`, not just at 240. Pinned rather
   than fixed, for the fork reason above — the day the reference diff
   lands, the pin fails and follows it.
3. **`noindex` on the exhibit: considered, rejected.** It reads sensible
   — a deliberately-wrong-tool page is not a catalogue result — but it
   would have been the repo's FIRST indexing policy, set unilaterally
   inside one variant. Verified before deciding rather than after: no
   robots.txt under `workers/front`, no variant sets robots metadata
   anywhere, the only master carrying `<meta name="robots">` is
   `a11y/element-demos`, and the established FENCED precedent — remix3 —
   does not noindex either.
4. **The exhibit claimed a cache window it does not have.** An earlier
   draft exported `APOLLO_STALE_TIME_MS = PLP_STALE_TIME_MS` and the
   guard asserted the two equal — a true statement wired to nothing,
   because **Apollo has no staleTime knob at all**. Verified rather than
   recalled: `grep -rl staleTime` across the installed
   `@apollo/client@4.2.12` returns nothing. Its window under
   `cache-first` is unbounded. Manufacturing a five-minute TTL in Apollo
   was rejected — ADR-0005 §4's rule is that documented configuration is
   fair and "hand-tuning is configuration that exists only to win a
   cell", and a hand-rolled TTL is hand-tuning in the flattering
   direction. The exhibit now runs the library's documented default and
   SAYS the window differs: the lead's claim is "free for five minutes,
   by published config", the exhibit's is "free until eviction, by
   library default". The library fact is pinned as a canary with a
   non-vacuity control (a control sweep for a token Apollo really ships,
   so a typo'd path cannot read as "no staleTime here"), and that canary
   was itself sabotage-proven in both directions. Its first draft used
   `execFileSync`, which throws on grep's exit-1 — so the guard crashed
   on its own SUCCESS path, the crash-not-a-guard shape this log has
   condemned before. It uses `spawnSync` and distinguishes exit 1 from
   exit ≥ 2 now.
5. **A second asymmetry that would have punished the exhibit.** The lead
   carries `placeholderData: keepPreviousData`, so a paginate click
   keeps the previous grid on screen; the exhibit had no equivalent and
   would have snapped back to the SERVED page's data mid-navigation.
   Apollo's own documented equivalent is `previousData` on the
   `useQuery` result (`useQuery.d.ts:179` in the installed package), and
   the exhibit uses it. ADR-0005 §7 requires the exhibit to be fair to
   be evidence, and a flicker the lead does not have is not a property
   of pointing a GraphQL client at REST.
6. **This unit's own facet-encoding test was wrong first.** It asserted
   that every awkward crate facet value appears URL-encoded in the
   rail, and failed on `Indie Rock` — a style ranked 13th of 95, which
   the `top 12` cut means the page never renders. The test now slices
   the same way the component does. Worth recording because the failure
   mode was a test making a claim about markup that does not exist,
   which passes as thoroughness right up until it doesn't.

**The staged verification pass found six more, and its best finding was
one this unit had already printed and read past.** The lenses run
sequentially against the committed tree; the first one alone returned
seven, and every one below survived re-derivation.

1. **No `aria-current` on any page from 6 onward — a full grid of 24
   real cards, one click from page 5's own Next link.** The pagination
   window was anchored at `[1..min(totalPages,5)]`, which is exactly
   what `plp.mjs:88` does and is correct there because `renderPlp` only
   ever renders page 1. Generalized to page N it means no rendered link
   equals the served page from 6 on, so the `--current` branch never
   runs. **This unit's own page probe had printed page 10's pagination
   with no current marker and the reading missed it** — the window now
   slides with the served page (reducing to `[1..5]` at page 1, which
   the identity legs prove), and the guard sweeps pages 1,2,3,5,6,9,10
   rather than page 2 alone. Sabotage-proven: re-anchoring fails at
   page 6 exactly.
2. **A failed page change painted the SERVED page's grid under the new
   page's URL, on both cache arms.** They push history on click and
   render `data ?? initial`, so a failed fetch left the page looking
   fine and the receipt lying — worse than an error. Both now fall back
   to the real navigation the anchor would have done unaided, which is
   the floor the cold arm always had.
3. **Three `pushState` writers and zero `popstate` listeners.** Back
   moved the address bar while every island kept its `useState` value,
   so the URL and the grid described different pages with nothing to
   reconcile them. Next's own docs for this version say raw `pushState`
   integrates with the router and updates the stack "without reloading
   the page", so there is no document load to save it. All three arms
   now restore through `readPlpCondition` — the same derivation the
   server route uses, so a restored page cannot disagree with a served
   one about what its URL means.
4. **The plaque's "INSTALLED pins" leg compared a file with itself.** It
   read `variants/react-next/package.json` and compared it against a
   constant DERIVED from that same file — it could not fail under any
   change, while its name said "the INSTALLED pins" and its comment said
   "the versions the lockfile actually installs". It now resolves each
   package's own manifest. Sabotage-proven on the axis the old one was
   blind to: floating the declared range to `^4.0.0` against an
   installed `4.2.12` now fails.
5. **The record still claimed in two places that the exhibit "holds the
   LEAD's window"** — in this section and in the code comment that is
   the first thing a variant author reads — while the same document
   proved three paragraphs later that Apollo has no such window. Both
   rewritten.
6. **A citation this unit's own edit invalidated.** The sentence about
   the head discard cited `normalize.ts:392-396`, which was right when
   written and became the delivery-element drop when this unit inserted
   sixteen lines of comment above it. Re-derived by re-opening the
   range, not by adding sixteen. **The lesson is the general one: an
   edit to a file moves every citation into it, including your own.**

**FIVE of this unit's own guards were vacuous, and the pattern is worth
more than any of them.** In order of discovery:

1. **The seed leg** asserted that the islands render 24 cards — true
   whether or not either cache held anything, because both render
   `data ?? initial`.
2. **The structural wiring guard**, written to close findings (2) and
   (3) above, used `src.includes("usePopstateCondition")` — satisfied by
   the IMPORT line alone, so deleting the CALL from two of the three
   arms left it green. Caught by sabotaging the fix and watching it
   pass.
3. **The plaque's "INSTALLED pins" leg** compared
   `variants/react-next/package.json` against a constant derived from
   that same file.
4. **"points Next at 3"** asserted `toContain('href="?page=3"')` — which
   at page 2 the NUMBERED link for page 3 satisfies, so hardcoding the
   Next anchor back to page 2 survived it.
5. **The stylesheet legs** compared the two exported constants and
   nothing connected either to a route, so pointing the BENCHMARKED
   group's layout at `PLP_APOLLO_CSS` — shipping the plaque sheet on the
   two measured strategies, which is measured bytes on a published cell
   — passed every assertion in the file.

**All five are one shape: asserting that a NAME or a SUBSTRING is
present, rather than that the MECHANISM under test runs or is
connected.** Three of the five were found only by sabotage, and two of
those only after the fix for an earlier finding was itself sabotaged.

**Then a staged lens found EIGHT more of the same shape, and the count
stopped being the point.** Every leg in the file proved a CONSTANT or a
WRITE, and none proved a READ — so all of these stayed green with the
behaviour broken: the lead's per-query `staleTime` set to 0 (the guard
checked the CLIENT DEFAULT, which the component overrides); the
exhibit's `fetchPolicy` swapped to `network-only`; the exhibit ignoring
its cache entirely; either arm's cache key pinned to one page;
`preventDefault()` deleted from the pagination click, which silently
turns every strategy into a full document load; `push` made a no-op, so
the URL never moves; `window.location.assign` deleted out of the error
floor while every call site stayed; and a fenced plaque added to a
BENCHMARKED route, which the fence legs cannot see because they render
the ISLANDS and not the PAGE.

The fix was seams rather than more assertions. Both islands' inner
components and their query-options builders are exported, so a test can
seed a cache with page X, ask for page Y, and watch which one renders —
a cache that is read and a cache that is ignored are then
distinguishable without a DOM. And `PlpArticle` is a plain function, so
its returned element tree can be walked and the anchor's own `onClick`
invoked with a stub event: `preventDefault` and the modified-click
escape are now driven, not grepped. All nine sabotage-proven.

**Writing the pattern down paid for itself twice: a SIXTH instance was
found by looking for it rather than tripping over it, and the eight
after it were found by a lens told to look for exactly that shape.** Every leg
in the file tested the CONDITION machinery — the clamp, the facet
forwarding, the round-trip — and not one connected it to a route. A page
that never read `searchParams` would have served n=24 while the chrome
tagged the visit `n=240|cache=cold`, because the beacon tag is derived
from the URL and never from what was served
(`packages/measurement/src/beacon.ts:47-58`): a false receipt with
nothing red. The three inline query-parsing blobs are now one tested
`conditionFromSearchParams`, and a structural leg holds each route to
calling it, to fetching for the result, and to staying `force-dynamic`
(without which `?cache=` means nothing, since a cached render serves one
warmth under both presets). All three sabotage-proven.

**And the count did not stop there.** The client-path lens added three
more of the same shape, two of which were the FIXES for its own findings
being vacuous on their first draft: the round-trip leg was closed under
a dropped `?run=` (a round-trip over a type that lacks a field cannot
notice the field going missing); the wiring leg accepted a
`usePushWhenSettled(…, true)` that pushes on the click after all; and
the hook-body leg accepted a `navigateOrReload` that only ever assigns.
Sixteen tabulated sabotages passed in total, which is the number the
table supports and the one to quote.

**"The tests are green" was true the whole way through every one of
them** — through 36 passing tests, three full `pnpm run check` runs at
31/31, and a clean `next build`. That sentence is the finding. A suite
that is green while 19 of its own guards excuse the behaviour they
name is not a weaker version of a suite that catches them; it is a
suite that reports the opposite of the truth, and nothing in the green
distinguishes the two. The only thing that did was breaking each guard
on purpose and watching what happened.

Its limits, stated rather than implied: those two hooks are effects, and
nothing in this workspace runs effects or has a DOM — so no test here
proves that Back actually restores or that a failure actually navigates.
What the guard proves is that no arm silently loses the wiring, which is
the failure that actually happened, twice. The behavioural proof is owed
to the origin suite's JS-on leg, where this repo already puts JS-on
control checks, and it is named as owed rather than quietly skipped.

**A fourth lens went at the CLIENT path — the half no guard in this repo
can reach — and found the worst defect of the unit.**

1. **`?run=` never reached the edge Worker, from any of the three URLs
   this build derives.** The bench runner sets the isolation nonce on
   every measured URL (`tools/bench-runner/src/batch.ts:79`) and the
   Worker folds a well-formed value into the KV key
   (`workers/edge/src/index.js:51-53, 127`) — that is how a batch mints
   warm state without touching other runs', or live visitors'. `run` was
   not a field of `PlpCondition`, so the SSR tray fetch, the client tray
   fetch and the pushed history URL all dropped it: every batch, every
   post-deploy smoke and every visitor would have shared ONE
   infinite-TTL warm entry, and the warm column would not have been
   reproducible in the way its own receipt claims. On the surface whose
   entire subject is measurement. It is fixed, validated with the
   Worker's own regex (asserted against the Worker's source, not
   re-typed), and proven by driving the real Worker: a nonced request
   MISSES the shared entry and mints its own.

   **The guard could not see it, and the reason is the unit's own
   pattern in a new place.** The round-trip leg asserts
   `readPlpCondition(plpHistoryUrl(c)) === c` over `PlpCondition`
   values — and a round-trip over a type that LACKS a field is closed
   under that field's loss. A guard shaped like the thing it guards
   cannot notice what the thing forgot.

2. **The two cache arms moved the address bar on the click, not on the
   content.** Under `keepPreviousData` (and Apollo's `previousData`) the
   grid keeps painting the previous page until the new one lands, and
   `PlpArticle` derives its whole pagination from the payload it is
   handed — so for the entire in-flight window the URL said page 2 while
   `aria-current="page"` said page 1: a wrong receipt AND a wrong
   announcement. It compounded, too: the "2" link stays live in that
   window, so a visitor who sees nothing change and clicks again pushes
   the SAME URL a second time (`pushState` appends unconditionally,
   unlike a hash assignment), and Back then lands on the duplicate and
   looks dead. The cold arm never had either problem — it pushes after
   the payload commits — and ADR-0005 §1's discipline is that the arms
   differ by exactly one architectural move; differing in WHEN the
   address bar moves is a second one. Both cache arms now push when the
   displayed page is the requested page, and never push a URL the bar
   already shows.

3. **The error floor moved the visitor FORWARD on the Back path.**
   `location.assign` always appends a history entry, including for the
   URL already in the bar. So: press Back, the restore re-fetches, the
   fetch fails, the floor `assign`s the re-derived URL, and the browser
   leaves the history position the visitor just navigated to — Back goes
   dead. Invisible on the click path, where the target really is
   somewhere new, which is why it survived the first draft of both hooks
   AND of the cold arm's restore. `navigateOrReload` reloads when the
   target is where we already are and assigns otherwise.

**And one this lens found that is NOT fixed here, deliberately.** A
cmd/ctrl-click on a paginate link goes somewhere different from a plain
click on the same link: the intercepted path preserves the whole
condition, while the raw `href` carries only `page` and `n` — so
cmd-clicking "2" from `?cache=cold&genre=Jazz` opens the EDGE-CACHED
condition with the filter gone. Two measurement conditions behind one
link. **That href IS the contract's** (`plp.mjs:63-68`, the same
`pageHref` whose dropped `cache` is already reported above), so fixing
it per-variant forks it again and leaves the htmx PLP to guess. It is
therefore folded into the reference diff rather than patched here — and
it makes that diff more urgent than "a paginate click loses the
condition" alone suggested, because it is now also a way for two tabs to
disagree about what they are measuring. An alternative was considered
and rejected: having the strategy supply the href builder, so the served
DOM keeps the master's link and the hydrated DOM carries the full
condition. It works, and it introduces a deliberate
server/client href difference in the one variant whose published
initial-JS cell was already paid for once by a hydration bug.

**Four things this lens SUSPECTED and cleared, recorded because a
checked-and-cleared risk is worth as much as a finding.**
`apollo-link-rest`'s `@rest(path: "{args.path}")` does NOT percent-encode
the tray path — I drove the installed link with a stubbed `fetch` and it
requested `/api/plp?n=24&page=2&cache=cold&genre=Folk%2C%20World%2C%20%26%20Country`
verbatim, which would otherwise have 404'd every Apollo pagination click.
No stale-closure contamination in TanStack's `queryFn` (key and function
are installed as a pair per render). No reload loop in either error
floor. And middle-click is safe: modern engines dispatch `auxclick`, not
`click`, so React's handler never runs and the anchor navigates for
real.

**One follow-up this unit did NOT take, named rather than left.**
`loadFeatured`/`loadDetail` (`src/lib/edge.ts:23-39`) drop `run` the same
way `loadPlp` did, on the PDP and editorial paths. Those surfaces are
already published and re-measuring them is not this unit's call, so the
durable fix — forwarding `run` in `edgeFetch` from the incoming request
rather than per-surface — is reported for integration instead of applied
under a PLP branch.

**The fifth lens returned NINE, and three of them were defects the
fourth lens's fixes had just introduced.** That is the sharpest thing
this unit learned: a verification pass is not a filter you run once.

1. **`usePushWhenSettled` — the fix for the URL-timing defect — fired on
   MOUNT.** The seeded cache resolves on the first render, so `settled`
   is true immediately, and the hook compared STRINGS: the served
   `?n=24&run=bench-abc&cache=cold` is not the string
   `?cache=cold&run=bench-abc` even though it is the same condition
   (default `n` dropped, different order). So every bench-measured load
   of the two cache arms rewrote its own URL and took TWO history
   entries where the cold baseline takes one — a second architectural
   difference between the arms, introduced by the fix for the first one.
   Now a mount latch plus a `sameCondition` comparator, both
   sabotage-proven; `navigateOrReload` had the same string-equality bug
   and got the same treatment.
2. **The fenced plaque overstated its own evidence.** It said "It works,
   and the page you are reading is the proof." It is not: the grid on
   that page is server-rendered by `loadPlp`, byte-identically to the
   plain arm, and handed to Apollo as a cache SEED — so Apollo issues no
   request for anything the reader is looking at. Its REST path is
   exercised only by a later pagination click, which nothing in this
   repo drives yet. The exhibit was overclaiming on the one page in the
   repo whose subject is not overclaiming. The copy now says what the
   page shows (server-rendered grid; Apollo answers the page changes)
   and the behavioural proof is owed to the origin suite.
3. **"Apollo holds the lead's window" survived in a THIRD place** — the
   `PLP_STALE_TIME_MS` docstring — after being corrected in the
   exhibit's file header and in this log. Three homes for one falsehood,
   found one lens at a time.
4. **The unbacked `isPending: false, isFetching: false` claim survived
   in the lead's file header** after being corrected here. And the
   lens's own reasoning is the reason it was worthless: nothing fires a
   request during `renderToStaticMarkup`, so an `isFetching` reading
   proves nothing about a real mount either way. Staleness was always
   the seam.
5. **`retry: false` was a second non-default knob on the measured lead
   arm, published nowhere.** TanStack retries three times with backoff
   by default; this arm does not, so a failed page change reaches the
   error floor at once instead of after three silent re-requests that
   would put bytes and seconds into an interaction cell without
   appearing in any receipt. ADR-0005 §4's rule is that configuration is
   published copy — so it is published in the docstring now, and
   asserted, because an unasserted published knob is this file's own
   recurring shape.
6. **Three citation and count slips, in a record that makes citation
   discipline its standard.** `pdp.test.ts:642` is `:641` (wrong in four
   places, and wrong when written — that file is untouched by this
   slice, so nothing moved it; it was simply miscounted). The edge
   Worker's parse range cited `:122-127` for `n`/`page`/`cache`/`run`,
   but `cache` is read at `:62` inside `serveData`, outside the range.
   And the test counts were a commit behind. The lens also confirmed
   that roughly forty other citations in the record ARE correct, which
   is the point: a reviewer who spot-checks one, finds it off, and stops
   checking discounts the forty that hold.

**The origin suite ran in CI, and it settles one of this unit's two open
questions and sharpens the other.** The unit could not run it locally —
three parallel agents held its ports — so it was designed to be
verifiable without it and the gap was named rather than skipped. Opening
the PR ran it: **17 files, 510 tests, all passing**, against a live
composed origin built from this branch, with `/plp/apollo`, `/plp/plain`
and `/plp/tanstack` all present in the build output.

What that DOES settle: `suite/pdp.test.ts` (82 tests) passed, and that
file carries the editorial eight-chunk pin at `:641`. The integration
risk this unit flagged — that adding client islands re-groups the client
graph under a published initial-JS cell — is now checked where it counts
rather than inferred from a manifest diff.

What it does NOT settle, and the record must not let the green imply
otherwise: **zero legs requested `/react-next/plp/…`**. Grepping the
suite's own output for that path returns nothing. The two `plp:` legs
that do appear ("the normalizer extracts identically across independent
loads", "pixels stabilize") are drift-gate self-checks over the reference
MASTER and predate this unit. So the suite proves this branch breaks none
of the 510 existing assertions; it proves nothing about the three routes
it adds. Every browser-level claim about them — that the served page
carries the App Router wrapper the noise registration excuses, that Back
restores, that a failed page change falls back to a real navigation —
remains owed to PLP legs that do not exist yet.

**The editorial chunk pin, measured rather than worried about.**
`tools/origin-suite/suite/pdp.test.ts:641` asserts the editorial page
references exactly EIGHT client chunks, under a published initial-JS
cell, and adding client islands is exactly what re-groups a chunk graph.
Measured directly: built the app twice, once with the three PLP routes
and their islands present and once with them moved aside, and diffed
editorial's `page_client-reference-manifest.js` chunk set. **Identical**
both times (three chunks, same names). That is strong evidence, not
proof — the suite counts `<script src>` in the SERVED HTML, which
includes root and shared chunks the manifest does not list, and only the
origin suite can count those. Integration should re-check it there.

**Two defects in the contract renderer, mirrored rather than fixed, with
diffs reported.** `packages/reference/**` is read-only to this unit, and
a variant that unilaterally improved on the master would fork it — the
htmx PLP arriving in parallel would then have to guess which behaviour
to copy. So both are reproduced exactly and reported:

1. `plp.mjs:134` emits `rel="next"` unconditionally. At `?n=240` the
   fixture has ONE page and the master still links `?page=2&n=240`, a
   page with zero releases (verified by rendering both).
2. `plp.mjs:51` builds facet hrefs as `?${param}=${value}` — a single
   param that drops `n`, `cache` and `run`. Its own neighbouring comment
   at `:60-68` says pagination hrefs "preserve the WHOLE condition
   (URL-as-receipt, ADR-0004 §5)" after a verify-slice finding that a
   hardcoded `?page=N` "silently reset the visitor's condition"; the
   facet links were never given the same treatment, and `pageHref`
   itself still drops `cache`. So a facet click on `?cache=cold` lands
   on the edge-cached condition — which is precisely what the
   `plp-facet-toggle` registry entry is supposed to measure.

A third gap, not a defect: `renderPlp` takes no `page` argument, so page
≥ 2 is not expressible by the contract at all while the master links to
`?page=2..5` on every visit. Serving those a 404, or serving page 1
under a page-2 URL, are both worse than generalizing, so this build
generalizes — the `--current` marker moves to the served page and
`rel="next"` points at `page + 1` — and states it. At page 1 it reduces
to the master exactly, which is what the guard compares. **Unit 2 must
make the same call or the two PLP variants disagree on page 2.**

**Nothing new registered in `PERMITTED_NOISE`, and that is measured.**
The catalogue, the facet rail and both cache islands normalize equal to
the master under `NO_NOISE`. Two species the surface DOES add are
already covered without a registration: React 19 hoists a
`<link rel="preload" as="image">` per eager card image (a delivery
element the normalizer drops unconditionally — invisible to the
contract, visible in the byte cell, which is the correct split), and the
exhibit's `[data-pm-fenced]` plaque, dropped only by the exhibit's own
comparison legs through the call-site `dropFencedSubtrees` flag that no
registration can smuggle in. Scope stated rather than implied: that
measurement is in-process, and `renderToStaticMarkup` never emits the
App Router streaming wrapper the existing registration exists for, so it
does not re-prove the SERVED page. The origin suite owes that.

**What this unit could not do, and did not fake.** The client-cache
arm's headline cell — "a revisit costs 0 requests / 0 bytes" — is
measurable only through a named interaction-registry entry split into an
unmeasured priming prefix and a measured step (ADR-0005 §3).
`INTERACTIONS` (`collect.ts:33`) is still the flat
`(page) => Promise<void>` shape and its keys are exactly `none`,
`body-click`, `editorial-add-to-cart`, `pdp-gallery-switch` and
`pdp-add-to-cart` — **no `plp-*` id is a registry entry** (derived by
parsing the object, not read by eye). Stated precisely, because an
earlier draft of this line said the six appear "only in `docs/`" and
that is no longer true: they appear in `docs/adr/0005`,
`docs/build-log.md`, `docs/prototypes/surface-design/panel-findings.json`
and in this unit's own test comment — four files, all prose, none of
them a registration. `tools/bench-runner/**` is out of bounds. So the arm is built to the published design and the number
is not approximated.

**The fence does not reach the runner, and shipping this route opens
that gap.** `assertBenchableTarget` (`batch.ts:125-137`) keys on
`resolvedPathSegments(path)[1]` against `FENCED_VARIANT_PREFIXES` — a
VARIANT set. Ran the exact derivation: `/react-next/plp/apollo/` yields
prefix `"react-next"`, so the runner accepts it and a receipt naming the
exhibit can be minted today. Widening that set is not the fix — it would
refuse three benchmarked strategies plus react-next's editorial and PDP
columns. A route-level fence needs a second registry consulted in the
same function. FOUR more layers share the blind spot, and the fifth lens
found the fifth:

- `build.mjs:244` keys lab columns by `target.variant`. An earlier draft
  of this line said a fenced Apollo target would OVERWRITE a benchmarked
  react-next column. **That is not reachable, and the correction matters
  because the reachable failure is worse-shaped.** `build.mjs:123-125`
  compares the batch's measured variants against the registered set with
  an EXACT match in both directions, so two `react-next` targets in one
  receipt are refused outright. What IS reachable is **substitution**: a
  batch that measures the exhibit *instead of* `/plp/plain/` publishes as
  the react-next column, exact match satisfied, nothing red. Same
  severity, different mechanism — and a fence written against the wrong
  one would not catch it.
- **For a `strategies` surface the column AXIS never meets.**
  `chrome.ts:226-229` keys the reading table by strategy LABEL;
  `build.mjs:244` keys the bundle by VARIANT. The day `plp` gets
  `labBundle: true` and its first receipt lands, every cell renders an
  em-dash under the caption "Every number above links its receipt", and
  the build throws nothing, because its only column-axis check compares
  variants against variants. C2 stated over a table with no cells —
  precisely what `bundleFromReceipt`'s column check exists to prevent,
  one axis over.
- Receipts carry no strategy field at all (`batch.ts:244` destructures
  `[, variant, surface]`), so `/plp/apollo/` and `/plp/plain/` produce
  identical labels.
- The HUD's `fencedHere` (`chrome.ts:279`) matches on variant, so the
  exhibit page renders the full lab table with no fenced note.
- **The fifth, and the only one live for real visitors on day one: the
  beacon `surface` tag.** ADR-0005 §2 says in as many words that "the
  data strategy rides in the existing `surface` tag's value
  (`plp-plain`, `plp-tanstack`, `plp-loaders`, `plp-apollo`)". It is
  unimplemented — `grep -rn` for any of those four strings across every
  source file returns ZERO — and the front Worker derives the tag as
  `url.pathname.split("/")[2]` (`workers/front/src/index.js:133`), so all
  three routes beacon `surface: "plp"`. The FENCED exhibit's RUM pools
  into the same bucket as the two benchmarked strategies, and no
  per-strategy PLP cell can be split out of RUM at all. The exhibit's
  numbers enter a number it is defined to be excluded from, by the one
  path that needs no bench run to happen.

All of those files are outside every unit's boundary. The single fix
that closes the most of them: `bundleFromReceipt` resolving a strategies
surface's column identity from the preset list (match `target.path`
against `preset.path` + `preset.query`) and refusing a target that
matches a `fenced` preset — that is the route-level bench hole and the
column hole in one place. `workers/front/methodology/index.html:303-307`
already tells readers the runner-side refusal "extends to it when the
catalogue surface it lives on is built" — that sentence becomes false on
merge unless the gap closes with it.

**A measured regression the registry change causes, in nobody's
boundary.** Driving the real `renderChrome` over the four registry
states (a probe that mutates `SURFACE_CONTROLS` in memory and restores
in a `finally`, the `chrome.test.ts:73-77` idiom):

| registry state | `/plp/apollo/?cache=cold` aria-current | "Served by" |
|---|---|---|
| today (`variants: []`) | `["Misapplication exhibit — Apollo on REST"]` | 0 of 2 |
| + react-next, planned deleted | **`[]`** | 1 of 1 |
| + react-next, planned `["htmx"]` | **`[]`** | 1 of 2 |
| + react-next + htmx, planned deleted | **`[]`** | 2 of 2 |

Registering the variant makes `cells` non-empty, so the fallback at
`chrome.ts:155-158` — the only branch that ever marks the fenced preset
current — stops running, and `presetIsCurrent` fails for all three live
presets because `/plp/apollo/` is not a prefix of their paths. The strip
renders ZERO `aria-current` on the one page that most needs to say where
you are. The variants branch has an explicit fenced-current arm
(`:173-175`); the strategies branch has none, and no test asserts
aria-current on a strategy switcher, so it would ship silently.

**The registry deletion is right only if Unit 2 lands with this.** The
same probe: with both variants live the panel reads "Served by 2 of 2"
and zero "not built yet" columns, which is coherent. With only this unit
and `plannedVariants` deleted it reads "Served by 1 of 1" while the
table still discloses one unbuilt column — the count and the table
disagree. If integration takes only one of the two PLP units,
`plannedVariants` must become `["htmx"]` rather than disappear.

**Three files this unit is blocked on, all outside every boundary,
reported rather than grabbed:** the edge Worker's PLP facet params
(ADR-0005 §5's "This is the PLP build's contract" — the Worker still
handles `n`, `page`, `cache`, `run` only), the two `pm-plp__head` /
`pm-plp__results` rules `plp.css` owes, and the `OWED` registry
retirement that must land in the same branch as those rules or
`master-styles-resolve`'s self-expiry leg fails. Until the first lands,
a facet click serves the UNFILTERED grid under a filtered URL. The
routes forward all five canonical params to the data plane anyway, so
the page is already correct the day the Worker's contract does.

Verification, exit codes noted rather than piped away: `pnpm run check`
**31/31 successful, exit 0**; `pnpm exec next build` exit 0 with
`/plp/plain`, `/plp/tanstack` and `/plp/apollo` all listed `ƒ (Dynamic)
server-rendered on demand`. The origin suite was NOT run — it binds
ports three other agents hold today, and this unit was designed to be
verifiable without it.

### Cutting the PLP's inert controls, and giving page 2 one answer (2026-08-29)

A five-lens merge review found no defect in the three strategy arms — the
cold fetch, the TanStack layer and the fenced Apollo exhibit were correct.
Everything that held the PR back was either integration the unit had not
done, or a falsehood it had faithfully inherited from the master it was
built to mirror.

**Three controls that answered every question with the same answer.** The
PLP served a facet rail, a search form and a sort select. `workers/edge`
`handlePlp` parses `n`, `page`, `run` and `cache`; `genre`, `style`,
`format`, `sort` and `q` appear nowhere in it. So a facet click navigated to
`?genre=Ambient` and got back all 500 releases, under a toolbar still
reading "Showing 1–24 of 500 releases", with no error state and no
indication anything had been ignored. A visitor filtering a crate and
receiving the unfiltered crate, presented as the answer, is the worst
outcome this project has — worse than an error, because an error is
legible.

The unit knew, and said so in a comment: the params "reach a data plane that
ignores them", reported "rather than routed around". That is the correct
instinct about scope and the wrong conclusion about shipping. The rule is
this repo's own, written at `decision-map.md:323` when `pdp-controls` faced
the dead Zoom button and the inert format group: *either the controls become
real in all variants, or the scope cut is taken explicitly and the dead
controls are REMOVED from the master and the CSS so no variant copies them.
Shipping them inert is the falsely-interactive state.* Same shape, same
answer.

So they are out — `plp.mjs`, both toolbar forms, the `pm-facets` rail,
`FacetGroup`, the `STYLE_CUT`/`FORMAT_CUT` constants, `computeFacets`,
`components/facets.css` deleted outright, the toolbar's `__search`/`__sort`/
`__label`/`__input`/`__select` rules, and `__body`'s rail column. The
regenerated master is **105 deletions and zero insertions**.

Implementing ADR-0005 §5 instead was costed and rejected for THIS merge, and
the reason is not line count. §5 requires validation against the snapshot's
real facet values, which raises three questions the ADR does not answer: does
a filtered response recount its facets over the filtered set; does `PlpPage`
grow a field naming the applied filters (a data-contract change every variant
and the drift gate sees); and what bounds a KV key space that is now
combinatorial across five params at infinite TTL — on the project whose
subject is what infrastructure costs. That is a unit with an ADR amendment in
front of it. What made cutting *cheap* is the timing: **no PLP number is
published yet**, so nothing is invalidated — and had we measured first, every
published PLP number would have described a page whose largest DOM subtree is
a rail the finished product does not serve.

Nothing about the cut is left to memory. The markup skeleton stays in three
docblocks; the facet-encoding leg is `it.skip`ped rather than deleted, with a
note saying it is the leg that must come back; `structure.test.ts` carries a
comment where `facets.css` used to be; and both arms now hold a
`plp-params-not-yet-honoured` tripwire that reads `workers/edge/src/index.js`
from disk and fails the day a param is wired through, naming the three things
that must follow it. htmx's arm had that tripwire and react-next did not,
which is part of how the two builds came to disagree about what the plane
does.

**A worse version of the same bug, one layer down.** react-next did not just
render the dead controls — it *forwarded* their params to `/api/plp`
(`plp-condition.ts`), so the request looked filtered while the payload was
not, and it put them in the TanStack query key (`PlpTanstack.tsx`), so
identical unfiltered payloads cached under distinct keys. The client-cache
cell — cell 2, this arm's headline, "a revisit costs 0 requests / 0 bytes" —
would have been measuring a cache miss it manufactured itself. htmx's arm
deliberately forwarded none of them, with a comment worth quoting: *"Forwarding
their names would not filter anything; it would only make the request look
like it had."* The address bar keeps the filters, because that is what the
visitor asked for; only the data-plane request drops them.

**Page 2, and why nothing could see that the arms disagreed.** `renderPlp`
took no `page` argument. It rendered `summaries.slice(0, n)` and hardcoded
"1" as current — while emitting links to `?page=2..5` on every visit. So the
contract described page 1 and shipped invitations to pages it could not
describe, and each arm generalized the rest alone:

| | empty page count | `rel="next"` past the end |
|---|---|---|
| react-next | `0–0` | emitted |
| htmx | `0` | gated |

Two arms serving structurally different DOM for the same URL, which is
precisely what a canonical markup contract exists to prevent — and both
suites *pinned* their own answer, so neither would ever drift into agreement.
No gate could catch it: the browser drift leg opens a committed static file,
which cannot express `?page=2` at any condition, and both identity suites
loop over `n` with no `page` axis at all.

Patching react-next to match htmx would have fixed the symptom in the arm
that was wrong and left the contract silent — so the next variant would guess
again. The fix went into the file both mirror. `renderPlp(snapshot, { page })`
now owns all of it: the five-wide window that slides with the served page
(the naive `1..min(totalPages,5)` renders **zero** `aria-current` from page 6
on, on a full grid of real cards), the `--current` marker, `hasNext = page <
totalPages`, and `"0"` for an empty page. htmx's arm had already worked out
every one of these and could not land them, because it could not touch the
contract; its `page === 1 || page < totalPages` escape existed only to
reproduce the master's defect at the one condition the master could render.
That escape can now go.

The whole page-aware rewrite is **byte-identical at page 1** — which is why
the 105-line master diff is pure deletion, and why every existing identity
leg passed it unchanged.

**Registering the variant broke something, exactly where the unit predicted.**
`SURFACE_CONTROLS.plp.variants` was `[]`, so `chrome.ts` filtered every
strategy cell against an empty array: the PLP's entire measured-axis control
— the surface's whole point — rendered as one dead `<span aria-current=
"page">`, under a panel reading "Served by 0 of 2". The two-line registration
fixes that and causes a regression, which this unit's own owed list had
called in advance: the fallback branch that had been marking the fenced
Apollo preset current stops running the moment `cells` is non-empty, so
`/react-next/plp/apollo/` would render three anchors and **zero**
`aria-current`. The fenced-current arm lands in the same commit, matched on
**path alone** — the obvious `presetIsCurrent` match would have left the
query-less `/react-next/plp/apollo/` unmarked, because that preset has only a
`?cache=cold` arm. Both URLs are guarded now. Nothing about the fenced cell
is counted: "Served by 1 of 2" reads `variants`, never cells.

**Two chrome rows promising a milestone that had already passed.** The
per-interaction byte readout and the replay control both said they "land with
the store's PLP build". This is the store's PLP build; it delivers neither.
They now say `not built yet`, the reading table's own wording for a planned
column. The first draft cited "ADR-0005 §8" in the visitor-facing string and
`repo-checks/instrument-font.test.ts` failed it — `U+00A7` is not in the
subsetted instrument mono, so the citation would have rendered as tofu in the
chrome. It moved to a code comment. A guard nobody was thinking about caught
a defect nobody would have seen until a screenshot.

Verification on the final tree: `turbo run lint typecheck test` **31/31,
exit 0**; origin suite green; `node packages/reference/render/build.mjs`
leaves only `plp/index.html` changed, and re-running it a second time leaves
`git status --porcelain packages/reference/surfaces/` empty.

### The PLP, htmx: the arm whose name is half a mechanism (2026-08-28)

Unit 2 of a four-agent parallel build. The brief was the catalogue grid
in the htmx variant — the "server-rendered — loaders + PE" arm of
ADR-0005's data-strategy comparison — and the interesting decision was
one the repo had already written down and left for whoever got here.

**The registration was pre-argued, and this build is the case it named.**
`PERMITTED_NOISE` carried htmx as a measured-EMPTY entry, correctly:
editorial's one interaction is client cart state, which hypermedia does
not own, so the served page carries no `hx-*` at all. That note ended
with a prediction — "if a later surface (the PLP build, where htmx's
loaders+PE strategy lives) puts `hx-*` on a page, THAT build registers
`^hx-` under behaviorAttrPatterns deliberately". The question was
whether this build is that surface, and the answer is not a preference.
ADR-0005 §1 defines the arm as "the server fetches the tray and returns
finished HTML; **interactions are real links enhanced into partial
swaps (works JS-off)**", and the switcher control that navigates to it
is labelled "Server-rendered — loaders + PE" — a string rendered into
every measured page. Shipping loaders without the PE would have left
the instrument advertising a mechanism the surface does not have, which
is the falsehood `SURFACE_CONTROLS.pdp.proves` was amended to remove
three phases ago ("the same falsehood as the dead control, one layer
up"). So: registered, `behaviorAttrPatterns: ["^hx-"]`, with
`attrPatterns` and `classPatterns` empty and no `dropElementSelectors`
— all mechanism, the qwik shape.

What it actually costs on the page is three attributes on ONE element,
**56 B raw**, all on `<nav class="pm-pagination">`: `hx-boost`,
`hx-target`, `hx-swap`. The anchors are untouched and keep their own
`href`, which is what makes ADR-0005's "(works JS-off)" a property of
the markup rather than a promise — with JavaScript off a page-flip is
ordinary navigation. `^hx-` is registered as a PREFIX rather than three
literal names on purpose: the class exists for a paradigm's namespace
(`^q:`, `^on:` are registered the same way), and pinning the three
names would make the next surface's `hx-get` read as content drift.

**Which interaction gets enhanced was decided by what the data plane
can actually answer, not by what the markup shows.** ADR-0005 §5 makes
five canonical facet params (`genre`, `style`, `format`, `sort`, `q`)
"the PLP build's contract", and `workers/edge/src/index.js` implements
none of them — `handlePlp` reads `n`, `page`, `cache` and `run` and
nothing else. So the master's facet rail, search form and sort select
are live markup with nothing behind them: **three of the surface's four
navigation affordances are served and dead**, and pagination is the
one that works. That is also the ADR's own choice — §5 records that the
prototype "deliberately used page-flips (already canonical) so the
origin stayed untouched". Enhancing a dead control would have been the
falsehood, not the fix, so only the pagination nav carries `hx-*`. The
edge Worker is in no unit's file boundary; the gap is reported with a
diff, not patched from a variant.

**The knob forwarding is the part that protects a number rather than a
rendering.** The bench runner builds every measured URL as
`?n=…&run=…` plus `&cache=cold` on the cold column
(`tools/bench-runner/src/batch.ts:78-80`), and this arm's switcher
preset is `/htmx/plp/?cache=cold`. A Worker that dropped `cache` would
have the edge serve the KV warm tier under a column labelled cold — the
server-rendered arm reading faster than it is, which is rigging in the
FLATTERING direction, the one ADR-0001 §9 is usually read as not
covering. Dropped `run`, the warm column inherits every previous run's
KV state. Both are forwarded, and the effective values are read back
off the response (`perPage`, `page`) rather than re-derived, because
`clampN` lives in the edge Worker and two implementations of one clamp
is how a served page and its beacon tag come to disagree. Worth
recording as an observation, not a defect: **no request-time variant
forwards `?cache=` on the EDITORIAL surface** — htmx, qwik, react-next
and remix3 all call `/api/snapshot` and `/api/pdp/{id}` with no query
string — so that surface's cold column is cold in the page fetch only.
It is uniform across all four, so it biases nobody, and it is not this
unit's to change.

**The partial swap's byte win is real and much smaller than the phrase
suggests, which is the sort of number this surface exists to produce.**
Measured, fixture, page 2 at n=24: the whole document is 30,387 B raw /
2,920 B brotli-q11; the `.pm-plp` fragment the server answers to an
`HX-Request` is 27,729 B / 2,321 B. That is **8.7% fewer raw bytes,
20.5% fewer compressed** — because on a catalogue grid the swapped
region *is* nearly the whole page, and what a partial swap saves is the
shell, not the payload. No verdict is published from this; it is a
pre-merge measurement of a surface with no receipts yet, recorded so
the eventual `plp-paginate` cell has a prior to argue with. One
independent confirmation fell out of the same measurement: the vendored
`htmx.min.js` is **14,996 B brotli-q11**, which is ADR-0005's addendum
figure of "15.0 KB htmx" derived a second way.

**The enhancement is not decoration on the mechanism; it is the part
that keeps the enhanced path usable.** `hx-boost` replaces a navigation,
and in doing so takes away the two things a navigation does for free:
the browser moves focus into the new document, and it announces the new
page. The anchor the visitor activated is inside the swapped subtree, so
it is destroyed and focus falls to `<body>`; nothing announces that the
catalogue changed (WCAG 2.4.3, 4.1.3). `src/plp.js` restores both — it
focuses the results heading and writes the new range into the shell's
existing `[data-pm-status]` live region, so the announcement costs no
markup. `tabindex="-1"` is set by the script, never rendered: the served
DOM must equal the master's, and a rendered focus stop with no script to
use it is the `pm-pdp__scroll` defect exactly. **4,039 B raw / 1,479 B
brotli-q11**, on a surface with no published receipts — re-derived against
the file at commit time, because an earlier draft of this line said
2,780/1,064, a figure taken before the failure announcement was added and
45% under the file it described. The verification pass caught it; a byte
figure nobody can re-derive is the thing this repo refuses, and it refuses
it in a record about its own code as much as in a published cell.

**One number in an earlier draft of this record was wrong, and the way
it was wrong is the reason to say so here.** The editorial
non-regression was first written as "byte-identical, fixture 5,915 B /
crate 6,525 B". Those are `String.length` — UTF-16 code units — and the
page carries non-ASCII (`—`, `·`, `’`), so the wire figures are
**5,936 B and 6,554 B**, 21 and 29 bytes higher. The CLAIM was never in
doubt (the two renders are equal, before and after, on both snapshots),
but this variant's editorial column has PUBLISHED byte receipts, and a
figure nobody can re-derive with `wc -c` is not a measurement. Caught by
the verification pass; the numbers above are `Buffer.byteLength`.

**A second dead control was found on the way, and it belongs to the
shell rather than to this surface.** `CART_CONTRACT` says the
enhancement populates each `[data-pm-cart-count]` slot "on every shell
page load", and the masthead renders that slot on every page. The
htmx variant's script list was a module constant shared by every page,
so the question only arose once there were two surfaces — and the
answer is that `cart.js` must ride the PLP too, or its masthead badge
is permanently empty. It costs nothing there: it returns early when the
editorial feature button is absent (`cart.js:62`).

**What the guard is, and where it had to go.** `@pm/htmx` had no `test`
script at all; it has one now, and a **44-leg** pre-merge guard in a new
`variants/htmx/test/`. It is plain JavaScript, matching a workspace with
no TypeScript toolchain and whose whole identity is "no framework, no
compile step" — `workers/blog` is the standing precedent. The strongest
leg is byte-strict, because this renderer is the same species as the
reference's: `renderPlpPage` equals `renderPlp` **byte-for-byte** after
the ADR-0008 delivery strip and the removal of the three registered
attributes, at n=24 **and** at n=240, for **both** committed snapshots.
Two more legs prove the registration is exactly load-bearing: the
normalized DOM equals the master UNDER `PERMITTED_NOISE["htmx"]`, and
does NOT equal it under `NO_NOISE` — so a registration that stopped
doing work fails here instead of sitting in the registry as decoration.
This splits htmx's guards across two homes (editorial's stays in
`tools/repo-checks`, another unit's directory), which is flagged for the
integrator rather than resolved by editing a file this unit may not.

**Fifty-one sabotages, each watched failing and restored from a
backup copy.** They are the reason two things in this record are true
rather than hoped. One sabotage — adding the PLP's enhancement to
`EDITORIAL_SCRIPTS` — produced **no test failure at all**, and the gap
it exposed is worse than it looks: editorial is the one surface here
with published byte receipts, and a `<script>` element is invisible to
every identity guard there is, since the drift normalizer drops script
elements as delivery and the byte-strict editorial guard's own
`stripDelivery` removes them before comparing. A stray script on
editorial moves a published number and passes everything. The script
list is now pinned per surface, in both directions. And three
assertions failed their sabotage with a bare "expected false to be
true" — a crash, not a guard's own message, the shape this repo already
had to name once — so they were given messages and re-sabotaged.

**The verification pass found three blockers, and all three were in the
half of this slice that had no contract to check it against.** The
byte-identity legs are strong exactly where a master exists; above page
1 there is none, and that is where every one of them lived.

1. **A history-cache miss would have wiped the page.** The Worker chose
   page-vs-fragment on `HX-Request` alone. htmx keeps a sessionStorage
   cache so Back can restore a page without a round trip, and on a MISS
   — storage blocked, quota shed, or evicted past `historyCacheSize`
   (10) — it re-fetches the URL and swaps the answer into
   `getHistoryElement()`, which is `document.body` unless the page
   declares `[hx-history-elt]` (this one does not), with `swapStyle:
   'innerHTML'`. It sends that request **with `HX-Request: true`**,
   because `historyRestoreAsHxRequest` defaults to true
   (`htmx.org@2.0.10/dist/htmx.js:281`; the fetch is
   `loadHistoryFromServer`, which sets both that header and
   `HX-History-Restore-Request`). So Back, on a cache miss, would have
   received the bare `.pm-plp` block and written it over the entire
   body — skip link, chrome slot, masthead, footer and every script
   gone, leaving a grid with no navigation and no runtime. htmx's own
   config documentation names this trap in one line at `htmx.js:277`:
   *"This should always be disabled when using HX-Request header to
   optionally return partial responses."* The fix is the server-side
   half of that sentence — the partial requires `HX-Request` present
   **and** `HX-History-Restore-Request` absent — chosen over the client
   config it suggests because a server's correctness must not depend on
   a client file having loaded.
2. **No current-page marker from page 6 on.** `plpBlock` copied the
   reference's `1..min(totalPages, 5)` window literally, which is
   correct for a renderer that only ever draws page 1 and wrong for one
   that does not: from page 6 the predicate matched nothing, so the nav
   carried **no `aria-current="page"` at all** and offered no route past
   5. Measured on both snapshots — six clicks from the front page on the
   fixture, and the crate has 21 pages. The window now slides and is
   clamped to contain the current page; at page 1 it is still `1..5`
   (and `1..1` at n=240), which is why byte identity survived the fix.
3. **A page past the last one read backwards.** The edge Worker floors
   `page` at 1 and applies no ceiling, so `?page=11` answers 200 with an
   empty `items` array, and the arithmetic range rendered **"Showing
   241–240 of 240 releases"** — which `src/plp.js` would then have
   announced to a screen reader verbatim. An empty page now shows "0",
   which is true, and "Next" is emitted only when a next page exists —
   **except at page 1, where the reference's unconditional link is
   reproduced deliberately** rather than diverging from the contract at
   the one out-of-range condition a master can actually be compared at.

All three were invisible to the guard as written, and for one reason
worth naming: **the page>1 block exercised page 2 and nothing else**,
and page 2 is the single page above 1 where both (2) and (3) are hidden.
The leg now sweeps every page of both snapshots — 31 renders, cheap —
and asserts exactly one current marker on each. That is the same shape
as the defect Phase 15 opens with: a guard whose one driven case
happened to be the case that could not fail.

**A SECOND contract defect on the same `<nav>`, and it is the one that
moves a number.** `renderPlp`'s `pageHref` (`plp.mjs:60-68`) carries a
comment claiming its hrefs "preserve the WHOLE condition (URL-as-receipt,
ADR-0004 §5)". They carry `page`, and `n` when it differs from the
default, and nothing else — and a query-only relative reference REPLACES
the entire query (RFC 3986 §5.3; verified,
`new URL("?page=2", ".../plp/?cache=cold&run=bench-7&n=240")` →
`.../plp/?page=2`). So every page-flip silently drops `cache`, `run` and
`profile`. From this arm's own switcher preset — `/htmx/plp/?cache=cold`
— one click on "2" serves from the KV **warm** tier while the injected
chrome, rendered server-side against the original search and sitting
outside the swapped subtree, still prints `cache: cold` and the line
"The URL is the whole measurement condition". The address bar and the
instrument disagree about one visit, in the flattering direction, and
`plp-paginate`'s measured step would land in a different KV namespace
than its own priming load because `run` goes too. This is the same class
as the `rel="next"` defect below and materially worse; both are the
contract's, not this variant's, and both are reported with diffs rather
than patched from a consumer. What this unit did do is stop repeating
the false claim: the variant's copy of that comment now states what the
code does, and a guard leg pins the master's href shape so the reference
fix cannot land on one side only.

**Deliberately NOT diverged from, though it is wrong.** `renderPlp`
emits its `rel="next"` link unconditionally
(`packages/reference/render/plp.mjs:134`), so at n=240 — where
`totalPages` is 1 — the master points "Next" at an empty page. No test
has ever rendered the PLP at any n but the default: `renderPlp` has
exactly one caller, `packages/reference/render/build.mjs:77`. The
temptation was to fix it in the variant, and that would have been the
wrong instinct — a deliberate divergence at a condition the gate does
not compare is the vacuous-guard shape this repo refuses, and
`packages/reference/**` is the contract, not this unit's file. The
variant reproduces the reference exactly at every n the reference can
render, and the one-line fix is written into the handoff for whoever
owns it. The same reasoning bounds `?page=`: the reference renderer has
no `page` option at all, so at page > 1 there is nothing to be identical
to, and the two lines that must vary — the count range and which link
carries the current marker — are variant-defined until the reference
grows the option.

**The verification pass then found the FOURTH registry consumer nobody
had named, and it is the one that fails silently.**
`tools/repo-checks/test/warm-tier-discipline.test.ts:33` finds tray
requests by literal — ``/["'`]\/api\/(plp|pdp)/`` — and enforces that
every one carries `run=` or `cache=cold`, because an un-nonced write
mints a canonical KV entry with **no TTL** (`workers/edge/src/index.js:84`
applies the TTL only when the nonce is non-empty) and the next crate
re-seed then serves a stale catalogue to real visitors indefinitely.
`/htmx/plp/` is now the first PAGE path in the repo that reaches KV: it
proxies the tray server-side, so it never names `/api/` and the guard
cannot see it. The moment the PLP drift leg is written — whose natural
first line is `get("/htmx/plp/")` — the discipline is evaded by
construction. That guard's own header records this defect class being
found three separate times in one pass. `tools/repo-checks/**` is
another unit's boundary; the one-line widening is in the handoff.

**And one of this unit's own detectors was the narrow shape the suite had
already rejected for this same variant.** The guard's `hx-*` matcher was
`\s(hx-[a-z-]+)=`, which reports `hx-on:click` (a colon in the name,
`htmx.js:2752`), `hx-disable` (valueless, `:206`) and `data-hx-boost`
(the documented prefix form `getAttributeValue` falls back to, `:418`) as
ABSENT — all three live mechanisms in the pinned runtime. Sabotage
confirmed the cost: an `hx-on:click` on an anchor left "exactly three
attributes" and "no anchor is touched" both green. The origin suite had
rejected exactly this shape for htmx's editorial leg
(`drift.browser.test.ts:901-907`) and the guard here was written narrower
anyway. It now uses the suite's family, and pins that the page carries no
`data-hx-` spelling — because `^hx-` deliberately does not match it, so
that spelling must fail loudly rather than be read as drift.

**The fourth lens found the two defects the identity guard was
structurally incapable of seeing, and both are on the arm's own seams.**
The byte-strict legs are only as strong as the payload they are handed,
and this guard hands itself one.

*The tray's SHAPE was proven by nothing.* `plpBlock` destructures six
keys off the edge's response and the test assembles those same six keys
itself, so every identity leg passes by construction whatever
`workers/edge` actually returns. Measured, not argued: a payload
identical to `handlePlp`'s but with `perPage` renamed renders a **200**
page carrying `Showing NaN–NaN of 240 releases`, with every pagination
href `?page=N&n=undefined`. Nothing throws, so the branded 503 never
fires; `plp.js` reads that same string and announces "Showing NaN to
NaN" to a screen reader — the exact defect class this section already
records fixing for the reversed range — and the edge clamps
`n=undefined` back to 24, so a visitor on `?n=240` is silently reset by
clicking "2". The contract is now asserted where the data ENTERS, so the
existing 503 owns it, and it holds at runtime against the deployed plane
rather than against a payload the test wrote.

Sabotaging that check then exposed a second, smaller thing worth
recording: deleting its FACETS clauses produced **no failure at all**,
because every malformed-`facets` payload also throws during template
interpolation, so the route answers 503 either way. The clauses were
real but unprovable through `fetch`. Rather than keep an unprovable
clause or drop a useful one, the check is exported and driven directly,
where each clause is a defect a test can see — and the code comment says
plainly which clauses change the route's behaviour on their own and
which do not.

*The enhancement was not idempotent, and htmx re-runs it.*
`cleanInnerHtmlForHistory` (`htmx.js:3237-3248`) strips only the request
class and `data-disabled-by-htmx` from its history snapshot, so
`<script>` elements are KEPT; `allowScriptTags` defaults true (`:160`)
and `duplicateScript` (`:549`) builds a node the browser executes. One
Back press therefore ran `plp.js` a second time, and its listeners are
on `document`, which survives the body swap — so every later page-flip
announced the range TWICE into a `role="status"` region and focused
twice, growing with each Forward/Back cycle. A file whose entire purpose
is a11y parity would have made the enhanced path worse than the
unenhanced one. A `window` flag makes it re-entrant; the guard now loads
the real file three times against one document and asserts exactly one
announcement per swap. The original legs loaded it once, so idempotence
was never exercised — the same shape as the page-2-only pagination legs
above.

**A fourth finding belongs to a Worker this unit may not edit, and that
Worker's own comment predicted it.** `workers/front` injects the
switcher/HUD chrome into `div#pm-chrome-slot` on any `text/html`
response and asserts slot cardinality of exactly one, logging
`chrome-slot-count` as an ERROR otherwise
(`workers/front/src/index.js:147-183`). A partial has no slot by
design, so every page-flip would log an error against a Worker behaving
correctly. That file already carries a variant-scoped pass-through for
remix3's frame partials and says, at `:126-128`, that the exception is
*"deliberately variant-scoped … the PLP build (htmx loaders+PE) should
generalize this deliberately when it does."* The variant half of that
generalization is applied here — the partial response declares itself
with `x-pm-partial: 1`, so the front Worker's rule can be one
variant-agnostic line rather than a second hardcoded path prefix — and
the header is INERT until that one line lands. Its diff is in the
handoff; `workers/front/**` is the measurement pass's file, and a stray
edit there makes published receipts unpublishable.

**`pnpm run check` is 31/31, exit 0 — and 31 is the honest number.** It
was 30 at `ae97f8e` and the brief asked for 30; the same brief mandates
a `test` script for `@pm/htmx`, and turbo's `test` task depends only on
`topo`, so the new script adds exactly one command and cannot add fewer.
Derived, not counted by hand:
`pnpm turbo run lint typecheck test --dry=json | jq '[.tasks[] | select(.command != "<NONEXISTENT>")] | length'`
→ 31, breaking down as 1 lint + 16 typecheck + **12** test + 2 builds.
`@pm/htmx#test` is declared `cache: false` in `turbo.json` for the
reason its three siblings are: its real inputs span the reference
render tree, both committed snapshots and `workers/edge`, and an
under-declared input replays a stale PASS — precisely the hole the guard
exists to close.

### The registration that was right, and the four sentences that had gone false (2026-08-29)

This was the batch's only red PR, and the red was inherited rather than
introduced — which made the first decision the important one: **do not delete
the thing that is failing.**

`tools/drift-gate/src/normalize.ts` gained
`htmx: { attrPatterns: [], classPatterns: [], behaviorAttrPatterns: ["^hx-"] }`,
and two assertions in `tools/origin-suite` require that entry to be
`undefined`. The tempting fix — drop the entry, CI goes green — would have
been exactly wrong. The entry fulfils a prediction written into the comment
it replaces:

> if a later surface (the PLP build …) puts `hx-*` on a page, THAT build
> registers `^hx-` under behaviorAttrPatterns deliberately.

This is that build. `render.mjs` ships three real `hx-*` attributes —
`hx-boost`, `hx-target`, `hx-swap` — on one `<nav class="pm-pagination">`,
and one occurrence in the whole tree (tool-counted across every rendered
file on the branch). The variant's own suite proves the entry is
load-bearing rather than decorative by asserting the comparison FAILS under
`NO_NOISE` and that the first divergence contains `hx-`. Deleting it would
have made the gate green by making it blind.

So the two assertions moved instead. They now check the entry's **shape**,
and the shape is the point: `attrPatterns: []` is the load-bearing half,
because that class admits ordinary markup and would let real drift past the
gate — the one thing this entry must never become. `behaviorAttrPatterns`
admits only the paradigm's own mechanism, which is what the class exists
for.

The `expect(body).not.toMatch(/\s(?:data-)?hx-/i)` byte assertion above each
one is **kept**, and it is what actually keeps editorial honest. That was
worth verifying rather than assuming: the editorial drift leg passes
`NO_NOISE` explicitly on both sides, so it never consulted the registry at
all — the registration could not have loosened that surface's comparison
even in principle. The `toBeUndefined()` line was belt-and-braces over a
comparison that was already braced, and it is simply obsolete now.

**The prose was where the real risk was, because prose has no test.** Four
places said htmx registers nothing. Three were the obvious kind —
`variants/README.md`, `variants/remix3/DIFF-TO-STARTER.md`, and the same
sentence duplicated into `decision-map.md`'s slice-F node, plus a fifth in
`build-log.md`'s own slice-E phase, which no list had. The fourth is the one
worth recording, because a reflex sweep for "htmx registers nothing" misses
it entirely: `variants/README.md:71` is about **remix3**, and calls its
emptiness "the **third** earned emptiness". The subject is right; the ordinal
is the lie, and it counts htmx to get there. Fixing what a grep finds would
have left a false sentence behind in a file whose whole job is telling the
next reader what is true.

**A gate loosening justified by a file nobody can open.** `decision-map.md`
pointed the reviewer at `~/Desktop/pm-unit2-plp-htmx-handoff.md` for the
exact diffs reconciling the fairness gate. That is the gate defeating
itself: the registration is defensible precisely because its reasoning can
be read, and the reasoning was on someone's Desktop. It is committed at
`docs/handoffs/2026-08-28-plp-htmx.md`, alongside the nine already there,
with a header saying what this pass changed under it and leaving its
verification numbers as the numbers of the day they were taken.

**The guard that would have caught the disagreement.** This arm and
react-next's had contradicted each other about every page past the first —
this one gated `rel="next"` and rendered `0`, that one emitted the link
unconditionally and rendered `0–0`. Neither was reckless: the reference
could only render page 1, so each generalized alone, and each PINNED its own
answer in its own suite, which meant they could never drift into agreement.
#38 made `renderPlp` page-aware, so this arm's `page === 1 ||` escape — which
existed only to reproduce the master's defect at the single condition the
master could express — is gone.

That fixes today. `tools/repo-checks/test/plp-arms-agree.test.ts` is what
fixes tomorrow: it renders BOTH implementations from ONE tray at page 1, at
the last real page, and at `totalPages + 1`, on both snapshots, and compares
normalized DOM under both paradigms' registrations. It lives in
`repo-checks` because that is the only workspace where both are importable —
the two variant suites each see one arm, which is structurally why nothing
could see this. Two details it had to get right to be worth anything: it
compares the `div.pm-plp` **swap target** (htmx's `renderPlpFragment` against
react-next's `PlpArticle`) rather than a document against a fragment, and it
lowercases attribute names first, because linkedom preserves React's
`fetchPriority` where a real browser's tokenizer lowercases it — without
that, the two arms "disagree" on every card image over a parser gap no
visitor could observe. Sabotage-proven: restoring react-next's unconditional
`Next` fails it with the exact extra anchor named.

Also settled here, because it is the last merge: the `(fog)` node claimed
these surfaces run "in that order, one node at a time", which three parallel
units had just falsified. The rewrite records what the real constraint turned
out to be — not order, but shared files, and specifically one object
(`SURFACE_CONTROLS`) that all three PRs owed a registration to and none
supplied, so each shipped a page the instrument reported as unserved. And the
map's own line 3 — "keep it compact" — was amended rather than obeyed: every
unit for months has landed a prose block instead, and a rule nothing enforces
and everything violates is worse than no rule. Trimming the entries was
rejected on the grounds that the build record IS the product; what is given
up is stated, and the next call (split per phase, or archive resolved nodes)
is named rather than deferred silently.

### The last surface, built — and the two things the spec had not seen (2026-09-02)

The spec session could not run a server, so the first thing this one did was
the probe it owed. Front Worker alone on 8787, before any change:
`GET /how-it-was-built/` → `HTTP/1.1 404 Not Found`, body `not found`, the
Worker's log line `{"event":"unknown-prefix","path":"/how-it-was-built/"}`;
`/` and `/methodology/` → 200; `/_pm/build.json` attesting `87113f6`, clean.
Every store page's footer linked that 404 — 2,006 of them over the crate, as
the spec counted. After the change the same probe returns 200 with
`class="pm-doc"`, no `data-pm-chrome`, no `pm-chrome-slot`, no `<script`, and
the composed-origin suite now holds all of that on every run.

**The build followed the PRD's five decisions. Two of them met facts the PRD
had not seen, and both changed the shape of what shipped.**

**The page is written at attestation time.** The PRD pictured `build.mjs`
passing the stamped SHA into `renderHowBuilt`. Turbo replays a cached front
dist whenever the package's inputs are unchanged, and `stamp-build.mjs` exists
precisely because a replayed dist carries the SHA of the commit that BUILT it —
`run-local` and the `dev` script re-stamp after every turbo build. A page baked
in `build.mjs`'s body would name one commit while the re-stamped attestation
named another, and the served-vs-master leg would fail on a disagreement the
cache manufactured. So `stampBuild()` now renders the page and writes it beside
`build.json` from ONE `{sha, dirty}`, rendering FIRST so a thrown render cannot
leave a fresh attestation beside a stale page (the design review's should-fix).
`@pm/front` declares `@pm/reference` — the first workspace to — which is what
puts the renderer into turbo's cache key for the front build (`--dry=json`:
`@pm/front#build` gains `@pm/reference#topo` with `render/*.mjs` among its
inputs; the suite's file-URL import pattern would have left it out). ADR-0004
§2's "not consumed" gets an addendum saying what it protects: no component
runtime, never shipped code; build-time spec consumption is the `@pm/tokens`
class.

**GitHub does not render the build log.** The PRD's deep links were to be
SHA-pinned files; this build also anchors them, and checked what GitHub shows.
An ADR page carries `user-content-*` ids for every heading, so an addendum
links GitHub's heading anchor — the rule is github-slugger's, and it is pinned
in `packages/reference/test/reference.test.ts` to anchors fetched from GitHub
today: em dash → `--`, `§` and quotes and backticks dropped, `#16 + audit` →
`16--audit`, `Addendum A —` → `addendum-a--`, and ADR-0008's `## Consequences`
/ `### Consequences` → `consequences` / `consequences-1` (the dedupe numbers
across all levels). The build log's page payload, by contrast, carries
`"richText":null,"richTextTruncated":true,"renderedFileInfo":null` at 403 KB
— no rendered view, so a heading fragment scrolls nowhere. A phase therefore
links the code view at its heading's own line, `?plain=1#L<n>`: exact at a
pinned SHA, and checked offline without any slug rule at all (line *n* of the
file must BE the heading the link shows). Two anchor forms, each honest about
what the target can display.

**What the review caught before it was code.** Three independent lenses read
the design note against the tree and the PRD (design review, in the session
record): (1) render-first in the stamp, above; (2) the D9 dirty arm would
never run anywhere — CI planes are always clean — so all three arms (master,
clean, dirty) are now rendered in-process by the reference test, and the HTTP
leg asserts the arm the plane is in by value; (3) a second copy of the slugger
in the repo-check would prove only that two copies agree, so the repo-check
imports the one exported rule and the golden vectors carry the GitHub
agreement; (4) the frame prose claimed "the two paragraphs … are the only
hand-written text" on a page with five hand-written section intros — the
honesty page overstating its honesty; it now says what is true (every list is
generated; the prose between lists is written by hand); (5) the build line sat
inside `.pm-prose`, whose contract is "no classes inside" — it is the header's
dek now; (6) home's PM-006 row moved to link the surface (ADR-0007 §4: rows
update as surfaces land) and was the one live row no leg pinned — pinned now;
(7) the `%%LAB_RUNS%%` slot renders "N" by whitelist, any other marker in a
heading refusing the render.

**Nine duties, fired and restored from a backup copy** (never `git checkout
--`; `git status --porcelain` identical before and after each run):

| Duty | Sabotage | Failure it produced (verbatim) | Owner |
|---|---|---|---|
| D1 (was absent) | `docs/adr/0010-probe.md` with frontmatter + `# title` | `committed how-built is missing ADR 0010-probe — re-run: node render/build.mjs` — 1 failed, 39 passed; 40/40 after `rm` | `packages/reference/test/reference.test.ts` |
| D1, addenda arm | `## Addendum — sabotage probe (2026-09-02)` appended to ADR-0009 | `committed how-built is missing addendum 2 of 0009-blog-plane — re-run: node render/build.mjs` | same |
| D2 | `how-built-page.mjs`: `return renderHowBuilt({ head, build })` → `return renderHowBuilt({ head, build }).replace("Decision records</h2>", "Decision record</h2>")` — a post-render edit of the body, because the composition owns only the `<head>` and an edit to the renderer changes the suite's re-render identically (verify-slice caught the first row's wording as unreproducible) | `first divergence at normalized line 87: … <h2 id="decision-records">Decision records</h2> … actual … Decision record</h2>` | `tools/origin-suite/suite/how-it-was-built.test.ts` |
| D3 (existed) | `## Phase 99 — sabotage probe` appended to the build log | `committed how-built is missing Phase 99 — re-run: node render/build.mjs` | `reference.test.ts` |
| D4 | `docs/adr/0009-blog-plane.md` renamed | `deep links to files that do not exist — re-run: node render/build.mjs: … "docs/adr/0009-blog-plane.md"` | `tools/repo-checks/test/how-built-links-resolve.test.ts` |
| D4, fragment arm | one addendum fragment misspelled in the master | `fragments naming no heading in their file — the heading was reworded, or the anchor rule drifted: … 0002-…#addendum--strategy-review-correctionz-2026-07-12` | same |
| D4, line arm | one line inserted above `## Phase 3` in the build log | `line anchors that no longer point at their heading — re-run: … "docs/build-log.md?plain=1#L886 is \"(sabotage: one inserted line — delete me)\", link says \"## Phase 3 — Store data\"", … (13 entries, every phase from 3 on)` | same |
| D5 | `id="phase-3"` → `id="phase-33"` in the master | `TOC anchors with no matching id: … "phase-3"` | same |
| D6 (existed) | `labBundle: true` on the singleton's registry entry | `front lab: surface "how-it-was-built" is both singleton and labBundle — a singleton is off the benchmarked matrix (ADR-0007 §5) …` | `workers/front/build.mjs` |
| D7 | the page write in `stampBuild()` removed | `GET /how-it-was-built/ -> 404`; leg: `expected 404 to be 200` (status asserted before any body read) | the suite leg |
| D8 | `## Phase 99` appended to the build log; an addendum appended to ADR-0009 | turbo's own verdict for `@pm/front#build` via `--dry=json`: `HIT` (control) → `MISS` → `HIT` (restored) → `MISS` → `HIT` | `turbo.json` |
| D9 | the composition passed `dirty: false` while `/_pm/build.json` said `dirty: true` | `expected '87113f60ad187b6190f1aa4c19c85a2948c6f…' to be 'main'` | the suite leg (both arms also rendered in-process by `reference.test.ts`) |
| PM-006 row | home's status link pointed back at the GitHub build log | `PM-006 must link the served surface: expected '<strong class="cat__live">Public toda…' to contain 'href="/how-it-was-built/"'` | the suite leg |

**The line anchor was observed, not assumed.** GitHub's blob page for the
build log carries `"large":false,"truncated":false` and a `lineInfo` of
6,501 lines for the plain view, and a real Chromium (Playwright, 2026-09-02)
opened `…/blob/main/docs/build-log.md?plain=1#L886` with the line present,
reading `## Phase 3 — Store data`, highlighted, no "too large" notice, the
file at 412,355 B. The code view has its own size behaviour for big files
and this file only grows, so the repo-check pins the observation to a
512 KiB ceiling: crossing it fails with an instruction to re-observe and
raise the ceiling with the new date and size — a guess is not a receipt.

**Verify-slice, four lenses, after the sabotage pass.** The first run died on
the session limit with `4 started / 0 results` — an empty findings array that
reads exactly like a clean pass and was not one (the 2026-08-14 lesson); the
journal was read before anything was believed, and the run was resumed. The
resumed run returned 24 raw findings, 14 distinct, none refuted on re-reading
the code; all are fixed in this commit: (1) the served-vs-master leg rendered
its expected body from THIS checkout's docs, so a plane built from another
commit would read as composition drift with a message blaming the wrong
thing — it now refuses a checkout/plane SHA mismatch by name, the bench
runner's rule; (2) the dirty-build leg accepted either arm on the DEPLOYED
plane, so a deploy-job step leaving one unignored file would ship every link
on `main` with everything green — the remote run now requires a clean
attestation; (3) the head's `<meta name="description">` claimed SHA-pinned
links in both arms while the dirty body said the opposite, and the head is
exempt from the body compare — it is derived from the attestation and pinned
per arm; (4) the methodology `<h2 id="…">` regex was attribute-order-blind in
the renderer AND every guard, so a `<h2 class="x" id="y">` would vanish from
the index with all guards agreeing — one exported extractor now, comments
stripped, an id-less `<h2>` refusing the render, and a floor that every `<h2`
on the page is indexed; (5) the master's byte-regeneration exemption hid a
flipped ADR status, a reworded title or heading text — it is byte-compared
now, after the index pins so their messages still name the missing entry;
(6) `githubSlug` slugs the source while GitHub slugs the rendered text, so a
heading with a link, HTML, an entity or `_emphasis_` would mint a fragment
GitHub never renders — indexed headings carrying those now refuse the
render; (7) the anchor vectors were typed strings with no committed
evidence — `packages/reference/test/fixtures/github-heading-anchors.json`
now holds every rendered heading of all nine ADR pages with the id GitHub
served beside it (URL, bytes, date, ref), and the test re-slugs each page as
one document against that sequence; (8) missing metadata rendered an
invalid `<time datetime="">` — the renderer refuses, naming file and field;
(9) `@pm/reference` could have gained an extension-less `exports` map past
the no-component-runtime check — its `exports` is pinned undefined; (10) a
hand-typed "six rendering paradigms" beside home's "Five architectures" —
the number is gone; (11) the D2 sabotage row was unreproducible as worded —
the exact edit is recorded above; (12) ADR-0007 §4 still said the PM-006 row
links the build log — addendum; (13) `workers/README.md` listed two
singletons — three now, with the stamp-time write; (14) the line-anchor
behaviour was reasoned, not observed — observed, above.

**Stale prose fixed, as owed:** `workers/front/methodology/index.html`'s header
no longer promises a move this surface declined — it records that the page
keeps its URL and is indexed by its `<h2 id>`s; `surfaces/how-built.css` no
longer claims "decision-map rows"; README's surface row no longer says "not
built". ADR-0008 addendum B records §8 as built, and the `(fog)` node's count
of unbuilt surfaces drops to one.

**Verification, counts tool-derived (final tree):** `pnpm run check` → **33
successful, 33 total**, exit 0; the count derived, not typed: `turbo run lint
typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`
→ `33`. `node packages/reference/render/build.mjs` followed by `git status
--porcelain packages/reference/surfaces/` → `how-it-was-built/index.html`
and nothing else. Origin suite, fixture mode, run alone: **18 files, 519
tests passed**, 143.0 s, `run-local` exit 0. Crate mode
(`PM_SEED_DIR=tools/snapshot-capture/crate`), on the committed tree: **18
files, 519 tests passed**, 143.2 s, exit 0, the plane stamping
`dist/how-it-was-built/index.html` from a CLEAN tree — every deep link on
the served page pinned to the attested commit, `blob/main/` absent, the
build line and the head's description naming it; D2 byte-identical at that
attestation; five suite fetches of the URL, all 200. (The runs necessarily
preceded this paragraph, whose commit is an amend of the one they ran on, so
the SHA they pinned is not the SHA that ships; the post-deploy smoke repeats
the same legs against the deployed SHA.) Two earlier fixture runs that
overlapped other load on this machine failed with 86 and then 26 browser
timeouts, all in `pdp-controls`, `bench`, `bench-interaction` and the pixel
legs of `drift` — the files CI's own post-deploy smoke flaked on at
`87113f6` (`gh run view 33647164503`: origin ✓, check ✓, smoke ✗ on one qwik
stepper assertion); each re-run alone passed in 143 s against 803–1,541 s
loaded. Run the suite alone, and never pipe the runner through `tail` — the
first run's exit code was `tail`'s.

**What this leaves.** The footer's other dead link, `/vanilla/a11y/`, is the
a11y unit's. No field data for this surface (reversible for ~2.5 KB of
`measure.js` plus one normalizer exclusion). The committed master pins `main`
and carries line anchors into the build log, so an edit ABOVE a phase heading
— mid-file, not an append — moves the lines and fails the repo-check until the
master is re-rendered; that is the price of a citation that names a line, and
the guard says exactly which line moved.

### The footer's last 404, and the exhibit that must not have a dead control (2026-09-03)

The probe first, on the held composed origin: with the a11y directory absent
from the vanilla dist — main's state, where it has never existed —
`GET /vanilla/a11y/` → `404`, the front log recording
`"event":"dispatch","variant":"vanilla","path":"/vanilla/a11y/","status":404`
(the assets Worker's own not-found, an empty body); `element-demos/` and
`mode-demos/` the same. With the directory present, all three `200`, the body
carrying `class="pm-a11y"`, exactly one `data-pm-chrome="1"` stamped
`data-pm-surface="a11y"`, `<meta name="robots" content="noindex">` on
element-demos alone, and no `<details` served `open`. The 2026-08-29 audit
counted the footer's OTHER dead link at ~2,006 pages; this one sat in the same
footer on every one of them.

**The design was settled; the build made three calls the design left open.**

**One renderer, two heads — the second time, for a variant-hosted singleton.**
The vanilla variant re-types every benchmarked surface it serves
(DIFF-TO-STARTER decision 1) and it does NOT re-type this one: `render.mjs`
renders the three pages with `@pm/reference`'s own `renderA11y*` under the
variant's head, chrome slot and one script. The re-implementation rule exists
so paradigms are compared on identical markup (ADR-0003 §1); this section is
served in one variant and measured by nothing, so a re-typed copy would have
been 330 lines whose only property is that a guard holds them equal to the
function that could have produced them — and two renderers over one spec is
the failure this log keeps recording. `shell.mjs` `page()` grew the skeleton's
two ✂ lines as options (`slot`, `scripts`) and a `head` callback that hands the
consumer the master's own ordered sheet list, all default off:
`node render/build.mjs` followed by `git status --porcelain
packages/reference/surfaces/` printed nothing, and the regeneration test holds
the bytes. `@pm/vanilla` is the second workspace to declare `@pm/reference`
(`pnpm-lock.yaml` +3 lines, the same three `@pm/front` added the day before);
`turbo run build --filter=@pm/vanilla --dry=json` shows `@pm/reference#build`
among `@pm/vanilla#build`'s dependencies and `render/a11y.mjs`,
`render/shell.mjs` among `@pm/reference#topo`'s inputs, and a comment edit in
`a11y.mjs` took the vanilla build's cache verdict HIT → MISS → HIT (restored).
DIFF-TO-STARTER decision 6 records the call and fences it: a future
benchmarked surface may not cite it.

**The emulation has one state, and it is the accessible one.** The design said
"additive-only emulations gated behind the real media queries" and the first
draft of the script wrote a `data-pm-emulate` attribute onto the stage — a
second state, a styling hook the accessible state would have to be kept in
step with. The canonical markup places each stage DIRECTLY after its toggle,
so `mode-demo.css` applies every emulation through
`.pm-mode__toggle[aria-pressed="true"] + .pm-mode__stage[data-pm-mode="…"]`,
and the script writes `aria-pressed` and nothing else: the visual state cannot
exist without the programmatic one (ADR-0003 §5 — the gallery's zoom scales
its stage from the same attribute). "Never override your OS setting" is then a
mechanism rather than a sentence: with a toggle off no rule matches and the
real query stands. The forced-colors rule's custom properties are
`tokens.css`'s `@media (forced-colors: active)` block verbatim, and a
repo-check parses both and holds them equal — a copied remap that drifts from
the seam it demonstrates is the kind of quiet falsehood this exhibit cannot
carry. The browser leg then asserts the promise under Playwright's
`reducedMotion: "reduce"` and `forcedColors: "active"` contexts: the collapsed
duration and the remapped canvas stand with the toggle off, on, and off again.

**Specimens are wired.** The focus, target-size and mode-stage demos render
the store's own button for its rendering — its ring, its 24×24, its colours
under a mode — and the design said nothing about what pressing one does. A
button that does nothing when pressed is the dead-control state Phase 12
recorded, on the one page where that is the worst possible bug, so a press
answers in the compare's or the mode's OWN visible `role="status"` line, never
the shell's `[data-pm-status]` — which `masthead.css` sizes 1×1 and clips, so
an answer routed there reaches a screen reader and leaves a sighted pointer
user with a button that visibly does nothing, on the page whose subject is
whether a control can be hit. The verification pass found that, and then found
the fix's own first draft putting ONE line at the top of the page, up to three
viewports above the button. The line is per section now, and its sentence names
the demo, the side and the press count, because a live region does not
re-announce unchanged text and the target-size walkthrough invites repeats. The live-region twins are
excluded by attribute: each writes the SAME sentence into its own slot —
`role="status"` on the DS-ON side, a plain element on the DS-OFF side — and
never into the shell's region, because routing the DS-OFF twin there would
announce the silence the exhibit exists to show. The forms demo's field is a
STATIC specimen served in its error-wired state: live validation on one twin
would break "differs only in accessibility", on both would re-implement the
checkout on an exhibit page. The controls guard carries it as a registry entry
that is CHECKED — exactly one served `aria-invalid`, on that field, inside a
compare box — never as a skip. `a11y.js` is also the fourth vanilla `read()`
of the cart contract (badge only, never a write; the uniqueness clause
checked), because the masthead is the shell and the cart survives a swap onto
this page too.

**Guards, each fired by sabotage and restored from a backup copy** (never
`git checkout --`; `git status --porcelain` identical before and after every
row):

| Guard | Sabotage | Failure it produced (verbatim) | Owner |
|---|---|---|---|
| identity after the delivery strip | `renderA11yPage` given a post-render `.replace("Five defaults, on and off", "Five default, on and off")` — the D2 class | `first divergence at character 738: … <h1 class="pm-page__title">Five defaults, on and off</h1> … actual … Five default, on and off …` · `a11y/element-demos has drifted from its master (see above)` | `variants/vanilla/test/a11y-master-identity.test.mjs` |
| exactly one slot | `slot: true` → `slot: false` | `Expected values to be strictly equal: actual: undefined, expected: 1` (now named: `a11y: exactly one chrome slot …`) | same |
| noindex carried through | the head callback dropped `noindex` | `variant a11y/element-demos: actual: false, expected: true` | same |
| script-only state written | `aria-pressed` → `data-pressed` in the toggle handler, the two comment mentions left in place | `a11y/mode-demos renders [aria-pressed] but vanilla's enhancement never writes it — the control announces a state it can never enter`; the sheet-promised leg and the self-proof failed with it (comments stripped by `codeOnly`, as the checkout pass required) | `tools/repo-checks/test/pdp-controls-wired.test.ts`, a11y block |
| every control reached | the specimen loop deleted | `a11y/element-demos: controls vanilla's enhancement never reaches: expected [ …(3) ] to deeply equal []` and the same three on mode-demos | same |
| the shell stays silent | the live-region handler also called `announce()` | `expected 'Added "A sample record" to the demo c…' to be ''` — on the DS-ON leg, the DS-OFF leg and the specimen leg | `a11y-controls-behave.test.ts` |
| emulation ≡ seam | one system colour in the forced-colors rule changed (`--color-accent: Highlight`) | `the forced-colors rule's custom properties are the media query's, verbatim … expected [ …(10) ] to deeply equal [ …(10) ]` | same |
| registration ships with routes | `variants: ["vanilla"]` → `[]` | `a11y registers no live variant — either the section is unserved or the registration was left out of the commit that served it: expected 0 to be greater than 0` | pdp-controls-wired, a11y block |
| masters cannot move | `page()`'s `slot` default → `true`; separately `scripts` default → one script | `editorial/index.html is stale — re-run: node render/build.mjs` (both) — `shell()`'s own default is unreachable through `page()`, which passes its own; the first attempt flipped that one and nothing moved, so the row records the default that guards | `packages/reference/test/reference.test.ts` |
| a master edit moves both sides | `Five defaults` → `Five default` in `a11y.mjs` | regeneration: `a11y/element-demos/index.html is stale`; the identity test PASSED (17/17) — recorded as its designed blind spot, the regeneration test being the guard for it | reference.test.ts |
| turbo hashes the renderer | a comment appended to `a11y.mjs` | `@pm/vanilla#build` cache: `HIT` (control) → `MISS` → `HIT` (restored) | `turbo.json` graph via `@pm/reference#topo` |
| additive, stage-scoped | the toggle handler also toggled a class on `<html>` | `expected '{"elements":["html[class=pm-emulating…' to be '{"elements":["html[lang=en]","head[]"…'` | a11y-controls-behave |
| …and the guard's own name made true | the toggle also set `aria-hidden="true"` on the honesty CAVEAT — the dishonesty this page must never ship, and it touches no class, no inline style, not `<html>`/`<body>` and not the stage, so the fingerprint's FIRST draft missed it entirely | the fingerprint is total now (every element, every attribute, `aria-pressed` on the toggles masked) and it fires: `expected '{"elements":["html[lang=en]","head[]"…' to be …` | a11y-controls-behave |
| the published ratios are the palette's | the superlative put back in the copy | `the copy publishes an unverifiable superlative: worst shipped` | `a11y-controls-behave` |
| …and they track the tokens | `--pm-neutral-600` darkened to `#4a443a` | `the paper pairing moved — requote the page: expected '9.40' to be '6.14'` | same |
| the specimen registry has teeth | a sixth field added to the forms demo (masters regenerated) | `.pm-field__control: the registry excuses 2, the masters render 3` | pdp-controls-wired, a11y block |
| …and names a tag | a `<button>` given the excused field class | `the specimen row excuses <input>, not this: expected 'button' to be 'input'` | same |
| the twins stay distinguishable | the sentence stopped naming the side | `expected 'Specimen: "Add to cart", a box. …' not to be 'Specimen: "Add to cart", a box. …'` | a11y-controls-behave |
| a repeat says something new | the press counter removed | `a repeated press repeated itself — silent to AT: expected 1 to be 3` | same |
| the renderer cannot drift from the masters | a heading edited in `a11y.mjs` with NO regeneration | `a11y/element-demos/index.html is stale — re-run: node render/build.mjs` | `reference.test.ts` |
| filling the answer line shifts nothing | the reserve put back to `3em` | `a11y/element-demos @320px: filling the answer line moved the next demo: expected 23 to be +0` | `a11y.browser.test.ts` |
| the forced-colors leg tests the SEAM, not the browser | tokens.css's whole `@media (forced-colors: active)` block deleted | `expected { text: '#201c16', …(4) } to deeply equal { text: 'CanvasText', …(4) }` — and this is the row that justifies the rewrite: the leg's FIRST version compared painted colours, which Chromium forces whatever the author CSS says, so it would have PASSED with the design system's seam deleted | same |
| the URL serves | the a11y directory moved out of the served dist | `/vanilla/a11y/ → 404`; leg: `expected 404 to be 200` on all three pages (status asserted before any body read), plus the two sheet legs on the vanished pages | `tools/origin-suite/suite/a11y.test.ts` |
| the home row is derived | the PM‑005 row reverted to `In build` | `PM-005 status: expected 'In build · <a href="https://github.co…' to contain 'Public today'` and the derived home-rows leg red beside it (`home's catalogue rows match SURFACE_CONTROLS completion state`) | `composed-origin.test.ts` home-rows leg + `a11y.test.ts` |
| the drift gate sees the composed page | post-render body edit, dist rebuilt | `normalized DOM drift (dom-vanilla-a11y-element-demos) — full extracts in .dev-logs/drift/` | `drift.browser.test.ts`, a11y block |
| the OS setting wins — additive only | an `[aria-pressed="false"]` rule appended to mode-demo.css that re-enables motion in the stage (a subtractive emulation); dist rebuilt | `expected 0.12 to be less than 0.001` under Playwright's `reducedMotion: "reduce"` — the one guard that can see it; the repo-check's block compare and the DOM legs stay green through it, which is why the browser leg exists | `a11y.browser.test.ts` |

**Verify-slice, four lenses.** **four lenses, 25 raw findings, 16 distinct, none refuted, all fixed here.**
The pass is the reason this section is longer than the build was. Its first
run died on the Fable limit with `4 started / 0 results` — an empty findings
array that reads exactly like a clean sweep and was not one, the 2026-08-14
lesson arriving for the second time in three units; the journal was read
before anything was believed and the four lenses were re-run.

Four of the sixteen are defects in this session's OWN mid-pass fix, which is
the part worth keeping. The correctness lens found that a specimen press
answered through the shell's `[data-pm-status]` — 1×1 and clipped, so the
answer reached a screen reader and left a sighted pointer user with a button
that visibly did nothing, on the page whose subject is whether controls can be
hit — and that both focus twins produced byte-identical text, which a live
region does not re-announce. Fixing that introduced three more, all caught:
the new line went in ONE page-level copy, up to three viewports above the
button; its `min-height: 3em` reserve held at 412 px and 1440 px and shifted
the next demo 23 px at 320 px, the width this page's own reflow demo is about;
and inserting it between a toggle and its stage broke the adjacent-sibling
selector every emulation is keyed on — that last one caught within seconds by
this slice's own adjacency guard, which is what the guard was for.

The rest, by kind. **Two false claims:** the exhibit's only published number
was a superlative ("our worst shipped pair") that is false — muted ink on the
sunk surface is 5.73:1 and ships in three places — and three documents of
record plus a test docstring described the pre-fix mechanism the code
deliberately rejects, which for ADR-0008 means the rationale of record would
have taught the next author to reintroduce the defect. **Four vacuous or
under-powered guards:** the browser leg asserted the abandoned region and a
sentence the script never writes (a guaranteed-red leg, and the pages'
visible answer line had no browser coverage at all); the forced-colors leg
compared painted colours, which Chromium forces regardless, so it would have
passed with the seam deleted; the reflow leg pinned the 320 without the
`box-sizing` declaration that makes 320 mean the frame; and the "not the
sr-only shape" check tested for a class the line would never have carried.
**Three registries and lists that could go stale:** the specimen exemption
excused a class with no tag and no count, the a11y master list was hand-typed
beside a sibling that derives the same set from disk, and the browser
fingerprint sampled four attribute families while its linkedom twin had
already gone total for that exact reason. **Two records that did not match
their tree:** the "counts tool-derived (final tree)" figure was 189 on a tree
that was not final (193), and the page hashes were stale with character counts
labelled bytes. **One shipped waste:** the index linked `plaque.css` and
rendered no plaque class — `pm-pdp__scroll` in mirror image, which
`master-styles-resolve` cannot see because it only walks class → rule.

Every one is fixed in this commit, and the fixes brought their own guards: the
published ratios are now recomputed from the palette with superlatives barred
by name, the answer line's reserve is a measurement with a zero-shift leg at
four widths, and the forced-colors leg reads custom properties rather than
paint.

**The exhibit's one published number was a superlative, and the superlative
was false.** The contrast demo said "our worst shipped pair measures 6.14:1".
6.14:1 is right for the pair it shows — `--color-text-muted` (`#675f52`) on
the paper ground (`#fdfcfa`) — and this is the commit that makes the sentence
public, so it was computed from the tokens rather than inherited. But "worst"
was checked by nothing, and it is wrong: the same muted ink on
`--color-surface-sunk` (`#f6f4ef`) is **5.73:1**, and that pairing ships in
three places — both `pm-editorial__feature-note` lines inside the editorial
feature aside (six variants) and the checkout's `pm-cart__empty` line, which
is the checkout's canonical served state, so every visitor sees it. Nothing
fails AA either way; what failed was the claim. A skeptic with a colour picker
would have falsified the exhibit's only quantitative sentence on the page whose
whole argument is that the numbers here are honest. The copy now names both
pairs and no superlative: "6.14:1 on this paper ground, and 5.73:1 on the sunk
panels where the editorial feature note and the checkout's empty-cart line
live." Found by the verification pass.

**The pages stay snapshot-independent, which is what lets the crate smoke run
what CI runs.** `renderA11yPage` has arity 1 (a page key; no snapshot can
reach it) and the a11y block references no tray field, so the three pages hash
to 4d39e470, 4b0933cf and eb5db5a5 whatever `PM_SNAPSHOT` says — 3,731 /
11,034 / 8,353 characters, which is 3,747 / 11,076 / 8,374 BYTES in UTF-8.
Those are two different numbers and the first draft of this paragraph labelled
the character counts "B", which the verification pass caught: the em dashes
and the `×` in the demos are multibyte, and a byte figure that is really a
character figure is exactly the sort of number this log exists to not publish.

**Verification, counts tool-derived (final tree):** `pnpm run check` → **33
successful, 33 total**; derived, not typed —
`turbo run lint typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`
→ `33` (the new tests live inside existing task scripts, so the count holds).
`@pm/repo-checks` **195 passed / 1 skipped**; `@pm/vanilla` **17 passed**;
`@pm/reference` **40 passed**; lint clean. The repo-checks delta is measured,
not subtracted from memory: `git stash` on this tree and the same command on
`main` gives **163 passed / 1 skipped**, so the slice adds **+32** legs there.
That figure was written **189** and then **193** in earlier drafts of this
paragraph, both times because a "final tree" count had been taken on a tree
that was not yet final — the verification pass caught the first, and its own
follow-on guards (the visible-answer, twin-distinctness and repeated-press
legs, the specimen registry's count, and the two contrast checks) moved it
twice more. Which is the argument for deriving a count at the end rather than
quoting one from the middle.
`node packages/reference/render/build.mjs` then `git status --porcelain
packages/reference/surfaces/` → nothing. Origin suite, run ALONE from a torn-down plane, on the
final tree: fixture **20 files, 551 tests passed**, 142.8 s, exit 0; crate
(`PM_SEED_DIR=tools/snapshot-capture/crate`) **20 files, 551 tests passed**,
142.7 s, exit 0 — the "both snapshot modes" half of the done list, run rather
than argued, and the build line proves the plane really swapped (`editorial +
500 PDPs + checkout + 3 a11y pages rendered from the crate snapshot` against
the fixture run's `240 PDPs`; the a11y count is 3 in both, which is the
snapshot-independence above showing up where a reader can check it). The
baseline on `main` at 0233451 was 18 files / 519 tests, so this slice adds two
files and 32 legs: `a11y.test.ts` **13**, `a11y.browser.test.ts` **7**, and
the drift block **12** — three pages × one normalized-DOM leg plus three pixel
profiles, which is `drift.browser.test.ts` going 93 → **105**. 13 + 7 + 12 =
32, and 519 + 32 = 551.

**Two runs were thrown away before those two, and the reason is a standing
hazard rather than a mistake.** An earlier pass raced this session's own
rebuilds — `wrangler dev` was watching files that were being rewritten under
it — and reported mass failures across blog, pdp, chrome and composed-origin;
that is Phase 15's "run the suite alone" lesson, earned again. A LATER pass
ran alone and still died, with 5,000 ms browser timeouts through
`pdp-controls.browser.test.ts`, which is the same flake this machine produced
at `87113f6` and CI produced in its own post-deploy smoke. So "run it alone"
is necessary and not sufficient on this hardware: the honest procedure is run
it alone, and re-run a timeout-shaped failure before believing it. Both
recorded runs above are clean first attempts after a full teardown.

**One thing the exhibit found in the shell, and did NOT fix.** Measuring the
DS-ON specimens in a real browser to confirm the target-size demo's claim
(`.pm-button` is 123×47 — the claim is true) also measured the rest of the
page, and `.pm-masthead__brand` is **170×23**, a pixel under WCAG 2.5.8's
24 px floor — the one masthead control with no `min-height`, where its two
siblings both carry `min-height: var(--target-min)`
(`components/masthead.css:59` link, `:86` cart; the brand at `:33-34` sets
only a `font` shorthand). Pre-existing and site-wide, not this slice's: the
editorial page measures the same 170×23.

**And it is not a conformance failure — the first draft of this paragraph and
its decision-map node both said it was.** 2.5.8's own *Equivalent* exception
covers it: "The function can be achieved through a different control on the
same page that meets this criterion." The brand is `href="/"` and the footer's
`What is this?` link is the same destination at 24 px, on every page. So the
true statement is narrower and worth less: a 23 px target whose function is
also reachable at a conforming size, where closing it buys robustness rather
than compliance. The verification pass caught the overclaim, and on the
commit that ships an accessibility exhibit a WCAG citation that does not hold
is precisely the wrong thing to be wrong about. It is recorded rather than
fixed because the fix belongs in the shared component and its blast radius is
every surface: masthead.css is linked by all twelve committed masters, so a
1 px height change regenerates every one of them and re-baselines every pixel
drift leg across three profiles. That is a unit, not a line. The exhibit is
what made it visible, which is the argument for building the exhibit.

**What this leaves.** The masthead brand's target size, above. No live
validation on the forms demo (the call above). The exhibit pages carry the
chrome and its HUD like every variant page and will never publish a lab table
(ADR-0007 §5). Every footer link on every store page now resolves; the `(fog)`
node's list of unbuilt surfaces is empty.

### The controls come back, and the tier learns what it may hold (2026-09-04 · verified 2026-09-18)

The map called this its largest owed item and the 2026-08-29 audit put it
third: the PLP's commercial form is "search + faceted filters + sort", and
the served pages had none of it. The rail, the search form and the sort
select were cut on 2026-08-29 — correctly, rather than shipped inert —
because `workers/edge` `handlePlp` read `n`, `page`, `run` and `cache` and
nothing else, so every one of those controls navigated to a filtered URL and
got the unfiltered grid back under a count that still said "of 500". ADR-0005
§5 had named the contract fourteen months earlier and left two questions and
one bound open. This unit closes them, and the order it did so in is the
useful part.

**Step 0 went first, on its own branch, because it did not need the rest.**
`handlePlp` floored `page` at 1 with no ceiling, folded the raw integer into
the KV key, and wrote every miss through with no TTL. So `for p in $(seq 1
1000000); do curl "?page=$p"; done` minted one immortal ~10 KB entry per
integer — the attacker pays nothing, the project pays writes and storage
forever, on the surface whose thesis is pricing infrastructure honestly. The
obvious fix is wrong: clamping `page` BEFORE the KV lookup needs
`totalPages`, which needs the snapshot, which needs R2, and that puts ~400 ms
of origin on every warm hit and erases the edge-cache cell. So the ceiling is
applied on the way OUT — `serveData` gained a `cacheable(payload)` predicate,
the lookup stays one KV read, and a page past `totalPages` is still the
honest empty "0" every arm renders but is never stored and says so
(`x-pm-cache-state: none`, the state a 4xx already carried: not a warm-tier
resource). `@pm/edge` had no test at all; it has a vitest suite now (turbo
33 → 34), driving the Worker in-process with a RECORDING KV stub so "never
written" is asserted on the store rather than inferred from a header.
Sabotage: predicate removed, 4 of 9 legs fail. Committed as `fec4a29` on
`plp-page-ceiling` before anything else was written.

**The design went in front of a panel before the code did.** Four skeptics
(measurement integrity, the contract and the arms, cost and anti-rigging,
seams) attacked the design note against the repo: 33 findings, 6 kills. Two
kills were already right in the code by the time the panel returned — a
search skips the KV lookup entirely (the note's order of operations would
have let `?q=ambient` HIT the unfiltered page-1 entry every visitor had
warmed, and serve it as a hit), and an empty `sort=` is absent, never a 400
(it is what an untouched select submits). Three changed the design:

- **`hx-boost` was going on the `.pm-plp` root.** htmx boosts every
  descendant same-origin anchor, and the 24 card links to
  `/vanilla/pdp/<slug>/` are descendants — a click on a record title would
  have fetched the PDP document and swapped it INTO the grid, masthead and
  second chrome slot included. `hx-target`/`hx-swap` ride the root (inherited);
  `hx-boost` rides the four navigation containers — the rail, both forms, the
  pagination — and never the root or a card. The guard pins the placement
  and that no card anchor carries an `hx-*`.
- **The tray's shape changed under an unchanged `v1:` key prefix.**
  Visitor-facing entries have no TTL, so the default condition's pre-deploy
  entry would have served a tray without `applied` after the deploy and both
  arms would have thrown on `applied.q` for every visitor until a manual
  flush — and the nonced smoke would have stayed green. The prefix is now the
  tray-shape version (`PLP_TRAY_VERSION`, beside the shape, `v2:`), and the
  htmx boundary refuses a tray without `applied` as a 503 rather than a
  TypeError.
- **The "zero storage" residual was false.** Any well-formed `?run=` nonce on
  a cacheable condition is one KV write and one ~4 KB entry for an hour — a
  time-bounded dimension, not zero, and the same holds for `/api/pdp`. The
  ADR addendum says so, and flags the one thing this session could not
  verify: whether the `pm-warm` namespace is on Cloudflare's Free plan
  (1,000 writes/day), which would make that dimension an outage vector.

The discounts were folded in too: `q` normalized client-side by the same rule
so a cache arm's `settled` can ever be true; a junk filter a 404 "No such
filter" on both arms rather than htmx's "data plane didn't answer" 503 beside
react-next's error boundary; the RUM `cacheState` tag saying `none` for a
search instead of blending an R2 read into the KV column; the bench runner
refusing a PLP batch at an n the tier never holds; the strategy presets
carrying the visitor's whole condition instead of replacing it; the n knob
dropping `page`. Every item is in the ADR addendum with what it gave up.

**Q1 and Q2, settled.** Facet counts under a filter RECOUNT over the filtered
set with the selected group's own filter lifted — a count is what the click
returns: switching within the group you filtered by, adding in the others.
And `PlpPage` grows `applied`, because every renderer now draws the
selected facet, the chosen sort and the search value from the payload, never
from the URL: under `keepPreviousData` the previous tray is on screen while
a new condition is in flight, and controls drawn from the request would show
one condition's selection over another's grid — a toggle-off link that does
not toggle off. The arms-agree guard found the reference and react-next
disagreeing about an EMPTY result the day the filters landed (a lone current
"1" over "Showing 0 of 0" against an empty nav — page 1 of 0 either way);
neither is what a visitor needs, so an empty result has no pagination
landmark at all, in all three renderers.

**One implementation of the semantics, and the third consumer of the spec.**
The Worker had re-typed the reference's facet comparator, and the react-next
guard's own header had counted the `computeFacets` hits and found "not one
assertion" comparing the two. Filtering and sorting would have been a second
and third copy of the same class. So the semantics — filter, ASCII-case-
insensitive search over title or artist, five sorts with nulls last and
committed-order tie-breaks, the recount, the slice — are ONE pure, import-free
module, `packages/reference/render/plp-query.mjs`, imported by the reference
renderer and by the edge Worker. `@pm/edge` declares `@pm/reference`, and the
ADR-0004 §2 addendum records the one exception to "never shipped" it makes:
the data plane is not a paradigm, its bundle is never a measured client
bundle, and what the exception buys is that the master and the served page
cannot disagree about what a filtered condition contains. The two arms still
re-type the MARKUP; the three rules a paradigm cannot import — the n clamp,
the q normalizer, the href rule — are re-typed in react-next and pinned equal
over tables of inputs.

**The key-cardinality policy, measured rather than estimated.** A key is
written only when `q` is absent, `n` is one of the two published knob values,
and the page is within the filtered set. The URL-derivable half is one
derivation (`plpWarmable`, @pm/measurement) for the Worker and for the
chrome's RUM tag. The ceiling was computed by building every cacheable
payload with the real query module and counting its bytes: **37,182 keys /
0.162 GB / $0.19 of writes / $0.08 per month** for the real crate — against
4,548,342 keys / ~19.7 GB / $22.74 / $9.87 per month with `n` free in
1..240, against unbounded before. Prices fetched from Cloudflare's pricing
pages that day. The first draft of the ceiling script counted facet bytes
over the filtered set, not the lifted one, and the cost lens caught the 1.5×
under-count; the number above is the corrected one.

**The controls, back in the master first.** One href rule for pagination,
facets, both forms' hidden inputs and every client-side history write —
canonical order, defaults omitted, the bare condition spelled `?page=1`,
form-submit encoding — closes the first PLP build's handoff §6.2(ii): a
page-flip from `?cache=cold` stays cold. The regenerated master is **105
insertions and zero deletions**, the mirror image of the 105-line cut. The
default sort is labelled "Catalogue order": snapshot-capture stores rows
id-ascending, and the pre-cut master's "Popularity" was a false label in the
spec layer. The front Worker honours `x-pm-partial` — every htmx page-flip
had been an ERROR log against a correct Worker since 2026-08-28. The
warm-tier guard now covers PAGE paths that proxy the tray: `/htmx/plp` as the
handoff predicted, and `/react-next/plp`, which the handoff missed and which
carried a live un-nonced instance in `a11y.test.ts` that planted the
canonical PLP key on every deployed smoke.

**Verification.** The two unfinished halves of the unit ran on 2026-09-18, fourteen days after
the code, on the same tree plus what the verification itself changed.

**The origin suite, alone, both snapshots.** Fixture run 2 on the resumed
tree: 572 passed, 1 failed. The six run-1 failures — React's `<!-- -->` text
boundaries in the count line, browser waits keyed on the input's value, htmx
pushing the raw form URL — were gone; the one failure was
`bench.browser.test.ts`'s one-command-reproduce leg hitting its 600 s cap
while run 1's WHOLE suite had taken 143 s. Timeout-shaped, so it was re-run
before it was believed: run 3, 573 of 573 in 144 s; crate mode, 573 of 573
in 143 s. The hang was a one-off, and no Worker reloaded under it (each
wrangler log shows one `reloadStart`, at startup). A mechanism that produces
exactly that shape is on record rather than fixed, because it is not this
unit's code: `tools/bench-runner/src/cpu.ts` `CdpConnection.send()` awaits
an inspector reply with no timeout, so one lost `Profiler.stop` holds a
batch until vitest's cap.

**The react-next 404, read rather than reasoned about.** Run 1 had left one
question open: the junk-filter page on react-next answered 404 with "No such
filter" in the body and ZERO injected chrome. A held plane settled it. The
served document is `<html id="__next_error__">` — Next's own error shell —
with the branded boundary present only inside the RSC flight payload, no
chrome slot, and the front Worker logging `chrome-slot-count` 0: byte-for-
byte the shape the PDP's 404 has shipped since its build (DIFF-TO-STARTER
item 25; `pdp.test.ts` asserts the status alone). The htmx 404 carries the
chrome once and `x-pm-cache-state: none`. So the suite leg pins the recorded
shape for react-next — status, sentence, `__next_error__` — and the chrome
count for htmx; a Next release that starts SSR-ing the boundary fails the
leg and tightens it. The two new `not-found.tsx` docblocks had claimed the
shell "keeps the chrome slot present" — copied from the PDP's, and false in
served HTML on both arms of that claim; corrected. The PDP's own
`not-found.tsx` and `lib/plp-error.tsx` carry the same sentence and predate
this unit: flagged, not fixed here.

**The sabotage table: 36 rows, one deliberate defect each, the owning guard
must fail.** First pass 31 caught, 5 missed — and the misses are the useful
part. Four were one shape: a claim tested by equality with the module under
test. `plp-params.test.js` compared the Worker's tray to `applyPlpQuery`,
which the Worker IMPORTS, so dropping the artist half of the search (Q1) or
reversing the tie-break (Q4) moved both sides together and the "title OR
artist" and "ties on committed order" legs stayed green; react-next's guard
pinned `normalizePlpQ` equal to the reference over a table but never that
the route CALLED it (N2); and `loadPlp`'s one line that decides
404-versus-outage (`400 → null`, N7) had no in-process test, because the
guard drives the edge Worker directly and never went through it. Each gained
a leg with an independent oracle — the raw summaries (a word that occurs in
some artist and in no title; each row's position in the committed order), the
route function itself, a mocked `getCloudflareContext` — and each re-run was
caught. The pre-check had already found G7: `@pm/bench-runner` had no test
task at all, so the addendum's "the bench runner refuses a PLP batch at any
other n" was typechecked prose. The fence is now an exported function with
the package's first test (turbo 34 → 35), which also pins it equal to
`plpWarmable` over every n in 1..240 — one derivation, held to the other.
One row stays missed, honestly. G5, the front Worker's `x-pm-partial`
pass-through: its only observable effect is the ABSENCE of a
`chrome-slot-count` ERROR log. HTMLRewriter is workerd-only, so there is no
in-process test, and the seam leg pins the visible half (no chrome and no
head sheet on a partial; chrome exactly once on the document) but cannot
see a log line. Proven by the log instead: across the crate run, zero
slot-count errors on any `/htmx/plp/` response (17 documents and partials
served), and every error logged was one of the recorded 404 shapes. And one
row was retired: DELETING the tie-break is a no-op, because
`Array.prototype.sort` is stable — "Since version 10 (or ECMAScript 2019),
the specification dictates that `Array.prototype.sort` is stable" (MDN,
fetched 2026-09-18) — so the row that bites is the reversal. Final: 35 of 36.

| row | file | defect | result | guard that failed |
|---|---|---|---|---|
| W1 | `workers/edge/src/index.js` | warm-tier gate `tiered: plpWarmable(…)` → always tiered | CAUGHT | `test/plp-params.test.js` |
| W2 | `workers/edge/src/index.js` | page ceiling `cacheable: page <= totalPages` → always cacheable | CAUGHT | `test/plp-page-ceiling.test.js` |
| W3 | `workers/edge/src/index.js` | facet-value validation disabled | CAUGHT | `test/plp-params.test.js` |
| W4 | `workers/edge/src/index.js` | unknown `sort` no longer 400s | CAUGHT | `test/plp-params.test.js` |
| W5 | `workers/edge/src/index.js` | empty `?genre=` no longer treated as absent | CAUGHT | `test/plp-params.test.js` |
| W6 | `workers/edge/src/index.js` | over-long facet value no longer refused before the lookup | CAUGHT | `test/plp-params.test.js` |
| W7 | `workers/edge/src/index.js` | KV key prefix pinned to `v1:` (tray-shape version dropped) | CAUGHT | `test/plp-page-ceiling.test.js` |
| W8 | `workers/edge/src/index.js` | `run` nonce dropped from the key | CAUGHT | `test/plp-params.test.js` |
| Q1 | `packages/reference/render/plp-query.mjs` | search matches title only (artist half removed) | MISSED → CAUGHT (leg added 2026-09-18) | `test/plp-params.test.js` |
| Q2 | `packages/reference/render/plp-query.mjs` | nulls sort FIRST instead of last | CAUGHT | `test/plp-params.test.js` |
| Q3 | `packages/reference/render/plp-query.mjs` | genre facets counted over the filtered set (own filter not lifted) | CAUGHT | `test/plp-params.test.js` |
| Q4 | `packages/reference/render/plp-query.mjs` | sort tie-break REVERSED (`b.index - a.index`) | MISSED → CAUGHT (leg added 2026-09-18) | `test/plp-params.test.js` |
| R1 | `packages/reference/render/plp.mjs` | `cache=cold` dropped from the reference href rule | CAUGHT | `test/master-identity.test.js` |
| R2 | `packages/reference/render/plp.mjs` | bare condition spelled `?` instead of `?page=1` | CAUGHT | `test/master-identity.test.ts` |
| R3 | `packages/reference/render/plp.mjs` | selected facet outside the cut no longer appended | CAUGHT | `test/plp-arms-agree.test.ts` |
| R4 | `packages/reference/render/plp.mjs` | default sort relabelled "Popularity" | CAUGHT | `test/master-identity.test.js` |
| H1 | `variants/htmx/src/render.mjs` | `hx-boost` removed from the navigation containers | CAUGHT | `test/master-identity.test.js` |
| H2 | `variants/htmx/src/render.mjs` | `hx-boost` moved onto the `.pm-plp` root | CAUGHT | `test/master-identity.test.js` |
| H3 | `variants/htmx/src/index.js` | htmx forwards only the four old knobs | CAUGHT | `test/master-identity.test.js` |
| H4 | `variants/htmx/src/index.js` | tray 400 no longer distinguished from 503 | CAUGHT | `test/master-identity.test.js` |
| H5 | `variants/htmx/src/index.js` | tray without `applied` accepted | CAUGHT | `test/master-identity.test.js` |
| H6 | `variants/htmx/src/render.mjs` | htmx condition drops cache/run/profile | CAUGHT | `test/master-identity.test.js` |
| N1 | `variants/react-next/src/lib/plp-condition.ts` | `cache=cold` dropped from react-next's href rule (both call sites) | CAUGHT | `test/master-identity.test.ts` |
| N2 | `variants/react-next/src/lib/plp-condition.ts` | react-next route stops normalizing `q` | MISSED → CAUGHT (leg added 2026-09-18) | `test/master-identity.test.ts` |
| N3 | `variants/react-next/src/lib/plp-condition.ts` | `profile` forwarded unvalidated | CAUGHT | `test/master-identity.test.ts` |
| N4 | `variants/react-next/src/components/PlpTanstack.tsx` | TanStack `settled` falls back to page equality | CAUGHT | `test/master-identity.test.ts` |
| N5 | `variants/react-next/src/lib/plp.tsx` | selected facet loses `aria-current` | CAUGHT | `test/plp-arms-agree.test.ts` |
| N6 | `variants/react-next/src/lib/plp.tsx` | facet click no longer resets `page` to 1 | CAUGHT | `test/master-identity.test.ts` |
| N7 | `variants/react-next/src/lib/edge.ts` | react-next `loadPlp` lets a 400 fall through to the error boundary | MISSED → CAUGHT (leg added 2026-09-18) | `test/edge.test.ts` |
| G1 | `tools/repo-checks/test/warm-tier-discipline.test.ts` | warm-tier guard regex narrowed back to `/api/(plp|pdp)` | CAUGHT | `test/warm-tier-discipline.test.ts` |
| G2 | `packages/measurement/src/beacon.ts` | `plpWarmable` ignores `n` | CAUGHT | `test/profiles.test.ts` |
| G3 | `packages/switcher/src/chrome.ts` | n knob keeps `page` | CAUGHT | `test/chrome.test.ts` |
| G4 | `packages/switcher/src/chrome.ts` | strategy presets drop the visitor's condition | CAUGHT | `test/chrome.test.ts` |
| G5 | `workers/front/src/index.js` | front Worker `x-pm-partial` pass-through disabled | MISSED — unguardable by test; proven by log (see text) | — |
| G6 | `packages/tokens/css/surfaces/plp.css` | `.pm-plp__results` rule renamed (OWED retirement broken) | CAUGHT | `test/master-styles-resolve.test.ts` |
| G7 | `tools/bench-runner/src/batch.ts` | bench-runner PLP n fence disabled | CAUGHT | `test/batch.test.ts` |


**The key policy, read off the store.** The crate run's local KV holds 21
keys. Nine are PLP: eight nonced (`run=suite-…`, TTL 3600 s) and one
un-nonced canonical `v2:/api/plp?n=24&page=1`, written 7.07 s before the
suite's first nonce — the runner's own `/api/plp` readiness probe
(`run-local.mjs`), local-only; the post-deploy smoke never runs it. Zero
keys carry `q=`; zero carry an n outside {24, 240}; zero carry the `v1:` PLP
prefix. The twelve PDP keys are six nonced and six un-nonced server-side
page fetches, the measurement-pass known. `kv-ceiling.mjs` re-run on the
crate reproduces the addendum's numbers to the digit — 37,182 keys /
0.162 GB / $0.19 / $0.08 per month, against 4,548,342 / 19.745 GB / $22.74 /
$9.87 — and the regenerated masters are +105/−0 (plp) and +1/−0
(how-it-was-built), as recorded.

**verify-slice.** Four lenses, sequential (the limit-resilient shape), on the
tree above; 15 raw findings across the first three, refuted or fixed inline,
and every fix given a guard that a second sabotage round (13 rows, table
below) proves bites. The correctness and conformance lenses converged
independently on the same six defects — the signal worth having. (1) An
EMPTY intersection dropped the SELECTED facet from the rail: `genre=Jazz&
style=Minimal` with no such record rendered "0 of 0", no marked facet and no
link that removed either filter — 637 of the crate's 855 genre × style pairs
are empty — and all three renderers agreed on the wrong markup, so
arms-agree could not see it. The query module now lists the selected value at
its honest count, 0 (ADR Q1's one exception, recorded); the edge test holds
it to a real empty pair, arms-agree renders one and reads two `aria-current`
facets whose hrefs each drop their own param. (2) `?page=` of 309+ digits
parsed to Infinity: the tray carried `"page":null` against its own Zod
contract, htmx answered a false "data plane didn't answer" 503, and
react-next held Infinity while the Worker read its `page=Infinity` as page 1,
so `settled` could never be true. Both clamps cap at `MAX_SAFE_INTEGER` —
past the end, empty, never stored — and react-next's is pinned to the
module's over a table. (3) The junk-value length bound measured with
`encodeURIComponent` while the key is spelled by `URLSearchParams`, which
encodes `! ' ( ) ~` as three bytes: two values of 96 `!`s passed the bound
and handed `KV.get` a 613-byte key — a 500 where the policy promises 400
`none`. The bound now uses the key's own encoder, and a whole-key belt
refuses anything KV would; the leg asserts the message so each layer is
proven separately. (4) react-next's sort select and search box were
UNCONTROLLED, and React never re-applies a changed `defaultValue` to a
mounted select or a dirty input: after Back the controls kept one condition
over another's grid — the very thing Q2 was decided to prevent, and a
behaviour htmx (whole-block swap) did not share. Keyed on their applied
values they remount, SSR bytes untouched; a browser leg now drives search →
sort → Back → Back on both arms. (5) The sort form's hidden `q` sat before
the select, so a JS-off sort with a search applied spelled `…&q=…&sort=…` — a
third spelling of one condition the code comment denied. Hidden knobs split
around the control in all three renderers, and arms-agree serializes both
forms in tree order against the href rule. (6) The Worker header restated the
ceiling with stale storage numbers. The seams lens added two: `@pm/edge#test`
was a CACHED turbo task reading the crate by an unhashed path — a crate
re-freeze would have replayed a stale PASS for exactly the legs that hold the
policy to the real crate — now uncached like every sibling guard that drives
a Worker over the crate; and the instrument's `nKnob` was a literal copy of
`PLP_N.warmed` with nothing pinning the two — now the derivation itself,
pinned by identity. Two more from the first lens: the warm-tier guard was
blind to the browser suite's template-literal request shape (its two tray
requests were cold and nonced by luck of the object form), so the regex now
sees `${…}/api/plp` and the helpers spell the literals; and the decision-map
node cited a build-log entry that did not yet exist — this one. The skeptic lens (re-run after
an expired login token killed its first attempt; the three finished lenses
replayed from the journal) added five. Two were real behaviour: react-next's
`HiddenKnobs` re-emitted a junk `run`/`profile` unbounded where the reference
and htmx drop it — the one place the three renderers disagreed, reachable
only through the exported `PlpArticle` seam — now bounded by the same rule
and pinned by an arms-agree case; and the browser suite drove only the plain
react-next arm, so Q2's in-flight guarantee (`keepPreviousData`, `settled`
= `appliedMatches`) was never observed where it exists — the TanStack arm is
now a third arm of every browser leg. Two were record hygiene: the committed
design note carried the superseded ceiling and key shape beside the record
of record (a supersession note now heads it; the ceiling script's usage
line and `v1:` prefix corrected, numbers unmoved), and RUM tags a page past
the end or an empty intersection `default` while the Worker serves `none` —
recorded in the addendum's "given up" bullet as the ADR-0001 §8 matter it
is. The fifth was the guard blindness above, seen from the other side: the
`${arm.path}?…` lines the two new files are built from matched nothing, so
their discipline rested on a comment. The regex gained a path-variable
alternative, the suite's request helper refuses an undisciplined path at
request time, and the one unrelated `${path}?` line in the suite carries
its own exemption.

**The one finding the fixes surfaced that no lens made.** Proving the
react-next remount guard bites — a sabotaged plane, the browser file alone —
failed the Back leg on react-next as intended AND on htmx, which the lenses
had called immune. Standalone replays passed every time; the failure needed
a freshly started plane and the suite's own timing. Logged from inside
vitest against a cold plane: the sort submit fired NATIVELY (`native
submit`, no `htmx:beforeRequest`, the in-flight beacons aborted by a full
navigation). htmx processes swapped-in content in a settle task
`settleDelay` (20 ms) after insertion, and pushes the URL BEFORE it; a leg
that acts the instant the address bar moves submits a form htmx has not yet
boosted. The browser then navigated for real, and Back restored the
previous document's form state — the browser's own behaviour, and
progressive enhancement's honest fallback, not an htmx defect. The suite now
waits for the `htmx-added` marker to clear after every swap before touching
a control; on a fresh plane the file passes first time, both arms, in 3 s.
The `key` proof stands: without it react-next fails the leg on the
assertion; with it, both arms pass.

Round 2 — one row per fix landed this day:

| row | defect | result | guard that failed |
|---|---|---|---|
| S1 | selected value no longer appended at 0 on an empty intersection (query module) | CAUGHT | `test/plp-params.test.js` |
| S1b | same defect, seen by the arms-agree case | CAUGHT | `test/plp-arms-agree.test.ts` |
| S2 | `clampPage` cap removed (Infinity again) — Worker | CAUGHT | `test/plp-page-ceiling.test.js` |
| S3 | `clampPlpPage` cap removed — react-next | CAUGHT | `test/master-identity.test.ts` |
| S4 | per-value bound measured with `encodeURIComponent` again | CAUGHT | `test/plp-params.test.js` |
| S5 | whole-key belt disabled (per-value bound intact) | MISSED — unreachable by construction: with the per-value bound intact no key can exceed 512 bytes (3 × 96 + overhead ≈ 420); the belt is proven by S4+S5 | — |
| S4+S5 | both bounds wrong — the original 500 scenario | CAUGHT | `test/plp-params.test.js` |
| S6 | reference emits the sort form's hidden `q` before the select | CAUGHT | `test/plp-arms-agree.test.ts` |
| S6h | htmx does | CAUGHT | `test/master-identity.test.js` |
| S6r | react-next does | CAUGHT | `test/plp-arms-agree.test.ts` |
| S6-all3 | ALL THREE do — only the serialization oracle can see it | CAUGHT | `test/plp-arms-agree.test.ts` (the serialization oracle) |
| S8 | warm-tier regex narrowed back (blind to `${ORIGIN}/api/plp`) | CAUGHT | `test/warm-tier-discipline.test.ts` |
| S9 | browser suite's tray helper drops `cache=cold&run=` | CAUGHT | `test/warm-tier-discipline.test.ts` |


**The suite once more, on the final tree.** Fixture 579 of 579 in 143 s;
crate 579 of 579 in 142 s — six legs more than the morning's runs (the
Back leg on each arm, the TanStack arm's four). The first crate attempt is
on record too: seven seconds in, the front Worker's `wrangler dev` process
died with an empty internal error and the SDK's own "please create an
issue" text, and 0 of 206 legs reached the plane; run alone again, green.
Not this unit's code, and not the first wrangler tree to misbehave today:
the morning's held plane survived `pkill -f "wrangler dev"` because the
process is spelled `wrangler.js dev`, and its orphans rebuilt on every
source edit until the load average read 101. `run-local.mjs`'s own
pre-flight hint names the wrong pattern; flagged.

**`pnpm run check`:** 35 of 35 tasks green, both before and after the
findings were folded in.

**What this leaves.** For Rob: whether the `pm-warm` namespace is on the Free
plan — the `run` nonce is a time-bounded key dimension and 1,000 writes/day
is an outage vector, not a cost line. Flagged, not fixed: the PDP
`not-found.tsx` and `lib/plp-error.tsx` docblocks (the same false sentence
this unit corrected in its own), and the bench runner's uncapped CDP send.
The measurement-pass items the addendum names stay with the pass.

### The floor the blog already had, and the roster the collector never checked (2026-09-18)

The 2026-08-29 audit put this fourth, and said plainly that nothing in it
was a blocker: no published number is movable from outside, and no
unauthenticated write reaches storage. What it found was an inconsistency a
header-checking staff reviewer sees in the first minute. The blog wall had
held up under an adversarial pass — constant-time credential compare, hashed
revocable sessions, header-plus-form CSRF with `Sec-Fetch-Site`, a real CSP,
`nosniff`, a referrer policy — and every page that is NOT the blog shipped
with none of it. Confirmed on a held plane before a line was written:
`curl -sD -` on `/`, `/methodology/`, `/vanilla/editorial/`, an image and
`/api/snapshot` returned no `X-Content-Type-Options`, no referrer policy, no
frame policy, and the only paths carrying any of the three were `/blog/*`.
Nothing in `docs/` recorded the store's absence as a decision, which is the
part that mattered: an absence with no record reads as an oversight even
when it is not one.

**Where the headers go, and why there are two mechanisms.** The front Worker
has two serving paths. Requests for its own static assets — the home
surface, the methodology page, the how-it-was-built page, the `/_pm/*`
instrumentation, the `/pm/*` fonts — are answered assets-first and never
reach the script; everything else dispatches over a service binding and
returns whatever the upstream sent, headers untouched (`.transform(upstream)`
at the end of the injection path, `return upstream` on the pass-through
ones). So the floor needs to exist twice, and the design question was how
to make the two copies one thing. One module, `security-floor.js`, holds
the three headers as data; the Worker's exported `fetch` is now a one-line
wrapper — `withSecurityFloor(await front.route(request, env))` — so the
floor is a property of the seam rather than of each `return` inside the
router (there were five; a sixth added later cannot forget), and the build
writes `dist/_headers` from the same module for the asset paths. Cloudflare's
own page on the file, fetched that day, supplied two facts: the file "will
not itself be served as a static asset" — the suite pins it, `/_headers`
404s — and "custom headers defined in the `_headers` file are not applied to
responses generated by your Worker code", which is exactly why the script
needs its own copy, and which no steady-state leg can pin (the wrapper
masks it); sabotage row F1 is what shows it, proxied pages losing the floor
while assets keep theirs. A third fact the docs do not state was read off the plane instead:
local `wrangler dev` applies a `_headers` file dropped into `dist/`
immediately, and 404s a request for `/_headers`. The upstream's headers are
immutable on a fetched response, so the wrapper is the documented
`new Response(response.body, response)` shape, and it uses `set`, never
`append` — an upstream that sends `x-frame-options: SAMEORIGIN` is
overridden, not joined, which is the mechanism behind the sentence "the
floor can never become a per-variant variable".

**What is on the floor, and what deliberately is not.** `x-content-type-
options: nosniff`; `referrer-policy: strict-origin-when-cross-origin` — the
blog's value, so one policy governs the domain; `x-frame-options: DENY`,
because nothing legitimately embeds the store. The frame policy's modern
spelling is a CSP directive, `frame-ancestors 'none'`, and it was rejected
here for the reason the next paragraph is about: a `Content-Security-Policy`
header carrying one directive is a half-CSP by another name. And there is
no CSP on store pages. That is a decision, recorded in ADR-0004's addendum,
not the omission it was before this entry. Qwik and Astro emit inline
scripts on every editorial page, so a `script-src` has two shapes:
`'unsafe-inline'`, which permits exactly the injected markup a CSP exists to
refuse, or a per-response nonce, which changes the served bytes on every
request — and the drift gate's normalized-DOM equivalence, the variant
master-identity guards and the published KB cells would each need a nonce
rule before the header could ship honestly. That is a design pass with its
own guards, not a header added to a commit about headers. The suite pins
the ABSENCE on `/`, on two variants' editorial, on `/_pm/chrome.css` and on
`/api/snapshot`, so a partial CSP cannot arrive by accident, and pins that
the blog's own CSP rides through the front's floor untouched.

**The bytes, measured and named — and the sentence the skeptic lens
reversed.** On the local plane, HTTP/1.1, `/vanilla/editorial/`'s header
block grew from 202 to 308 bytes: 106 bytes, the three `name: value\r\n`
lines, and the front's new test derives that figure from the module so the
prose cannot drift from the code that ships the bytes. On the deployed
plane the transport is HTTP/2 or HTTP/3, and there the honest statement is
a mechanism, not a measurement: HPACK's static table (RFC 7541 Appendix A,
61 entries, fetched) holds none of the three, so the first response on a
connection carries Huffman literals and every later one a single index byte
each; QPACK's (RFC 9204 Appendix A, fetched) already indexes
`x-content-type-options: nosniff` at 61 and `x-frame-options: deny` at 97 —
our `DENY` misses the value match by case and costs one literal value per
h3 connection. Those compressed figures are read off the tables, not
measured: the plane deploys on merge and the runner cannot see header
frames. The first draft of this paragraph then said the headers ride
"inside every byte cell", because Resource Timing's `transferSize` — the
runner's byte authority — is defined as body plus headers. The anti-rigging
lens fetched the spec and Chromium's source and found the spec replaces the
header component with a constant: `transferSize` is the encoded body size
plus 300 octets, "as that might expose the presence of certain cookies",
and Chromium implements it as `kHeaderSize = 300`. So the ruler cannot see
response headers at all — add or remove any number of them and no KB cell
moves — and the honest sentence is the opposite of the drafted one: the
floor is real on the wire and invisible to every published number. It is
still named, because a byte discipline that cannot account for 106 bytes
on every response is not complete, and because constancy still matters
for the timing cells: identical on every variant by construction, so it
cancels in every comparison. The chrome constant is a with-versus-without
delta measured on one plane and does not move. ADR-0001 addendum U says
all of this in the place a reader of the byte discipline will look, and
flags the pre-existing wording in addendum O that rests on the same
misreading.

**The roster the collector never checked.** `handleBeacon` validated the
five tags for presence and for the Analytics Engine's 96-byte limit, then
used `tags.variant` as the dataset's index — the sampling key. Any string
that fit became one. Published numbers were never at risk (they come from
committed lab bundles, never from RUM), so this was dashboard pollution, one
curl at a time, and it is the half of the beacon problem a rate limit cannot
address (rate limiting itself stays at `domain-cutover`, as recorded). The
roster existed — the front's prefix table, the switcher's surface registry —
but in two places the edge Worker could not import, and the repo's lesson
about hand-maintained lists is that they go stale against the registry
without any guard noticing. So the list moved to where both sides already
look: `@pm/measurement`, the beacon contract package, gains
`VARIANT_PREFIXES` and `SURFACE_NAMES`, and the two existing lists became
DERIVATIONS of it rather than copies. The front builds its prefix → binding
table from the prefix list (`vanilla` → `VANILLA`, `react-next` →
`REACT_NEXT`), so a variant it dispatches is a variant the collector keeps,
by construction; the switcher registry's object literal is held to the
surface list by `satisfies Record<SurfaceName, SurfaceControls>` — a key
added on either side without the other fails typecheck — and by a runtime
pin the test run can see. Two sentinels ride beside the lists: the home
surface's in-page HUD tags itself `singleton`/`home` (ADR-0007 §5), and the
suite's own beacon traffic — real, undeletable AE points on every
post-deploy smoke — carries the reserved `ci-smoke`, so a dashboard can
exclude it by name. The measurement client's `"unknown"` fallback is
deliberately not on the roster: a chrome that lost its data attributes is
exactly the point that must not become a sampling key. Read off the held
plane before the roster was written: every page a variant serves with a
chrome slot tags `variant` with its URL prefix and `surface` with its second
path segment, and every second segment is a registry key.

The roster tests in `@pm/measurement` and `@pm/edge` compare the roster to
itself, and a prefix dropped from the list moves both sides together — the
self-referential-oracle class unit 5 named. So the front Worker gains its
first test task (turbo 35 → 36, the bench-runner precedent): the dispatch
table against `wrangler.jsonc`'s `services` list, the one oracle that does
not move when the list does — every roster prefix has a binding named for
it, every binding that is not a variant is exactly `EDGE` or `BLOG`, every
service is `pm-<prefix>`. The same file holds the floor module's mechanics
(override, null body stays null, redirect keeps its location, the
`_headers` text is the same three lines) and the 106.

**The blog's upload, and the wall's two nits.** `POST /api/media` keyed the
stored extension and the R2 content-type off `file.type` — client-controlled
— and consulted the byte sniffer for width and height only, so a file the
sniffer could not read still uploaded, with null dimensions, silently
forfeiting the zero-CLS-by-construction rule the file's own header claims.
`dimensions.js` already distinguished all five formats to find their
dimensions; it now says which one it found — `sniffImage(bytes)` returns
`{ type, width, height }` or `null`, and `imageDimensions` is that without
the type. The upload path keys everything off the sniff and never off
`file.type`: unreadable bytes are a 400 `unreadable image`; PNG bytes
declared `image/jpeg` are stored as the PNG they are, served as PNG, with a
`.png` key. A mismatch is corrected rather than refused, on purpose — the
honest client that sends `application/octet-stream` keeps working, and XSS
stays dead either way (no SVG in the whitelist, `nosniff` on `/blog/media/*`).

The lockout increment was read-modify-write: `SELECT` the count, add one in
JavaScript, upsert it back. A parallel burst of wrong credentials read the
same count and wrote the same count plus one, so twenty attempts could land
as one and the documented five-per-ten-minutes lockout never fired under
exactly the load it exists for. Harmless against a 256-bit credential with
no username dimension, but not sabotage-proof by the repo's own standard.
It is one statement now — `INSERT … ON CONFLICT (bucket) DO UPDATE` — and
SQLite's upsert sees the existing row as `login_attempts.*`, so the window
test, the increment and the threshold are all `CASE`s against the row being
updated. D1 is SQLite, so the statement was proven on real SQLite before it
touched a plane: Node 24's `node:sqlite` runs the committed migration's DDL
in memory, and the unit test drives the exported `recordFailure` through a
twelve-line D1-shaped adapter — four failures do not lock, the fifth locks
for thirty minutes to the second, a failure inside the window keeps the
window's start, a failure past it restarts the count at one, twenty
increments count twenty, and the log of statements shows one `INSERT` and
no `SELECT`. The origin suite drives the same twenty requests in parallel against
the plane's D1 — every one refused, no cookie minted, the twenty-first meets
the 429 — and the sabotage table below says what that leg is and is not: the
lockout fires under a burst on the composed plane, but the leg does not
tell the two statement shapes apart on local D1; the unit test does. That
leg is local-only by design — on the deployed plane it would write production rows and lock a
real IP for half an hour, and the smoke never writes to production — and it
buckets by a TEST-NET-3 address carried in `cf-connecting-ip`, which local
dev passes through (probed: a spoofed bucket locked at the sixth attempt
while the `local` bucket stayed open) and which Cloudflare overwrites at the
edge.

The second nit is a line: `csrfOk` compared the token with `===` while the
credential went through `crypto.subtle.timingSafeEqual`. Both go through
the one helper now, renamed to say what it does. Its length check is
load-bearing, not tidiness: the runtime's compare throws on a length
mismatch, and a wrong-length token must be `false`, never a 500. Node's
`SubtleCrypto` has no `timingSafeEqual` (checked on 24.13), so the unit test
installs one with workerd's contract and RECORDS its calls — a test that
only checked the boolean would pass against `===` too, which is the defect.

**Verification.** In the order the standing rule names, on the working tree
above plus what the verification itself changed.

**`pnpm run check`:** 36 of 36 tasks green — run once after the lens findings were folded and the masters regenerated, and once more on the committed tree after this text landed — 36 tasks now, the front's first test task
among them.

**The origin suite, alone, both snapshots.** Fixture: 622 of 622 in 143 s
(23 files; 579 legs before this unit plus 43 new — the floor file's, the
data plane's three roster legs, the blog's four). Crate: 622 of 622 in
143 s. The front Worker's log across both runs carries eight
`chrome-slot-count` errors, every one a recorded 404 shape (Next's
`__next_error__` on a PDP or PLP junk path, qwik's root and its 404) —
none of them this unit's. Before the floor, `/vanilla/editorial/`'s header
block was 202 bytes on the wire; after, 308: the 106 the module spells.

**Read off the plane, outside the suite.** HEAD, an upstream 500, an htmx
partial, a remix3 frame, a brotli-compressed asset from the front's own
dist and one from a variant (encoding preserved), a 301 and a variant's 404
— every one carries the three headers. `/_headers` answers 404; a
`_headers` dropped into `dist/` is applied by local `wrangler dev` without a
restart, so the assets-first legs hold locally for the same reason they
hold deployed, not by luck of a restart.

**The sabotage table: 23 rows, one deliberate defect each; the owning guard
must fail.** 29 guard checks, 29 caught but three; two controls passed as
designed. The three misses are one row, three runs: the origin suite's
twenty-parallel lockout burst does NOT distinguish the atomic increment
from the read-modify-write it replaced — on local D1 the twenty requests
were serialised enough that the racy code reached the threshold too, every
time. The leg is kept for what it does prove (the lockout fires under a
burst on the composed plane; no cookie is minted; the twenty-first attempt
meets the 429) and the record does not claim more. The guard that bites is
the unit test on real SQLite: under read-modify-write its one-statement leg
fails (a `SELECT` appears) and its twenty microtask-interleaved increments
count ONE instead of twenty — which is also the shape the race takes on the
deployed D1, where every statement is a network round-trip and the window
between read and write is real. Two controls: an upstream that sends
`x-frame-options: SAMEORIGIN` alone passes the floor suite (the override
works), and the roster-versus-itself tests in `@pm/edge` pass with a prefix
dropped from the list — which is why the front's wrangler.jsonc guard
exists, and it caught the same drop.

| row | defect | result | guard that failed |
|---|---|---|---|
| F1 | front: fetch no longer wraps route() in the floor (PLANE) | CAUGHT | `security-floor.test.ts` |
| F2 | floor set-if-absent + placeholder-ssr sends x-frame-options SAMEORIGIN upstream (PLANE) | CAUGHT | `security-floor.test.ts` |
| F2c | CONTROL: upstream SAMEORIGIN alone — the floor must override (PLANE) | control — PASSED as designed | — |
| F3 | build no longer writes dist/_headers (PLANE, rebuilt) | CAUGHT | `security-floor.test.ts` |
| F4 | module value changed (DENY→SAMEORIGIN): both paths move together (PLANE, rebuilt) | CAUGHT | `security-floor.test.ts` |
| F5 | referrer-policy dropped from the module (PLANE; script path) | CAUGHT | `security-floor.test.ts` |
| F6 | referrer-policy dropped — the front unit test (names + 106 B) | CAUGHT | `front/test` |
| B1 | edge: variant roster check disabled | CAUGHT | `edge/test/beacon.test.js` |
| B1s | same, seen by the suite (PLANE) | CAUGHT | `data-plane.test.ts` |
| B2 | edge: surface roster check disabled | CAUGHT | `edge/test/beacon.test.js` |
| B2s | same, seen by the suite (PLANE) | CAUGHT | `data-plane.test.ts` |
| B3 | roster drops ci-smoke from variants | CAUGHT | `measurement/test` |
| B3e | same, edge | CAUGHT | `edge/test/beacon.test.js` |
| B3s | same, suite accept leg (PLANE) | CAUGHT | `data-plane.test.ts` |
| B4 | roster drops singleton (home HUD) from variants | CAUGHT | `measurement/test` |
| B4e | same, edge | CAUGHT | `edge/test/beacon.test.js` |
| B5 | qwik dropped from VARIANT_PREFIXES — wrangler.jsonc still binds QWIK | CAUGHT | `front/test` |
| B5e | CONTROL: roster-vs-itself tests cannot see a dropped prefix | control — PASSED as designed | — |
| B5s | same, suite: /qwik/editorial/ no longer dispatched (PLANE) | CAUGHT | `security-floor.test.ts` |
| B6 | registry gains a key the roster lacks (satisfies pin) | CAUGHT | `switcher/typecheck` |
| B6t | same, runtime pin | CAUGHT | `switcher/test` |
| B7 | registry key renamed away from the roster (satisfies pin) | CAUGHT | `switcher/typecheck` |
| M1 | upload: unreadable bytes fall back to client file.type with null dims (PLANE) | CAUGHT | `blog.test.ts` |
| M2 | upload: extension + R2 content-type from client file.type again (PLANE) | CAUGHT | `blog.test.ts` |
| M3 | sniffer names VP8 WebP as image/png | CAUGHT | `blog/test/units.test.js` |
| A1 | lockout increment back to read-modify-write | CAUGHT | `blog/test/auth.test.js` |
| A1s1 | same, suite 20-parallel burst run 1 (PLANE) | MISSED | `blog.test.ts` |
| A1s2 | same, suite 20-parallel burst run 2 (PLANE) | MISSED | `blog.test.ts` |
| A1s3 | same, suite 20-parallel burst run 3 (PLANE) | MISSED | `blog.test.ts` |
| A2 | window reset removed: count never restarts | CAUGHT | `blog/test/auth.test.js` |
| A3 | threshold off by one (> instead of >=) | CAUGHT | `blog/test/auth.test.js` |
| A4 | CSRF compare back to === | CAUGHT | `blog/test/auth.test.js` |
| A5 | length guard removed before timingSafeEqual | CAUGHT | `blog/test/auth.test.js` |
| R1 | new suite file's tray request loses its nonce and cold | CAUGHT | `repo-checks/warm-tier` |

**verify-slice.** Four lenses, sequential; 8 raw findings, 6 distinct, none
refuted; every one folded, and every code fix given a fixture a second
sabotage round proves bites. Three lenses converged independently on the
same record defect — the signal worth having — and the fourth found the one
that mattered most.

- **The record claimed a proof the sabotage table had already shown was not
  one** (correctness, conformance and skeptic lenses, independently). Five
  sentences — a code comment in `auth.js`, the unit test's header, the suite
  leg's comment, the decision-map bullet, this entry's first draft — called
  the origin suite's twenty-parallel burst "the parallel proof" of the
  atomic increment, and one of them said the racy code "was a 403" there.
  Rows A1s1–3 say otherwise: with read-modify-write restored, the burst leg
  passed three times of three on local D1. All five now say what the leg
  proves (the lockout fires under a burst; no cookie; the twenty-first meets
  the 429) and what it does not, and name the unit test's one-statement and
  twenty-interleaved-increments legs as the discriminating proof. Wording
  only; no code moved.
- **"Both pinned by the suite" was half true** (conformance lens). Of the two
  facts from Cloudflare's `_headers` page, only "never served" has a suite
  leg; "applies to asset responses only" is unobservable while the script's
  wrapper is in place and is shown by sabotage row F1 instead. The
  decision-map bullet and this entry say so.
- **The ruler cannot see the headers, and the record said the opposite**
  (skeptic lens; the finding of the pass). The first draft of ADR-0001
  addendum U, the decision-map bullet, two paragraphs above and the module's
  own header all said the floor rides "inside every published byte cell"
  because Resource Timing's `transferSize` includes response headers. The
  lens fetched the spec and Chromium's source: the spec replaces the header
  component with a constant 300 octets "as that might expose the presence
  of certain cookies", and Chromium implements `kHeaderSize = 300`. Verified
  again by this session from the same two pages before a word was changed.
  Add or remove any header and no KB cell moves; the floor is real on the
  wire and invisible to every published number — the honest sentence, now
  in all five places, and the reverse of the drafted one. The same lens
  found addendum O's "headers-included `transferSize`" wording resting on
  the same misreading; pre-existing, flagged for the measurement pass, not
  rewritten here.
- **The sniffer named a type after three bytes** (skeptic lens). `"GIF"` was
  the whole GIF test, so a text file beginning "GIF…" uploaded as
  `image/gif` with a 21057 × 8260 box — the zero-CLS rule forfeited in the
  other direction — and a 0 × 0 IHDR passed as an image. The sniff now reads
  the full six-byte GIF and eight-byte PNG signatures, requires IHDR at
  offset 12, and refuses a zero dimension in every format through one
  `sized()` helper.
- **A legal JPEG became a 400** (skeptic lens). ITU T.81 B.1.1.2 allows any
  number of `0xFF` fill bytes before a marker; the marker walk read the byte
  after the first `0xFF` as the marker, so a padded file an encoder had
  emitted — which uploaded with null dimensions before this unit — was
  refused as unreadable. The walk skips fill bytes; a padded fixture pins it.
- **The burst leg's "fresh bucket per run" was a 1-in-126 dice roll**
  (skeptic lens) — `Date.now() % 126` against a thirty-minute lock. The
  bucket is the header's verbatim value, so two random hosts in the IPv6
  documentation prefix make a collision negligible.

The seams lens found no defect and confirmed the two pending gates the
context named: the how-it-was-built master needed regenerating after the
ADR addenda (it was, +2 lines, the two new index entries; every other
master byte-stable), and the final suite runs must follow the last docs
edit. It also checked that the burst and upload legs run in CI's origin job
(fresh D1 per run) and skip on the deployed smoke, that the roster leg
posts only off-roster events to the deployed collector (all refused before
`writeDataPoint`, zero AE rows), and that a turbo cache replay of the front
build carries `_headers`.

Round 2 — one row per code fix landed from the lenses:

| row | defect | result | guard that failed |
|---|---|---|---|
| S1 | GIF signature back to the three-byte prefix | CAUGHT | `workers/blog/test/units.test.js` |
| S2 | zero-dimension guard removed from sized() | CAUGHT | `workers/blog/test/units.test.js` |
| S3 | JPEG 0xFF fill-byte skip removed | CAUGHT | `workers/blog/test/units.test.js` |
| S4 | PNG IHDR-at-12 check removed | CAUGHT | `workers/blog/test/units.test.js` |
| S5 | PNG signature back to four bytes | MISSED — no fixture read bytes 4–7; one added (S5b) | — |
| S5b | PNG signature back to four bytes — after the bytes-4-7 fixture | CAUGHT | `workers/blog/test/units.test.js` |

**The suite once more, on the final tree.** Fixture 622 of 622 in 143 s; crate 622 of 622 in 143 s — after the lens fixes, the record rewrites and the master regeneration; no leftover process after either teardown; the front log again carries exactly the eight recorded 404-shape `chrome-slot-count` errors and nothing of this unit's.

**What this leaves.** The CSP, as a decision with a revisit trigger.
Beacon rate limiting and Cloudflare Access on `/blog/admin/*`, at
`domain-cutover` as recorded. The beacon's other three tags — `cacheState`,
`environment`, `location` — are still bounded by bytes only; the shape of
the first two is a closed set the same roster could hold, not this unit's
ask. The deployed plane's compressed header bytes, stated from the RFC
tables until a deploy exists to measure them against. For Rob, carried
forward unchanged from unit 5: whether `pm-warm` is on the Free plan; the
PDP `not-found.tsx` and `lib/plp-error.tsx` docblocks; the bench runner's
uncapped CDP `send()`; the two post-deploy smokes that failed on one qwik
stepper assertion.

### The form that could not place an order, and the summary that moved the form (2026-09-24)

The 2026-08-29 audit put this seventh and gave it a hard ordering: before
any checkout batch is minted. Not because the page was broken — it served,
its guards bit, its two served falsehoods had been fixed — but because the
instrument could not see it. The cart suite parameterises over the
EDITORIAL surface (`cart.browser.test.ts:100`), the PDP's controls have their
own browser leg, and checkout had neither; the drift gate compared no served
checkout page to its master; the bench registry held five ids, none of them
checkout's. The checkout-vanilla node had recorded all of it as owed, plus a
phone-profile layout shift its own comment contradicted, a JS-off "Place
order" that ended on a zero-length 405, three byte-identical cart trios with
nothing holding them identical, a near-verbatim copy of the PDP guard, and an
OWED registry entry waiting for a rule. Six tasks. Two of them changed what
the unit thought it knew before the verification pass, and the pass changed
two more. The decisions are ADR-0008 addendum D, ADR-0001 addendum V and
ADR-0004's forwarder addendum; this is the account.

**Read off a held plane before a line was written.** `POST /vanilla/checkout/`
with the body a JS-off browser sends: 405, zero body bytes, the security
floor present. `/vanilla/checkout/placed/`: 404. The empty order summary:
234 px on both profiles, a 12 rem content-box floor with 90 px of blank
below the total. A three-item cart on the phone profile grew it to 259 px
and moved the form's top from 708.6 to 733.8 px — layout-shift **0.0214**;
six items, 165 px. On the desktop only the summary's own total row moved:
0.0011. The first probe read 0 for all of it, because it read the
observer's list before the observer had delivered; two animation frames and
`takeRecords()` later it read what the geometry said, and that lesson is in
the suite leg. At 320 px nothing overflowed (`scrollWidth` 320).

**The leg — JS on, JS off, and the gate.** `checkout.browser.test.ts` drives
every LIVE checkout variant (the registry, `["vanilla"]` today) in Chromium
at the composed origin, every in-page wait on a DOM state the enhancement
produces — the formatted value, the focused summary, the announcement, the
line count — never a timer (the htmx settle-race lesson). The cart contract
on this surface, priced by the reference's OWN `formatPrice` imported by
file URL and moved by the price the served LABEL states; the controls (real
keystrokes format the card; an invalid submit renders ten resolving links
and MOVES FOCUS in a real focus model; fix-and-resubmit announces without
leaving the page; the chrome survives under a 4× CPU throttle); the geometry
(below); and the JS-off path (native validation holds an empty submit —
counted as zero POSTs, not read off a URL — and a filled form's native POST
lands on the placed page through the 303 and re-GETs on reload).
`checkout.test.ts` is the HTTP half; `drift.browser.test.ts` gains the
served form page and the placed page against their masters by normalized
DOM and pixels under all three profiles — the first drift-gate leg the
served checkout has had; `security-floor.test.ts` gains the placed page and
the 303 as a new response class; `bench-checkout.browser.test.ts` drives
the three ids through `measureVisit` and pins each one's FIRST input.
Forty-seven legs, 622 → 669 (11 · 13 · 11 · +2 · +10), counted from
single-file runs because vitest's non-TTY reporter writes no per-file line
for a passing file.

**The ids, the fetch the first draft denied, and the gate the lens found.**
`grep -c "checkout-" collect.ts` was 0; it is 3, with the definitions ADR-0001
addendum V records. Two things were measured before the comments were
written and one was found after. Playwright's `fill` (CDP `insertText`)
registers no event-timing interaction — ten fills, 0 entries with an
`interactionId`. **Both submit ids fetch**: the bench leg's first draft
asserted zero bytes and the plane recorded 1,512 — `PMWarnGlyph.U26A0.woff2`,
1,212 bytes of font for the ⚠ every field error and the summary title draw,
fetched on the first error render; 1,512 is body plus Resource Timing's
300-octet header constant (addendum U), identical bytes from every
variant's own tokens tree, glyph mass not paradigm difference. And the
correctness lens read the ruler: the pinned `web-vitals` observes `event`
entries at its default 40 ms `durationThreshold` plus the `first-input`
entry, always, so on a fast paradigm INP IS the visit's first input. The
first draft of `checkout-type-card` clicked the field before typing and its
cell was that click (24 ms, no handler); it focuses programmatically now and
the first input is the `keydown` (8 ms), pinned by a leg that drives the
entry under a `first-input` observer. `checkout-fix-and-submit` was
redesigned the same way — a programmatic invalid submit so the one real
click would be the successful one — and rejected within the hour: **CLS
0.099**, the summary's render being a shift no input precedes (the fills'
clean-ups are excluded by their own trusted `change` events, per the Layout
Instability spec's list; the skeptic lens corrected the first attribution).
It keeps two real clicks and says what that means under the gate. The fit
template publishes ONE interaction per surface (addendum T), so the
measurement pass picks the id — `checkout-submit-invalid`, the §7 contract
interaction, is the recommendation — and its declaration follows: constant
for a submit id, none for the keystrokes. Six samples after the redesign,
one run each and not published: INP 16 / 48 / 40 ms on the desktop profile,
8 / 64 / 48 on the phone (type-card / submit-invalid / fix-and-submit), CLS 0
in all six.

**The geometry: a floor became a cell** (ADR-0008 addendum D). The region is
a three-row grid whose middle track is FIXED at three lines, DERIVED in the
sheet — `calc(3 * var(--cart-thumb) + 2 * var(--space-stack-sm))`, 9.25 rem
at a 16 px root; the first draft wrote the literal and called it derived,
and the conformance lens said so — with the empty copy and the list sharing
that cell by `grid-area`, the served list `:empty` and hidden, and the
total's price slot reserving `10ch` because a widening right-aligned span
moves its own start edge and the metric counts it (sabotage row G3 proves
the leg sees exactly that). After: layout-shift 0 on both profiles with one,
three and six items. The cost, so it is a decision: the empty state is 25 px
taller everywhere, and the desktop summary shows three lines before
scrolling where it showed five and a half. The measured page is the empty
cart and never shifted, so no published number moved.

**Where the JS-off order lands, and the routing rule that rewrote it**
(addendum D; ADR-0004's forwarder addendum). A 303 to `checkout/placed/`, a
second committed master of the surface, `noindex`, no form, stating what the
request carried: only the shipping radios have a `name`, so the body is
`shipping=…` and the Worker never reads it. The first draft matched `POST
/vanilla/checkout/`; its pre-merge pin passed and the plane kept answering
405, because a static-assets Worker answers a path that has an asset behind
it before the script runs — Cloudflare's routing page, fetched, says so for
"the incoming request" and nothing about methods; the seams lens then read
the router and asset workers Cloudflare ships inside miniflare and found the
asset check path-only and ahead of the GET/HEAD check, which this session
re-read in the bundle. So the form posts to a RELATIVE `place-order/`, a
path with nothing in dist behind it, the one request that reaches the
script; every page GET stays assets-first. Rejected: `run_worker_first` on
the page path (a script invocation on every GET of the measured page),
`_redirects` (method-blind), a 200 on the POST URL (re-posts on refresh).
The deployed plane's answer is the smoke's `checkout.test.ts` legs to give.

**The trio, held identical, and one guard where there were two.**
`cart-trio-identical.test.ts` extracts `read`/`count`/`renderCount` — and,
after the skeptic lens, the `const KEY` each closes over — from every vanilla
script that carries them (four; a11y.js is the badge-only fourth), files
against each other and never against the contract module. `codeOnly` moved
to `test/lib`, shared on purpose: a lexer with one right answer is not an
oracle. `pdp-controls-wired.test.ts` runs ONE block over a `{ surface,
masters, enhancements, minControls }` table for the PDP and the checkout,
and holds the placed master to "renders no control" as a checked claim. One
limit found by sabotage and pre-existing: its state leg is string inclusion
and cannot tell a read of `aria-pressed` from a write; the behaviour half is
the browser leg. `.pm-checkout__form { min-inline-size: 0 }` retires the
last OWED entry — a rule that acts in the phone layout's bare `1fr` track
(Grid §6.6, fetched twice by two lenses) and is a no-op in the desktop
`minmax(0, …)` track, with no observable effect at any viewport from 320 px
up today; the sheet says all of that. The registry is empty and kept.

**Verification.** In the standing order, on the final tree.

**`pnpm run check`:** 36 of 36 — the same 36; the new test files join
existing tasks, and `@pm/bench-runner#test` is uncached now.

**The origin suite, alone, and what "alone" was worth today.** The machine
carried Spotlight indexing, a VM and another session's `wrangler dev`
throughout, load average 8–17. The pre-verify-slice tree ran green twice —
fixture **666/666** in 144 s on the second attempt, crate **666/666** in
144.6 s on the fifth — and the runs that failed are recorded as they
happened (`docs/prototypes/checkout-measure-prep/suite-runs-2026-09-24.md`):
wrangler 4.110's front dev server died with its internal error twice, a
pre-flight met a socket still closing, a stall hit the ten-minute cap, and
one 665/666 lost the pre-existing bench leg's INP beacon to load, the flake
class issue #16 carries. The skeptic lens then refused those runs as
verification of the reviewed tree, correctly: every file the pass changed
was newer than both. The run that stands is the last one below.

**The sabotage tables** (`docs/prototypes/checkout-measure-prep/sabotage-2026-09-24.md`,
every row and verdict). Round 1: 39 rows — 36 caught, 2 controls passed as
designed, 1 missed. Round 2, over the verify-slice fixes: 8 rows — 6
caught, 1 control, 1 missed. Round 3, over the skeptic's key leg: 1 caught,
1 control. Both misses were the rows' fault and each was re-run in a form
that caught (W2 half-replaced an attribute the guard's `includes` still
found; S2 put `display: none` before the block's own `display: flex`). And
the runner failed twice, both times exposed only by a CONTROL row: its
first pass reported every row CAUGHT with exit 126 — the login shell had
handed `node` to a version-manager shim and nothing had run — and its
backups were kept from the first run that touched a file, so round 2's
restores rewound three files to their round-1 state and the control broke
on a "fixed" tree. A table that reads "caught" on a guard that never ran is
the vacuous pass in its purest form; the sabotage file records both.

**verify-slice.** Four lenses, sequential, launched after round 1 so no lens
read a sabotaged file; the first two lenses' fixes were folded while the
last two read, and both said so in their headers and re-read every citation
at write time. 22 raw findings, 20 distinct, 13 refuted by the lenses
themselves, none refuted here, every one folded, every code fix given a
round-2 or round-3 row. In order of weight:

- The ruler's 40 ms gate, and two ids measuring the wrong interaction
  (correctness) — the type-card redesign above; the recovery's programmatic
  priming built, measured at CLS 0.099, and rejected.
- The record told the measurement pass to declare `interactionFetch` for all
  three ids; the fit template is per surface with one id (conformance) —
  rewritten everywhere to "the pass picks one; its declaration follows".
- The green runs predated the fixes (skeptic) — the final pair below.
- The trio guard skipped the one free variable, `KEY` (skeptic) — a copy
  writing `pm:cart:v2` would have merged green; compared now (row K1).
- Five places cited Cloudflare's routing page for a claim about POST that
  the page does not make (correctness) — narrowed to what it says; the
  seams lens supplied the platform's own source.
- ADR-0004 still said "one-line forwarder" (conformance) — its addendum.
- "Derived, not chosen" was a literal (conformance) — the `calc` above; the
  six-item leg reads the track off the computed grid (row S1).
- The form rule's docblock named the wrong Grid track (correctness and
  conformance, both fetching §6.6) — corrected, rule unchanged.
- The six-item leg read "before" after `load` with the fetch unheld;
  `boundingBox()` equality had no null guard; the JS-off negative trusted a
  URL after a timer (correctness, conformance) — held, guarded (row S2b),
  counted.
- `@pm/bench-runner#test` was turbo-cached while its new test reads two
  other workspaces by path (seams) — `cache: false`.
- ADR-0001 addendum V promised a byte guard the smoke skips (skeptic) — "on
  the local plane only", and the deployed transfer stated as unmeasured.
- The shipped probe drove the rejected design and six quoted samples had no
  reproducing step (skeptic) — three explicit modes, a reproducer beside
  it, the bench leg printing its desktop samples.
- Four comments the slice made false, a drifted line reference, and two
  wording over-claims ("10ch covers every total"; "three 44 px lines")
  (correctness, conformance) — fixed; the sheet now states its bounds.
- The tree in motion (seams) — for eleven minutes code, record and guard
  disagreed about `checkout-type-card`, because the runner's stale backup
  had rewound the code; fixed at the runner and in the tree.

**The suite once more, on the final tree — the run that stands.** Fixture
**669 of 669** in 144.0 s; crate **669 of 669** in 144.2 s — after the lens
fixes, the record rewrites and the master regeneration, with `pnpm run
check` 36 of 36 immediately before them and nothing edited between. One
edit followed them, and it is a comment: `bench-checkout.browser.test.ts`
had said the suite log carries the bench samples it prints, and the final
log showed vitest's non-TTY reporter carries no console output at all — the
reproducer script beside the record is the reproducing step, and the
comment says so now. No leftover process after either teardown; the front
log carries the recorded eight `chrome-slot-count` 404 shapes and nothing of
this unit's.

**What this leaves.** The checkout fit template and `labBundle` — the
measurement pass's, with the recommendation and the two declarations
written down for it. The scrollable line list carries no `tabindex` (Chrome
makes a child-less scroller keyboard-focusable by default — announced for
130, shipped in 132 per the Chrome blog post fetched that day; Safari does
not); a markup-contract change, not this unit's. The placed page's beacon
residual, named in the node. wrangler 4.110 dying under load; environment,
recorded. For Rob, carried forward unchanged: whether `pm-warm` is on the
Free plan; the PDP `not-found.tsx` and `lib/plp-error.tsx` docblocks; the
bench runner's uncapped CDP `send()`; the two post-deploy smokes that failed
on one qwik stepper assertion; the deployed plane's compressed header bytes;
addendum O's `transferSize` wording; unit 10's Rob-gated items.

### The gate that nothing re-proved, and the plane no one had typed (2026-09-25)

The 2026-08-29 audit put this fifth and gave it no ordering: two structural
gaps in the part of the repo a sceptical reviewer reads first when the claim
is "staff-level". Every package is strict TypeScript, and the entire workers
plane — 4,224 lines of `src/**/*.js` across three deployed Workers (`wc -l`
at c7ed377; the audit's 3,879 was the same set on 2026-08-29), the blog's
auth, session, CSRF and SQL code among them — was plain JS with no
`@ts-check`, no JSDoc types, no typecheck task, and no record of why the
boundary sat there, while `packages/reference/render/lib.mjs` documents its
own `.mjs` choice in its header. And the anti-rigging publication gate in
`workers/front/build.mjs` — 55 throw sites by `grep -c 'throw new Error'`
(the audit counted 54; the tree grew one) — was enforced only by the
one-time sabotage proofs the decision map records. Nothing re-proved a
single refusal fired, and the file's own history holds the failure class:
a guard was REMOVED once because "an unfireable guard advertises coverage
it lacks". A refactor that inverted one condition shipped silently. Three
lines came along: the beacon collector's missing-value coercion to 0, the
blog escaper's skipped single quote, and the cold PDP read that parses the
whole details tray per request. The decision is ADR-0004's addendum of this
date; this is the account.

**The gate first, because its refactor is the one that can lie.** The
refusal set moved verbatim into `workers/front/lab/publish.mjs` — pure, no
filesystem, no `node:` import; the renderer and the hash arrive as
dependencies — leaving `build.mjs` a 603-line composer that reads files,
hands them to the gate and writes what it admits (1,310 lines before). 47
throws moved; the 8 that are about the HOME PAGE's composition (a malformed
manifest field, the default profile's cells, a `%%` marker left in a
template) stayed; 47 + 8 = 55. What says the refactor changed nothing is a
diff, not a reading: the front dist built on the clean tree was copied
aside before a line moved, and the dist built after is BYTE-IDENTICAL to
it across its twenty files (`diff -r`, with `build.json` and the
how-it-was-built page excluded because the working tree's dirty flag is
the only thing that differs in them), and so is the generated
`lab-bundles.js` the Worker imports.

**Then the fixtures, one per refusal class, and the three ways the suite
cannot pass over nothing.** Thirty hand-written malformed receipts would
drift from each other and from the runner's shape, so there is one VALID
receipt — the PDP surface, four registered variants, three runs per column,
every field a real receipt carries — and a table of 60 rows
(`CASES.length`; 52 when #48 merged, eight more from the pass below), each
the mutation of one field AND the regex the refusal
must throw, on one line, beside its throw site's name. Three runs, not one,
so a median can honestly hide a stray run (a run that captured nothing
behind a median that agrees is the mechanism two classes are about) while
the fixture stays the true median of its own runs. The generator writes 52
files (40 receipts, 12 chrome constants; 1.5 MB on disk, 70 KB gzipped,
`linguist-generated` so GitHub folds them in review) and a leg holds the
committed files byte-identical to what it produces — a fixture edited by
hand into something the table does not describe is a red test. The suite
drives every row through the REAL registry, the real `FIT` and the real
`fencedPathOf`: template refusals mutate `FIT.pdp` inline (a template is
code); batch refusals pair a mutated second profile with the valid one; the
chrome-constant rows run against a stand-in renderer whose fragment the
valid constant's sha256 was minted from, so the identity gate is proven
against a known fragment; the band rule is asserted as the outcome it is
(`bandsOverlap: true`, no sentence, the interaction figure still on the
bundle — addendum R's category fix). Non-vacuity: the table is not empty
and the on-disk set equals it in both directions; every throw in the
module carries a `// refusal: <site>` marker and the marker set equals the
rows' site set in BOTH directions, read from the source — a map, since the
first commit's COUNT of labels let 19 of 29 condition-level mutants through
(the pass below); and the CONTROL rows that must pass: the valid fixtures
admit and publish a sentence with bands, the three receipts the plane
actually publishes admit through the very call `build.mjs` makes, a chrome
constant minted from the real renderer over their bundles admits and is
refused for a fragment the build does not ship, and an upper-case `ZSTD`
token admits. The first run of
the suite caught its own table: a batch-shape row whose mutation had become
a no-op when the base moved from two runs to three passed instead of
throwing, which is exactly the check a row exists to make. The runner's own
Zod schema holds the fixtures to the receipt contract in
`tools/bench-runner` (37 legs); three rows are flagged as deliberate schema
refusals and asserted to fail it. Stated limit: Zod strips unknown keys, so
an INVENTED field is not caught there — the real-receipt control and the
gate's own typedef are what hold field names.

**The typecheck, and what it cost to turn on.** Before a line was annotated:
99 errors on edge, 56 of them inside `packages/reference/render/plp-query.mjs`
— the spec's own query module the edge Worker serves, pulled into the
program by its import; 20 on front; 427 on blog, 132 of them in the
CodeMirror editor bundle. `checkJs` sits in each Worker's `tsconfig.json`
rather than as a per-file pragma, deliberately: a declaration that can be
omitted is an opt-out, and a new file must not be able to skip the check by
forgetting a line — a sabotage row proves a pragma-less new file with an
implicit-any parameter fails. Runtime and binding types are wrangler's own,
generated by each `typecheck` script (`wrangler types cloudflare-env.d.ts
&& tsc --noEmit`) and gitignored; the react-next precedent commits its
generated file, 13,000 lines of it, and was not followed. The blog's
browser code is a second target under the DOM lib. The types are JSDoc at
the seams: D1 rows cast to the row their SQL selects, the committed
migrations column for column; every request body read as `Record<string,
unknown>` and checked field by field; result unions where the routes used
to check `.ok` by convention. `plp-query.mjs` gained typedefs for the tray
and the query, so the Worker's calls are checked against the spec's own
signatures. `pnpm run check` grows 36 → 40, derived: the three typechecks
plus `@pm/front#build`, which the front's typecheck depends on because it
imports the generated `lab-bundles.js` (the astro precedent, the same
ts(2307) on a fresh checkout; verified by deleting the directory, both with
and without the dependency).

**Three findings the check made, priced against the rule.** The fit
declaration `workers/front/lab/fit.d.mts` — the file a TypeScript consumer
reads the templates through, whose own header names the "second copy of
the shape" hazard — lacked `interactionId`, a field the template set and
the build read since 2026-08-28; `fit.mjs` is held to its declaration with
`@type` now, and a sabotage row removes the field again. The edge Worker's
PLP handler returned `serveData`'s `Response | null` straight through where
the route promised a `Response`; the null branch cannot happen today
(`applyPlpQuery` always returns a page) and is a throw now rather than a
cast, so a future compute that can return null meets a 500 instead of a
null response. The blog's `savePost` accepted a number into a TEXT column
through a hand-made PUT — the editor never sends one — and drops it now with
the file's own warning shape, the model its comment already states. None
moved a served byte.

**The three lines.** The collector answers 400 `value must be a finite
number` for an absent, null, string or infinite value and writes nothing;
before, `doubles: [finite ? value : 0]` recorded a fabricated 0 — a
dashboard row that never happened, and a p75 over a row of zeros is a lie
that looks like a finding. The unit legs assert the DATASET through a
recording stub, with a CONTROL that a measured 0 still writes as 0 (CLS on
a still page is a real zero), and a suite leg is the HTTP half. Infinite
is proven with a RAW `1e999`, which `JSON.parse` reads as Infinity: JSON
has no NaN or Infinity literal and `JSON.stringify` writes both as `null`,
so the first commit's legs by those names had sent null and proven the
`typeof` half twice; NaN cannot arrive over JSON and is asserted to be the
body-is-not-JSON 400 (the pass below). The prompt's
cite drifted: `grep -n 'Number('` finds only the PDP id parse; the coercion
was the ternary. The escaper handles its fifth character (`'` → `&#39;`) as
the repo's six others do — the seven are `grep -rlE "function esc|const
esc ="` over `packages variants workers` with the three extensions, and
`grep -l '&#39;'` over them read 6 before, 7 after; every call site was in
a double-quoted attribute or text (`grep -rnE "='[^']*\$\{"` over
`workers/blog/src`: no template — the one hit is `html.js`'s own comment
quoting the pattern), so this is defence in
depth, not a fix for an exposure, and the record says so. The cold PDP read
is RECORDED, not indexed, and the comment in `handlePdp` says which and why:
an index written at seed time (`snapshot/details/{id}.json`) is one small R2
read per cold request, but every plane has to be re-seeded before the Worker
can read it, the deployed bucket's re-seed is a credentialed manual step
(workers/README.md), and until it ran every cold PDP read would answer 404.
The parse is bounded — one R2 read plus one JSON parse per `?cache=cold` or
per first request under a `?run=` nonce — and off the published path: the
warm column never reaches R2, and the PDP's request-time variants fetch
their tray server-side without forwarding the knob (`measurement-pass`), so
no published PDP cell is priced by it. Its cost is measured below rather
than estimated.

**Verification.** In the standing order, on the tree as it stood before
the verify-slice pass; the final pair is below.

**`pnpm run check`:** 40 of 40, derived — 36 on main, plus the three
Worker typechecks and `@pm/front#build`, which the front's typecheck now
depends on.

**The origin suite, alone.** The machine carried load 3–5 and nothing of
this session's. Fixture-1 ran 669 of 670: the one failure was the bench
leg's INP beacon arriving null on a `body-click` run, the pre-existing
flake class issue #16 carries and unit 7 met on its crate-3, in a file this
unit does not touch; no crash marker, no refused connection. Re-run before
belief: fixture-2 **670 of 670** in 143.8 s, then crate-1 **670 of 670** in
143.8 s, zero refused connections, the front log carrying the recorded
eight `chrome-slot-count` 404 shapes and nothing else, no leftover process
after either teardown (`docs/prototypes/workers-hardening/suite-runs-2026-09-25.md`).
The one new leg is the beacon value's HTTP half (669 → 670).

**The sabotage table** (`docs/prototypes/workers-hardening/sabotage-2026-09-25.md`,
every row with its exit code). Round 1, before verify-slice: 27 rows —
22 caught, 5 controls passed as designed, 0 missed. The rows that carry the
unit's claims: the prompt's "Done means" typo — `updated_at` renamed to
`updatedAt` in `savePost`'s return — fails the blog typecheck; an inverted or
removed refusal in each gate function fails its own fixture (the dirty-tree
check inverted, the cross-tree check removed, the constant-spread
comparison flipped, the batch-SHA check removed, the chrome-constant
identity gate inverted, the unattested-origin refusal removed); a new
refusal with no row fails the throw-site count; a fixture deleted, a
fixture hand-edited and a row deleted each fail the set-equality legs; a
row's mutation made a no-op fails its own expectation; the composer
skipping `assertBatchIntegrity` fails the calls leg; a binding-name typo
(`env.WARN`) fails the edge typecheck; `generated/` deleted fails `tsc` run
bare with ts(2307) and passes through turbo because the build runs first;
the fit-declaration drift re-created fails the front typecheck, as does a
field the declaration lacks; a pragma-less new edge file with an
implicit-any parameter fails; the beacon coercion restored fails the
dataset legs; the escaper's quote dropped fails the unit leg; a
schema-required field removed fails the runner's schema leg. One row did
not run: the invented-field case (expected MISSED, because Zod strips
unknown keys) tripped on its own edit anchor, and runs in round 2 with its
expected verdict written first.

**The cold read, measured rather than estimated.** On a held crate plane
the edge Worker answered `?cache=cold` for one release in a median 4.7–4.9
ms and a KV hit in 1.0–1.1 ms (ten of each, two runs), so the whole-tray
read and parse — 967,527 bytes to serve 1,570 — costs about 3.6–3.8 ms per
cold request on this machine; through the front the delta is the same
(5.9 against 2.3). The deployed plane's R2 read has network in it that the
local emulation does not, which the indexed alternative would pay too; the
parse is the part an index would remove, and it is under four
milliseconds on a request no published cell prices. Recorded in the
handler and here; not indexed, for the reasons above. The collector on the
same plane: 400 naming `value` for an absent, null or string value; 204
for `0` and for `1234.5`.

**verify-slice.** Four lenses, sequential, launched after round 1 so no
lens read a sabotaged file; 64 minutes, 225 tool uses. 13 raw findings, 11
distinct (three lenses converged on the typed numbers), 1 refuted here
(the conformance lens read PENDING markers mid-pass that the commit had
already replaced — true when read, gone before it shipped), every other
one folded, each with a round-2 row. In order of weight:

- The throw-site count leg counted LABELS, not coverage (skeptic): 19 of
  29 condition-level mutants passed all 63 legs, among them a chrome
  constant from a DIRTY origin, a tolerance of `Infinity` that turns the
  constancy check off, an ABSENT `interactionSettled` admitted, a fifth
  variant admitted by a subset comparison, the cutoff day and touching
  bands slipping past two `>=`s. Every `throw` now carries a `// refusal:
  <site>` marker and the leg holds marker set and row set equal in both
  directions — a map — with eight new rows for the branches named (60
  rows now) and a CONTROL that an upper-case `ZSTD` token admits (rows
  R2, R3, R6–R14).
- The beacon's "NaN" and "Infinity" legs sent `null` on the wire
  (correctness): JSON has no such literals and `JSON.stringify` writes
  both as `null`, so the `isFinite` half of the check was proven by
  nothing. The legs now POST a RAW `1e999` / `-1e999` (which `JSON.parse`
  turns into ±Infinity) in the unit suite and on the plane, and a raw `NaN`
  is asserted to be the body-is-not-JSON 400 it is (row R1).
- No chrome constant is committed today, so the dist byte-identity proof
  never ran `admitChromeConstant`, and its CONTROL used a stand-in
  renderer (skeptic): a control now mints a constant from the REAL
  `renderChrome`/`chromeFragmentOf` over the bundles the plane's own three
  receipts produce, admits it with build.mjs's deps shape, and is refused
  for a context whose fragment the build does not ship (row R15).
- The front's `keyof Env` cast hid a misspelt sibling binding (skeptic):
  `SIBLINGS` and the `EDGE` literal are typed to `Env` now; the cast covers
  only the roster-derived half the dispatch test pins (row R4).
- `PublishedBundle.columns` was keyed by `string` while the chrome
  iterates the switcher's `ReadingMetric` union (seams): bound to the
  union at the gate, and the origin suite's third copy of the list replaced
  by the switcher's export (rows R5, R16).
- The composer `build.mjs` is outside every typecheck program, so the deps
  contract with the gate is held by the lexical leg and the dist identity,
  not by `tsc` (conformance) — stated in the ADR addendum with its price
  (`@types/node` and ~120 annotations, most in the reference renderer
  chain), owed.
- Typed numbers the tree did not reproduce (three lenses): "62 legs"
  (63 at the time, 85 now), "4,289 lines" (4,224 of `src/**/*.js` at
  c7ed377, the audit's own set), a `grep` claim of "nothing" that returns
  `html.js`'s own comment, and "seven escapers" by a command that finds
  four — each rewritten with the command that yields it.
- The generator's header said two runs per column where the code writes
  three (correctness) — fixed; and `readJson` turning a JSON `null`,
  array or primitive body into `{}` is a fifth behaviour change the first
  draft did not list (skeptic): a `null` body to the preview route was a
  500 and is an empty preview now — stated here.

**Sabotage round 2**, over those fixes (the same file, its second table):
19 rows — 15 caught, 1 control passed as designed, 3 missed. Two were
stated as MISSED before they ran: an invented field on a fixture (Zod
strips unknown keys — the real-receipt control and the gate's typedef hold
field names) and a stale local copy of the reading-table names in the
origin suite (the local typecheck cannot see a list the suite no longer
imports; the suite's own leg on a plane is the catcher). The third, R15,
missed for the row's own reason — the chrome renderer already returns the
bare fragment, so swapping the fragment extractor for identity changed
nothing — and R15b, which hashes an UNPOPULATED render while the constant
claims populated, is refused by the identity gate: caught.

**How this unit shipped, stated.** The first commit (#48, `f66d464`) merged
with the pass still running, at Rob's request, so unit 9 could start in a
worktree; its record said so in place of this section. The completing
commit (branch `workers-hardening-verify` off `f66d464`) folds the pass,
adds the eight rows, the map leg, the raw-literal legs, the real-renderer
control and the typed bindings, rewrites the interim paragraphs, and runs
the final pair below on the finished tree.

**The suite once more, on the final tree — the run that stands.** Fixture
**670 of 670** in 143.9 s; crate **670 of 670** in 144.2 s — after the pass's
fixes, round 2 and the record rewrites, with `pnpm run check` 40 of 40
immediately before them and nothing edited between. Two edits followed
them, both to the record: the suite-runs table's two final lines and this
sentence. No leftover process after either teardown; the front log carries
the recorded eight `chrome-slot-count` 404 shapes and nothing of this
unit's.

**The ceiling this entry crossed, re-observed rather than guessed.** The
how-it-was-built master links each build-log phase by line
(`?plain=1#L<n>`), and `how-built-links-resolve.test.ts` pins the size at
which GitHub's code view was OBSERVED to honour that — 512 KiB, from a
2026-09-02 observation at 412,355 B. This entry took the file to 533,209
B and the leg went red, as designed. So the branch was pushed and a real
Chromium (the origin suite's Playwright build, headless) opened the code
view at two anchors, a phase heading at L4342 and this entry's own heading
at L7920: GitHub's header read "8132 lines (7399 loc) · 521 KB", both
lines present reading their headings, both highlighted, no "too large"
notice. The observation is recorded beside the first in the test and the
ceiling raised to 640 KiB with the same headroom the first pin used; the
script, its two observation lines verbatim and one screenshot sit in the
unit's record directory.

**What this leaves.** The `harness.quiescence` gate — the measurement
pass's, landing with the receipts that satisfy it; when it does, it is one
more marked throw and one more row the map leg demands. The composer and
the other front build scripts outside the typecheck program (the ADR
addendum prices bringing them in). The fixtures' 1.5 MB on disk, chosen
over a leaner gate-shaped fixture so the runner's own schema can hold
them. For Rob, carried forward unchanged: whether
`pm-warm` is on the Free plan; the PDP `not-found.tsx` and
`lib/plp-error.tsx` docblocks; the bench runner's uncapped CDP `send()`;
the two post-deploy smokes that failed on one qwik stepper assertion; the
deployed plane's compressed header bytes; addendum O's `transferSize`
wording; the checkout fit template and its `interactionFetch` declaration;
the cart line list's missing `tabindex`; wrangler 4.110's crashes under
load (none today); unit 10's Rob-gated items.

### `interaction-registry` — narrative moved from the decision map (2026-09-25)

The decision map's `interaction-registry` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **MERGED — PR #35 (`ae97f8e`, 2026-08-28).** At hand-off this unit was code complete and unmerged: branch `interaction-registry` off main `832e9cd`, **ten** commits (`git rev-list --count 832e9cd..HEAD` = 10 — nine code plus the records; an earlier draft of this line said "nine", written from inside the ninth and counting only its predecessors, which is the exact error this map has already had to correct twice), presented for Rob's merge call. The batches could not run until it merged: the addendum-Q provenance gate refuses a local checkout measuring a plane on a different SHA, by design, and this unit changes the ruler. That block lifted with the merge; the post-merge pass is the `measurement-pass` entry below. Tree at hand-off: turbo `check` **30/30**; fixture AND crate origin suites both **17 files / 510 passed / 0 failed** (up from 479 by the four interaction legs and the three chrome unit cases; the 24 previously env-gated blog skips ran live). **verify-slice `wf_0785a61e-e76`: 4 lenses, all completed, 26 findings, ALL 26 confirmed against source — 24 adopted, 2 answered by measurement, 1 (the attestation gate) adopted but SEQUENCED onto the post-merge pass. Six were defects in this slice's own new work.** Thirteen sabotages, each watched failing and restored from a BACKUP COPY.

- **The unit's centre turned out to be the instrument, twice.** The interaction byte boundary was `page.waitForLoadState("networkidle")`, a document-load-lifecycle LATCH — Playwright's own typings, `types.d.ts:5020`, "if the state has been already reached while loading current document, the method resolves immediately", with `networkidle` marked DISCOURAGED at `:5024`. No navigation happens across a scripted interaction and the runner's own pre-click loop closes the latch, so the post-click call returned in **0–1 ms** (re-timed this session on the deployed plane; the discovering session measured **24–49 ms** from inside the runner — either is proof, since a 500 ms window cannot resolve in under 500 ms) and could never observe anything. `pdp-gallery-switch` fetches a 25,194 B image and the runner recorded `interactionBytes: 0` with **`interactionSettled: true`** — the flag whose whole job is to make that zero falsifiable. **It survived because every `interactionId` any test had ever driven was `body-click` or `none`, both of which fetch nothing**, so a working boundary and a broken one produced identical assertions. No test had ever driven an interaction that fetches; one does now, and it fails against the latched wait.

- **The second defect was found by probing the fairness question rather than reasoning about it, and it inverts the answer.** With the boundary fixed, qwik's gallery switch measured 52,032 B against 25,194 B for the other three, and the predecessor prompt framed that as: inherent to qwik's renderer, or a defect in `PdpGallery.tsx`? Publishing it as a paradigm cost if the second would be rigging AGAINST qwik. **It is neither.** A standalone probe of the same click measured **25,194 B on qwik**, on the local crate plane and the deployed plane alike. The single variable was `page.route`, which the runner registers to capture vitals beacons — and **Playwright documents that "Enabling routing disables http cache"** (`types.d.ts:4063`); its routing is not URL-scoped at the browser, so one beacon route took the cache away from every request of every measured visit. Adding that one line to the probe reproduced 52,032 B byte-for-byte, on qwik and no other variant: qwik re-writes `src` on all five thumbs with the value each already holds, which costs nothing with the cache on and is five downloads with it off. **The instrument was manufacturing a 26,838 B paradigm difference no visitor can experience.** `PdpGallery.tsx` is deliberately UNCHANGED — factoring it to chase the phantom would have added serialized state to a published initial-JS cell for no measured benefit.

- **Neither defect moved a published number, and that is measured, not assumed.** Editorial, five variants, five runs, same plane, before and after the cache fix: every initial-JS median within 1 B (the attribution's own rounding), every interaction median 0 in both columns both ways. The published fit line's "and none of them fetches another byte for the click" was TRUE all along; only its `interactionSettled` attestation was unearned, which is a record problem, not a number problem. The receipt's `methodNotes` now says exactly that, in the artifact.

- **Gate 2, qwik's INP: the PDP publishes NO INP row, loudly.** On the same click qwik reads INP 8 ms against 24 ms for the other three. Chromium closes an event-timing entry at the first paint after the handler's SYNCHRONOUS processing returns; qwik's resumed handler returns at 0.7 ms having only scheduled the render, the ~8 ms paint carries nothing, its DOM change lands at 9.9 ms after it, and **its visible update arrives at 34.6 ms — the latest of the four** (vanilla 18.4, react-next 19.5, astro 18.2). The cell reads lowest where the work finishes last. Then the check that decided how to publish it: the same probe on EDITORIAL shows the same asymmetry (qwik's DOM change at 22.0 ms against 1.0–3.5) but there it falls INSIDE the window and the cell reads 24 like the rest. **So the direction and size of the discrepancy are a race with the frame boundary, not a property of the paradigm** — and it already rides editorial's published INP cell. The first answer was "publish it with the limit stated" (addendum M's precedent); two further batches refuted that. Qwik reads **8 ms** on gallery-switch under average broadband, **0 ms** under slow 4G, and **8 ms** on add-to-cart under average broadband, while the other three hold at 24 throughout — a column swinging 0 → 24 across conditions is not measuring a paradigm property, switching interactions does not escape it, and 0 ms is a number no caveat rescues. So the surface declares `interactionTiming: {publish:false, reason}`, the value is dropped at BUNDLE time (not hidden at render time), the row carries the reason, `/methodology/` carries the mechanism and the figures, and a suite leg proves both directions. **Editorial keeps its row** — all five variants at 24 ms across every profile, seven runs each — because withholding a stable row would be over-correction. A click-to-visible-paint reading would be like-for-like where INP is not; it is a receipt field, a reading row and a publication path — a unit, not a clause — and it is recorded as owed rather than quietly skipped.

- **The hardcoded no-fetch refusal is now DECLARED per surface**, so a surface whose interaction legitimately fetches publishes with the fetch stated instead of being unpublishable by construction: `interactionFetch: "none"` or `{kind:"constant", toleranceBytes}`. Required, not optional — a generalisation that can be omitted is a way to opt out of a check — with a constant measuring zero refused by name, and the clause moved ahead of the band-overlap early return so it cannot be skipped. Sabotage-proven five ways.

- **Two interaction families, one receipt slot — decided: publish one, and NAME it.** Extending the receipt key to carry the interaction was rejected (the surface parse becomes ambiguous and the chrome would need two tables per surface); merging both into one bundle was rejected because `READING_METRICS` has no interaction-bytes row, so the published "interaction cell" IS the INP row. `pdp-gallery-switch` publishes; `pdp-add-to-cart` is measured and recorded as unpublished with its numbers and its reason. The bundle carries `interactionId` and the INP row renders it where the row publishes — on the PDP the same slot carries the withholding reason instead — and a receipt carrying two interaction families is refused outright.

- **A cost this unit created and paid: the chrome constant.** Naming the interaction in the INP row grows the fragment 12,072 → 12,131 B, and the addendum-N hole-1 identity gate refused the committed constant for describing a fragment the build no longer ships — the first time that gate has fired on a real chrome change. The artifact is removed rather than replaced (an absent constant is a legal state, now covered by a both-directions suite leg instead of a leg that only knew the populated one) and re-measured against the deployed plane at the merge SHA. The local-plane interim, +236 ms FCP/LCP, is recorded and NOT published: this project's own record has local-plane constants at +224/+216 against deployed ones at +76 to +104, so the gap is the plane, not the label.

- **The verification pass earned its keep on this slice more than on any before it, and three of its findings were about this unit's own claims rather than its code.** A `/methodology/` sentence the site's own served bundle falsifies one click away (react-next reads 32 ms, not 24 — derived from the receipts now, so it also cannot go stale). Six hand-typed paint-timing numbers with no artifact, on the one page whose premise is that it carries none without one (moved to the ADR; what stays is the mechanism and the instability, which IS checkable in the receipts the withheld cells would have linked). And a wall-clock claim — "the genuine waits cost nothing measurable" — read off a comparison taken under lighter parallel load, which the next full run refuted by timing the pre-existing `reproduce` leg out at exactly 300003 ms.

- **Three more defects were caught by SABOTAGING this unit's own new guards rather than by reading them.** The `interactionTiming` refusal fired as a raw `TypeError` from the column loop, which dereferenced the declaration before the named check ran — it failed closed, so nothing could have published, but a sabotage that produces *some* failure is not proof a guard works. The new zero-fetch leg pointed at the fixture's UNPRICED release, caught in a minute by the fail-fast the same pass had just added. And the widened fragment-budget leg's own non-vacuity assertion was a tautology (`pages.length >= LAB_SURFACES.length` holds for every input, empty registry included) — the anti-pattern that file's own comments condemn.

- **The cache fix is now guarded by MECHANISM, not by a variant's side effect.** The cross-variant agreement leg catches today's symptom only because qwik happens to re-write identical `src` values; a keyed thumb list or a Qwik diff improvement would make it pass with the cache on OR off. A second leg drives the runner's own setup functions and asks whether a SECOND visit in the same context re-downloads the immutable images. Two drafts of it were wrong first — a font served `max-age=0, must-revalidate` (legitimately a paid re-request), then `fetch()` and `Image()`, neither of which produces a resource-timing entry on a memory-cache hit at all.

### `how-it-was-built` — narrative moved from the decision map (2026-09-25)

The decision map's `how-it-was-built` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT (2026-09-02)** — branch `how-it-was-built-build` off `87113f6`, one commit. `/how-it-was-built/` serves from the front Worker's own `dist`, assets-first, chrome-free, script-free; every store-page footer link to it now resolves. Spec: `docs/prds/how-it-was-built-build.md` (merged as #37); ADR-0008 addendum B and an ADR-0004 §2 addendum record what the build settled. The before/after probe the spec owed: `GET /how-it-was-built/` on the front Worker alone answered `404 Not Found` / `not found` with `unknown-prefix` in its log before the change; `200`, `class="pm-doc"`, no `data-pm-chrome`, no `pm-chrome-slot`, no `<script` after it, and the composed-origin suite holds all of that on every run.

- **One renderer, two heads — done, and the page is written at attestation time, not in `build.mjs`'s body.** `@pm/front` declares `@pm/reference` (the first workspace to; ADR-0004 §2's "not consumed" is qualified by addendum, not contradicted) and `stampBuild()` now writes BOTH `/_pm/build.json` and `dist/how-it-was-built/index.html` from one `{sha, dirty}`, rendering the page BEFORE writing either file. Why there: turbo replays a cached front dist whenever the package's inputs are unchanged, and a page baked in `build.mjs` would then name the commit that BUILT it while the re-stamped attestation names HEAD — the exact disagreement the served-vs-master leg exists to catch, produced by the cache rather than by drift. The stamp is the one step every serving path already runs after a replay (`run-local`, the `dev` script; `deploy` rebuilds fully), so it is where the page belongs. The design review's one should-fix on this: render first, so a thrown render cannot leave a fresh `build.json` beside a stale page.

- **Deep links are receipts in two forms, because GitHub shows the two files differently.** An ADR is rendered, so an addendum links GitHub's own heading anchor (`#addendum--…`); the rule is github-slugger's and is PINNED to anchors GitHub actually rendered (fetched 2026-09-02, five hard cases plus the `consequences`/`consequences-1` dedupe pair on ADR-0008) in `packages/reference/test/reference.test.ts`. The build log is NOT rendered by GitHub's blob view — its page payload carries `richText: null, richTextTruncated: true` at 403 KB (checked 2026-09-02) — so a heading fragment there would scroll nowhere; a phase links the code view at its heading's own line, `?plain=1#L<n>`, exact at a pinned SHA. The PRD's picture of one anchor form was wrong for half the links, and an index whose links open at the top of a 6,500-line file is not a citation.

- **Home's PM-006 row links the surface.** ADR-0007 §4 shipped it "Public today, linking the build log" as the day-one way to show a live token and says rows update as surfaces land; the composed-origin suite already holds every other live row to a same-origin href. The row now links `/how-it-was-built/` and the new suite leg pins it (the review's should-fix: an unpinned live row can rot back to a GitHub link with nothing going red). README's surface table row is corrected too.

**Nine duties, each fired and restored from a backup copy** (never `git checkout --`; porcelain identical before and after): the table is in the build log (Phase 15, "The last surface, built"). D1 was proven absent by the spec session and fires now; D3 and D6 re-confirmed; the seven new guards each fired with their own message, plus the fragment and line arms of D4 and the home-row pin.

**Verified three ways before the commit:** a three-lens design review of the note before code (nothing blocking; its should-fixes applied), the sabotage table above, and the repo's verify-slice pass — whose first run died on the session limit with an empty findings array that reads like a clean pass and was not one (journal: 4 started, 0 results), and whose resumed run returned 14 distinct findings, none refuted, all fixed in the same commit (build log, Phase 15: the checkout/plane refusal on the served-vs-master leg, the deployed plane's clean-attestation requirement, the head description derived from the attestation, one heading extractor with an id-less refusal, the master byte-compared again, the inline-markdown fence on anchors, the fetched-anchor fixture, metadata refusals, `exports` pinned undefined, the typed "six" removed, the D2 row made reproducible, ADR-0007's addendum, the workers README, and the line anchor observed in a real browser).

### `checkout-vanilla` — narrative moved from the decision map (2026-09-25)

The decision map's `checkout-vanilla` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **RESOLVED (2026-08-29)** — PR #36, rebased onto `0eec463`. Turbo `check` green on every task; the count is **31 on this branch** and is not a constant — `@pm/vanilla` had no `test` script and now has one, and #38/#39 each add another, so main lands at 33. Derive it, never type it: `turbo run lint typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`. `@pm/repo-checks` **148 passed / 1 skipped** (two legs removed, see below); `@pm/vanilla` **4 passed**.

**Merge-review pass (2026-08-29).** A five-lens review held this PR back for two served falsehoods, both now fixed in the master and mirrored into the variant, and one dead control. All three are page-level honesty, not code hygiene — see `build-log.md`.

- **The card fields POSTed to the edge with JS off.** `field()` stamped `name` on every input, the form is a real `method="post"`, and `preventDefault()` lives only in the deferred script — so the plaque's "what you type never leaves your browser" was false on the one path where it mattered. `field()` now emits NO `name` at all, and the four payment fields carry `autocomplete="off"` instead of the `cc-*` tokens that ask a browser for a real saved card. Measured in Chromium, form filled with a real-looking card and address, JS off: the POST body is `shipping=standard` and nothing else. `name` survives only on the shipping radios, which need one to be a group.

- **The page advertised native validation it did not have.** 0 `required`, 0 `pattern` in the whole checkout markup; `type="email"` was the only constraint, so an empty form submitted clean. `required` now mirrors `checkout.js`'s RULES one-for-one (10 fields), with `pattern` on the three that have a shape test. Safe for JS-on because the hydration `novalidate` handover at `checkout.js:220` runs before the formatter binds — verified in Chromium: the error summary still renders 10 errors and still takes focus.

- **`SURFACE_CONTROLS.checkout.variants` was `[]`** while this PR makes `/vanilla/checkout/` real, so the panel rendered "Served by 0 of 3". Now `["vanilla"]` + `plannedVariants: ["react-next","htmx"]`, landed in the same commit as the routes it makes true. This also un-vacuums the "every LIVE variant has an entry" leg, which until now ranged over nothing.

- **`@pm/vanilla#test` is now `"cache": false`** (the entry the branch reported as owed and did not apply), so the 73-line duplicate of the checkout identity guard in `@pm/repo-checks` — which existed only because the vanilla task could replay a stale PASS — is deleted, its one unique assertion carried into `variants/vanilla/test/`. **Net −73 lines.**

**Answer.** The page was the easy half. `renderCheckoutPage` matched the master on the first run, byte-strict after the delivery strip, stylesheet list and order included — checkout is data-free (`renderCheckout` takes no snapshot; `render/build.mjs:78` discards it), so there is one page and one flavour of it. The work was the guards, and the first thing they did was fail honestly.

- **`pdp-controls-wired.test.ts` passed a sabotage it was written to fail.** Its state checks were `script.includes("aria-invalid")` over the RAW file. Rewiring every write in `checkout.js` to `data-invalid` left five occurrences down to **two, both in comments**, and the suite stayed green. Pre-existing, not introduced: `pdp.js:90`/`:97` name `aria-pressed` in the prose above the zoom toggle, so deleting that toggle and keeping its explanation would have passed the guard added to catch the dead zoom. Same defect `master-styles-resolve.test.ts:66-73` fixed one file over — "a class NAMED in a contract comment is not a rule" — by the other door. `codeOnly()` strips comments, string-aware so a `"https://…"` literal keeps its tail; all four PDP variants pass unchanged.

- **The markup-derived rule inverts on this surface, and nearly went vacuous.** The PDP legs prove themselves by requiring at least one script-only state in the markup; a served checkout form correctly renders **zero**. Exempting checkout would have been the vacuous pass this file exists to refuse, so the exemption is a CHECKED CLAIM (`SERVES_NO_SCRIPT_STATE` — a master that ever renders one fails until it is wired or the entry goes), and the bite moves to the **stylesheets**: `field.css:45` styles `.pm-field__control[aria-invalid="true"]` across twelve controls, a rule nothing but script can match. That is `pm-pdp__scroll` in mirror image — markup promising behaviour no sheet implements, versus a sheet promising a state no script produces — and neither guard sees the other's case. Scoped to `<main>`: the masthead's `[aria-current="page"]` is the server's (`shell.mjs` sets `current` at render time). The PDP passes it unchanged.

- **The cheap half was not enough, so the expensive half was built without a browser.** `pdp-controls-wired` proves an enhancement can REACH a control and says so about itself. For the PDP the other half is the origin suite, which cannot gate a merge; checkout has no browser leg at all. `checkout-controls-behave.test.ts` therefore drives the REAL `checkout.js` against the REAL served master in linkedom, pre-merge, no ports — card grouping, MM/YY, blur validation writing and clearing `aria-invalid`, the error summary's heading, per-field links and **focus move**, no stacking on a second submit, the cart populating, and the shipping radio moving the total by exactly the **$12.00** its own label states. Limits stated in the file: no layout (says nothing about CLS), no timing (**not evidence about INP** — those numbers come from the bench runner), and a DOM emulation is not a browser.

- **The catalogue is fetched, not baked, and the ruler is the reason.** Cart is `localStorage`, so no paradigm can SERVE cart contents (ADR-0008 §7); `cart-summary.css:15-18` pins what a line needs. Inlining the index was measured and rejected: **50,892 B raw / 8,571 B brotli-q11** for the crate's 500 releases (fixture 25,970 / 2,490), on the flagship INP page, to serve a state the measurement never enters — the canonical served state IS the empty cart. That is a manufactured paradigm cost, the shape PR #35 had just removed from the ruler. A test asserts the empty-cart page fetches nothing at all. The build-time alternative's cost is published rather than avoided, and the request-time variants face the same choice.

- **Turbo went 30 → 31 and the number is the deliverable.** `@pm/vanilla` gained a `test` script — the exact gap this map recorded at `:325` — verified by `--dry=json`: 31 real commands, 75 nodes, delta exactly `@pm/vanilla#test`. Reporting 30 after closing that gap would have been the lie. Dependency-free (`node --test`, no vitest, no linkedom), so the lockfile is untouched and the no-toolchain control stays one. **Disclosed weakness:** that task inherits `cache: true` with inputs limited to `variants/vanilla/**`, so a reference-renderer change plus a master re-render can replay a stale PASS. The `"cache": false` entry every sibling has (`turbo.json:129`, `:181`, `:198`) is owed and NOT applied — shared root file, four agents — so the same comparison also lives in `@pm/repo-checks#test`, which is uncached and always runs. That copy is what makes the claim true today.

- **linkedom matches `:checked` on the ATTRIBUTE, not checkedness**, and does not reflect a property assignment. `shippingCost()` now walks the group and reads `.checked`. Both forms are correct in a browser; only one is provable before merge.

**Eight sabotages, each watched failing with its own message and restored from a backup COPY, never `git checkout --`.** The identity test's failure output was two 6 KB blobs until the fifth sabotage exposed it — a guard whose failure cannot be read is a guard that gets muted — so it prints a first-divergence excerpt now.

**Owed, and NOT done here.** Three of these are boundary, not judgment. (1) `pm-checkout__form` still has no rule; it must live under `packages/tokens/`, which is in nobody's boundary this round, and the `OWED` retirement is coupled to it — the completeness leg fails if the rule lands and the entry stays, the per-surface leg fails if the entry goes without the rule, so they land together at integration or not at all. Units 1 and 2 owe the same pair for `pm-plp__head`/`pm-plp__results`: three units, one registry, one file. (2) ~~`SURFACE_CONTROLS.checkout.variants` is still `[]`~~ — **applied in the merge-review pass above**; the leg now ranges over `vanilla` and bites. (3) **Checkout has no origin-suite leg of any kind** — the cart suite parameterises over the EDITORIAL surface only (`cart.browser.test.ts:103`; `shell.mjs:66-67` states it), the PDP's controls have their own file, and checkout has neither, so a checkout cart that diverges from editorial's is exactly as invisible as the dead PDP controls were. (4) The three ids ADR-0008 names — `checkout-type-card`, `checkout-submit-invalid`, `checkout-fix-and-submit` — are still absent from `collect.ts:33`, which holds five, none of them checkout's; that file is the measurement pass's. Nothing is published from this surface, so no receipt is invalidated by any of it.

**Still owed after the merge-review pass, and deliberately not taken here** — each is real, none blocks the merge, and doing them inside a merge-unblocking pass would be scope this PR cannot defend. (5) **A JS-off submit still ends on a zero-length 405** (`workers/front/src/index.js:101` → ASSETS). Nothing personal leaves — measured body is `shipping=standard` — but the dead end is unlovely, and the honest fix is a JS-off success page, not more copy. (6) **CLS on the phone profile**: `checkout.css:40-43` puts `.pm-cart { order: -1 }` above the form at ≤52em and `cart-summary.css:37`'s `min-block-size: 12rem` is a floor, not a fixed height, so late catalogue population (`checkout.js:190`) grows the summary and shifts the form. It moves no published number — the measured state is the empty cart — but it contradicts `checkout.js:97-98`. Cheapest moment to fix it is before the first checkout batch, since there is nothing to invalidate yet. (7) **`read`/`count`/`renderCount` are now byte-identical in three files** (`checkout.js:32,54,55`, `cart.js:13,35,36`, `pdp.js:17,39,40`). The no-module-graph justification holds; the drift risk does not. One repo-check asserting the three match after comment stripping is ~20 lines, and `codeOnly()` already exists at `pdp-controls-wired.test.ts:284`. (8) `pdp-controls-wired.test.ts` still carries a near-verbatim copy of the PDP block for checkout; parameterising saves ~40 lines.

### `plp-react-next` — narrative moved from the decision map (2026-09-25)

The decision map's `plp-react-next` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **RESOLVED (2026-08-29)** — PR #38, rebased onto `0eec463`. Turbo `check` green on every task; the count is **31 on this branch** (`@pm/react-next` had no `test` script and now has one) and is not a constant — #36 and #39 each add another, so main lands at 33. Derive it, never type it: `turbo run lint typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`. Origin suite green on the final tree.

**Merge-review pass (2026-08-29).** A five-lens review found no defect in the three strategy arms themselves — everything that held this PR back was integration the unit had not done, plus one served falsehood it inherited from the master.

- **The facet rail, the search form and the sort select are CUT.** `workers/edge` `handlePlp` reads `n`, `page`, `run` and `cache`; none of the five ADR-0005 §5 params. So every facet click, every search and every sort navigated to a filtered URL and got the **unfiltered grid** back, under a toolbar still reading "Showing 1–24 of 500 releases", with no error state. This arm made it worse than htmx's did: it *forwarded* the params to `/api/plp`, so the request looked filtered, and it keyed TanStack's cache on them, so identical unfiltered payloads cached under distinct keys and the client-cache cell — the PLP's headline — was measuring a miss it manufactured itself. The rule applied is this map's own at `:323`, set by `pdp-controls`: become real in every variant, or take the cut explicitly and REMOVE the controls from the master and the CSS. Implementing §5 instead is a unit, not a merge fix — it needs facet-value validation, a KV-key cardinality policy for five new params, and an ADR answer on whether a filtered response recounts its facets and whether `PlpPage` grows a field naming the applied filters. Cutting now costs nothing: **no PLP number is published**, so nothing is invalidated — and measuring a page whose largest DOM subtree is an inert rail would have priced a page the product never serves.

- **The reference is now page-aware, and that is what reconciles the two arms.** `renderPlp` took no `page`, so page ≥ 2 was not expressible by the contract and both arms generalized it unaided — differently. react-next emitted `rel="next"` unconditionally and rendered `0–0` on an empty page; htmx gated it and rendered `0`. Two arms, one URL, structurally different DOM, invisible to every gate because the only thing either was compared against rendered page 1. `renderPlp(snapshot, { page })` now owns the sliding window, the `--current` marker, `hasNext = page < totalPages` and the `0` range; react-next mirrors it. **Byte-identical at page 1** — the regenerated master is 105 deletions and zero insertions, all of them the cut.

- **`SURFACE_CONTROLS.plp.variants` was `[]`**, so `chrome.ts` filtered every strategy cell against an empty array and the surface's entire measured-axis control collapsed to one dead `<span aria-current="page">`, under "Served by 0 of 2". Now `["react-next"]` + `plannedVariants: ["htmx"]`. **The naive registration was not enough**: the fallback branch it retires was the only thing marking the fenced Apollo preset current, so `/react-next/plp/apollo/` would have rendered three anchors and zero `aria-current`. The fenced-current cell lands with it, matched on **path alone** because that preset has only a `?cache=cold` arm and the query-less URL would otherwise still come back unmarked. Nothing about it is counted — the count reads `variants`.

- **Two chrome rows promised HUD controls this build does not deliver** — the per-interaction byte readout and the replay control, both "land with the store's PLP build". This IS that build. They now say `not built yet`, the reading table's own wording for a planned column. The first draft cited "ADR-0005 §8" in the copy and `repo-checks/instrument-font.test.ts` failed it: `§` is not in the subsetted instrument mono and would have rendered as tofu. The citation moved to a code comment, where it belongs.

- **The exhibit's cost, re-measured on the real build** (client-reference-manifest chunk sets + `rootMainFiles`, brotli q11): TanStack **+8,897 B**, Apollo **+60,952 B** brotli — **6.85×**. Quote the DELTAS: six builds during verification moved the absolutes (`plain` 527,753 → 528,513 raw) while the deltas held to under 0.3% and the ratio to 6.84–6.86×. `/editorial/` is the control, byte-identical across all five, against the prototype's 7.3× (ADR-0005 §7). Published in BYTES because the rounded-KiB form flipped between 6.8× and 6.9× across builds whose deltas barely moved, and a figure that changes with rounding is not a measurement. Local build measurement, not a receipt; `/editorial/` is carried as a control and is byte-identical across every build in the session, which is what says these deltas are the PLP's and not the toolchain's.

- **The RC's packaging broke four ways** (Node ESM → UMD `TypeError`; extensionless relative imports; Turbopack's browser condition → "no exports at all"; an undeclared `rxjs` under no-hoisting). Fixed with a fourth `packageExtensions` peer entry, one `turbopack.resolveAlias`, and one `ssr.noExternal` — none of them a patch of the library. This is exactly why ADR-0005 §7 pins the exact version; a bump re-runs all four as its canary.

- **The guard drives the REAL edge Worker** in-process over a stub R2/KV and feeds its actual tray to the React render, which pins `renderPlp`'s facet comparator against the Worker's — an agreement `plp.mjs:22-27` asserts in prose and no test anywhere checked (`git grep -c computeFacets ae97f8e` finds 8 hits at the base commit — two definitions (`workers/edge/src/index.js:101`, `packages/reference/render/plp.mjs:28`), two call sites, four prose mentions, and not one assertion — pinned to the SHA because the first correction was falsified by writing it down: a count of "the tree" changes the moment the record joins it). **37 tests / 155 `expect` calls, 1.07 s local, sabotage-proven on 52 axes** — 19 of which PASSED against the guard as it then stood (counts derived with `awk`/`grep -c` after the final edit, not tallied by eye); one of them (a stylesheet dropped from `PLP_CSS`) is caught by the stylesheet leg **only**, because the normalizer discards the whole `<head>`. Verification found and fixed a long run of this unit's own defects, and the count that is actually derivable is the sabotage table's: **19 sabotages passed against a guard written to catch them**, each one vacuous. The staged pass's best finding was one this unit had already printed and read past (a full grid of 24 cards shipping with zero `aria-current` from page 6 on, one click from page 5's own Next link, because the pagination window was anchored at 1 the way the reference's is). Others: a guard that was vacuous (the seed leg), a fairness defect in the cold arm (two quick paginate clicks raced, and the last RESPONSE won rather than the last click — the two library arms get ordering free, so leaving it would have punished the baseline for something that is not its data strategy), a test that made a claim about markup the page never renders, an exhibit constant that claimed a cache window Apollo does not have (verified: `grep -rl staleTime` across the installed `@apollo/client@4.2.12` returns nothing — the exhibit now states the difference and pins the library fact as a canary), a missing `previousData` that would have made the exhibit flicker where the lead does not; a failed page change that painted the SERVED page's grid under the new page's URL on both cache arms; three `pushState` writers with zero `popstate` listeners, so Back left the URL and the grid describing different pages; a plaque-pin guard that compared a file with itself; and a citation this unit's own sixteen-line edit had invalidated. **Those vacuous guards are all one shape — asserting that a NAME, a SUBSTRING or a CONSTANT is present rather than that the MECHANISM under test runs, is read, or is connected.** Eight came from one staged lens told to look for exactly that shape: every leg in the file proved a constant or a WRITE and none proved a READ, so pinning either cache arm's key to one page, swapping the exhibit to `network-only`, deleting `preventDefault()` from the pagination click (which silently turns every strategy into a full document load), or adding a fenced plaque to a BENCHMARKED route all stayed green. The fix was SEAMS, not more assertions: both inner components and their query-options builders are exported, so a test can seed page X, ask for page Y and watch which renders; and `PlpArticle` is a plain function, so its element tree is walked and the anchor's own `onClick` invoked with a stub event — `preventDefault` is driven, not grepped. Three were found only by sabotage, two of those only after the fix for an earlier finding was itself sabotaged. One let the two BENCHMARKED strategies ship the fenced exhibit's stylesheet — measured bytes on a published cell — with every assertion green; another meant no leg connected the condition machinery to a ROUTE, so a page that ignored `?n=` would have published a beacon tag its served page contradicts. The sixth was found by looking for the pattern rather than by tripping over it, which is the argument for writing it down. A `noindex` on the exhibit was considered and rejected: it would have been the repo's first indexing policy, set inside one variant, and the fenced precedent does not noindex.

- ~~**Two contract defects mirrored, not fixed**~~ — **BOTH SETTLED in the merge-review pass above, in the master rather than in either arm.** The unconditional `rel="next"` is gated; `renderPlp` takes `page`, so the paginator generalization is the contract's and both arms mirror it instead of guessing. The facet-href condition reset is settled by deletion: the rail is cut. What survives is the same omission in `pageHref` — a query-only relative reference replaces the whole query, so `cache`, `run` and `profile` are dropped on every page-flip. That one is now **stated in `plp.mjs` rather than mis-stated**: the comment there used to claim the hrefs "preserve the WHOLE condition", which was never true. It is the same gap in all three renderers, which is why it is recorded rather than patched in one of them.

- **`PERMITTED_NOISE` gains nothing**, measured: the surface normalizes equal to the master under `NO_NOISE`. React 19's per-eager-image `<link rel="preload">` is a delivery element the gate already drops; the exhibit's plaque is dropped only by its own legs' `dropFencedSubtrees`. The in-process measurement does not re-prove the served page — the origin suite owes that.

**What this unit could not do, and did not fake.** The client-cache arm's headline cell ("a revisit costs 0 requests / 0 bytes") needs a registry entry split into an unmeasured priming prefix and a measured step (ADR-0005 §3). `INTERACTIONS` (`collect.ts:33`) is still flat `(page) => Promise<void>` and its keys are exactly `none`/`body-click`/`editorial-add-to-cart`/`pdp-gallery-switch`/`pdp-add-to-cart` — no `plp-*` id is a registry entry; the six appear in four prose files only. The arm is built to the published `staleTime: 5min` config; the number is not approximated and the cell is not published.

**Owed, and outside every unit's boundary** — reported with diffs, not grabbed. Items (5) and (6) were **discharged in the merge-review pass** and (4) **in `measurement-pass` PR-1 (2026-09-01)**; all three are struck; the rest stand.

(1) **`workers/edge/src/index.js`'s PLP facet params (ADR-0005 §5) — now the surface's largest owed item, and it grew.** Until they land, there is no facet rail, no search and no sort on any PLP variant: they are cut rather than served inert. Restoring them is one commit with the params — the markup skeleton is preserved in the `plp.mjs`, `toolbar.css` and `plp.css` docblocks, the react-next legs that guard them are `it.skip`ped rather than deleted, and both arms carry a `plp-params-not-yet-honoured` tripwire that reads the Worker's own source and FAILS the day someone wires a param through without restoring the UI. Two questions ADR-0005 does not answer must be settled first, and they are the reason this is a unit and not a merge fix: does a filtered response recount its facets over the filtered set, and does `PlpPage` (`packages/data-contract/src/schema.ts:89-100`) grow a field naming the applied filters? A third is infra-cost, which this project of all projects should price: five params fold into an infinite-TTL KV key, so the key space is combinatorial — the `?page=` ceiling is the same class and is owed with it.

(2) `packages/tokens/css/surfaces/plp.css`'s two owed rules, which must land in the same branch as (3) the `OWED` retirement in `tools/repo-checks/`, or `master-styles-resolve`'s self-expiry leg fails.

(4) ~~A **route-level** fence — `assertBenchableTarget` keys on the VARIANT segment, so `/react-next/plp/apollo/` is benchable today (derivation run: prefix `"react-next"`), and the same variant-keyed blind spot sits in the front build's lab columns, the receipt schema and the HUD's fenced note.~~ — **DONE in `measurement-pass` PR-1 (2026-09-01):** `fencedPathOf` in `@pm/switcher` (`packages/switcher/src/config.ts`), refused by `assertBenchableTarget` and mirrored at receipt ingest in `workers/front/build.mjs`; details and line cites in the `measurement-pass` entry below.

(5) ~~a **measured aria-current regression** registering the variant causes~~ — **FIXED with the registration, in the same commit.** The prediction was exactly right: the fallback branch that had been marking the fenced exhibit current stops running the moment `variants` is non-empty. The strategies branch now has a fenced-current arm, matched on path alone so the query-less `/react-next/plp/apollo/` is covered too — which the naive fix would have missed. Guarded, both URLs, in `chrome.test.ts`.

(6) ~~the registry deletion is right only if Unit 2 lands with this~~ — **settled the way this said**: `plannedVariants` is `["htmx"]`, not gone, so the note reads "Served by 1 of 2" and agrees with the table beneath it. It becomes empty-or-gone when #39 lands htmx.

**Owed and NOT discharged, added by the merge-review pass:** the **cross-arm agreement leg** — one test rendering both PLP implementations at `totalPages + 1` from the same tray and asserting equal normalized DOM. It cannot live here: `variants/htmx`'s PLP renderer arrives with #39. It lands there, in `tools/repo-checks/`, where both are importable. Until it exists, the two arms agree because one master now defines the answer, not because anything checks that they do.

### `plp-htmx` — narrative moved from the decision map (2026-09-25)

The decision map's `plp-htmx` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **RESOLVED (2026-08-29)** — PR #39, rebased onto #38. Turbo `check` green on every task; the count is **33 with all three PRs landed**, and it is not a constant — derive it, never type it: `turbo run lint typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`. In-variant guard **45/45**; `@pm/repo-checks` gains the cross-arm PLP leg. Origin suite green. **51 sabotages, each watched failing and restored from a backup copy.** **verify-slice `wf_73fac766-f84`: all four lenses completed — correctness 9, issue/ADR-conformance 8, seams-integration 4, anti-rigging 4 — 25 findings, every one confirmed against source by the main session before acting, every actionable one adopted** — every one of them above page 1, the half of the surface with no master to be checked against.

**Merge-review pass (2026-08-29).** This was the batch's only red PR, and the red was inherited, not introduced.

- **The red CI was two stale assertions in a package this branch never touched.** `tools/origin-suite`'s `editorial.test.ts` and `drift.browser.test.ts` each required `PERMITTED_NOISE["htmx"]` to be `undefined`; this branch registers `^hx-` under `behaviorAttrPatterns` for the three real attributes on its paginator. **The registration is CORRECT and deleting it to go green would have been the wrong fix** — it fulfils a prediction written into the very comment it replaces ("if a later surface (the PLP build …) puts `hx-*` on a page, THAT build registers `^hx-` under behaviorAttrPatterns deliberately"), and `master-identity.test.js` proves it is load-bearing by showing the comparison FAILS under `NO_NOISE`. Both assertions now check the entry's SHAPE, with `attrPatterns: []` as the load-bearing half — that class would admit ordinary markup, which is the one thing the entry must never become. The `not.toMatch(/\s(?:data-)?hx-/i)` byte assertion above each one is KEPT: it is what actually keeps editorial free of `hx-*`, and it never depended on the registry, since that leg passes `NO_NOISE` explicitly.

- **Four stale prose sites, not the three that were listed.** `variants/README.md:51-53`, `variants/remix3/DIFF-TO-STARTER.md:179`, `docs/decision-map.md:231` and `docs/build-log.md:2279` all said htmx registers nothing. `variants/README.md:71` is a different defect and nearly slipped through: it says remix3's is "the **third** earned emptiness" — an ordinal that silently counts htmx, so the falsehood is the number, not the subject.

- **The justifying handoff lived on the Desktop.** `decision-map.md` pointed a reviewer at `~/Desktop/pm-unit2-plp-htmx-handoff.md` for the diffs reconciling the fairness gate. A gate loosening whose justification cannot be opened defeats the gate. It is committed at `docs/handoffs/2026-08-28-plp-htmx.md` with a header recording what this pass changed under it.

- **Page ≥ 2 agreement, from the other side.** This arm held the correct shape all along — gated `Next`, `0` on an empty page — and could not land it, because `packages/reference` was outside its boundary and diverging unilaterally would have forked the contract. #38 made the reference page-aware, so the `page === 1 ||` escape that existed purely to reproduce the master's defect is gone. **The new `tools/repo-checks/test/plp-arms-agree.test.ts` is the guard that would have caught the original disagreement**: it renders BOTH arms from one tray at page 1, the last page and `totalPages + 1`, on both snapshots, and compares normalized DOM. It is the only place both implementations run in one process. Sabotage-proven by restoring react-next's unconditional `Next` and watching it name the extra anchor.

- **It does not survive, and the registry had already written the case.** htmx registered nothing through slice E, correctly: editorial's one interaction is client cart state, which hypermedia does not own. That entry's own note ended "if a later surface (the PLP build, where htmx's loaders+PE strategy lives) puts `hx-*` on a page, THAT build registers `^hx-` under behaviorAttrPatterns deliberately." This is that build, and the deciding evidence is not taste: **ADR-0005 §1 defines the arm as "interactions are real links enhanced into partial swaps (works JS-off)"**, and `SURFACE_CONTROLS.plp.strategies` labels the control "Server-rendered — loaders + PE" — a string rendered into every measured page. Loaders without PE would leave the instrument advertising a mechanism the surface lacks, the exact falsehood `pdp.proves` was amended to remove. Registered as `behaviorAttrPatterns: ["^hx-"]`, `attrPatterns`/`classPatterns` empty, no `dropElementSelectors` — all mechanism, the qwik shape. On the page it is **three attributes, 56 B raw**, all on the ONE `<nav class="pm-pagination">`; the anchors keep their own `href`, which is what makes "(works JS-off)" a property of the markup rather than a claim.

- **Which control got enhanced was decided by the data plane, not the markup.** ADR-0005 §5 makes five facet params (`genre`/`style`/`format`/`sort`/`q`) "the PLP build's contract"; `workers/edge/src/index.js` `handlePlp` reads `n`, `page`, `cache`, `run` and nothing else. So **three of the surface's four navigation affordances — facet rail, search form, sort select — are served and dead**, and pagination is the one that works. §5 records that the ADR's own prototype "deliberately used page-flips (already canonical) so the origin stayed untouched", which is the same call. Enhancing a dead control would have been the falsehood, not the fix.

- **The forwarding leg protects a number, not a rendering.** `tools/bench-runner/src/batch.ts:78-80` builds every measured URL with `n` + `run`, plus `cache=cold` on the cold column. A Worker that dropped `cache` would have the edge serve the KV warm tier under a column labelled **cold** — the server-rendered arm reading faster than it is, rigging in the flattering direction. Dropped `run`, the warm column inherits every prior run's KV state. Both forwarded, via a whitelist; effective values are read back off the response (`perPage`, `page`) rather than re-derived, because `clampN` lives in the edge Worker and two implementations of one clamp is how a served page and its beacon tag come to disagree. **Observation, not a defect:** no request-time variant forwards `?cache=` on the EDITORIAL surface (htmx, qwik, react-next, remix3 all call the tray endpoints with no query string) — uniform across all four, so it biases nobody, and not this unit's to change. **SUPERSEDED 2026-09-01 (`measurement-pass`):** "biases nobody" was the wrong test. Uniform, yes — but the receipt's minted method note (`tools/bench-runner/src/batch.ts:350` at `360f90a`) said the cold/warm columns "measure the edge tier", and for every request-time variant they did not: the server-side tray fetch read KV under both columns. The artifact and its stated method disagreed. Resolved by scoping the cold column to browser-visible fetches, not by forwarding the knob — see below.

- **Identity is byte-strict, at both ends of the knob, both snapshots.** `renderPlpPage` equals `renderPlp` **byte-for-byte** after the ADR-0008 delivery strip and removal of the three registered attributes, at **n=24 and n=240**, fixture and crate. Two further legs prove the registration is exactly load-bearing: normalized DOM equals the master UNDER `PERMITTED_NOISE["htmx"]` and does NOT under `NO_NOISE`. Guard placement is a compromise, flagged not resolved: htmx's editorial guard lives in `tools/repo-checks` (another unit's directory this build may not edit), so the PLP's went in a new `variants/htmx/test/` — **htmx's guards are now split across two homes** and consolidating them is the integrator's call.

- **The measured partial-swap win is much smaller than the phrase implies.** Fixture, page 2 at n=24: whole document 30,387 B raw / 2,920 B brotli-q11; the `.pm-plp` fragment answered to an `HX-Request` 27,729 B / 2,321 B — **8.7% fewer raw bytes, 20.5% compressed**. On a catalogue grid the swapped region *is* nearly the whole page, so what a partial swap saves is the shell, not the payload. Nothing is published from this (the PLP has no receipts); it is recorded so the eventual `plp-paginate` cell has a prior to argue with. Same measurement independently confirmed ADR-0005's addendum figure: the vendored `htmx.min.js` is **14,996 B brotli-q11** = "15.0 KB htmx".

- **The enhancement is part of the mechanism, not decoration on it.** `hx-boost` replaces a navigation and takes away the two things a navigation does free: focus into the new document, and an announcement. The activated anchor is inside the swapped subtree, so it is destroyed and focus falls to `<body>` (WCAG 2.4.3, 4.1.3). `variants/htmx/src/plp.js` focuses the results heading and writes the new range into the shell's existing `[data-pm-status]` live region — no new markup. `tabindex="-1"` is **script-set, never rendered**: a rendered focus stop with no script to use it is `pm-pdp__scroll` again. **4,039 B raw / 1,479 B brotli-q11** (re-derived at commit time; an earlier draft said 2,780/1,064, taken before the failure-announcement listeners were added — 45% under, caught by the verification pass). Its logic is driven pre-merge against a linkedom document using the file's real source — the pdp-controls lesson, that an enhancement no pre-merge check reads is how two dead controls shipped on ~500 pages.

- **A second dead control, and it belongs to the shell.** `CART_CONTRACT` requires the enhancement to populate `[data-pm-cart-count]` "on every shell page load"; the htmx script list was one module constant, so the question only arose once there were two surfaces. `cart.js` now rides the PLP too — without it that masthead badge is permanently empty — and it costs nothing there (`cart.js:62` returns early with no feature button).

- **One sabotage produced NO failure, and the gap it found is the sharpest thing in this unit.** Adding the PLP's enhancement to `EDITORIAL_SCRIPTS` passed every check. Editorial is the one surface here with **published byte receipts**, and a `<script>` element is invisible to every identity guard there is: the drift normalizer drops script elements as delivery (ADR-0003 §2) and the byte-strict editorial guard's own `stripDelivery` removes them before comparing. A stray script on editorial moves a published number silently. Script lists are now pinned per surface, sabotage-proven in both directions. Separately, three assertions failed their sabotage with a bare "expected false to be true" — a crash, not the guard's own message, the shape this repo has already had to name once — and were given messages and re-sabotaged.

- **The verification pass earned its keep on the half of the slice that has no contract.** All three blockers lived above page 1, where no master exists to be compared against. (1) The Worker chose page-vs-fragment on `HX-Request` alone — but htmx's Back-button restore re-fetches with that header set (`historyRestoreAsHxRequest` defaults true, `htmx.org@2.0.10/dist/htmx.js:281`) and swaps the answer into `document.body` by `innerHTML`, so a history-cache miss would have written the bare `.pm-plp` block over the whole page: shell, chrome slot and every script gone. htmx's own config doc names the trap at `htmx.js:277` — "This should always be disabled when using HX-Request header to optionally return partial responses". Fixed server-side (`HX-Request` present AND `HX-History-Restore-Request` absent), not by the client config it suggests, because a server's correctness must not depend on a client file having loaded. (2) The page window was a literal copy of the reference's `1..min(totalPages,5)`, so **from page 6 there was no `aria-current="page"` anywhere in the nav and no route past 5** — six clicks from the front page on the fixture; the crate has 21 pages. (3) An out-of-range page rendered its range backwards — **"Showing 241–240 of 240 releases"**, which `src/plp.js` would have announced to a screen reader verbatim — because the edge floors `page` at 1 with no ceiling. **All three were invisible for one reason: the page>1 leg drove page 2 and nothing else, and page 2 is the single page above 1 where (2) and (3) both hide.** It now sweeps every page of both snapshots. That is Phase 15's own opening defect in miniature — a guard whose one driven case was the case that could not fail.

- **The FOURTH registry consumer nobody had named, and it fails silently.** `tools/repo-checks/test/warm-tier-discipline.test.ts:33` finds tray requests by the literal ``/["'`]\/api\/(plp|pdp)/`` and requires each to carry `run=` or `cache=cold`, because an un-nonced write mints a canonical KV entry with **no TTL** (`workers/edge/src/index.js:84` TTLs only nonced entries) and the next crate re-seed serves a stale catalogue to real visitors indefinitely. `/htmx/plp/` reaches KV as a PAGE path — it proxies the tray server-side — so it never names `/api/` and the guard cannot see it. (An earlier draft of this line called it "the first PAGE path in the repo that reaches KV"; false — the request-time editorial pages (react-next, qwik, htmx, and the fenced remix3 — `variants/remix3/src/lib/data.ts:24`) have proxied the tray server-side since slice B, so the guard has been blind to them all along. The PLP is where it was noticed. Corrected 2026-09-01.) It bites the moment the PLP drift leg is written, whose natural first line is `get("/htmx/plp/")`. Out of boundary; one-line widening in the handoff. Also unnamed and concrete: `plp` carries no `labBundle` flag, and `workers/front/build.mjs:708-712` throws on a receipt whose surface is not flagged — the first `plp-<profile>.json` fails the front build by name.

- **One of this unit's own detectors was the narrow shape the suite had already rejected for this variant.** The guard's `hx-*` matcher was `\s(hx-[a-z-]+)=`, which reports `hx-on:click` (colon in the name, `htmx.js:2752`), `hx-disable` (valueless, `:206`) and `data-hx-boost` (`getAttributeValue`'s documented fallback, `:418`) as ABSENT — all three live in the pinned runtime. Sabotage measured the cost: an `hx-on:click` on an anchor left both "exactly three attributes" and "no anchor is touched" green. `drift.browser.test.ts:901-907` had rejected this exact shape for htmx's editorial leg already. Widened to the suite's family, plus a leg pinning that the page uses no `data-hx-` spelling — `^hx-` deliberately does not match it, so that spelling must fail loudly rather than read as drift.

- **The anti-rigging lens found the two defects the identity guard was structurally incapable of seeing.** (1) **The tray's SHAPE was proven by nothing** — `plpBlock` destructures six keys and the test assembles those same six, so every identity leg passes by construction whatever `workers/edge` returns. Measured: a payload with `perPage` renamed renders a **200** page reading `Showing NaN–NaN of 240 releases`, hrefs `?page=N&n=undefined`, nothing throws so the 503 never fires, `plp.js` announces the NaN string to a screen reader, and the edge clamps `n=undefined` back to 24 so a visitor on `?n=240` is reset by clicking "2". Asserted at the boundary now, so the existing 503 owns it — at runtime, against the deployed plane. Sabotaging that check then showed its FACETS clauses produced **no failure at all** (every malformed-facets payload also throws during interpolation), so the check is exported and driven directly where each clause is provable, with the comment naming which clauses change behaviour alone. (2) **The enhancement was not idempotent and htmx re-runs it**: `cleanInnerHtmlForHistory` keeps `<script>` in the history snapshot (`htmx.js:3237-3248`), `allowScriptTags` defaults true (`:160`), `duplicateScript` (`:549`) re-executes — so one Back press doubled every later announcement into a `role="status"` region and doubled `focus()`, growing per cycle. The a11y file would have made the enhanced path worse than the unenhanced one. Re-entrancy flag on `window`; the guard now loads the real file three times against one document.

- **A fourth finding is a Worker this unit may not edit, and its own comment predicted this build.** `workers/front` asserts chrome-slot cardinality of exactly one on any `text/html` response and logs `chrome-slot-count` as an ERROR otherwise (`workers/front/src/index.js:147-183`); a partial has no slot by design, so every page-flip would log an error against a Worker behaving correctly. That file already passes remix3's frame partials through by a variant-scoped path check and says at `:126-128` that the exception is "deliberately variant-scoped … the PLP build (htmx loaders+PE) should generalize this deliberately when it does". The variant half is applied — the partial declares itself with `x-pm-partial: 1`, so the front Worker's rule is one variant-agnostic line instead of a second hardcoded prefix — and it is **inert until that line lands**. Diff in the handoff.

- **TWO reference defects on the same `<nav>`, and the second is the one that moves a number.** `renderPlp`'s `pageHref` (`packages/reference/render/plp.mjs:60-68`) claims in its own comment to "preserve the WHOLE condition (URL-as-receipt, ADR-0004 §5)" and carries only `page` and `n`; a query-only relative reference replaces the entire query (RFC 3986 §5.3, verified), so every page-flip drops `cache`, `run` and `profile`. From this arm's preset `/htmx/plp/?cache=cold` one click on "2" serves from the **warm** tier while the injected chrome — rendered server-side against the original search, outside the swapped subtree — still prints `cache: cold`. The address bar and the instrument disagree about one visit, in the flattering direction; `plp-paginate`'s measured step would also lose the `run` nonce and land in a different KV namespace than its priming load. Not patched from the variant (same reasoning as below); the variant's copy of the false comment is corrected and a guard leg pins the master's href shape so the reference fix cannot land one-sided. Diff in the handoff.

- **A reference defect found and deliberately NOT worked around.** `renderPlp` emits `rel="next"` unconditionally (`packages/reference/render/plp.mjs:134`), so at n=240 (`totalPages` = 1) the master's "Next" points at an empty page. It survived because **no test has ever rendered the PLP at any n but the default** — `renderPlp` has exactly one caller, `build.mjs:77`. Fixing it in the variant would have been a deliberate divergence at a condition the gate does not compare, which is the vacuous-guard shape this repo refuses; the variant reproduces the reference exactly wherever the reference can render, and the one-line fix is in the handoff for `packages/reference`'s owner. Same reasoning bounds `?page=`: the reference has no `page` option, so above page 1 there is nothing to be identical to.

**Reported, not applied — the exact diffs are in [`docs/handoffs/2026-08-28-plp-htmx.md`](handoffs/2026-08-28-plp-htmx.md).** That file was written to `~/Desktop/` and cited from here, which made this branch's gate loosening depend on a justification no reviewer could open — the exact thing the gate exists to prevent. It is committed now, with a header noting what the merge-review pass changed under it.

**APPLIED in the merge-review pass (2026-08-29), all in this commit:** the `packages/switcher/src/config.ts` registry change (`plp.variants: ["react-next", "htmx"]`, `plannedVariants` gone — "empty or gone", the editorial precedent); both origin-suite `expect(PERMITTED_NOISE["htmx"]).toBeUndefined()` assertions this registration was designed to break (`drift.browser.test.ts`, `editorial.test.ts`), rewritten to assert the entry's SHAPE — `attrPatterns: []` is the load-bearing half — with the `not.toMatch(/\s(?:data-)?hx-/i)` byte assertion above each one kept, since that is what actually keeps editorial free of `hx-*`; and **four** stale prose sites, not the three the handoff named: `variants/README.md:51-53`, `variants/README.md:71` (a different defect — it calls remix3's emptiness "the third", an ORDINAL that silently counts htmx), `variants/remix3/DIFF-TO-STARTER.md:179`, plus `docs/decision-map.md:231` and `docs/build-log.md:2279`, which nobody's list had.

**Still owed:** `workers/edge/src/index.js`'s five facet params (ADR-0005 §5) — now the surface's largest open item, since the rail, search and sort are CUT rather than shipped inert; and `packages/tokens/css/surfaces/plp.css`'s two unruled classes with the paired `OWED`-registry retirement in `tools/repo-checks`, which must land together or `master-styles-resolve` fails. The `packages/reference/render/plp.mjs` pagination fix is **done** — `renderPlp` takes `page` and gates `rel="next"`, so this arm's `page === 1 ||` escape is gone.

**Not done, and deliberately:** the origin suite was not run (single-tenant ports, three concurrent agents), so the JS-ON half is unproven here — that htmx's runtime performs the swap, that focus actually moves, that the composed origin routes `/htmx/plp/`, and that the served page's DOM matches the master through a real browser parse. Nothing is pushed and no PR is opened. No receipts were minted and no number is published: the byte figures above are pre-merge measurements of a surface that has none.

### `plp-data-plane` — narrative moved from the decision map (2026-09-25)

The decision map's `plp-data-plane` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT (2026-09-04), VERIFIED AND LANDED (2026-09-18)** — two branches off `9f24548`: `plp-page-ceiling` (step 0, one commit `fec4a29`, its own PR so the KV ceiling does not wait) and `plp-data-plane` stacked on it (the rest, one commit). The build paused at a session limit on 2026-09-04 with the code and records written and resumed 2026-09-18 for the verification half; its numbers are in the build log's phase entry and in this node's last bullet.

**Answer.** Landed, with the two open questions settled in the ADR-0005 addendum of 2026-09-04 and the policy made a mechanism rather than a note. The design went in front of a four-lens adversarial panel BEFORE code (`plp-design-critique`, 4 lenses / 33 findings / 6 kills, all read and answered); three kills changed the design and two were already right in code.

- **Step 0 first, on its own branch.** `handlePlp` floored `page` at 1 with no ceiling and wrote every miss through with no TTL, so `for p in $(seq 1 1000000)` minted one immortal ~10 KB entry per integer. The ceiling is applied on the way OUT (`serveData`'s `cacheable(payload)` predicate): a page past `totalPages` is still the honest empty "0" every arm renders, never stored, `x-pm-cache-state: none`. Applying it BEFORE the KV lookup would need R2 on every warm hit and erase the edge cell. `@pm/edge` gains its first vitest suite (turbo 33 → 34 tasks). Sabotage: predicate removed, 4 of 9 legs fail.

- **Q1: facets RECOUNT over the filtered set, the selected group's own filter lifted** — a count is what the click returns. **Q2: `PlpPage` grows `applied`** — every renderer draws the selected facet, chosen sort and search value from the payload, never the URL, so the client-cache arms cannot show one condition's controls over another's grid during an in-flight window; `settled` becomes `appliedMatches(payload, condition)`. The tray's shape is versioned by the KV key prefix (`v2:`) — without the bump, the default condition's pre-deploy entry would have crashed both arms after the deploy (a critique kill).

- **One implementation of the semantics.** `packages/reference/render/plp-query.mjs` — filter, ASCII-case-insensitive search over title or artist, five sorts (nulls last, committed-order tie-breaks), recount, slice — is imported by the reference renderer AND the edge Worker. `@pm/edge` is the third consumer of `@pm/reference` (ADR-0004 §2 addendum: the data plane is not a paradigm; its bundle is never a measured client bundle). The Worker had re-typed the reference's facet comparator and nothing compared the two.

- **The key-cardinality policy:** cacheable ⇔ `q` absent ∧ n ∈ {24, 240} ∧ page ≤ totalPages (of the filtered set). Everything else is served from R2, `none`. The URL half is ONE derivation (`plpWarmable`, @pm/measurement) for the Worker and the chrome's RUM `cacheState` tag; the bench runner refuses a PLP batch at any other n. Junk facet values are exact-match 400s against the snapshot's real sets, after the lookup (a junk key can never hit because it is never written); over-long values are refused before it. Empty values are absent (a GET form submits `sort=`). **The ceiling, measured with the real query module:** 37,182 keys / 0.162 GB / $0.19 of writes / $0.08 per month for the real crate under the adopted policy, against 4,548,342 keys / ~19.7 GB / $22.74 / $9.87 with n free, against unbounded before (prices fetched from Cloudflare's pricing pages that day; list prices). The honest residual: a junk request is one Worker call + one R2 read + one KV read-miss; a fresh `run` nonce on a cacheable condition is one KV write and one ~4 KB entry for an hour — time-bounded, not zero. **Unverified and flagged for Rob:** whether `pm-warm` is on the Free plan (1,000 writes/day), which would make the nonce dimension an outage vector rather than a cost line.

- **The controls, back in the master first, then both arms.** One href rule for pagination, facets, both forms' hidden inputs and every history write (`conditionHref`; re-typed in htmx and react-next, pinned equal): canonical order, defaults omitted, bare condition `?page=1`, form-submit encoding (`+`). Closes handoff §6.2(ii): a page-flip from `?cache=cold` stays cold. The strategy presets carry the visitor's whole condition (only `cache` moves) and the n knob drops `page` — both chrome defects the critique found. A junk filter is a branded **404 "No such filter"** on both arms, never the data-plane-down 503. An empty result has no pagination landmark (the arms-agree guard caught the reference and react-next disagreeing about page 1 of 0 the day the filters landed). The default sort is labelled **Catalogue order** — the crate is id-ascending, and the pre-cut master's "Popularity" was false.

- **htmx:** `hx-target`/`hx-swap` on the `.pm-plp` root, `hx-boost` on the FOUR navigation containers and never the root — a root-level boost would have boosted the 24 card links and swapped a PDP document into the grid (a critique kill, caught before a line shipped). The front Worker honours `x-pm-partial` (handoff §6.1): every page-flip was an ERROR log against a correct Worker until this line. **react-next:** `PlpCondition` is flat (`genre/style/format/sort/q`, plus `profile`, carried in hrefs and never in the tray path or a cache key); `PlpArticle({ payload, carry, onNavigate })` is one seam for every control; `q` is normalized client-side by the same rule so `settled` can be true.

- **Instrument gaps (step 4):** the warm-tier guard now covers PAGE paths that proxy the tray — `/htmx/plp` AND `/react-next/plp` (react-next forwards the page URL's `cache`/`run`; `a11y.test.ts` carried a live un-nonced instance that planted the canonical key on every deployed smoke). Two shapes it excludes are pinned (an `href="…"` assertion; `/plpx`).

- **Origin suite gains `plp.test.ts` (HTTP) and `plp.browser.test.ts` (Playwright):** a facet click, a search and a sort each filter IN PLACE on both arms with JS on (a survival marker proves no document load; the address bar carries filter, column and nonce) and as real navigations with JS off; both arms serve one normalized DOM for one filtered URL through the composed origin; junk 404s on the pages; the partial passes the front Worker chrome-free.

- **Verification (2026-09-18):** origin suite alone, fixture 573/573 and crate 573/573 (one timeout-shaped failure on the first fixture run — `bench.browser`'s reproduce leg at its 600 s cap — re-run before belief and gone; the bench runner's uncapped CDP `send()` is the flagged, pre-existing mechanism). The react-next junk-filter 404 is Next's `__next_error__` shell — the PDP 404's recorded shape (DIFF-TO-STARTER item 25), read off a held plane and pinned in `plp.test.ts`; the two `not-found.tsx` docblocks that had claimed the shell keeps the chrome slot were corrected. Sabotage table 36 rows → 35 caught after four test gaps closed — three claims tested only by equality with the module under test (artist match, committed-order ties, the route calling the normalizer), one seam line with no in-process guard (`loadPlp` 400 → null), plus `@pm/bench-runner`'s first test task for the n fence (turbo 34 → 35); the honest miss is the front Worker's `x-pm-partial` pass-through, whose only observable effect is the absence of an ERROR log, proven by the crate run's log (0 slot-count errors on `/htmx/plp/`). The crate run's local KV: 21 keys, 0 with `q=`, 0 with n ∉ {24, 240}, every PLP key nonced with a 3600 s TTL except the runner's own readiness probe. verify-slice: 20 raw findings across the four lenses (6 + 7 + 2 + 5); 13 real defects fixed, each with a guard a second sabotage round proves bites; one recorded in the ADR addendum rather than fixed (the RUM `none`/`default` blend on hand-typed conditions); one resolved by the build-log entry landing (this node had cited it before it existed). The proof of one fix also found the suite's own race against htmx's 20 ms settle window. Final suites on the final tree: fixture 579/579, crate 579/579. `pnpm run check` 35/35.

### `security-floor` — narrative moved from the decision map (2026-09-25)

The decision map's `security-floor` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT AND VERIFIED (2026-09-18)** — branch `security-floor` off `17b39ce`, one commit. Numbers in the build log's Phase 15 entry "The floor the blog already had, and the roster the collector never checked" and in this node's last bullet.

- **The floor is part of the held-constant transport (ADR-0004 §3 addendum).** `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin` (the blog's value), `x-frame-options: DENY` — on EVERY response the composed origin serves, identically for every variant, so it can never be a per-variant variable and it cancels in every comparison. One definition (`workers/front/src/security-floor.js`), two mechanisms because the front has two serving paths: the script's exported `fetch` wraps everything `route()` returns (proxied pages and fragments, the data plane's JSON and images, the blog, the Worker's own 404 and 502 — a property of the seam, not of each return statement), and `build.mjs` writes `dist/_headers` from the same module for the assets-first paths the script never sees (`/`, `/methodology/`, `/how-it-was-built/`, `/_pm/*`, `/pm/*`). Cloudflare's docs (fetched 2026-09-18): the file applies to asset responses only and is never served — the first shown by sabotage row F1 (script wrapper removed: proxied pages lost the floor while assets kept it), the second pinned by the suite (`/_headers` 404s); both true of local `wrangler dev` (probed on a held plane). `set`, never `append`: an upstream cannot weaken the floor; the blog's stronger set survives because the floor only adds.

- **Wire cost, measured and named — and invisible to the ruler (ADR-0001 addendum U).** 106 bytes uncompressed per response on HTTP/1.1 (`/vanilla/editorial/` header block 202 → 308 B on the local plane; the figure is derived from the module by the front's test, not typed). HPACK's static table (RFC 7541) holds none of the three — literals once per h2 connection, one index byte each after; QPACK's (RFC 9204) indexes `nosniff` (61) and `x-frame-options: deny` (97). None of it reaches a published byte cell: Resource Timing's `transferSize` replaces the header component with a constant 300 octets by spec ("as that might expose the presence of certain cookies") and Chromium implements exactly that (`kHeaderSize = 300`) — both fetched 2026-09-18 after the skeptic lens caught the first draft saying the opposite. Add or remove any header and no KB cell moves; the floor is identical on every variant regardless, so it cancels in every comparison; the chrome constant (a with/without delta) is unmoved. Flagged for the measurement pass: addendum O's "headers-included `transferSize`" wording rests on the same misreading.

- **The beacon roster — one list, three consumers, no copy.** `@pm/measurement` gains `VARIANT_PREFIXES` (the eight dispatched prefixes) and `SURFACE_NAMES` (the registry's keys), plus `HOME_TAGS` (`singleton`/`home`, the home HUD's own pair) and `SMOKE_TAG` (`ci-smoke`, reserved for the suite's real, undeletable AE points). The front Worker DERIVES its prefix → binding table from the prefix list (a variant it dispatches is a variant the collector keeps, by construction); the switcher registry is held to the surface list by `satisfies` at compile time and by a runtime pin; the edge collector 400s a `variant` or `surface` off the roster before the byte bound, naming the tag, and writes nothing. The measurement client's `"unknown"` fallback is deliberately off the roster — a chrome that lost its data attributes is exactly the point that must not become a sampling key. The front gains its first test task (turbo 35 → 36): the dispatch table against `wrangler.jsonc`'s `services` — the roster's one INDEPENDENT oracle (the roster-vs-itself tests move together when a prefix is dropped; this does not). Rate limiting stays at `domain-cutover`; this is the half a rate limit cannot do.

- **Two auth nits.** The lockout increment is ONE `INSERT … ON CONFLICT DO UPDATE` whose `CASE`s express the window test, the increment and the threshold against the row being updated — proven on real SQLite (`node:sqlite`) with the committed migration DDL: four failures do not lock, the fifth locks for thirty minutes, a failure past the ten-minute window restarts at one, twenty increments count twenty; and exercised end-to-end by the suite's twenty-parallel burst against the plane's D1 (the lockout fires, no cookie is minted, the twenty-first attempt meets the 429) — a leg that does NOT distinguish the statement shapes on local D1: with the old read-modify-write restored it passed three runs of three (sabotage A1s1–3), so the unit test's one-statement and twenty-interleaved-increments legs are the discriminating proof, and the record says so. The CSRF token is compared through the same constant-time helper as the credential; Node has no `crypto.subtle.timingSafeEqual`, so the unit test installs one with workerd's contract (TypeError on a length mismatch) and RECORDS its calls — a boolean-only test would pass against `===` too.

- **Not done here, recorded:** the CSP (above); beacon rate limiting and Cloudflare Access on `/blog/admin/*` stay at `domain-cutover` (sub-decision (c); ADR-0009 §5); the beacon's `cacheState`, `environment` and `location` tags are still bounded by bytes only; the deployed plane's h2/h3 header bytes are stated from the RFC tables, not measured (the plane deploys on merge); the lockout burst leg is local-only by design — on the deployed plane it would write production D1 rows and lock a real IP, and the smoke never writes to production.

- **Verification (2026-09-18):** `pnpm run check` 36/36 (36 tasks — the front's first test task joins). Origin suite alone, fixture 622/622 and crate 622/622 (143 s each; 43 new legs), then again on the final tree: fixture 622/622 and crate 622/622 (143 s each), zero leftover processes. Sabotage round 1: 23 rows, 29 guard checks caught, 2 controls passed as designed, 3 missed — one row three times: the suite's twenty-parallel burst leg cannot tell the atomic increment from read-modify-write on local D1 (the racy code reached the threshold too); the unit test on real SQLite can (its one-statement and twenty-interleaved-increments legs fail under RMW), and every sentence that had called the suite leg "the proof" was rewritten to say so. verify-slice: four lenses, 8 raw / 6 distinct findings, none refuted, all folded — three lenses converged on that same over-claim; the skeptic lens caught the record saying the floor rides "inside every byte cell" when Resource Timing's `transferSize` replaces the header component with a constant 300 octets by spec (Chromium `kHeaderSize = 300`; both fetched and re-verified) — the reverse of the drafted sentence, now corrected in five places; plus three code defects in the sniffer and the burst leg (three-byte GIF test, 0 × 0 accepted; JPEG fill bytes refused; a 1-in-126 bucket collision), each fixed with a fixture. Round 2 over the fixes: 6 rows, 5 caught first time, the sixth (the eight-byte PNG signature) missed until its fixture existed, then caught. Seams lens: zero defects. Wire cost read off the plane: 202 → 308 B per response on HTTP/1.1, the 106 the module spells. Floor probed beyond the suite on HEAD, a 500, an htmx partial, a remix3 frame, brotli assets, a 301 and a variant 404 — all carry it.

### `checkout-measure-prep` — narrative moved from the decision map (2026-09-25)

The decision map's `checkout-measure-prep` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT AND VERIFIED (2026-09-24)** — branch `checkout-measure-prep` off `7771bdc`, one commit. Numbers in the build log's Phase 15 entry "The form that could not place an order, and the summary that moved the form" and in this node's last bullet. No batch is minted here; that stays with the measurement pass.

**Answer.** Six changes, each with a guard a sabotage proves bites; two of them changed what the unit thought it knew.

- **The leg — JS on, JS off, and the gate.** `checkout.browser.test.ts` drives every LIVE checkout variant (the registry, not a name) in Chromium at the composed origin: the cart contract on this surface (a stored cart populates badge, label and summary on load, priced by the reference's OWN `formatPrice`; the shipping radio moves the total by exactly the price its served LABEL states; the empty cart fetches nothing; a malformed value is the empty cart), the controls (real keystrokes format the card and expiry; an invalid submit renders ten links and MOVES FOCUS; fix-and-resubmit announces without leaving the page; the chrome survives under a 4× CPU throttle), the geometry (below), and the JS-off path (native validation blocks an empty submit; a filled form's native POST lands on the placed page through the 303, and a reload re-GETs it). `checkout.test.ts` is the HTTP half; `drift.browser.test.ts` gains a checkout block — the served form page and the placed page against the committed masters by normalized DOM and by pixels under all three profiles, the a11y block's shape — which is the first drift-gate leg the served checkout has ever had; `security-floor.test.ts` gains the placed page and the 303 as a new response class. 47 new legs (622 → 669): `checkout.test.ts` 11, `checkout.browser.test.ts` 13, `bench-checkout.browser.test.ts` 11, `security-floor` +2, `drift` +10 — counted from single-file runs, not the suite log.

- **The three ids, what each cell measures under the ruler's gate, and a fetch the first draft denied.** The pinned `web-vitals` (5.3.0; the client passes no options) observes `event` entries at its default 40 ms `durationThreshold` plus the `first-input` entry, always — so an interaction under 40 ms is invisible to INP unless it is the visit's FIRST input, and on a fast paradigm the cell IS that first input (the correctness lens read the bundle; the plane confirmed it). Every entry is built so its first input is the interaction its name promises. `checkout-type-card`: the field focused PROGRAMMATICALLY, then sixteen real keystrokes, settling on the formatter's output — the first draft clicked the field first and the cell was that click (24 ms, no handler; measured). `checkout-submit-invalid`: one click on the pristine form, settling on the focus move — the §7 contract interaction. `checkout-fix-and-submit`: two REAL clicks with ten `fill`s between them (`fill` is CDP `insertText`: `input` events, no key events, 0 event-timing interactions across ten fills, measured); the first click always counts and the second only past 40 ms, so on a fast paradigm the cell reads the invalid submit and separates from it only where the recovery's handler is slow enough to be seen — the condition the surface's spotlight names. A programmatic priming (`requestSubmit()` + fills, one real click) was built, measured and REJECTED: CLS 0.099 — the summary's render is a shift no input precedes (the fills' clean-ups are excluded by their own trusted `change` events either way; the skeptic lens corrected the attribution). **Both submit ids FETCH**: every field error and the summary title draw U+26A0 as a non-colour cue, Familjen Grotesk lacks it, and fonts.css serves a one-glyph face scoped by `unicode-range` — `PMWarnGlyph.U26A0.woff2`, 1,212 B body, 1,512 B `transferSize` (the spec's 300-octet header constant, ADR-0001 addendum U), asked for on the first error render. Identical bytes from every variant's own tokens tree: glyph mass, invariant by construction. **The fit template is keyed by SURFACE and publishes ONE interaction (ADR-0001 addendum T)** — the measurement pass picks which; the recommendation is `checkout-submit-invalid` (the contract interaction, one click, one input), and its declaration is then `interactionFetch: { kind: "constant" }`; a keystroke pick would declare `"none"`; the other two stay drivable and unpublished (the `pdp-add-to-cart` precedent). The first draft of this node told the pass to declare all three, which the template cannot express (the conformance lens). `bench-checkout.browser.test.ts` drives each id through `measureVisit`, derives the face's size from the served fonts.css and pins body + 300, and drives each entry again under observers to pin its FIRST input (keydown on the card; pointerdown on the button; fills no input). Six measured visits on the held plane after the redesign: INP present in every one (desktop 16 / 48 / 40 ms, slow-4g phone 8 / 64 / 48 ms — type-card / submit-invalid / fix-and-submit; the keystroke id reads keystroke-sized where its first draft read the click's 24–32 ms) — one run each, load-sensitive, NOT published; CLS 0 in all six.

- **The geometry: a fixed cell, not a floor.** `cart-summary.css` held `min-block-size: 12rem` — a FLOOR — and the empty state already stood at 234 px (14.6 rem; content-box), so a one-item cart changed nothing and a three-item cart grew the region 25 px and moved the form below it on the phone profile: layout-shift **0.0214** measured on the held plane before a line changed (desktop: the total row alone moved, 0.0011). Now the region is a three-row grid whose middle track is FIXED at three lines — `calc(3 * var(--cart-thumb) + 2 * var(--space-stack-sm))`, 9.25 rem at a 16 px root, derived IN the sheet (the first draft wrote the literal and called it derived; the conformance lens said so) — and the empty copy and the list SHARE that cell (`grid-area: 2 / 1`; the served list is `:empty` and hidden, so the copy owns the cell alone), so population changes nothing outside the cell; past three lines the list scrolls inside it. The total's price slot reserves `10ch` — every total up to $99,999.99; the whole crate at quantity one sums to $17,416.36 — because a right-aligned span widening from "—" to "$1,234.00" moves its own start edge and the metric counts it (sabotage row G3 proves the leg sees exactly that). Measured after: layout-shift **0** on both profiles with 1, 3 and 6 items, form and summary boxes unmoved. **What it costs, stated:** the empty state is 25 px taller everywhere (234 → 259 px), and the desktop summary shows three lines before scrolling where it showed five and a half. Rejected: a fixed height on `.pm-cart` itself (fragile — the empty copy's wrapping at narrow widths would overflow it); two track heights by viewport (two knobs for one rule); moving the summary below the form on phones (abandons the design's "what am I buying, then the form"). The browser leg HOLDS the catalogue fetch across first paint so the shift, if any, is observable rather than raced, drains the observer with `takeRecords()` before reading (the unit's first probe read 0 by reading too early), and asserts the boxes before the metric so it does not depend on the metric.

- **Where the JS-off order lands — and why the form no longer posts to itself.** The paradigm answers the native POST with a **303** to `checkout/placed/`, a second committed master of the surface (re-typed in the variant like the form — checkout is benchmarked; DIFF-TO-STARTER decision 8), `noindex`, no form, the plaque stating what the request carried: only the shipping method has a `name`, so `shipping=…` is the whole body, and the Worker never reads it — not reading it is the stronger form of the plaque's promise, so the page cannot and does not name the method chosen. The first draft matched `POST /vanilla/checkout/`; its pre-merge pin passed and the plane kept answering 405, because on a static-assets Worker a request whose path has an asset behind it is answered before the script runs (Cloudflare's routing page, fetched 2026-09-24: "Cloudflare will first attempt to serve static assets if one matches the incoming request"; "If an appropriate static asset if not found, Cloudflare will invoke your Worker script" — the typo is the page's; the page says nothing about METHODS, and that a POST is matched the same way is what local wrangler 4.110 does, measured — the deployed plane's answer is the post-deploy smoke's `checkout.test.ts` legs to give). ADR-0004 gains the addendum that qualifies its "one-line forwarder" sentence, so the next static variant does not ship the 405 again. So the form's action is a RELATIVE `place-order/` — each variant answers its own — a path with nothing in dist behind it, the ONE request that reaches the script; every page GET stays assets-first. Rejected: `assets.run_worker_first` on the page path (a script invocation on every GET of the measured page, to answer a POST nobody measures), a `_redirects` file (method-blind), a 200 on the POST URL (a refresh would re-post). Every other non-GET keeps the binding's 405; a GET of the endpoint is a 404, not a page. Residual, accepted and named: the placed page carries the chrome slot like every variant page, so a JS-ON visitor who types its URL sends a `surface=checkout` beacon from a page that is not the form; the JS-on form never navigates there, so the path is JS-off-only in practice.

- **The trio guard, and the parameterisation.** `cart-trio-identical.test.ts` extracts `read`/`count`/`renderCount` from every vanilla script that carries them — FOUR (a11y.js is the badge-only fourth), derived from disk — and holds them identical after comment stripping and whitespace collapse, each compared to the others and never to the contract module they re-implement (the self-referential-oracle class unit 6 named). `codeOnly` moved to `test/lib/code-only.ts`, shared on purpose: a lexer with one right answer is not an oracle, and two copies of a lexer diverge. `pdp-controls-wired.test.ts` runs ONE block over a `{ surface, masters, enhancements, minControls }` table for the PDP and the checkout; the two surfaces differ in KIND only where the registries say so (`SERVES_NO_SCRIPT_STATE` decides the markup-state leg's shape), and the placed master is held to "renders no control and no script-only state" as a checked claim rather than fed to a loop whose non-vacuity floor it would rightly fail. One honest limit, found by a sabotage the parameterisation did not cause: the state leg is `includes`, which cannot tell a READ of `aria-pressed` from a WRITE — sabotaging only the zoom's `setAttribute` passed because the `getAttribute` on the next line still names it; replacing both fails. Pre-existing shape; the behaviour half is `pdp-controls.browser.test.ts`.

- **The coupled tokens, closed.** `.pm-checkout__form { min-inline-size: 0 }` — a grid-item guard against min-content overflow that acts in the ≤52em `1fr` track (Grid §6.6: a bare `1fr` implies an automatic minimum, content-based) and is a no-op in the desktop `minmax(0, 36rem)` track (the automatic minimum is already zero); the first draft's comment named the desktop track as the mechanism and the lens fetched the spec; NO observable effect at any viewport from 320 px up today (probed: scrollWidth 320 at 320), said so in the sheet — and `.pm-checkout--placed { max-inline-size: 36rem }` for the placed page's reading column. The OWED registry is now EMPTY and kept as a mechanism: rule and retirement in one commit, as the completeness leg demands.

- **Verification (2026-09-24):** `pnpm run check` 36/36 (no new turbo task — the new test files join existing ones; `@pm/bench-runner#test` is now uncached). Origin suite alone on the FINAL tree, run last with nothing edited after it: fixture **669/669** (144.0 s) and crate **669/669** (144.2 s), no crash, no leftover process, the recorded eight `chrome-slot-count` 404 shapes and nothing of this unit's (one comment-only edit in `bench-checkout.browser.test.ts` followed the runs — the build log says which). Earlier in the day the same suite ran green at 666/666 in both modes on the pre-verify-slice tree (fixture on the second attempt, crate on the fifth: two wrangler front crashes, a stale-port pre-flight, a ten-minute cap, and one 665/666 whose single failure was the pre-existing bench leg's INP beacon arriving null under load), and the skeptic lens rightly refused those runs as verification of the reviewed tree. Front log across the green runs: the recorded eight `chrome-slot-count` 404 shapes, nothing of this unit's. Sabotage round 1: 39 rows — 36 caught, 2 controls passed as designed, 1 missed (W2, the half-replaced zoom attribute; W2b with both occurrences caught); round 2 over the verify-slice fixes: 8 rows — 6 caught, 1 control, 1 missed (S2, a row the cascade overrode; S2b caught); round 3 over the skeptic's KEY leg: 1 caught + 1 control. Two defects in the runner itself, both exposed by a control row (a login shell that ran nothing, exit 126 on every row; stale backups that rewound three files between rounds) — the sabotage file records both. verify-slice: four lenses, 22 raw / 20 distinct findings, 13 refuted by the lenses themselves, none refuted here, every one folded — the correctness lens found two ids measuring the wrong interaction under the ruler's 40 ms gate; the conformance lens found the record instructing a per-id fit declaration the template cannot express; the seams lens found an uncached cross-workspace guard and the rewind; the skeptic lens found the record's green runs predating the fixes, the trio guard skipping its one free variable, and a CLS attribution half wrong. The build log's entry carries the whole list.

### `workers-hardening` — narrative moved from the decision map (2026-09-25)

The decision map's `workers-hardening` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT AND VERIFIED (2026-09-25), in two commits** — `workers-hardening` off `c7ed377`, merged as PR #48 (`f66d464`) ahead of its verify-slice pass at Rob's request so unit 9 could start in a worktree; then `workers-hardening-verify` off `f66d464`, the completing commit that folds the pass, its sabotage round 2 and the final suite pair, and rewrites this node's last bullet. Numbers in the build log's Phase 15 entry "The gate that nothing re-proved, and the plane no one had typed" and in this node's last bullet. No receipt is minted here.

**Answer.** The gate becomes a pure module with a committed fixture per refusal class; the plane is checked as the JavaScript it is; the three lines are fixed with their own legs — and the typecheck paid for itself before the unit was over.

- **The gate is `workers/front/lab/publish.mjs`: pure, importable, 47 throw sites, and build.mjs is the composer.** `bundleFromReceipt`, the receipt loop's provenance/estimator/identity/fence/template refusals (`admitReceipt`), the per-surface batch integrity (`assertBatchIntegrity`), the chrome-constant refusals with the addendum-N identity gate (`admitChromeConstant`) and the registry refusals (`labSurfacesOf`) moved verbatim, with the eight throws that are about the HOME PAGE's composition (a malformed manifest, the default profile's cells, the `%%` markers) staying where they are: 47 + 8 = 55, the count unchanged. No filesystem, no `node:` import — the renderer and the hash arrive as dependencies, so the test drives the same object the build does. build.mjs went 1,310 → 603 lines. Proven, not assumed: the front dist before and after the refactor is BYTE-IDENTICAL (`diff -r`, twenty files; `build.json` and the how-it-was-built page excluded because they carry the working tree's dirty flag), and so is the generated `lab-bundles.js`.

- **One committed malformed fixture per refusal class, derived from one valid receipt by a table that is the mutation AND the message.** `workers/front/test/fixtures/publish/generate.mjs` holds 60 rows (`CASES.length`; 52 at #48, eight added by the verify-slice pass for the branches its mutants slipped past); each names its throw site, breaks one field of the valid PDP receipt (four registered variants, three runs per column — three so a median can honestly hide a stray run, the mechanism two classes are about) and states the regex the refusal must throw. 52 files on disk (`ls | wc -l`: 40 receipts, 12 chrome constants; 1.5 MB, 70 KB gzipped, `linguist-generated` so GitHub folds them), held byte-identical to the generator's output by a test leg. `test/publish-refusals.test.js` (74 legs, a single-file run) drives every row through the real registry, the real `FIT` and the real `fencedPathOf`; template refusals mutate `FIT.pdp` inline (a template is code), batch refusals pair a mutated second profile with the valid one, the chrome-constant rows run against a stand-in renderer whose fragment the valid constant's sha256 was minted from, and the band rule is asserted as the outcome it is (`bandsOverlap: true`, no sentence, the interaction figure still on the bundle). **Non-vacuity three ways:** the table is not empty and the on-disk set equals it both directions; every throw in the module carries a `// refusal: <site>` marker and the marker set equals the rows' site set in BOTH directions — a map, read from the source, not a count (the first commit counted labels, and the skeptic lens's mutants showed 19 of 29 condition-level defects passing it); and CONTROL rows that must pass: the valid fixtures admit and publish a sentence with bands, the three receipts the plane actually publishes admit through the very call build.mjs makes, a chrome constant minted from the REAL renderer over those receipts' bundles admits and is refused for a fragment the build does not ship, and an upper-case `ZSTD` token admits. The runner's own Zod schema holds the fixtures to the receipt shape in `tools/bench-runner/test/publish-fixtures.test.ts` (37 legs; three rows flagged as deliberate schema refusals and asserted to fail it). Stated limit: Zod strips unknown keys, so an INVENTED field name is not caught by that leg — the real-receipt control and the gate's own typedef are what hold field names.

- **The plane is checked as JavaScript — by tsconfig, not by pragma (ADR-0004 addendum).** `workers/{edge,front,blog}/tsconfig.json` extend the base with `allowJs` + `checkJs` over `src/**/*.js` (the front's `lab/*.mjs` too); `checkJs` in the config rather than `// @ts-check` per file because a declaration that can be omitted is an opt-out. Runtime and binding types are wrangler's own, generated by each Worker's `typecheck` script (`wrangler types cloudflare-env.d.ts && tsc --noEmit`) and gitignored — a renamed binding fails the same day, and no 14 k-line generated file sits in review (the react-next precedent, deliberately not followed). The blog's browser code (the CodeMirror editor, the footnote enhancement) is a second target under the DOM lib. Types are JSDoc at the seams: D1 rows cast to the row their SQL selects (the committed migrations column for column), every request body read as `Record<string, unknown>` and checked field by field, result unions (`Saved | Refused`) where the routes used to check `.ok` by convention. Baseline before a line was annotated: 99 errors on edge (56 of them in `packages/reference/render/plp-query.mjs`, the spec module the edge Worker serves — now JSDoc-typed, so the Worker's calls are checked against the spec's signatures), 20 on front, 427 on blog. `pnpm run check` grows 36 → **40**: the three typechecks plus `@pm/front#build`, which the front's typecheck depends on because it imports the generated `lab-bundles.js` (the astro precedent; verified by deleting the directory). Derived, never typed.

- **What the check found, so the rule is priced against something.** (Five behaviour changes rode the annotation pass, all stated in the build log: the four below and `readJson` turning a JSON `null`, array or primitive body into `{}` where a `null` body was a 500.) `workers/front/lab/fit.d.mts` — the declaration a TS consumer reads the fit templates through — lacked `interactionId`, a field the template set and the build read since 2026-08-28; the "second copy of the shape" hazard the file's own header names, now closed by holding `fit.mjs` to its declaration with `@type`. The edge Worker's PLP handler returned `serveData`'s `Response | null` straight through where the route promised a `Response` (a throw now at the one branch that cannot happen). The blog's `savePost` accepted a number into a TEXT column through a hand-made PUT (the editor never sends one; dropped now with the file's own warning shape). None moved a served byte; all three are the class a reviewer flags in the first minute.

- **The three lines.** The beacon collector answers 400 `value must be a finite number` for an absent, null, string or infinite value and writes nothing — before, `doubles: [finite ? value : 0]` recorded a fabricated point (unit legs assert the DATASET, with a CONTROL that a measured 0 still writes as 0; a suite leg is the HTTP half). Infinite is proven with a RAW out-of-range literal (`1e999`, which `JSON.parse` reads as Infinity): JSON has no NaN or Infinity literal and `JSON.stringify` writes both as `null`, so the first commit's "NaN"/"Infinity" legs had sent null and proven the `typeof` half twice (verify-slice, correctness lens); NaN cannot arrive over JSON at all and is asserted to be the body-is-not-JSON 400. The prompt's own cite drifted: `grep -n 'Number('` finds only the PDP id parse; the coercion was the ternary. The blog's `esc()` escapes the fifth character (`'` → `&#39;`) like the six others — the seven escapers are `grep -rlE "function esc|const esc =" --include='*.mjs' --include='*.js' --include='*.ts' packages variants workers`, and `grep -l '&#39;'` over them read 6 before, 7 after; every call site was in a double-quoted attribute or text (`grep -rnE "='[^']*\$\{"` over `workers/blog/src`: no template — the one hit is `html.js`'s own comment quoting the pattern), so this is defence in depth, not a fix for an exposure. The cold PDP read is **recorded, not indexed**: the alternative — one object per release written at seed time — needs every plane re-seeded before the Worker can read it, and the deployed bucket's re-seed is a credentialed manual step, so until it ran every cold PDP read would 404. The parse is bounded (one R2 read + one JSON parse per `?cache=cold` or per first request under a `?run=` nonce) and OFF the published path (the warm column never reaches R2; the PDP's request-time variants fetch the tray server-side without forwarding the knob — `measurement-pass`), and its cost is measured below.

- **Verification (2026-09-25):** `pnpm run check` **40/40** (36 → 40: the three Worker typechecks and `@pm/front#build`; derived). Origin suite ALONE: fixture-1 669/670 (the one failure is `bench.browser.test.ts`'s INP beacon arriving null on a `body-click` run — the pre-existing bench-timing flake class, issue #16, in a file this unit does not touch), fixture-2 **670/670** (143.8 s), crate-1 **670/670** (143.8 s); 669 → 670 by the beacon-value leg. Sabotage round 1 (`docs/prototypes/workers-hardening/sabotage-2026-09-25.md`): 27 rows — 22 caught, 5 controls passed as designed, 0 missed; among them the prompt's own "Done means" typo (a result-union field renamed in `db.js` fails the blog typecheck), an inverted refusal per gate function (each fails its fixture), a new refusal with no row (the throw-site count leg), a fixture deleted, a fixture hand-edited, a row deleted, a row's mutation made a no-op, the composer skipping a gate call, a binding-name typo, `generated/` deleted with and without turbo (ts(2307) without; green through turbo because build runs first), the fit-declaration drift re-created, a pragma-less new file with an implicit-any parameter, the beacon coercion restored, the escaper's quote dropped, a schema-required field removed. The cold PDP read, measured on a held crate plane (`probe-pdp-cold-2026-09-25.txt`): edge Worker direct, `?cache=cold` median **4.7–4.9 ms** against a KV hit's **1.0–1.1 ms** — the whole-tray read and parse (967,527 B) costs **~3.6–3.8 ms per cold request**, repeatable across two runs and the same delta through the front (5.9 vs 2.3); a first request under a fresh nonce (the priming miss) 5.6–7.7 ms. On the plane: the beacon answers 400 naming `value` for an absent, null and string value and 204 for `0` and `1234.5` (curl). **verify-slice** (four lenses, 64 min): 13 raw findings, 11 distinct, 1 refuted here (a mid-pass read of markers the commit had already replaced), every other one folded — the throw-site COUNT was not coverage (19 of 29 condition-level mutants passed; now a marker MAP plus eight rows), the beacon's non-finite legs sent `null` on the wire (raw `1e999` now, unit and plane), no committed chrome constant meant the real renderer was never run through the identity gate (a control does now), the front's `keyof Env` cast hid a sibling-binding typo (typed to `Env` now), the bundle's row names were `string` not the switcher's union (bound now, and the suite's third copy of the list retired), the composer is outside the typecheck program (stated in the ADR with its price), and typed numbers three lenses caught (rewritten with the commands that yield them). **Sabotage round 2** over those fixes: 19 rows — 15 caught, 1 control, 3 missed: two stated before they ran (Zod strips an invented key; a suite-side list the typecheck cannot see) and one weak row (R15: the renderer already returns the bare fragment) re-run as R15b and caught. **Final tree:** `pnpm run check` 40/40; the final fixture and crate runs are the last two lines of `docs/prototypes/workers-hardening/suite-runs-2026-09-25.md` and the build-log entry, run on this tree with nothing edited after them but that table and the two sentences that quote it.

### `a11y-section` — narrative moved from the decision map (2026-09-25)

The decision map's `a11y-section` node was compacted on 2026-09-25 (unit 9 of the
2026-08-29 audit) to the shape the map's own header states — the question,
the decisions with their tradeoffs, and what is owed — and the map links here.
The paragraphs below stood in that node until then and are moved here
verbatim, in their original order; a line the node kept whole is not
repeated, and where the node kept only a bullet's leading sentence, the whole
bullet is here.

Status: **BUILT (2026-09-03)** — branch `a11y-section` off `0233451`, one commit. `/vanilla/a11y/`, `/vanilla/a11y/element-demos/` and `/vanilla/a11y/mode-demos/` serve through the composed origin in both snapshot modes; the footer's last dead link resolves from every store page; `SURFACE_CONTROLS.a11y.variants` is `["vanilla"]` in the same commit; home's PM‑005 row reads Public today. The before/after probe: with the a11y directory absent from the vanilla dist the composed origin answered `404` for `/vanilla/a11y/` (the assets Worker's own not-found — exactly main's state, where the directory has never existed); with it present, `200` with `class="pm-a11y"`, the chrome injected, the singleton reading sentence, one current cell and no offer. The origin suite holds all of that on every run.

- **One renderer, two heads — for a variant-hosted singleton this time.** The vanilla variant does NOT re-type the three pages: `variants/vanilla/render.mjs` renders them with `@pm/reference`'s own `renderA11y*` under the variant's head (its asset base, the master's own sheet list handed back through a callback), its chrome slot and one script — `@pm/vanilla` is the second workspace to declare `@pm/reference` (ADR-0004 §2 addendum, 2026-09-02; `pnpm-lock.yaml` +3). The re-implementation rule (ADR-0003 §1) exists so paradigms are compared on identical markup; this section compares no paradigms. `shell.mjs` `page()` grew the two ✂ lines as options (`slot`, `scripts`) and a `head` callback, all default off — the regeneration test holds every committed master byte-identical, and the sabotage pass flipped each default to prove it fires. DIFF-TO-STARTER decision 6.

- **Specimens are wired, not exempt.** Every button in a compare box or a stage is the store's own component shown for its rendering; a press answers in the page's own visible `role="status"` line — one per compare and per mode (`[data-pm-a11y-response]`), never the shell's `[data-pm-status]`, which `masthead.css` sizes 1×1 and clips. Both halves of that were defects the verification pass found and are guarded: the shell's region answers a screen-reader user and leaves a sighted pointer user with a button that visibly does nothing, and one page-level line leaves the answer up to three viewports above the control. It names the demo, the side and the press count, so no two specimens and no two presses produce the same string — a live region does not re-announce text that has not changed, and the target-size walkthrough invites repeats. It names itself a specimen — a button that does nothing when pressed is the dead-control state whatever page it sits on. The live-region demo writes into its own two slots (role="status" vs a plain element) and NEVER the shell's — routing the DS-OFF twin there would announce the silence the exhibit exists to show. The forms demo's field is served in its error-wired state as a STATIC specimen (a checked registry entry, not a skip; live validation on one twin would break "differs only in accessibility"). The cart badge populates from storage on all three pages — the fourth vanilla `read()`, read-only.

- **Guards, each sabotage-proven and restored from a backup copy** (the table is in the build log): identity after the delivery strip, exactly one slot + one script, sheet order + existence, noindex on element-demos alone, twins closed/label-first, toggles unpressed + caveat ×3 (`variants/vanilla/test`); every rendered and sheet-promised script-only state written or registered, every control reached, toggle/stage adjacency, the badge-only self-proof (`tools/repo-checks` pdp-controls-wired, a11y block); the real script driven over the real pages — slots, silence, additivity, specimens, badge incl. the uniqueness clause, emulation ≡ seam (`a11y-controls-behave`); at the seam — three 200s with the chrome stamped for the page, noindex, closed twins, caveat as content, sheet order + every asset 200 from the variant's tree, the footer from every variant, the 307 slash rule, PM‑005 (`a11y.test.ts`); in a browser — JS-off Tab order never enters a closed twin and does once opened, JS-on slots/silence/specimen, emulation moves computed style inside its stage only, a real reduced-motion or forced-colors preference wins over the toggle in both directions, the badge (`a11y.browser.test.ts`); and the drift gate — normalized DOM under NO_NOISE + pixels ×3 profiles for all three pages against the committed masters (`drift.browser.test.ts`).

### The map that had become the record, and the guard its own header asked for (2026-09-25)

The 2026-08-29 audit put this eighth: `docs/decision-map.md` is loaded in
full into every session, and its own header — restated that day because the
old rule was false — says what a node is: the question, the answer as
decisions with their tradeoffs, and what is owed, with evidence, narrative
and measured numbers in this log and LINKED, never repeated. It then
deferred the enforcement. The paragraph it carried, verbatim, because this
entry is where it now lives:

> Canonical planning artifact. **Loaded in full into every session**, which is what makes its size a real cost rather than a tidiness preference: at ~182 KB (`git cat-file -s HEAD:docs/decision-map.md`) it is roughly 45k tokens of every session's context before any work starts.
>
> **The rule, restated 2026-08-29 because the old one was false.** It said "keep it compact — link details, don't inline them", and every unit since the editorial build has landed a 20–40 line prose block instead. A rule nothing enforces and everything violates is worse than no rule, so this is what the file actually is: **one node per unit, carrying the QUESTION, the ANSWER as decisions with their tradeoffs, and what is OWED.** Evidence, narrative, measured numbers and the story of how something was found live in `build-log.md` and are LINKED from here, never repeated. A node that has resolved keeps its decisions and its owed list; the account of the work goes to the log.
>
> **The alternative was trimming the entries, and it was rejected deliberately.** The build record IS this project's product — it is the source content for the "How it was built" surface (ADR-0008 §8) and the reason a sceptical reader can check any claim. Deleting provenance to save context would trade the thing being proved for the cost of proving it. What is given up by choosing this instead: the file keeps growing, and a future session will have to split it per-phase or archive resolved nodes. That is the next call, and it is cheaper than either option is today.

The deferral was falsified the day it was written — the three nodes appended
that day stood first, second and sixth by size — and by the time this unit branched, at
`f66d464`, the map measured **253,385 B** by `wc -c` with **35** `### `
nodes (`grep -c`; the prompt had counted 194,751 B and 29 on 2026-08-29),
and the sixteen heaviest RESOLVED nodes ran 6,365–21,937 B each, 191,630 B
between them, three quarters of the file (the table is
`docs/prototypes/decision-map-compaction/node-bytes-2026-09-25.md`, derived
by the script beside it; its "before" column is main after the completing
commit, `7a3f568`, where the `workers-hardening` node is 2.5 KB heavier than
at `f66d464`). Two of the three falsehoods the audit pinned had
already been fixed by the units between: the interaction-registry node had
read "NOT MERGED" and reads `MERGED — PR #35` (fixed by 2026-09-01), and
the "first PAGE path in the repo that reaches KV" sentence carried its own
correction inline (2026-09-01). The third — the header's "~182 KB", stale
by its own command the day it was written — is fixed here by dropping the
number and keeping the command, with a leg that holds the header to that.

**The shape: compact in place, by deletion, never by rewriting.** A
per-phase split was rejected because `Blocked by:` edges are name-based and
every node resolves them by single-file lookup; an archive file was rejected
because the record's designated home already exists — this log, append-only,
not session-loaded. And nothing was deleted from the repo: every paragraph
that left a node is in this log verbatim, under the node's own phase, as a
sub-entry titled "*node* — narrative moved from the decision map
(2026-09-25)", which the node's `Status:` line links. What a node keeps is
its heading, `Blocked by:`, `Type:` and `**Question:**` lines verbatim (the
edges are names; a renamed heading breaks one), its `**Answer**` as the
original's own decision sentences, and its owed list; what moves is the
account of the work — verification paragraphs, sabotage counts, verify-slice
narratives, measured numbers that are evidence rather than decisions,
merge-review stories, drafts that were wrong first.

**The mechanism, so the claim "nothing invented" is a proof and not a
promise.** Each compacted node was written by deletion only and held to a
checker (`verify-node.mjs`, in the session's scratchpad; its whole-file
successor is committed): every kept non-blank line is either an original
line verbatim or a contiguous, sentence-aligned substring of exactly one
original line; the only new line is `Status:`, and every number, PR
reference, SHA and date in it must already appear in the original node
(2026-09-25 excepted), while every quoted title after `build-log.md` must be
a heading in this log. Sixteen nodes were compacted this way by sixteen
agents, each reviewed by an independent adversarial reader hunting for a
decision, a rejected alternative, a constraint on another unit or an owed
item that a reader of the map alone would now lack, and thirteen of the
sixteen went to a fixer for what the reviewer found: `security-floor` had
lost the `set`-never-`append` rule and the rejected one-directive
`frame-ancestors` CSP; `workers-hardening` had lost the cold read's cost
bound; `checkout-measure-prep` had lost six stated tradeoffs (the priming
rejected at CLS 0.099, the 303 target's `noindex`, the residual beacon
path, the fixed-cell cost); `pdp-controls` had lost the amended ADR-0002
guardrail; `a11y-section` the static forms specimen; `interaction-registry`
the unearned-`interactionSettled` exposure. Two review findings changed the
plan rather than a node: `plp-htmx` and `plp-react-next` still carried owed
lists — the edge Worker's five facet params, `plp.css`'s two rules with the
`OWED` retirement, the cross-arm agreement leg — that `plp-data-plane`
(2026-09-04, landed 2026-09-18) and PR #39 had discharged and nobody had
retired; the map contradicted itself two nodes apart. Those lines are
dropped (they are here, verbatim) and each node's `Status:` names what
discharged them. Then the whole file: `prove-provenance.mjs` (committed in
the unit's record directory) reads the map before and after and this log
after, and requires every removed non-blank line to be in the log verbatim
and every added line to be a header line, a `Status:` line, or a
sentence-aligned substring of a removed line — and holds every added
`Status:` line to the rule the per-node checker applied (its numbers, refs
and dates from the map before; its quoted titles the exact text of log
headings; its moved-narrative pointer naming its own node), which the
correctness lens found the first committed version had only claimed. On
the final tree — rebased onto the completing commit, so the base is `7a3f568`
and the `workers-hardening` lines are that commit's — it reports 172 removed
lines (165,386 B), 0 not in the log; 193 added lines — 16 `Status:`
lines, 174 aligned substrings, the header's three — 0 unexplained,
0 status violations; the three old header
paragraphs it had flagged before this entry existed are the ones quoted
above.

**The cap, derived rather than chosen.** The new leg,
`tools/repo-checks/test/decision-map-node-cap.test.ts`, fails any RESOLVED
node over 7,168 B, measured as the heading line through the line before
the next `### `. Which nodes are resolved is a checked vocabulary read off
the `Status:` line's leading clause — `open`, `in progress` or an in-flight
state (`not merged`, `code complete`, `sliced`, `PRD published`, …) is
exempt; `resolved`, `merged`, `closed`, `landed`, `built`, `deployed`,
`done` or `shipped` is capped; a clause that says neither fails the leg by
name, so no status can fall into the exemption by using a word nobody
classified (the correctness lens found the first draft reading every
in-flight phrasing in the map's history as resolved). The largest resolved node after compaction is 6,707 B
(`checkout-measure-prep`, whose six changes each carry a rejected
alternative and a stated cost); the first cap tried, 6 KiB, would have
forced dropping those, and a cap that removes decisions is the wrong cap,
so 7 KiB is the smallest whole KiB above the largest decision-only node.
Fifteen of the sixteen nodes compacted would fail it at their
pre-compaction size (the sixteenth, `how-it-was-built` at 6,365 B, was
compacted for the same reason and sits at 4,486 B), and the median resolved
node is 4,113 B, so the cap is 1.7× the median. Open nodes are exempt —
active work grows its node until it resolves — and the leg refuses to pass
over nothing four ways: zero resolved nodes fails; open nodes must be the
minority; every node names a status except the one listed by name (the
`(fog)` node); and the classifier and the cap are proven against literal
fixtures in the same file. A stated limit: the exemption trusts the
`Status:` line the way every registry guard here trusts its registry —
flipping a resolved node to `open` to dodge the cap is a one-line diff a
reviewer reads, and sabotage row N4 records the leg missing exactly that.
Two more legs in the file hold what the compaction introduced: the header
names the size command and states no size figure, and every `Status:` line
that cites `build-log.md` quotes only titles that are headings here — so a
reworded sub-entry heading breaks a map pointer loudly. Run against the
UNCOMPACTED map before any node moved, the file was red on exactly the
three legs it should be: the cap (all sixteen at that run's provisional
6 KiB; fifteen at the 7 KiB the leg carries — `how-it-was-built` sat at
6,365 B), the header figure, and the pointers (two `Status:` lines cited
the log; the leg wants more than ten).

**What it cost this log.** Sixteen sub-entries, 165,386 B of moved
paragraphs plus their headings and leads, took the file from 534,169 B to
723,812 B at the pushed commit `d4fdfe1` — past the 640 KiB at which GitHub's code view was last
OBSERVED to honour `?plain=1#L<n>` (`how-built-links-resolve.test.ts`, its
2026-09-25 observation at 533,209 B). That leg is red on this tree by
design, and its own instruction stands: re-observe on the pushed branch in
a real Chromium, record the observation beside the two others, and raise
the ceiling. Done on the pushed branch, at commit `d4fdfe1` (723,812 B): unit 8's
`observe-ceiling.mjs` (Playwright's Chromium, headless) opened the code view
at `#L4508` ("## Phase 15 — The instrument was the thing that was wrong")
and `#L8647` (this entry's own heading) — GitHub's header read "8869 lines
(7920 loc) · 707 KB", both lines present reading their headings, both
highlighted, no "too large" notice. The ceiling is 768 KiB now, the next
128 KiB step as the two pins before it, with 62 KB of headroom: one more
unit's entry fits, and the crossing after that re-observes again. The two
JSON lines verbatim and a screenshot are in the record directory
(`ceiling-2026-09-26.txt`, `ceiling-2026-09-26-L8647.jpg`); this paragraph
and the test's comment are the amend that followed the push, so the file
is larger than the figure above, which is pinned to `d4fdfe1`: 733,249 B
after the rebase onto the completing commit, under the 768 KiB. Inserting sub-entries under Phases 8, 10, 12, 13
and 14 moved every later `## Phase` heading, so the how-it-was-built master
was regenerated (`node packages/reference/render/build.mjs`) and its line
anchors re-pinned; the regeneration test holds the index and the
links-resolve leg reads line *n* of this file against each link's text.

**Verification.** In the standing order.

**`pnpm run check`:** 40 of 40 on the worktree before a line was edited
(the count derived with `--dry=json | jq`, not typed: 40 — this unit adds no
task; the new leg joins `@pm/repo-checks#test`, which is uncached), and
**39 of 40** on the final tree, run with `--continue` so every task ran: the one red is `@pm/repo-checks#test`, on the ceiling leg alone — 218 passed, 1 failed, 1 skipped of that package's 220 on the final tree with the one red leg named above.

**The sabotage table** (`docs/prototypes/decision-map-compaction/sabotage-2026-09-25.md`,
every row with its exit code; the runner is copied from unit 8's, reads the
pasted narrative back out of this log's own sub-entry, takes a fresh backup
per row, verifies every restore by byte equality, and runs its guards under
`bash -c`). Round 1, over every new guard on the compacted tree: 17 rows — 12 caught, 4 controls passed as designed, 1 missed as stated in advance. The rows that carry the unit's claims: the plp-htmx narrative pasted back into its resolved node fails the cap leg naming the node and its byte count (the prompt's own "Done means" sabotage), and so does a paste 1 KiB over the cap into `security-floor` and a new resolved node one byte over; an OPEN node padded 8 KiB past the cap PASSES, by design (control); every status flipped to `open` fails the minority leg; every heading demoted (zero nodes) fails the floor; a node with no status line fails; the header's "~182 KB" re-inserted and the size command removed each fail the header leg; a moved sub-entry's heading reworded in the log and a Status quoting a title that does not exist each fail the pointer leg; a line inserted above `## Phase 15` without regenerating the master fails the line-anchor leg; the master's phase-15 anchor edited by hand fails the regeneration pin. The one miss, N4, is the stated limit: the plp-htmx paste PLUS its status flipped to `open` passes, because the exemption trusts the Status line. Rounds 2, 3 and 4 followed the verify-slice folds (below): 17 rows — 11 caught, 6 controls passed as designed, 0 missed; 34 rows across the four rounds.

**verify-slice.** Four lenses, sequential, 67 minutes: 25 raw findings — correctness 8,
conformance 7, seams 2, skeptic 8 — 23 folded, 1 accepted without change,
1 declined, and every fold verified by its own pass (the leg, the proof and
the typecheck after each edit; sabotage rounds 2, 3 and 4). What they found,
in the order fixed. The correctness lens: the status classifier was a guess
— every in-flight phrasing the map's history holds (`PRD published`,
`sliced`, `SPEC WRITTEN, NOT BUILT`, `CODE COMPLETE, NOT MERGED`) read as
RESOLVED — so it is a checked vocabulary now, and a verdict in neither list
fails the leg by name; the pointer leg matched quoted titles by substring
and never checked that a node's moved-narrative pointer named its own key
(exact heading forms now, own key required); the header's figure regex
missed `bytes`, `KiB` and `kilobytes` while false-failing `B` (widened,
the cap sentence excluded); the last node's span counted the file's final
newline in both the leg and `node-bytes.mjs` (fixed in both, the table
re-derived); four Status lines lacked the referents their nodes' kept text
pointed at (checkout-vanilla's eight numbers, bench-instrumentation-dilution's
and pdp-build's phase, plp-react-next's three files); and the record claimed
a sentence-alignment check the committed proof did not make (ported into
`prove-provenance.mjs`, with the Status checks). The conformance lens: the
pointer leg was vacuous for a node that quoted nothing — every pointer and
all sixteen sub-entries could vanish with the file green (the both-directions
leg; rows P5–P7); plp-htmx kept the heading "Which control got enhanced"
with its decision deleted (the sentence restored); two kept sentences still
owed what `plp-data-plane` had discharged (deleted; in the log); pdp-build's
all-struck "remaining" line (deleted); this entry described the first
classifier and counted sixteen reds where the 7 KiB cap gives fifteen
(reworded); the byte table was 18 B stale against the map (a committed
generator writes it now, run last). Accepted without change: "recorded
per-slice above" and "(below)" left dangling by deletion — verbatim by rule,
and the Status lines carry the referents. The seams lens: plp-htmx kept its
two reference `<nav>` defects as pending when both were fixed (the Status
names the fixes); curly quotes were never extracted (both styles, with a
fixture). The skeptic lens: the preamble was the one region no leg measured
— 20 KB under `## Notes` passed everything (a preamble cap, 8 KiB, derived
like the node cap; row N9); the both-directions leg trusted a bare phrase
(exact quoted titles only; row P8); rows S1/S1b named `a11y-section` as the
last node when it is `workers-hardening` (the row derives the name and
refuses an OPEN one); this header's "the file's heaviest" overstated the
three same-day nodes (first, second and sixth — corrected in the map and
here); editorial-build's layer (1) and second completion duty, and four
decision sentences (pdp-build's `labBundle` rule, plp-htmx's assertion
shape, plp-react-next's measured-empty registration, workers-hardening's
Zod limit), restored verbatim; and a typed 191,631 in this entry against
the script's 191,630. Declined: a repo-checks leg regenerating the byte
table from `git show f66d464` — a shallow CI checkout may not hold that
commit; the generator runs before the commit instead, and the record says so.

**The origin suite, alone.** A docs-only unit still runs both modes:
`@pm/front#build` declares this log and the ADRs as inputs (the
how-it-was-built page is rendered from them) and the master-regeneration
test pins the rendered index. On the compacted tree, before verify-slice and before this entry: fixture-1 **670 of 670** in 143.5 s, 0 refused connections. Crate-1 was the plane, not the code — wrangler 4.110's front dev server crashed under load (the "please create an issue" banner at the end of `tools/origin-suite/.dev-logs/front.log`, which now names 4.141.0 as available; 6 `ECONNREFUSED 127.0.0.1:8787`; every browser leg at its 30 s timeout from the first test on; 244 failed at the 300 s hook cap), the failure class units 7 and 8 recorded; re-run before belief, crate-2 **670 of 670** in 144.3 s, 0 refused connections, no banner, 0 leftover processes. 670 legs is unit 8's count: a docs unit adds none. On the FINAL tree, run last with nothing edited after them but the suite-runs table's rows and the sentences that quote them: fixture-final-1 669 of 670 — the one failure `bench.browser.test.ts`'s INP beacon arriving null on a `body-click` run, the pre-existing flake class issue #16 carries and units 7 and 8 met — so re-run before belief: fixture-final-2 **670 of 670** in 143.7 s; crate-final **670 of 670** in 148.9 s; 0 refused connections, no banner, 0 leftover processes in all three. Then, after the rebase onto the completing commit: fixture 669 of 670 (the INP-null leg again) and **670 of 670** in 144.6 s; crate crashed the plane twice in a row under a machine carrying Spotlight indexing and a VM (wrangler's "Error inside ProxyWorker … internal error", the banner in front.log, 82 then 154 refused connections) and passed **670 of 670** in 145.1 s on the third run — five runs in the suite-runs table, recorded as they happened (`docs/prototypes/decision-map-compaction/suite-runs-2026-09-25.md`).

**What this leaves.** The ceiling observation needs the branch pushed,
which is Rob's. Unit 8's completing commit (PR #50) landed first and rewrote
the `workers-hardening` node's status line and three bullets and the tail of
its entry here; this commit was rebased onto it keeping both edits — the
node was re-compacted from the completing commit's text by the same
deletion rule (its Status carries the two-commit verdict, its fixtures
bullet the 60 rows and the refusal-marker map), and its narrative
sub-entry under Phase 15 carries that version's removed lines, the
rewritten verification paragraph among them.
For Rob, carried forward unchanged: whether `pm-warm` is on the Free plan;
the PDP `not-found.tsx` and `lib/plp-error.tsx` docblocks; the bench
runner's uncapped CDP `send()`; the two post-deploy smokes that failed on
one qwik stepper assertion and the local INP-null bench flake; the deployed
plane's compressed header bytes; addendum O's `transferSize` wording; the
checkout fit template and its `interactionFetch` declaration; the cart line
list's missing `tabindex`; wrangler 4.110's crashes under load; the
fixtures' 1.3 MB on disk; unit 10's Rob-gated items — branch protection,
worktree pruning, the Discogs ToS check the runbook says to pull forward.
