---
status: accepted
date: 2026-07-06
ticket: deployment-topology
---

# Deployment topology — single canonical plane, one-SHA monorepo, contextual switcher

## Context

The variants are the thing being compared, so *how* they are hosted, built, and
navigated between is itself a benchmark-critical surface — a careless choice here
silently confounds every number the project publishes. Three questions had to be
answered together: (1) where each variant is hosted, (2) the monorepo layout, and
(3) the contextual switcher that swaps architecture on the same route, including how
route and state survive the swap.

The binding constraints are inherited, not new:
- [ADR-0001](0001-benchmark-measurement-methodology.md): reproducible, un-riggable
  numbers; **identical assets everywhere; one variable changes at a time; all
  variants measured in one batch, tied to commit SHAs**; instrumentation stripped
  from the KB count; dated snapshots, not live.
- [ADR-0002](0002-data-contract-and-frozen-snapshot.md): the data plane is already
  **Cloudflare** — R2 origin → thin Worker (`/api/*`) → KV warm tier, cache state
  harness-driven.
- [ADR-0003](0003-design-system-and-zero-bias-presentation.md): **no shared
  component runtime** — each paradigm re-implements the canonical markup in its own
  idiom; forcing a runtime into the no-JS variants (the Web Components rejection)
  would bias the exact numbers being measured.
- The standing **real-world-fidelity** principle: a finding a working engineer could
  not reproduce is worthless.

Every decision below is that same move applied one layer at a time: **hold the
thing constant so it can't confound the paradigm, unless the thing genuinely *is* a
paradigm capability.**

## Working knowledge, to verify at build time

Unlike ADR-0002's API facts, the Cloudflare composition specifics below were **not**
verified against primary sources in-session — they are working knowledge. Treated
as the leading mechanism and **fenced for build-time verification** (like the Remix 3
adapter): single-hostname composition via a front Worker with **service bindings** +
**Workers Static Assets**; HTML chrome injection via **HTMLRewriter**; per-paradigm
Cloudflare adapters (`@cloudflare/next-on-pages` / OpenNext for Next, the Qwik CF
adapter, a Remix 3 target). A spun-out `cf-composition-spike` ticket verifies these
before the monorepo is scaffolded; if any fails, the affected decision is revisited.

## Decision

**1. A single canonical plane (Cloudflare); host held constant.** All variants
deploy to Cloudflare (Pages static / Pages Functions / Workers), co-located with the
R2/KV data plane. The host is thereby a **fairness control, not a variable**: a TTFB
gap can only be the paradigm, never "Vercel's edge network vs Cloudflare's," and no
runtime variant makes a cross-cloud hop to reach its data. Each paradigm uses its
**idiomatic Cloudflare adapter, not a hand-tuned deploy** (the direct analogue of
ADR-0003 §2's "idiomatic default, not hand-tuned"). A variant *may* additionally be
deployed to its native host (e.g. Next → Vercel Edge) as an **explicitly fenced
"real-world host" exhibit** — kept out of the core numbers, exactly like the
live-origin demonstration (ADR-0002 §3) and the Remix 3 frontier.

**2. One monorepo, pinned by one SHA.** ADR-0001's "all variants measured in one
batch, tied to commit SHAs" is only clean if a single SHA pins the entire matrix +
the snapshot manifest. Layout, using the ubiquitous language:

```
variants/   one per paradigm — vanilla, react-next, astro, qwik, htmx, remix3(fenced)
packages/   shared, consumed — NO component runtime (ADR-0003 §1):
              tokens/ (tokens.css) · reference/ (golden-master SPEC, not consumed)
              data-contract/ (Zod schema + types) · switcher/ · measurement/ (web-vitals beacon)
workers/    edge/  R2 read + beacon tagging + live path (ADR-0002 §8); front router (§3/§7)
tools/      bench runner, cost calculator, snapshot capture — dev/CI only, never shipped
docs/       decision-map, adr/, build-log, prototypes/
```

Tooling is **pnpm workspaces + Turborepo**: Turbo's content-addressed cache makes the
per-variant drift-test + benchmark-build CI incremental; pnpm's strict, non-hoisted
`node_modules` is a **zero-bias asset** — a variant physically cannot import a
sibling's dependencies by accident, so bundle contents stay honest. This
**deviates from the org's 3-repo GitOps standard** (`{service}` / `-cd` /
`-terraform`); the deviation is deliberate and justified — that standard serves
production Discogs services, whereas splitting variants across repos would break the
one-SHA-one-batch reproducibility this project's credibility rests on. There is
**no `packages/components`**: components are re-implemented per variant; `reference/`
holds the framework-free golden master as a *spec*, not consumed code.

