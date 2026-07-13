---
status: accepted
date: 2026-07-06
ticket: design-system
---

# Design system — shared tokens/components + zero-bias presentation

## Context

Every variant of the Discogs vinyl store renders the same storefront, so the
presentation layer — like the data layer before it ([ADR-0002](0002-data-contract-and-frozen-snapshot.md))
— is a shared, benchmark-critical surface. A storefront is a large shared surface,
which raises the stakes: any visual or structural difference between variants is a
confound in the render-axis numbers.

The binding constraints are [ADR-0001](0001-benchmark-measurement-methodology.md)
(reproducible, un-riggable numbers; identical assets everywhere; one variable at a
time) and the standing **real-world fidelity** principle (a finding a working
engineer could not reproduce is worthless). The load-bearing question: how is a
single token + component system authored so paradigms as different as vanilla,
heavy-hydration (React/Next), islands (Astro/Svelte), resumability (Qwik),
hypermedia (HTMX), and the Remix 3 frontier all consume it **without drift**?

A second driver surfaced in the grilling and shapes the whole ADR: the portfolio's
audience is skeptical staff engineers, and the guarantee they must not be able to
break is *"that variant is slow because its components were written differently."*

Note on org standards: Discogs' frontend standard component library is **HiFi**, a
React component library. It is deliberately **not** used here — it cannot be the
shared layer across non-React paradigms (vanilla, HTMX, Qwik, Remix 3), and a
React-only dependency would defeat the zero-bias guarantee. The shared layer must be
framework-agnostic CSS.

## Decision

**1. The shared artifact is CSS + a canonical markup contract — no shared runtime.**
The design system is (a) a framework-agnostic CSS layer (custom-property tokens +
component style rules) and (b) a **canonical markup contract**: the exact rendered
DOM (elements, nesting, `pm-` BEM class names) every variant must emit. Each paradigm
re-implements the markup in its own idiom (JSX, Astro, Qwik, an HTMX server partial,
a vanilla template), but all emit identical DOM and import identical style rules, so
pixels are identical **by construction**. A "component" is a spec (markup + classes),
not shared code. **Web Components were rejected**: a custom-element runtime would be
forced into every variant — including the vanilla and static/islands ones whose whole
thesis is "little/no JS" — biasing the exact numbers the project exists to measure.

**2. Presentation zero-bias = same styles, not same delivery.** The *control* is the
declared style rules + the rendered DOM (byte-identical everywhere). The *measured
variable* is how each paradigm **delivers and optimizes** that CSS — per-component
scoping, code-splitting, critical-CSS inlining, unused-CSS elimination — because those
are genuine paradigm capabilities whose payoff *is part of the verdict*. This mirrors
ADR-0002's "same data, not same access." Two guardrails keep it honest:
- **Repackage, don't re-value.** A paradigm may scope/split/inline/tree-shake, but the
  *computed* result must stay pixel-identical. Scoping (a hashed attribute) is fine;
  changing a token value is not. Enforced by the drift tests (§6), not by trust.
- **Idiomatic default, not hand-tuned.** Each paradigm uses the CSS optimization a
  competent team normally gets from it — not a bespoke per-variant purge tuned to win.

Consequently the CSS KB bucket (ADR-0001 §3) flips from noise to **signal**: Astro
shipping less scoped/tree-shaken CSS than vanilla's full sheet is a legitimate part of
the story, reported, not suppressed.

**3. Authoring shape: global token layer + per-component modules; two-tier tokens.**
Tokens are one global custom-property layer (shipped identically to all); component
rules are **per-component modules** so each paradigm can apply its native delivery
(§2) — a monolith could not be scoped or tree-shaken per component. Tokens are
**two-tier**: **primitive** (raw palette/type/space scale) → **semantic** (the aliases
components consume: `--color-text`, `--space-inset`, …). Components reference **semantic
tokens only**. One indirection = one auditable seam for theming and forced-colors.
Three-tier (component tokens) was rejected as token sprawl unjustified at five
surfaces; flat/one-tier was rejected for having no theming seam.

