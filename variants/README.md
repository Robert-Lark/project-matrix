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
- **`react-next`** — the REQUEST-TIME precedent (editorial-build slice B):
  Next.js on the OpenNext Cloudflare adapter, SSR per request. Copy this one,
  not `vanilla`, for any variant that fetches trays at request time (Qwik,
  HTMX, Remix 3): a request-time variant **binds `pm-edge` itself** in its own
  `wrangler.jsonc` (the front Worker's `EDGE` binding does not reach a variant
  server-side), which is also why the CI deploy step deploys `pm-edge` before
  the variants. Registers Next's App Router streaming wrapper through
  `NoiseSpec.dropElementSelectors`, the whole-element noise class it minted.
- **`astro`** — the second BUILD-TIME variant (editorial-build slice C):
  islands, static output, no adapter; binds nothing at request time. The
  variant that registers NOTHING in `PERMITTED_NOISE` as a measured outcome
  rather than by design, and whose `DIFF-TO-STARTER.md` records why one
  interactive button is not an island (an `<astro-island>` wrapper is an
  element the drift gate cannot excuse). Its pre-merge master-identity guard
  lives in its OWN workspace (`test/`), driven by Astro's Container API,
  because loading a `.astro` file needs Astro's compiler.
- **`qwik`** — the second REQUEST-TIME variant (editorial-build slice D):
  resumability, on the official `cloudflare-workers` integration; binds
  `pm-edge` itself like `react-next`, and fetches trays through a
  `routeLoader$` per request. The first variant whose registered noise is ALL
  mechanism (`^q:`/`^on:`/`^on-document:` under `behaviorAttrPatterns`, nothing
  under `attrPatterns`) — and the first that needs a registration for
  attributes on the `<html>` ELEMENT, which the drift gate compares. Its whole
  URL prefix comes from ONE value (`base` in `vite.config.ts`): qwik-city's
  router, the client's on-disk output directory, `q:base`, and the asset URLs
  are all derived from it. Pre-merge master-identity guard in its own `test/`
  (needs `qwikVite()`), driven by Qwik's own `renderToString`.
- **`htmx`** — the third REQUEST-TIME variant, and the second starterless one
  (editorial-build slice E): hypermedia — a hand-written Worker renders the
  complete page per request (the paradigm IS the template), with the PINNED
  `htmx.org` runtime vendored into the variant's own assets and served
  same-origin as a script tag (never a CDN include — the suite's request
  tracker fails any request off the composed origin). Binds `pm-edge` itself
  like `react-next`/`qwik`. Registers `^hx-` under `behaviorAttrPatterns`
  in `PERMITTED_NOISE`, and nothing else — a measured outcome, arrived at
  in two steps. Through the editorial build it registered NOTHING, because
  editorial's one interaction is client cart state, which hypermedia does
  not own, so that page idiomatically carries zero `hx-*` attributes (the
  honest hypermedia statement ISSUE E names). The PLP build is where `hx-*`
  earned its keep: three attributes on one `<nav class="pm-pagination">`,
  and the registration is the case the old note predicted in so many words.
  `attrPatterns` and `classPatterns` stay empty and that is the load-bearing
  part — the entry admits this paradigm's behavior attributes, never
  ordinary markup. The editorial page still carries zero `hx-` bytes, which
  the origin suite asserts against the served response rather than inferring
  from the registry. Its
  `DIFF-TO-STARTER.md` records why the runtime still ships. Pre-merge
  master-identity guard in `tools/repo-checks` (plain-JS renderer, the
  vanilla mechanism — byte-strict, both snapshots). Completed the editorial
  surface: `SURFACE_CONTROLS.editorial.plannedVariants` emptied with this
  slice.
- **`remix3`** — the FENCED frontier exhibit (editorial-build slice F):
  Remix 3 beta, non-React server HTML + frames, on a hand-rolled Workers
  entry — no official Workers target exists, so `src/worker.ts` IS the
  adapter (ADR-0004 second addendum; the `docs/prototypes/remix3-frontier`
  spike is prior art). The fourth REQUEST-TIME variant (binds `pm-edge`
  itself) and the first fenced one: excluded from every benchmark number by
  MECHANISM — on-surface plaque, a tagged `fencedExhibits` switcher cell
  (never a reading-table column), and a bench runner that refuses
  `/remix3/*` targets outright. `remix` is pinned EXACT and the committed
  lockfile pins the `@remix-run/*` sub-packages; the spike's `test.sh` is
  the canary on any bump. Registers NOTHING in `PERMITTED_NOISE` (the
  SECOND earned emptiness, with `astro`'s — it was written as the third
  while htmx's was still empty, and htmx's stopped being empty when the PLP
  build landed its paginator; remix's residue is comments, and its mechanism
  attributes live only inside the two `[data-pm-fenced]` subtrees the
  scoped drop removes). Drift comparison is ADVISORY (warns, never fails
  CI — ADR-0003 first addendum); the pre-merge master-identity guard in its
  own `test/` (needs remix/ui's JSX runtime) BLOCKS, because the lockfile
  makes it deterministic. Its `DIFF-TO-STARTER.md` records the hand-rolled
  entry, the drain-before-respond boundary, and every measured
  serialization behavior.
- the **throwaway placeholder stand-in variants** (issue #3) —
  `placeholder-static` (assets + the one-line forwarder script) and
  `placeholder-ssr` (per-request render with representative permitted
  paradigm noise for the drift gate). Both serve the same
  `/{variant}/sample/` surface; they keep serving the composed-origin proofs
  until a deliberate cleanup ticket (editorial-build PRD non-goal).
