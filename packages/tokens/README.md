# @pm/tokens

The zero-bias design system ([ADR-0003](../../docs/adr/0003-design-system-and-zero-bias-presentation.md)),
lifted from [`docs/prototypes/design-system/`](../../docs/prototypes/design-system/).
**CSS + assets only — deliberately no runtime** (ADR-0003 §1): a "component"
here is style rules + the canonical markup contract; each paradigm re-implements
the markup in its own idiom.

> ⚠ **Placeholder aesthetic.** Every value in the primitive token tier — colors,
> type scale, and the face itself ("PM Placeholder Sans", a subset of Inter —
> see [`fonts/README.md`](fonts/README.md)) — is a neutral stand-in. The real
> look is `aesthetic-direction`'s decision and pours into the primitives with
> zero component changes. That swappability is the designed payoff.

## Layout

- `css/tokens.css` — the two-tier token system: **primitive** (raw scale, never
  consumed by a component) → **semantic** (the one seam). Forced-colors remap
  and reduced-motion gating both live at the semantic tier (ADR-0003 §4–§5).
- `css/fonts.css` + `fonts/` — the self-hosted, subset placeholder font: a
  controlled constant, identical files + loading everywhere (ADR-0003 §8).
  Canonical loading markup: [`fonts/loading-markup.html`](fonts/loading-markup.html).
- `css/components/*.css` — per-component modules (`release-card`, `button`,
  `field`), authored separately so each paradigm delivers them its native way
  (scope / split / inline / tree-shake) without changing the computed result —
  "repackage, don't re-value" (ADR-0003 §2).
- `test/` — structural guards: components consume semantic tokens only, the
  forced-colors remap covers every color semantic, motion gating exists, and
  the package ships no JS.

How each paradigm *delivers* this CSS is the measured variable; the declared
rules are the control. See [CONTEXT.md](../../CONTEXT.md) ("presentation
zero-bias") for the vocabulary.
