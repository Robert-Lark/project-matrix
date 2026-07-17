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
