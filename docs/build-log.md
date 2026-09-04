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
