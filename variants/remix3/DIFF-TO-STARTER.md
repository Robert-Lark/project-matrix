# DIFF-TO-STARTER — remix3

**No official starter exists for this deployment shape** (the third
starterless case, after vanilla and htmx — and the sharpest: Remix 3 has no
official Cloudflare Workers target at all, only a Node ≥24.3 template). The
prior art is this repo's own spike, `docs/prototypes/remix3-frontier/`
(runnable per its README; `test.sh` 42/42 across both hosts), whose findings
ADR-0004's second addendum turned into the hosting decision of record: a
hand-rolled Workers entry on the canonical plane. The whole tree is the
diff; where a file descends from the spike or the official Node template,
that lineage is noted.

This exhibit is FENCED: excluded from every benchmark number (ADR-0003 first
addendum; `remix3-frontier` FINDINGS §7). The fence excludes numbers, not
visual identity (§4) — the page serves the canonical editorial markup and
the cart contract like every core variant.

## Files

- `src/worker.ts` — the entire "adapter" (~40 lines with the route guards);
  descends from the spike's `worker/index.ts`. See decisions 1–3.
- `src/router.tsx` / `src/routes.ts` / `src/render.tsx` — the fetch-router +
  renderToStream composition, from the spike's `app/` (itself from the
  official template); `render.tsx` deviations in decision 5.
- `src/ui/*.tsx` — the canonical markup re-implemented as Remix 3 `Handle`
  components, plus the two fenced subtrees (decisions 4, 6, 7).
- `src/lib/essays.tsx` — the committed essays re-typed as JSX (decision 13).
- `src/lib/format.ts` — the lib.mjs formatting rules re-implemented; no
  `esc()` (decision 7).
- `src/lib/data.ts` — per-request trays through this Worker's own pm-edge
  binding (the slice-B/D/E request-time precedent).
