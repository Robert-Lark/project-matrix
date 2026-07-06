# Prototype — the zero-bias design system

The concrete artifact for the `design-system` ticket. It proves the **architecture**
by which one token + component system renders **byte-identically across every
rendering paradigm** — not the final look.

> ⚠ **Placeholder aesthetic.** Every value in the primitive token tier is a neutral
> stand-in. The real look is decided in the `aesthetic-direction` ticket and *poured
> into these primitives* — components never change, because they reference only
> semantic tokens. That swappability is a designed payoff, not an afterthought.

## What's here

- **`tokens.css`** — the two-tier custom-property system. **Primitive** (raw scale)
  → **semantic** (the aliases components consume). Forced-colors and reduced-motion
  are handled once, at the semantic tier.
- **`components/*.css`** — per-component style modules (`release-card`, `button`,
  `field`). Authored as separate modules so each paradigm can deliver them its
  native way (scope / split / inline / tree-shake) without changing the computed
  result.
- **`reference/index.html`** — the **framework-free reference render**: the design
  system applied with plain `<link>`s and hand-written canonical markup. Dual role:
  (1) the openable prototype you react to; (2) the drift-proof **golden master**
  every variant is diffed against in CI. Open it in a browser.

## The decisions it embodies (see [ADR-0003](../../adr/0003-design-system-and-zero-bias-presentation.md))

1. **Shared CSS + canonical markup contract.** The shared thing is CSS + an exact
   DOM shape (elements, nesting, `pm-` BEM classes). Each paradigm re-implements the
   markup but emits identical DOM and imports the same styles → identical pixels by
   construction. No shared component runtime (Web Components rejected — they'd force
   a JS runtime into the very variants whose thesis is "little/no JS").
2. **Presentation zero-bias = same styles, not same delivery.** Declared style rules
   + rendered DOM are the *control*; how each paradigm delivers/optimizes the CSS is
   the *measured variable*. Guardrails: repackage don't re-value; idiomatic default,
   not hand-tuned.
3. **Two-tier tokens.** One indirection (semantic aliases) = the single seam for
   forced-colors and any future theming. Auditable.
4. **A11y shipped as the default.** Focus-visible rings, WCAG target sizes, relative
   units for zoom/reflow, reduced-motion gating, forced-colors remap, and accessible
   form wiring are baked in. State styles off native attributes (`:focus-visible`,
   `[aria-invalid]`), never JS-toggled classes — so a visual defect can't exist
   without the programmatic one. The `field` module ships with a stripped DS-off
   counterpart in the reference render (the "failure" half of the A/B).
5. **Drift is proven, not promised.** Every variant is checked against the reference
   render two ways in CI: normalized-DOM equivalence (ignoring framework scoping
   hashes) + pixel screenshot across the three test profiles.

## Consumes the data contract

The release card renders a `ReleaseSummary` tray from
[`../data-contract/schema.ts`](../data-contract/schema.ts); image `width`/`height`
ride along as data so layout space is reserved before load (honest CLS). Price is
formatted **in render** from `{amount, currency}` — the tray carries data, not UI.

See [ADR-0003](../../adr/0003-design-system-and-zero-bias-presentation.md) for full
rationale and rejected alternatives, and [CONTEXT.md](../../../CONTEXT.md) for vocabulary.
