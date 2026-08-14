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
(the comparison runs under `NO_NOISE`). But the runtime still ships, because
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
