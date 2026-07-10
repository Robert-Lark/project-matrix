# @pm/drift-gate

The [ADR-0003 §6](../../docs/adr/0003-design-system-and-zero-bias-presentation.md)
drift gate (issue #6): **drift proven, not promised**. Every variant page,
fetched through the composed origin exactly as a visitor gets it (chrome
injection active), is compared against the reference render two ways — either
failing the build:

1. **Normalized-DOM equivalence** — the browser's own parse of the served
   page, minus exactly the permitted noise (see below), must equal the
   golden master's. Catches markup drift pixels can hide (a wrong `alt`, a
   dropped attribute, changed nesting).
2. **Pixel diff** — full-page screenshots against the reference render at
   the three published test profiles' viewports (`@pm/measurement`'s
   versioned spec), zero differing pixels. Catches rendering drift markup
   can hide (a re-valued token — ADR-0003 §2's "repackage, don't re-value",
   automated).

The checks run in `tools/origin-suite/suite/drift.browser.test.ts` as part of
`pnpm run origin-suite` — the one command — so CI gates every push, and the
post-deploy smoke re-runs the gate against the real deployed origin.

## What the gate ignores, and why it may

- **The chrome slot** (`div#pm-chrome-slot`, subtree AND element): chrome is
  edge-injected instrumentation, not any variant's markup
  ([packages/switcher/README.md](../../packages/switcher/README.md)). The DOM
  normalizer drops it; the pixel leg **removes** it from the live page before
  screenshotting — removal, not region-masking, because the chrome sits in
  normal document flow and shifts everything below it. The reference render
  has no slot; after exclusion both sides agree by contract.
- **Comment nodes** — permitted paradigm noise (SSR boundaries).
- **`script`/`style`/`link`/`template` elements** — *delivery*, the measured
  variable (ADR-0003 §2): inlined critical CSS or a hydration payload is
  repackaging, not drift. Re-valuing what those bytes *render* is drift — the
  pixel check's half.
- **Registered per-variant noise** — hydration-marker attributes + scoping
  hash classes, declared per variant in `PERMITTED_NOISE`
  (`src/normalize.ts`). One auditable place; a variant may strip only what
  it registers there.

Everything else must match: elements, nesting, attributes (including the
`<html>`/`<body>` elements' own — a dropped `lang` is drift), class names,
text.

## Known boundaries (deliberate, not gaps to paper over)

- **The gate proves the SERVED DOM only.** Contexts are JS-off, so a
  hydrating variant's post-load DOM mutations (e.g. a React hydration
  mismatch patching the page) are unchecked. A JS-on second pass that waits
  for hydration to settle and re-runs the DOM check lands with the first
  hydrating variant.
- **Pixel coverage is exactly the three published profiles.** Style that
  activates only outside them (`@media print`, `forced-colors`, >1440px
  widths) is invisible to the pixel check, and delivery elements are dropped
  from the DOM check — so a token re-valued only under such a condition
  would pass. Forced-colors verification belongs to the a11y section's
  builds; the profile net widens if the profile spec ever does.
- **The element-category drop (`script`/`style`/`link`/`template`) is wider
  than issue #6's "only the permitted paradigm noise" list.** That is
  ADR-0003 §2 winning over issue text (delivery is the measured variable —
  inlined critical CSS must not fail the DOM check), flagged on the issue
  rather than silently resolved.

## Why the gate trusts itself

- The normalizer runs **inside the driven browser** (`page.evaluate`) — the
  DOM under test is the browser's own parse of the served bytes, not a
  second parser's opinion.
- Contexts are **JS-off**: the served markup is what the contract governs,
  the SSR paradigm noise can't be hydrated away before the normalizer proves
  it strips it, rendering can't tick mid-screenshot, and gate runs fire no
  beacons into the collector.
- The reference screenshot is captured **live in the same run and browser
  build** as the variant's — no stored baseline images to go stale.
- `fixtures/drifted-sample/` is the **deliberate-drift fixture**: a copy of
  the golden master with a wrong `alt` (DOM-visible, pixel-neutral) and a
  re-valued `--color-text` via an extra stylesheet (pixel-visible,
  DOM-invisible), plus a *populated fake chrome slot*. The suite asserts the
  gate fails it on **both** checks despite the chrome exclusion — each check
  is proven to catch exactly the class only it can see, and exclusion is
  proven unable to mask drift.

## The golden master

`packages/reference/surfaces/sample/index.html` — the sample surface's
canonical markup as a framework-free page (the surface-level composition of
the per-component reference renders; `packages/reference/index.html` remains
the per-component demo). Served, along with the fixture, by this package's
repo-root static server (`src/server.ts`, ephemeral port) so workspace-linked
`@pm/tokens` assets resolve to the same bytes variants ship.

Like `@pm/origin-suite`, this package has **no `test` script**: the gate
needs a browser and the running composed origin, and `turbo run test` must
stay green without either.
