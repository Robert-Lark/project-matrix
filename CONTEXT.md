# Project Matrix — Context

The ubiquitous language for the project: a live-benchmarking portfolio built as one
Discogs vinyl store across several rendering paradigms. This file is a glossary and
nothing else — no implementation detail. Rationale lives in `docs/adr/`; planning
state in `docs/decision-map.md`.

## Language

### The store & its evidence

**Canonical store**:
The default store every visitor sees — real Discogs data captured once and frozen,
served the way production serves cacheable data. It is the rigorous, reproducible
measurement, and needs no qualifying label.
_Avoid_: "static mode", "frozen mode", "the fake one".

**Live-origin demonstration**:
An on-demand action (scoped to the PDP) that fetches from the live Discogs API to
expose the real cost of a dynamic origin. Deliberately fenced — never fed into the
benchmark numbers, because it cannot be reproduced run-to-run.
_Avoid_: "live mode" (implies the canonical store is not real).

**Variant**:
One exemplar of a rendering *paradigm* (vanilla, heavy-hydration, islands,
resumability, hypermedia, + the Remix 3 frontier). The thing being compared.
_Avoid_: "framework", "stack" (we compare paradigms, not framework collections).

**Surface**:
One of the store's five pages, each proving a distinct tradeoff (Editorial, PDP,
PLP, Checkout, "How it was built").
_Avoid_: "lab", "page type".

### The data

**Frozen snapshot**:
The captured, normalized, dated copy of Discogs data that is the canonical origin.
Tied to a capture date + commit SHA.
_Avoid_: "cache", "dump", "mirror".

**Catalog data**:
The immutable slice — title, artist, year, tracklist, cover art. Legitimately
pre-computable in production, so freezing it is real-world-faithful.

**Commerce data**:
The mutable slice — price, availability. The only genuinely dynamic data; the only
thing the live-origin demonstration shows changing.

**Crate**:
The curated snapshot scope — one coherent slice of records (e.g. a genre or era),
~500 releases, chosen for a realistic facet distribution. Heavy on purpose.
_Avoid_: "dataset", "corpus".

**Release summary**:
The small normalized payload for a PLP grid card (cover, title, artist, price,
facets). One of the two "trays".

**Release detail**:
The full normalized payload for a PDP — the summary plus tracklist, images, labels,
formats. The other "tray".

**Tray**:
Informal name for a normalized payload shape (summary or detail). The prepped
ingredients every variant is handed identically.

**Zero-bias guarantee**:
Every variant consumes byte-identical data content (the control), so no variant is
advantaged by a better data shape. How each paradigm *accesses* that data is the
measured variable, not a bias.

### Serving

**Origin**:
Cloudflare R2 — the single source of truth holding the frozen JSON + self-hosted
images.

**Warm tier**:
Cloudflare KV — the globally-replicated edge cache that makes a "warm" read
reproducible everywhere. Contrast **cold**: bypass the edge and read the origin.

**Canonical plane**:
The single Cloudflare host every variant deploys to, co-located with the origin.
Holding the host constant makes it a fairness control, not a benchmark variable — a
latency gap can only be the paradigm. A variant may also appear on its native host
(e.g. Next on Vercel) as a fenced "real-world host" exhibit, excluded from the numbers.
_Avoid_: "the server", "prod" — there is one shared plane, not a per-variant server.

**Product interactivity**:
The genuine client-side interaction on a PDP (image gallery/zoom, add-to-cart with
cart state, quantity, format switch). Distinct from commerce-backend fidelity, and
kept rich because the render-axis thesis depends on it.

### Presentation

**Canonical markup contract**:
The shared, paradigm-neutral definition of a component's rendered DOM — exact
elements, nesting, and class names — that every variant must emit identically.
There is no shared component *runtime*; each paradigm re-implements the markup
(JSX, Astro, Qwik, HTMX partial, vanilla template) but the DOM it produces is
identical. Together with the shared style rules, this makes pixels identical *by
construction* — so "that variant is slow because its components were written
differently" is never a valid excuse.
_Avoid_: "shared component library" (implies shared runtime code — there is none).

**Presentation zero-bias**:
The design-system counterpart to the data zero-bias guarantee. The *control* is
the declared style rules + the rendered DOM (identical everywhere). The *measured
variable* is how each paradigm delivers and optimizes that CSS — scoping,
code-splitting, critical-CSS inlining, unused-CSS elimination — because those are
genuine paradigm capabilities whose payoff is part of the verdict. "Same styles,
not same delivery," mirroring data's "same data, not same access."

**Semantic token**:
The aliased design token a component actually consumes (`--color-text`,
`--color-surface`, `--space-inset`), one level above the raw primitive scale. The
single seam through which theming and forced-colors are applied — reassign the
semantic token once and every component adapts.

**Reference render**:
The framework-free rendering of each component (canonical markup + shared CSS as
plain static HTML, no framework). Serves two roles: the openable prototype, and the
drift-proof **golden master** every variant is diffed against in CI (normalized-DOM
equivalence + pixel screenshot). Never shipped to a visitor.

**Matched pair**:
An a11y-relevant component shipped in two forms — the compliant **DS-on** default and
a **DS-off** (stripped) counterpart, byte-identical except the accessibility
treatment. The pair makes a side-by-side comparison differ *only* in accessibility;
the DS-off form is what a rushed team ships without the design system.

### Controls & instrumentation

**Contextual switcher** (or just **switcher**):
The live control that swaps the architecture serving the current route by a **hard
navigation** to the target variant's URL — never a soft, in-place swap (there is no
shared runtime to swap). "Contextual" because its control-set is a function of the
surface: render-swap on the spine, data-strategy-swap on the PLP, device/CPU on
Checkout, a11y-mode toggles on the A11y section. Its options are **sparse** — only the
variants a surface is actually built in.
_Avoid_: "toggle" (it navigates, it doesn't flip in place), "framework picker".

**HUD**:
The constant heads-up display of measurement, present on every surface: the selected
profile's published lab snapshot shown alongside the visitor's own live web-vitals.

**Chrome**:
The switcher + HUD together — project **instrumentation**, edge-injected identically
into every variant and deliberately **excluded from each variant's measured KB**. Not
part of any paradigm's own bytes.
_Avoid_: "the UI", "the shell" — chrome is instrumentation, not the store itself.

**Measurement condition**:
The full set of variables that define one reproducible measurement, carried entirely
in the **URL** — path (variant / surface / entity-id) + query (data-volume, cache-
warmth, and the profile snapshot-selector). Because the condition lives in the URL, a
URL *is* a shareable receipt for a measurement. Contrast the **cart**, which is
application state (same-origin storage), not a measurement condition.

## Standing principle

**Real-world fidelity**: a finding is worthless if a working engineer could not
reproduce it in a real production setting. Every design choice is checked against
this — normalization, freezing, and forced cold/warm are all adopted specifically
because they map to real production patterns, and the one thing freezing hides
(dynamic-origin cost) is surfaced honestly via the live-origin demonstration.
