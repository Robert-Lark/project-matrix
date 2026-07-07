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
