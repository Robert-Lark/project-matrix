# DIFF-TO-STARTER — htmx

**No official starter exists for this paradigm** (editorial-build PRD: the
second starterless case, recorded rather than scaffolded). htmx's documented
install IS a script tag, not a scaffold — the htmx.org docs open with
`<script src=".../htmx.org@2.0.x/dist/htmx.min.js">` — so "hypermedia" here
means a hand-written Worker that renders complete HTML per request, plus that
script tag. **The whole tree is the diff**, small enough to read:

- `src/render.mjs` — the variant's own re-implementation of the editorial
  canonical markup (template literals over request-time tray data; the
  paradigm IS the template). Framework-neutral: the pre-merge
  master-identity guard imports it directly (the vanilla mechanism,
  byte-strict, both snapshots).
- `src/index.js` — the Worker: `/htmx/editorial/` renders per request from
  trays fetched through this Worker's OWN pm-edge service binding (the
  slice-B request-time precedent); `/htmx/editorial` 301s to the
  trailing-slash form with a RELATIVE Location; unknown paths under the
  prefix 404 cleanly; an edge failure answers 503 inside the store's own
  shell (the slice-B/D branded-fallback precedent).
- `src/snapshot.mjs` — the featured-release policy (fixture id from the
  committed `curation.json`, crate id = the recorded ADR-0008 §9 design
  constant 953800), imported with `with { type: "json" }` so the module
  loads identically under wrangler's esbuild and plain Node.
- `src/cart.js` — the one client enhancement, consuming the cart storage
  contract (`packages/reference/render/shell.mjs` `CART_CONTRACT`).
- `build.mjs` — assembles `dist/htmx/assets/`: `@pm/tokens` css/fonts
  verbatim (this paradigm's delivery, ADR-0003 §2), the VENDORED htmx
  runtime, and the cart enhancement. NOT snapshot-parameterized — nothing
  request-time bakes trays, so `PM_SNAPSHOT` never appears here.
- `wrangler.jsonc` — assets + Worker, `workers_dev: false`, `services`
  binding to pm-edge.

Pinned tooling: `htmx.org 2.0.10` (exact — see decision 2), `wrangler
^4.110.0` (the workspace pin; exact version in the committed
`pnpm-lock.yaml`).

## Recorded decisions

1. **The htmx runtime ships on this page even though nothing on it uses an
   `hx-*` attribute — and that is the honest shape, recorded rather than
   optimized away.** Editorial's one interaction is client cart state, which
   hypermedia does not own (there is no server cart by contract — ADR-0004
   §5: localStorage holds the cart ONLY, so it survives a variant swap). A
   hypermedia site includes its runtime site-wide and spends attributes only
   where the server owns the interaction — the PLP and checkout builds are
   where `hx-*` earns its keep (`SURFACE_CONTROLS` already plans htmx
   there). The two rejected alternatives, and why:
   - *Drop the script on this surface* — makes the column indistinguishable
     from a second vanilla and stops measuring the paradigm's real site-wide
     cost, exactly the flattery the reading table exists to prevent (the
     qwik eager-chunk precedent: record the honest cost, never rig the page
     to fit the instrument).
   - *Invent an `hx-*` cart interaction* — a server cart endpoint would
     break cart-survives-the-swap and misstate the paradigm (htmx swaps
     server HTML; the cart is client state by contract).
   Measured on the built asset (2.0.10, tool-derived: `ls -l` / `brotli -c |
   wc -c`): `htmx.min.js` is 51,238 B raw, **14,996 B brotli** (16,618 B
   gzip) — external-file JS, the same delivery shape as vanilla's
   enhancement, so the decomposed ruler (issue #16) needs nothing new for
   it. That ~15 KB is the paradigm's site-wide runtime cost landing on a
   page that uses none of it — the honest number the reading table should
   show, sitting between vanilla (1.35 kB) and qwik (26.83 kB) on the
   surface whose thesis is how much machinery prose needs.
   Ground truth through the composed origin (JS-on, resource timing, local
   dev serves gzip): at LOAD the page fetches `htmx.min.js` (16,903 B
   transfer / 51,238 B decoded) and `cart.js` (1,823 B / 3,160 B) — plus the
   chrome's `/_pm/measure.js`, instrumentation stripped by known path — and
   the add-to-cart click fetches **0 new requests** (localStorage write, no
   hypermedia round trip: the interaction htmx doesn't own costs the wire
   nothing).
2. **`htmx.org` pinned EXACT at 2.0.10, vendored, served same-origin.**
   Never a CDN include: the suite's request tracker fails any request off
   the composed origin, and a third-party host would be an unmeasured,
   uncontrolled variable (ADR-0003 §8's controlled-constant logic applied to
   delivery). The bytes come from the lockfile-pinned npm package at build
   time (`require.resolve("htmx.org/dist/htmx.min.js")`) — nothing is copied
   into git, and the origin suite asserts the SERVED file byte-identical to
   the installed package. htmx 4.x exists only as alpha/beta (the project
   skipped 3.x); a pre-release runtime would make this a fenced exhibit
   under ADR-0003's first addendum (the qwik-v2 precedent), so 2.0.10 — the
   newest stable at build time — is the pin.
3. **Zero `hx-*` attributes on the served page is an honest hypermedia
   statement, so NOTHING registers in `PERMITTED_NOISE`** (editorial-build
   ISSUE E names exactly this case). Like astro (slice C) the entry's
   absence is a MEASURED outcome asserted against raw served bytes, not a
   design assumption — the drift comparison runs under `NO_NOISE`, and the
   suite fails if an `hx-*` shape ever appears without a deliberate
   registration through slice A's `behaviorAttrPatterns` class.
4. **Script placement: all three script elements ride at the end of
   `<body>`** — the JSON data hook first, then `htmx.min.js` deferred, then
   `cart.js` deferred (render.mjs emits `[...hooks, ...RUNTIME_SCRIPTS]`;
   an earlier draft of this receipt recorded the hook second — caught by
   the slice's verify-slice pass, four lenses independently). Script
   elements are delivery, not contract (ADR-0008 freedoms); htmx's docs
   place the tag in `<head>`, but this variant keeps its delivery
   consistent with its own enhancement and the canonical DOM identical
   either way.
5. **Asset base is ABSOLUTE (`/htmx/assets/...`)** where vanilla's is
   relative: the Worker will serve htmx partials from deeper paths on later
   surfaces (the PLP build), and relative asset URLs would silently break
   there. The front Worker never rewrites paths, so the prefix is this
   variant's own duty (the react-next/astro/qwik precedent).
6. **No `binding` under `assets`** in wrangler.jsonc: assets are served
   assets-first by the platform; nothing in this Worker's code fetches the
   asset layer (unlike qwik-city's middleware, which is why slice D needed
   the `ASSETS` name). An unused binding would be dead config.
7. **Essay copy is re-typed as variant-owned content** (the recorded slice-A
   call, same reasoning: `@pm/reference` exposes no JS entry point, and
   reference code executing in a variant's production path is what the
   no-component-runtime guard exists to prevent). Textual identity is
   policed three ways: the pre-merge byte-strict guard (both snapshots), the
   CI drift gate against the fixture master, and the deployed smoke against
   the master re-rendered from the resolved snapshot (ADR-0008 §9).
8. **The release card renders from the DETAIL tray** (one `/api/pdp/{id}`
   call — the request-time shape, the qwik projection precedent). The card's
   fields are tray-identical between summary and detail; the byte-strict
   pre-merge guard proves that per snapshot rather than assuming it.