- `src/snapshot.mjs` (+ `.d.mts`) — the featured-release policy module, the
  htmx shape verbatim (plain `.mjs` + JSON import attributes so wrangler's
  esbuild and the guard's plain-Node vitest load the same file).
- `src/unavailable.ts` — the branded 503 as a STATIC string (decision 3).
- `src/client/entry.ts` — the template's `run()` bootstrap verbatim
  (decision 5).
- `src/cart.js` — the cart contract as a plain page-level script
  (decision 5).
- `src/frontier.css` — exhibit-only styling for the fenced subtrees
  (decision 6).
- `build.mjs` — esbuild prebuild of the client runtime + verbatim tokens
  css/fonts copy (decision 1).
- `wrangler.jsonc` — `pm-remix3`, plane-shared compatibility date, NO
  compat flags, assets-first `dist/`, `EDGE` service binding.
- `test/master-identity.test.ts` / `test/worker-fallback.test.ts` — the
  pre-merge guards, in this workspace not repo-checks (decision 8).

## Pinned tooling

`remix` is pinned EXACT at `3.0.0-beta.5`; the metapackage caret-ranges
every `@remix-run/*` sub-package, so **the committed lockfile is the real
pin of the render path**. The spike's `test.sh` is the canary on ANY bump.
Re-verified at build time (2026-08-11, the ISSUE F duty): npm's `next`
dist-tag still names `3.0.0-beta.5` (published 2026-07-01; the registry's
`modified` timestamp coincides, so nothing newer exists package-wide),
GitHub's `remix@3*` tags still end at `beta.5`, and every sub-package's
`latest` was last modified on or before 2026-07-01 — a fresh install today
resolves exactly what the spike verified. esbuild `^0.28.1` (the spike's),
wrangler `^4.110.0` (the plane's), typescript `^6.0.3` (the repo's — the
slice-D pin lesson).

## Recorded decisions

1. **Hand-rolled Workers entry; client assets PREBUILT.** The template's
   asset server (`createAssetServer`) compiles client entries per request
   and is Node-only (fs + esbuild + chokidar); the Workers-shaped
   equivalent is an esbuild prebuild into `dist/remix3/assets/` served
   assets-first (the spike's `build-client.mjs` is prior art). Deviation
   from the spike: `minify: true` — the spike kept dev builds; a real
   adapter would minify, and the exhibit publishes no numbers either way.
   No `nodejs_compat` flag anywhere: the spike's verified claim is that the
   pinned beta's core render path is web-standard, and this variant keeps
   that claim honest — if a future pin needs the flag, record it here AND
   in the spike's FINDINGS.

2. **The router is built PER REQUEST**, with `env` closed over — the spike
   built it once because it had no bindings; a request-time variant must
   reach its EDGE service binding from controller actions, and fetch-router
   offers no request-scoped injection at this pin. Two routes + one
   middleware make the per-request cost negligible, and nothing survives
   across requests that could leak one request's data into another.

3. **Drain-before-respond** (deviation from both spike and template, which
   stream the document): the full body is buffered before the first byte
   leaves, so a render-time throw — a malformed-but-200 tray, a framework
   ≥500 — lands in the branded-503 guard instead of truncating a committed
   200 (the plane's "never an unbranded failure page" contract; slice E's
   render-inside-the-guard finding made it a standing duty, and
   `test/worker-fallback.test.ts` proves all three failure classes).
   What is given up: the streamed document shell — a real paradigm feature.
   What is kept: frames still stream over the wire on reload (the flagship
   behavior), and the exhibit's frame resolves inline during SSR anyway.
   The fallback page itself is a static string that cannot throw and does
   not depend on the machinery whose failure it reports.

4. **Exactly TWO fenced subtrees, count-pinned.** The plaque (the DS plaque
   component's canonical fenced form — kicker · name · claim · rule,
   `data-pm-fenced="true"`) sits at the TOP of main: the boundary reads
   before the content (the a11y-section label-first principle). The frames
   demo — the paradigm made visible, without which the §5 browser coverage
   would have nothing to cover — sits AFTER the article: the store wins
   the page, apparatus is the appendix. The demo's own copy declares it
   "exhibit apparatus, not store content," which keeps the article's
   canonical "only interactive element on this page" feature-note honest —
   the demo's anchors are the exhibit's instrument, like the injected
   chrome, not the store. Both subtrees are dropped from the drift
   comparison by the scoped `dropFencedSubtrees` mechanism (a call-site
   flag, never a NoiseSpec field — no registration can smuggle it in), and
   the suite pins the count at exactly 2 so nothing else can ride the
   fence. The demo's `?pick=` state is a new query-param class (exhibit
   demo state, the JS-off fallback's URL); it swaps ONLY the fenced card —
   the canonical page around it is byte-invariant (tested) — and lands
   harmlessly on core variants via the switcher's query-preserving swap
   (they ignore it).

5. **No `clientEntry` island ships.** Editorial's one interaction is
   page-level client cart state touching three DOM regions (button,
   masthead slot, status region); Remix 3's island primitive scopes to its
   own subtree, so forcing the cart into an island would be exhibit
   theater, not idiom — the honest minimal shape is the plain script
   (`src/cart.js`), the astro/htmx precedent restated for a framework that
   DOES own client interactivity. Consequences, both measured: the
   template's workerd `clientEntry()` stable-id friction (spike FINDINGS
   friction #1) never engages, and `render.tsx` omits `resolveClientEntry`
   entirely. The client bootstrap (`run()`) still ships verbatim — it
   drives the frames demo (anchor interception, frame reloads, history).

6. **`css()` is deliberately unused on every served element.** The spike
   proved the mixin works on workerd; using it would put `rmxc-*` classes
   and a `<style data-rmx>` into the served document for zero exhibit
   value, and the drift registry's measured-clean outcome (no
   `PERMITTED_NOISE` entry at all) is worth more than demonstrating an
   optional styling idiom. The fenced subtrees are dressed by a
   variant-owned stylesheet (`frontier.css`, semantic tokens only); store
   components use the shared CSS verbatim, delivered as plain links.

7. **Measured serialization behaviors** (why the byte-strict vanilla/htmx
   guard mechanism cannot apply): the serializer reorders attributes
   (`class` always last), leaves `'`/`"` raw in TEXT while escaping the
   full set in attribute values (`escapeTextContent` vs `escapeHtml`, read
   from the installed dist), self-closes void elements, and
   `createHtmlResponse` emits an uppercase `<!DOCTYPE html>`. Frame
   boundaries are `<!-- rmx:f:… -->`/`<!-- /rmx:f -->` comments with a
   per-render id, plus a `<!-- rmx:flush … -->` trailer — comments, already
   ADR-0008 freedoms. The `#rmx-data` frame-status script IS emitted at the
   end of body — a `<script>`, delivery, dropped by every comparison — and
   its presence is pinned by an explicit assertion in
   `test/worker-fallback.test.ts`. (An earlier draft of this receipt
   recorded it ABSENT with stream-resolved frames, misread from a
   post-strip test dump; the verify-slice anti-rigging lens forced the
   citation to become an assertion and the assertion disproved the claim —
   the pin exists so this record cannot drift again.) The registry comment
   in `tools/drift-gate/src/normalize.ts` records the full species list. `crossorigin="anonymous"` on the font preloads: the JSX
   type admits only the named states; the canonical bare attribute is the
   EMPTY-value form, and per the HTML spec the empty value default and
   `"anonymous"` both select the Anonymous CORS state (the MISSING-value
   default is No CORS — deleting the attribute would break preload reuse,
   not preserve it). The suite's font leg tolerates the framework form like
   react-next's `crossorigin=""`. (Wording corrected by the verify-slice
   correctness lens against the fetched spec — the first draft claimed
   missing = Anonymous.)

8. **The pre-merge identity guard is the react-next mechanism** (normalized
   DOM via the real drift-gate `PAGE_NORMALIZE` over linkedom), not the
   byte-strict vanilla/htmx one (see 7), and it lives in THIS workspace,
   not `tools/repo-checks` (the astro precedent: rendering needs remix/ui's
   JSX runtime, and hosting a framework's compiler in repo-checks would
   route every repo-wide guard through it). It renders through the REAL
   Worker path with a stub EDGE serving the committed trays — snapshot
   policy, controller, middleware, and serializer all execute pre-merge
   (the slice-E lesson) — for BOTH snapshots, with the fenced drop proven
   load-bearing by a divergence complement. The guard BLOCKS while the
   drift leg is advisory, deliberately: the lockfile pins the whole render
   path, so this guard's outcome changes only when a commit changes the
   tree — the weekly-beta weather the advisory fence exists for cannot
   reach it.

9. **`PERMITTED_NOISE` registers nothing — measured-empty** (the astro/htmx
   precedent). `rmx-target`/`rmx-src` (FINDINGS §2 named them this slice's
   registration call "IF they appear in served DOM") appear ONLY inside the
   fenced demo subtree, which the scoped drop removes before comparison —
   on COMPARED elements they never occur, so registering them would be
   exactly the vacuous-excuse class slice D's non-vacuity scoping rejects.
   The suite asserts the emptiness against raw served bytes SCOPED to
   compared content, with the mechanism's presence inside the fence
   asserted alongside so the scoping strips something real.

10. **Frame partials pass through the front Worker untouched** (the
    q-data.json precedent): a partial is HTML that is not a page, so
    injecting chrome or error-logging its designed slotlessness would both
    be wrong. Deliberately variant-scoped
    (`/remix3/editorial/frames/*`), not a plane-wide `/frames/`
    convention — no other variant serves HTML partials today. HAND-OFF: the
    PLP build (htmx loaders+PE serves HTML partials) should generalize this
    deliberately.

11. **`@remix-run/render-middleware` needs a `packageExtensions` entry**
    (pnpm-workspace.yaml): its PUBLISHED `dist/lib/render.d.ts` carries an
    inline import type of a sibling package's raw TS source
    (`../../../fetch-router/src/lib/request-context.ts`), which imports
    `@remix-run/route-pattern` — undeclared by render-middleware, so
    unresolvable under the repo's `hoist: false` isolation. Types-only leak
    (the runtime js imports only declared deps); third instance of the
    class (OpenNext's esbuild, qwik-city's core), found by this slice.
    Declared as a peer for the qwik-city reason. Proving the fix required
    a full node_modules WIPE (the slice-D sabotage lesson —
    `pnpm install --force` lies about resolution changes).

12. **Essays re-typed as JSX with explicit string segments** — the
    recorded slice-A call (essay copy is variant-owned content; the
    no-component-runtime guard bars a runtime import), transcribed so JSX
    whitespace rules can never reshape the contract text. One deliberate
    wart mirrored: the contract template interpolates `formatPrice(...)`
    raw (a null would print `"null"`), and Remix skips null children, so
    the transcription wraps it in `String()` — textual identity under all
    inputs beats prettiness.

13. **HEAD is routed as GET and answered without a body** (RFC 9110
    §9.3.2): `remix/routes`' `get()` matchers see the method, and the
    platform strips bodies only for responses IT generates.

14. **The exhibit's version string is tool-derived end-to-end**: the plaque
    renders it from this package.json's own dependency pin (JSON import),
    the chrome tag is cross-checked against the same pin by the origin
    suite, and the guard asserts the installed package's version equals it
    — a bump cannot leave a stale number anywhere without going red.
