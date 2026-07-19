# variants/

One workspace per rendering paradigm — vanilla, heavy-hydration (React/Next),
islands (Astro), resumability (Qwik), hypermedia (HTMX), plus the fenced Remix 3
frontier (ADR-0004 §2).

Current occupants:

- **`vanilla`** — the first REAL variant (editorial-build slice A): static
  HTML, no runtime; serves `/vanilla/editorial/` against the ADR-0008
  editorial master. Snapshot-parameterized build (`PM_SNAPSHOT`: `fixture`
  default, `crate` on the deploy job — declared as turbo env + tray inputs
  on `@pm/vanilla#build`); the drift-gate registry's NO_NOISE control; the
  cart contract's first implementation
  (`packages/reference/render/shell.mjs` `CART_CONTRACT`). Its
  `DIFF-TO-STARTER.md` records the starterless call and the composition
  pattern the other editorial slices copy.
- the **throwaway placeholder stand-in variants** (issue #3) —
  `placeholder-static` (assets + the one-line forwarder script) and
  `placeholder-ssr` (per-request render with representative permitted
  paradigm noise for the drift gate). Both serve the same
  `/{variant}/sample/` surface; they keep serving the composed-origin proofs
  until a deliberate cleanup ticket (editorial-build PRD non-goal).