**4. Single canonical theme + first-class forced-colors; dark mode deferred.** Theming
is not the thesis; a dark mode is pure surface that multiplies the cross-variant drift
QA (N variants × M themes) with no architectural payoff. Forced-colors (Windows High
Contrast), by contrast, is a *required* matrix constraint. It is handled at the
semantic tier — under `@media (forced-colors: active)`, semantic tokens remap to CSS
system colors (`Canvas`, `CanvasText`, `LinkText`, `Highlight`, …) in one place and
every component adapts for free. Rules: no meaning by color/background-image alone
(carried by text + icon); a visible focus indicator that survives forced-colors;
`forced-color-adjust: none` only where a color genuinely *is* content. Dark mode stays
cheap to add later via the same seam.

**5. Accessibility is shipped as the design-system default.** The DS bakes in, as
defaults: focus-visible rings, WCAG target sizes, relative (`rem`) units for
zoom/reflow, reduced-motion gating, the forced-colors remap, and accessible form
wiring (associated labels, `aria-describedby`/`aria-invalid`, `autocomplete`, live
regions), plus skip-link + landmarks. **State styles off native attributes**
(`:focus-visible`, `[aria-invalid]`, `:disabled`), never JS-toggled classes — so a
visual defect cannot exist without the programmatic one. Every a11y-relevant component
ships as a **matched pair**: the compliant default and a documented **stripped**
counterpart, byte-identical except the a11y treatment, so a side-by-side comparison
differs *only* in accessibility. The failure→repair narrative is therefore **DS-off vs
DS-on** — literally what a rushed team ships without the system. Five headline
guarantees (forced-colors, accessible forms, focus, reflow/zoom, reduced-motion) span
WCAG's Perceivable/Operable/Understandable/Robust; target-size and skip-link/landmarks
are silent defaults.

**6. Drift is proven, not promised.** A **framework-free reference render** of each
component (canonical markup + shared CSS as plain static HTML, no framework) is the
**golden master** — it *is* the contract, so nothing is privileged. In CI, every
variant is checked against it two ways: **normalized-DOM equivalence** (after stripping
paradigm-injected noise — hydration markers, comment nodes, and the scoping hashes §2
permits) and **pixel screenshot diff** across ADR-0001's three test profiles. Either
drift fails the build. This makes "repackage, don't re-value" an automated test. The
reference render is a build artifact reused by the measurement harness.

**7. Aesthetic is a deferred, swappable decision.** The token architecture is
deliberately aesthetic-agnostic: the look is the *values poured into the primitive
tier*, swappable later by reassigning primitives with zero component changes. The
prototype uses a clearly-labeled **neutral placeholder** aesthetic that proves the
system; the real look is decided in a spun-out `aesthetic-direction` ticket.