**3. Single origin, path-prefixed, composed by a front routing Worker.** URLs are
`matrix.example/{variant}/{surface}/...` under **one hostname**, with a thin front
Worker dispatching by path prefix (service bindings; static variants via Workers
Static Assets), and `/api/*` routed to the ADR-0002 edge Worker. Chosen over
subdomain-per-variant because a single origin (a) holds the **entire transport stack
(TLS, HTTP/2/3, connection reuse) identical for every variant** — transport becomes
a fairness control instead of per-origin handshake noise landing unevenly on the
cold-load numbers; (b) makes the client **cart survive a swap for free** via shared
same-origin `localStorage`; and (c) reduces the switcher to a trivial, honest mapping
— rewrite the `{variant}` segment, keep the rest.

**4. The swap is a hard navigation — forced, and honest.** There is no shared client
runtime to soft-swap React for Qwik for HTMX (ADR-0003 §1), so a variant swap is a
full document navigation. This is not a limitation: a hard navigation is the *honest*
measurement — a real cold/warm load of the target paradigm, uncontaminated by the
outgoing app's resident runtime. The switcher is therefore a **navigation control**,
not a client-side view swap.

**5. The URL is the measurement condition.** State is partitioned by kind:
- **Path** carries identity: `variant` / `surface` / entity-id.
- **Query** carries the environment knobs, split into two honest kinds:
  **live request modifiers** (`n` = data volume served, `cache` = cold/warm — these
  genuinely change what the Worker/page does on this request) and a **snapshot
  selector** (`profile` — see §6).
- **`localStorage`** holds the **cart only** — genuine cross-surface application
  state, not a measurement condition (survives the swap for free, §3).
- **Transient per-paradigm UI micro-state** (gallery index, zoom, quantity spinner,
  format toggle, scroll) **resets on swap.** Preserving it would require a shared
  cross-paradigm serialization protocol — reintroducing the shared runtime ADR-0003
  §1 rejected — and it is not meaningful to the render/data comparison anyway.

The payoff: **a URL is a complete, shareable, reproducible receipt for one
measurement**, directly serving ADR-0001 §9's "receipt behind every number" and
one-command-reproduce.

**6. The throttle axis is a snapshot selector, never a live fake.** Network throttle
cannot be applied to a real visitor's connection, and a synthetic in-browser delay
does not reproduce connection setup, request parallelism, or TCP slow-start — so it
is a lab artifact a skeptic rightly discounts, forbidden by real-world-fidelity for
any published number. Instead `?profile=` **selects which dated lab snapshot** the
HUD displays (the three ADR-0001 §4 profiles); the live page is **not** re-throttled.
The HUD shows this alongside the visitor's **own real web-vitals** under their actual
network (the honest field/RUM readout, ADR-0001 §1). A synthetic throttle survives
only as a clearly-fenced "feel the difference" demo, never fed into a number.

**7. The contextual switcher is per-surface, sparse, near-zero-JS, edge-injected
chrome.** The switcher + HUD are **instrumentation**, and two prior constraints shape
their delivery. They are injected by the front Worker into a known slot in every
variant's response (HTMLRewriter), which means: the chrome is **byte-identical across
variants by construction** (no drift); its bytes arrive from a **known path so the
harness strips them precisely** from the measured KB (ADR-0001 §6); and each variant
build stays purely about its own paradigm. The core is **anchor links** (`<a href>`
to the swapped-variant URL) that work with **JS disabled**, so the chrome does not
inject a runtime into the vanilla/HTMX variants (the same reasoning as the ADR-0003
§1 Web Components rejection); JS enhances only the HUD's live readout, reusing the
`measurement` web-vitals lib already injected identically. The control-set is a
**function of the current surface** ("contextual"): render-switcher on the spine
(Editorial, PDP), data-strategy switcher on PLP, device/CPU controls on Checkout,
a11y-mode toggles on the A11y section; the HUD is constant. Its variant options are
**sparse — only the variants a surface is actually built in** (singleton surfaces —
Home, A11y, How-it-was-built — get no render-switcher), enforcing the sparse-matrix
principle: the switcher can never offer a cell that does not exist. The drift-test
normalizer (ADR-0003 §6) ignores the injected chrome slot, as it already does for
paradigm-injected noise.

