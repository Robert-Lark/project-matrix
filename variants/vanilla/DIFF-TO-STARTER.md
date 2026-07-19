# DIFF-TO-STARTER — vanilla

**No official starter exists for this paradigm** (editorial-build PRD: the
starterless case, recorded rather than scaffolded). "Vanilla" means static
HTML with no framework runtime; the honest minimal shape is a hand-rolled
static build in the `placeholder-static` mold, and **the whole tree is the
diff** — small enough to read:

- `render.mjs` — the variant's own re-implementation of the editorial
  canonical markup (template literals over the frozen trays).
- `build.mjs` — the snapshot-parameterized static build (`PM_SNAPSHOT`:
  `fixture` default, `crate` on the deploy job); copies `@pm/tokens`
  css/fonts into the variant's own assets (ADR-0003 §2 delivery) and the
  cart enhancement into `assets/cart.js`.
- `src/index.js` — the one-line `env.ASSETS.fetch(request)` forwarder every
  static variant ships (spike hardening 1).
- `src/cart.js` — the one client enhancement: add-to-cart against the cart
  storage contract (`packages/reference/render/shell.mjs` `CART_CONTRACT`).
- `wrangler.jsonc` — assets Worker, `workers_dev: false` (reachable only
  through pm-front's service binding).

Pinned tooling: `wrangler ^4.110.0` (the workspace pin; exact version in the
committed `pnpm-lock.yaml`).

## Recorded decisions (slice A precedents the other variants copy)

1. **Essay copy is re-typed as variant-owned content, not imported from
   `@pm/reference` at build time.** The PRD left this call to slice A. Why
   re-type: `@pm/reference` deliberately exposes no JS entry point (the
   no-component-runtime guard, ADR-0003 §1), and the request-time paradigms
   (react-next SSR, qwik, htmx) would otherwise have to bundle reference
   renderer code into their served Workers — reference code executing in a
   variant's production path is exactly what the guard exists to prevent.
   Textual identity is policed mechanically either way: the drift gate
   compares this page against the fixture master in CI, and the deployed
   smoke re-renders the master from the RESOLVED snapshot and compares the
   served page (ADR-0008 §9), so a copy edit that misses a variant fails the
   gate instead of shipping silently.
2. **Canonical formatting rules are re-implemented, not shared.**
   `packages/reference/render/lib.mjs` is the rules of record (price, stock,
   meta); each paradigm formats in its own code and the gate proves the
   strings match (ADR-0002 §6 kept display strings out of the trays for
   exactly this).
3. **The crate's featured id is the recorded design constant** (editorial
   953800, ADR-0008 §9 — a curated pick, not a receipt); the fixture's comes
   from its `curation.json`.
4. **The enhancement's data hook is a `<script type="application/json">`
   element, not a data attribute.** Script elements are delivery, not
   contract (ADR-0008 serialization freedoms), so the canonical DOM carries
   nothing extra and vanilla stays the registry's NO_NOISE control.
5. **Add to cart** implements `CART_CONTRACT` (key `pm:cart`, versioned
   value, count = Σ qty, announcement via `[data-pm-status]`); the masthead
   count populates from storage on every page load, which is what makes the
   cart survive a variant swap.