**8. Fonts are a controlled constant.** Self-hosted, subset, identical files + loading
everywhere (like ADR-0001's image/compression controls) — font choice is not a
paradigm feature, so no variant optimizes it differently. One variable sans (UI/prose)
+ tabular/mono figures for metrics (aligned prices, HUD).

## Considered alternatives

- **Web Components / custom elements as the shared layer.** Write-once, no markup
  drift — but forces a JS runtime into every variant, biasing the render-axis numbers.
  Rejected.
- **Per-paradigm component libraries from shared tokens (Style Dictionary).** Idiomatic
  per framework, but near-guarantees visual drift (N re-implementations of the visuals)
  and is the weakest zero-bias guarantee. Rejected.
- **HiFi (Discogs' React component library).** React-only; cannot cross non-React
  paradigms; a React dependency would itself bias the benchmark. Rejected as the shared
  layer.
- **CSS delivery held constant (one external stylesheet everywhere).** Would factor CSS
  out as a confound — but robs paradigms (esp. Astro) of genuine built-in optimizations
  whose payoff is precisely what the comparison is meant to reveal. Rejected in favor of
  delivery-as-measured-variable (§2).
- **One monolithic stylesheet.** Cannot be scoped or tree-shaken per component, so it
  would prevent §2's native optimizations. Rejected.
- **Three-tier tokens; flat tokens.** Sprawl vs. no theming seam. Both rejected for
  two-tier.
- **Utility-first CSS (Tailwind).** Bloats the markup contract, couples to a build step,
  and makes "identical DOM" harder to hold. Rejected for `pm-` BEM semantic classes.
- **Anoint one variant (vanilla) as the golden master.** Privileges one variant; if it
  drifts from intent everything is "correct" but wrong. Rejected for a framework-free
  reference render.
- **Pixel-only or DOM-only drift check.** Each misses what the other catches
  (DOM-identical can still render differently; identical pixels can hide different DOM).
  Rejected for both.

## Consequences

- **New tickets spun out:** `aesthetic-direction` (Prototype — decide the look, pour it
  into the primitive tier) and `a11y-section` (the dedicated ADA section: hybrid
  two-box-A/B for element-scoped defects + mode-toggle demos for global-state defects,
  hosted in the vanilla variant). A `home-surface` (gateway/landing) candidate was also
  surfaced and added to the map.
- **Matrix reshaped:** the "Checkout/A11y" row splits — Checkout keeps INP-under-load +
  the realistic form; accessibility becomes its own section.
- **Guardrail carried forward:** the PDP's rich product interactivity (ADR-0002) is
  expressed through DS components whose *appearance* is shared but whose *behavior* is
  per-paradigm (the render-axis variable).
- **The reference render is a shared build artifact** — the drift-test golden master and
  the a11y-section's compliant baseline both reuse it.
- The token file, canonical-markup contract, and drift-test approach double as source
  content for the "How it was built" surface.
- **Prototype:** [`docs/prototypes/design-system/`](../prototypes/design-system/) —
  `tokens.css` (two-tier + forced-colors + reduced-motion), three component modules,
  and the framework-free `reference/index.html` (golden master + reactable demo).

## Addendum — §6 scope for the fenced Remix 3 exhibit (2026-07-11)

`remix3-frontier` resolved that the fenced Remix 3 showcase **owes this
ADR's canonical-markup/shared-CSS contract** (fencing excludes benchmark
numbers, not visual identity), and that §6's drift gate covers its
Editorial surface **in advisory mode**: drift there warns but never fails
the build. §6's "either drift fails the build" continues to apply in full
to every *benchmarked* variant; the carve-out exists because the exhibit is
in no published number (so a drift there defrauds no comparison) and its
weekly-cadence pre-release dependency must not be able to block the
matrix's deploy. Hosting rationale:
[ADR-0004's second addendum](0004-deployment-topology-and-contextual-switcher.md);
the carve-out's reasoning and the paradigm-noise list to register when the
gate is wired:
[`prototypes/remix3-frontier/FINDINGS.md`](../prototypes/remix3-frontier/FINDINGS.md) §7(b).

## Addendum — "idiomatic default" gets a mechanism (2026-07-12)

The strategy review
([finding 6](../reviews/2026-07-12-strategy-review.md)) observed that §2's
"idiomatic default, not hand-tuned" — the fairness rule the flip framing leans
on hardest — was the only one enforced by nothing but the author's judgment:
the drift gate proves pixel/DOM identity, not idiomatic-ness. Adopted
mechanism, binding on every variant build:

**Each variant is scaffolded from its framework's official starter, and the
diff-to-starter ships as part of the receipt chain.** "What we changed from
the default, and why" is published per variant (most entries will be the
canonical markup contract, the tokens import, and the composed-origin
adapter). A reviewer no longer audits idiomatic-ness by reading six
codebases; they read six diffs. The diffs double as "How it was built"
content. Same rule, now an artifact instead of a claim — the §6 "proven, not
promised" standard applied to §2.