## Considered alternatives

- **Per-variant idiomatic hosts (Next → Vercel, etc.).** Most faithful to how teams
  deploy, but the host/provider network becomes a confound in the latency numbers and
  every runtime variant makes a cross-cloud hop to R2/KV — violating ADR-0001's "one
  variable at a time." Rejected for the core comparison; retained as the fenced
  real-world-host exhibit (§1).
- **Multi-repo (the org 3-repo GitOps standard).** Splitting variants across repos
  breaks the one-SHA-one-batch guarantee ADR-0001 §9 requires. Rejected for this
  reproducibility-first portfolio (not a production service).
- **Subdomain per variant.** Simplest deploy, but `localStorage` is not shared across
  subdomains (cart needs a parent-domain cookie — more machinery, size/PII care) and
  each origin adds a fresh TLS handshake, injecting cold-connect noise unevenly into
  the very cold-load numbers being compared. Rejected.
- **Umbrella Pages project, build-time subdirs.** Single origin without a router, but
  couples all six builds into one artifact (fighting the per-variant idiomatic
  toolchain) and lets one broken build block the whole matrix deploy. Rejected.
- **Storage-heavy state (env knobs in `localStorage`).** Cleaner URLs, but the env
  condition becomes invisible and un-shareable, so a URL stops functioning as a
  reproducible receipt — weakening the anti-rigging story. Rejected.
- **Maximal continuity (carry UI micro-state across the swap).** Requires a shared
  cross-paradigm state protocol — the shared runtime ADR-0003 §1 rejected — for state
  irrelevant to the comparison. Rejected.
- **Live in-browser throttle simulation.** A lab artifact; discounted by a skeptic.
  Rejected for numbers; survives only as a fenced demo (§6).
- **Switcher as a shared package each variant imports / hybrid delivery.** Puts shared
  runtime code into every variant (tension with the no-shared-runtime ethos), makes
  KB-stripping interleaved and less trustworthy, and risks per-variant chrome drift.
  Rejected for edge injection (§7).
- **npm workspaces / Nx.** npm's hoisting weakens the zero-bias dependency isolation;
  Nx is overkill for ~6 variants. Rejected for pnpm + Turborepo.

## Consequences

- **New shared infra: the front routing Worker** — composes the single origin (§3),
  fronts the ADR-0002 edge Worker at `/api/*`, and injects the switcher/HUD chrome
  (§7). It is instrumentation applied identically to all variants (a constant, not a
  confound) and its bytes are stripped from the KB count.
- **New downstream ticket: `cf-composition-spike`** (Research + Prototype, blocked by
  this ticket) — verify the Cloudflare composition mechanism (service bindings /
  Workers Static Assets / HTMLRewriter injection) and the per-paradigm CF adapters
  before scaffolding the monorepo. De-risks the working-knowledge assumptions above.
- **`home-surface` is unblocked** (its blockers `design-system` + `deployment-topology`
  are both resolved) and partially answered in principle: it is a **singleton on the
  canonical plane, served static** (vanilla/Astro-static), with **no render-switcher**
  (only the HUD + its own CTA chrome).
- **Feeds downstream builds:** the per-surface control copy feeds the per-surface
  builds; the data-strategy switcher's exact scenarios feed `data-strategy-lab`; the
  monorepo scaffold itself is a to-prd/implement job (after `cf-composition-spike`).
- The topology, the URL-as-receipt scheme, and the edge-injected-chrome approach
  double as source content for the "How it was built" surface.
