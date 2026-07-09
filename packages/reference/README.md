# @pm/reference

The framework-free **reference render** ([ADR-0003 §6](../../docs/adr/0003-design-system-and-zero-bias-presentation.md)),
lifted from [`docs/prototypes/design-system/reference/`](../../docs/prototypes/design-system/reference/).

`index.html` is the **golden-master spec**: the canonical `pm-` markup contract
rendered with the shared `@pm/tokens` CSS and font as plain static HTML — no
framework, no scripts. In CI (the drift gate, issue #6) every variant is checked
against it by normalized-DOM equivalence + pixel diff across the three test
profiles. The measurement harness reuses it; downstream, the a11y section's
compliant baseline does too.

It is a *spec*, not consumed code, and it is **never deployed as a variant** —
nothing a visitor loads is this file.

Open it directly in a browser (after `pnpm install`, the `./node_modules/@pm/tokens`
workspace link resolves the CSS and font).

**Serving it for the drift gate (issue #6):** the asset links resolve through
`./node_modules/@pm/tokens`, which pnpm creates as a symlink pointing *outside*
this package (`../../../tokens`). A static server rooted at this directory must
follow symlinks (some treat that as opt-in), or serve the **repo root** instead
— then every link resolves as a plain path. Verified 2026-07-07: Python's
`http.server` on the repo root serves all six assets 200, font included.
