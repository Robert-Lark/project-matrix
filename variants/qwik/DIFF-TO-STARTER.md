# DIFF-TO-STARTER — qwik

**Scaffold command (exact, pinned):**

```sh
npm exec --yes -- create-qwik@1.20.0 empty ./qwik   # run from variants/
cd qwik && npm exec --yes -- qwik add cloudflare-workers
```

Resolved by the first command: `@builder.io/qwik@1.20.0` + `@builder.io/qwik-city@1.20.0`
(the starter declares `^1.20.0`; exact resolutions are pinned in the committed
`pnpm-lock.yaml`, and this workspace's `package.json` pins the two framework
packages exactly rather than by range). `1.20.0` is the `latest` dist-tag.

**Why v1 and not v2.** `@qwik.dev/core@2.0.0-beta.38` is the v2 line and still
BETA. A beta framework is a *fenced exhibit* under ADR-0003's first addendum —
that is what remix3 is, and fenced exhibits are excluded from every benchmark
number. qwik is a CORE measured variant on this surface, so v1 stable is the only
pin consistent with the fairness rules. Matches ISSUE D's own text ("v1 stable").

**Honest note on how the integration was applied.** `qwik add` is interactive:
it initialises a TTY even with `--yes`, and dies with `ERR_TTY_INIT_FAILED` in a
non-interactive shell (reproduced three ways, including under a real pty). Its
`Create`/`Modify` set is a static template, so the files below were applied
verbatim from the package's own copy of it —
`node_modules/@builder.io/qwik/dist/starters/adapters/cloudflare-workers/` — and
the scripts/dependencies it lists were added by hand:

- `adapters/cloudflare-workers/vite.config.ts` — **verbatim, unmodified**
- `src/entry.cloudflare-pages.tsx` — **verbatim, unmodified**
- `wrangler.jsonc`, `public/_headers`, `public/_redirects`,
  `public/.assetsignore`, `worker-configuration.d.ts` — see the deviations below

Anyone can verify by running the two commands above interactively and diffing.
Note the integration's own naming: it is called `cloudflare-workers`, but the
adapter MODULE it wires is `cloudflare-pages`
(`import { cloudflarePagesAdapter as cloudflareWorkersAdapter } from
"@builder.io/qwik-city/adapters/cloudflare-pages/vite"`) and the entry file it
writes is literally `src/entry.cloudflare-pages.tsx`. `qwik-city@1.20.0` ships no
`adapters/cloudflare-workers/` directory at all. So the "official
`cloudflare-workers` adapter" that `docs/prds/editorial-build-issues.md` and
`docs/prototypes/cf-composition/FINDINGS.md:120` name is real as an
INTEGRATION — qwik.dev's own deployment page documents it under that name — but
it is a thin naming layer over the Pages adapter. Recorded rather than
silently reconciled; no ADR is affected.

## Deviations from the starter output, and why

1. **Starter demo and dev-server files removed:** `src/routes/index.tsx`,
   `src/global.css`, `src/entry.dev.tsx`, `src/entry.preview.tsx`, `README.md`,
   `.npmrc` (the repo root pins the public registry for every workspace),
   `.prettierignore` (no per-workspace prettier here), `public/favicon.svg`,
   `public/manifest.json`, `public/robots.txt`. `.vscode/` and `qwik.env.d.ts`
   are kept as scaffold fidelity.

   The three `public/` files are not just unused, they would be actively wrong.
   `favicon.svg` is referenced by the starter's `router-head.tsx` as
   `/favicon.svg` — **not** base-aware, so on the composed origin every page
   load would fetch a path this variant does not own and the front Worker does
   not serve. `robots.txt` and a PWA `manifest.json` are only meaningful at an
   origin ROOT, which belongs to pm-front; served at `/qwik/robots.txt` they are
   dead bytes on a byte-measured plane. The two dev entries go because this
   variant is never served by a framework dev server — `pnpm run dev` is
   `wrangler dev`, matching every other variant, so `run-local.mjs`'s generic
   spawn and the port registry hold unchanged. (Slice C recorded what happens
   when an agent follows a starter's `astro dev` instruction here: a page with
   no injected chrome, no `/_pm/*` measurement client, and every image 404ing,
   that looks fine.)

2. **The starter ships NO `AGENTS.md`/`CLAUDE.md`** — checked, because the last
   two slices both had to deal with one (Next 16's warns that its APIs differ
   from training data; Astro's actively misdirected agents). So there was nothing
   to audit — but "nothing to audit" is not the same as "nothing needed", and a
   verify-slice finding made that concrete: this variant has a failure mode that
   READS as an application bug. Run `wrangler dev` for `pm-qwik` alone and the
   `pm-edge` service binding has no target, so the route's loader fails and
   serves the branded `fail(503, …)` page — correct behaviour for an unreachable
   data plane, indistinguishable from a broken variant if you don't know. An
   `AGENTS.md` was therefore WRITTEN (symlinked as `CLAUDE.md`, the astro
   pattern) covering that, the composed-origin rule, the single-source prefix,
   and the drift-gate contract.

3. **`eslint.config.js` and the `lint`/`fmt` scripts removed; `build` no longer
   goes through `qwik build`.** The repo lints `variants/**` from the root
   (`//#lint`), and neither react-next nor astro ships a per-workspace eslint —
   consistency won. The cost is real and worth naming: `eslint-plugin-qwik`
   catches Qwik-specific mistakes the root config cannot, and it earned its keep
   during this slice by flagging `useVisibleTask$()` as the eager choice, which
   is what led to `useOnDocument` (point 12). It can be run ad hoc via
   `pnpm dlx`.

4. **The `qwik` CLI is not wired into any script, and `qwik check-client` was
   dropped from `build.server`.** The CLI cannot run under this repo's
   `hoist: false` isolation (pnpm-workspace.yaml): it requires `ignore`, then
   `semver`, neither of which `@builder.io/qwik` declares — it relies on being
   hoisted. Chasing that with `packageExtensions` entries would let one
   framework's dependency hygiene shape the whole repo's install graph, and
   nothing in build/deploy/test needs the CLI. `check-client`'s only job is to
   run `build.client` when the client output is stale, which `build` already
   does in order, unconditionally. (For a future `qwik add`, run it via
   `pnpm dlx @builder.io/qwik@1.20.0`, outside the workspace.)

5. **One `packageExtensions` entry WAS necessary**, for the same class of bug
   one layer down: `@builder.io/qwik-city@1.20.0` declares `@builder.io/qwik` in
   neither `dependencies` nor `peerDependencies`. Its post-build SSG step
   (`lib/static/node.mjs`) then dies with `ERR_MODULE_NOT_FOUND` under no
   hoisting. Declared in `pnpm-workspace.yaml`, the slice-B precedent
   (`@opennextjs/cloudflare` needing `esbuild`). This one is load-bearing —
   `pnpm run build` fails without it.

   **Declared as a PEER (`"*"`), not a `dependencies` pin**, and a verify-slice
   finding is why: a `dependencies` entry must name a version, and any literal
   there silently installs a SECOND framework core the day `variants/qwik` bumps
   its own pin — two cores, one of which nothing renders with. As a peer with
   `autoInstallPeers` on it resolves to whatever the consumer already has, which
   is what upstream should have declared. Verified on a wiped-`node_modules`
   install: qwik-city's sibling `@builder.io/qwik` symlink resolves to the app's
   own store entry, and exactly one core is installed.

   **Sabotage-testing this needs `node_modules` WIPED, not `pnpm install
   --force`.** Removing the entry and re-installing appeared to prove it dead
   config twice, because the previously-resolved symlink survived both times;
   only after deleting `node_modules` did the original `ERR_MODULE_NOT_FOUND`
   reproduce. Recorded because the same trap will mislead the next person who
   touches a resolution-level change here.

6. **`package.json` renamed to `@pm/qwik`, private, with the repo's script
   shape.** `dev` is `wrangler dev --port 8795 --inspector-port 9238` (the next
   free pair in `run-local.mjs`'s registry). `build` runs
   `scripts/prepare-build.mjs` then the two vite builds explicitly. `typecheck`
   is `tsc --noEmit`; `test` is `vitest run` (point 17).

7. **`vite.config.ts`: `base: "/qwik/"` — and that is the ONLY prefix
   declaration.** The front Worker forwards every request UNTOUCHED and never
   rewrites paths (ADR-0004 §3), so the app owns its prefix. Qwik derives all
   four consequences from this one value, which is a genuinely better story than
   slice C's (Astro needed `base` and `outDir` kept in agreement by hand):
   - qwik-city's router `basePathname` defaults to vite's base
     (`lib/vite/index.mjs`: `opts.basePathname = viteBasePath`);
   - the optimizer writes the client's public output to `dist/qwik/`
     (`dist/optimizer.mjs`: `clientPublicOutDir = path.join(clientOutDir,
     viteConfig.base)`), so the on-disk layout matches the URL space;
   - the served container's `q:base` becomes `/qwik/build/`;
   - `import.meta.env.BASE_URL` gives `src/lib/assets.ts` the asset root.

   Verified against a throwaway scaffold before this variant was written, not
   inferred: `q:base="/qwik/build/"`, chunks resolve at `/qwik/build/q-*.js`.
   An earlier attempt to force the layout with `build.outDir` instead is
   recorded here as a trap: it applies to BOTH vite builds, so the SSR build's
   `emptyOutDir` wipes the client output the previous step just wrote.

   Also trimmed from the starter's version: its `errorOnDuplicatesPkgDeps`
   guard and the commented-out `ssr` noExternal/external block. The guard
   enforces a REAL constraint — qwik packages in `dependencies` rather than
   `devDependencies` make the SSR build externalize the framework, and
   `@qwik-city-plan` then fails to resolve — so `vite.config.ts` now records
   that invariant in prose where the guard used to assert it. An earlier draft
   of this file justified the removal by claiming `tools/repo-checks` enforces
   the same thing repo-wide; it does NOT (a verify-slice finding), and the
   sentence is corrected rather than left standing, because a receipt citing a
   check that does not exist is worse than one admitting a judgment call.

8. **`wrangler.jsonc`: `workers_dev: false`, `compatibility_date` on the
   plane's shared date, the assets binding renamed to `ASSETS`, and a
   `services` entry for pm-edge.**
   - `workers_dev: false` matches every variant — reachable only through
     pm-front's service binding, so the single origin cannot be bypassed.
   - `compatibility_date: "2026-06-01"` rather than the starter's
     `"2025-12-28"`: the compat date changes runtime semantics, so a
     per-variant value would be an unfair variable across the matrix.
   - **`ASSETS`, not the starter's `ASSET`.** This is a starter bug, not a
     preference: qwik-city's own cloudflare-pages middleware calls
     `env.ASSETS.fetch(request)` whenever its build-time static-path list
     matches (`lib/middleware/cloudflare-pages/index.mjs`), so the starter's
     `ASSET` name — and its matching `worker-configuration.d.ts` — would throw
     on the day that fallback is reached. It is not reached today (Workers
     Static Assets serves those paths before the Worker runs, measured: a build
     chunk returns 200 with the mismatched name in place), which is exactly why
     it would have been a latent failure. `worker-configuration.d.ts` was
     dropped rather than corrected: nothing in this variant references `Env`.
   - `services: [{ binding: "EDGE", service: "pm-edge" }]` — the load-bearing
     difference from slice C. qwik is REQUEST-TIME, so it fetches trays per
     request, and the front Worker's own EDGE binding does not reach a variant
     server-side (the slice-B finding). CI already deploys pm-edge before the
     variants; `workers/README.md` carries the ordering note.
   - `main` and `assets.directory` are the starter's own values, unchanged —
     point 7's layout is what makes that work.

9. **`public/_headers` and `public/_redirects` removed; `.assetsignore`
   relocated to `dist/` by `scripts/prepare-build.mjs`.** With the `/qwik/`
   prefix, everything in `public/` lands under `dist/qwik/`, and all three of
   these are root-only control files that Workers Static Assets reads from the
   assets-directory ROOT (`dist/`) — so left in `public/` they would be
   decoration. `.assetsignore` is load-bearing and therefore written to the
   right place: without it, `dist/_worker.js` (which the adapter's `generate()`
   hook writes to the assets root) is served as a public file. Measured both
   ways: 404 with the file present, 200 without it. `_headers` and `_redirects`
   were dropped rather than relocated because their only content is cache
   policy on hashed build chunks plus an empty redirect list — no other variant
   sets cache headers, and the bench measures with a FRESH browser context every
   visit (`tools/bench-runner/src/collect.ts:132` — "the browser HTTP cache is a
   confound, not a measured axis"), so relocating them would introduce a
   one-variant asymmetry that buys nothing measurable.

10. **`server/` (the SSR build output) is git-ignored and eslint-ignored, and
    declared a turbo OUTPUT alongside `dist/**`.** It deliberately stays
    OUTSIDE `dist/`, because `dist/` is this Worker's public asset directory —
    a server bundle in there would be downloadable. That makes the turbo
    declaration load-bearing rather than tidy: `wrangler` bundles
    `dist/_worker.js`, which imports `../server/entry.cloudflare-pages` by
    relative path, so a cache HIT that restored only `dist/**` would leave
    `wrangler deploy` unable to resolve the import. (The @pm/astro#build
    lesson generalized: declare every build product, not just the obvious
    directory.) The root eslint ignore is scoped to `variants/qwik/server/**`
    rather than a bare `**/server/**`, which would silently exempt any future
    hand-written `server/` directory from lint.

11. **`deploy` REBUILDS** (`prepare-build` + both vite builds + `wrangler
    deploy`) — the slice-B shape, and deliberately the inverse of slice C's.
    Astro's `deploy` must not rebuild because CI's deploy step does not set
    `PM_SNAPSHOT`, so a rebuild there would overwrite crate-baked pages with
    fixture ones. That hazard cannot exist here: **this variant has no
    `PM_SNAPSHOT` at all.** Nothing in its build output is snapshot-flavoured,
    because a request-time variant resolves its trays per request (ADR-0002 §7)
    — which is also why `turbo.json` declares no `env` for `@pm/qwik#build`,
    matching `@pm/react-next#build`. Rebuilding is therefore free of the astro
    risk and removes any dependence on a cache restore having been complete.

12. **The load-time cart read is `useOnDocument("qinit", …)`, not
    `useVisibleTask$`.** Both work; `eslint-plugin-qwik`'s own
    `qwik/no-use-visible-task` rule names `useOnDocument` as the preferred
    alternative, because a visible-task blocks interaction until it has run
    whereas this registers a declarative `on-document:qinit` listener that the
    qwikloader fires after paint.

    Worth stating plainly, because it is the one place resumability does not get
    to defer anything: the cart contract requires that every shell page load
    populate the `[data-pm-cart-count]` slot from storage, since that is what
    makes the cart survive a variant swap (ADR-0004 §5). Reading client storage
    at load is eager work by definition.

    **An earlier draft of this point said "one lazy chunk at startup". That was
    wrong by more than an order of magnitude and it flattered this variant, so
    here is the measurement** (composed origin, JS on, resource timing —
    the same source the bench runner reads):

    | variant | JS/JSON requests at load | encoded | decoded | fetched by the click |
    |---|---|---|---|---|
    | vanilla | 1 | 1.35 kB | 2.80 kB | nothing |
    | astro | 0 (bundle inlined) | 0 | 0 | nothing |
    | qwik | 7 | **26.83 kB** | 62.16 kB | **nothing** |
    | react-next | 7 | 145.05 kB | 509.42 kB | nothing |

    Qwik fetches nothing on click because the handler is already down at load,
    and the causal chain is a more interesting paradigm result than the number:
    the contract forces a load-time storage read → that read is a QRL →
    resolving any QRL requires the framework core (50,917 B) → and rollup
    co-located `src/lib/cart.ts` such that the chunk behind the
    `useOnDocument` statically imports the add-to-cart chunk too (verified:
    the qinit chunk's static imports are the click chunk, the core, and the
    preloader). Resumability defers the BINDING; on this surface the contract
    pulls the BYTES forward regardless.

    Two things this does not mean. It is not a reason to drop the load-time read
    (that would break swap survival, the contract's whole point), and it is not
    a Qwik defect — react-next fetches 5.4x more for the same page. It IS the
    number the reading table must publish, and `astro`'s 0 requests in the same
    run is the issue-#16 inline-bytes defect reproducing itself independently.

13. **Cart state is a Qwik store behind a context id, with NO event bus.**
    react-next needed a same-window `CustomEvent` bus because its cart pieces
    are separate hydration islands with no common client ancestor; vanilla needed
    `document.querySelectorAll` because it has no component model. Qwik's
    components are one resumable tree, so the badge, the button, and the live
    region read and write the same store.

    `Shell` PROVIDES that store and deliberately never READS it. That is not
    tidiness — Qwik subscribes a component to exactly the store properties its
    render function touches, so a cart change re-renders `CartCount` and
    `CartStatus` and never the component hosting `#pm-chrome-slot`. Slice B lost
    that subtree on every slow-CPU load because react-dom's hydration walk
    discarded children React had not authored (a real shipped CLS bug, first
    seen as a CI-only flake). A browser test asserts the injected chrome
    survives a click rather than trusting the argument.

14. **`EditorialArticle` and `ReleaseCard` are INLINE components** (plain
    functions returning JSX), not `component$()`. Qwik's own guidance puts
    inline components first for small presentational markup: an inline component
    is not a lazy boundary, so it adds no lazy chunk and no serialized props to
    the resumability payload — and neither has any interactivity to defer. The
    three pieces that do (`CartCount`, `CartStatus`, `AddToCartButton`) are real
    `component$` boundaries, so the lazy chunks the page ships are the
    interactive ones and nothing else.

    **Correction, kept visible because an earlier draft of this file got it
    wrong:** inline markup is NOT free of Qwik's bookkeeping attributes.
    `<article class="pm-editorial">`, the essay's `<blockquote>`, and
    `<li class="pm-release-card">` all carry a `q:key` in the served page. See
    point 19 and the registry audit note for what actually decides that.

15. **The route loader PROJECTS its payload** to the fields the page renders,
    via `projectFeatured()` in `src/lib/edge.ts`. The reason is narrower than it
    looks and was measured rather than assumed: the initial page's inline
    resumability state (`<script type="qwik/json">`) does **not** carry loader
    results — it is 339 bytes, holding only the cart store and the props of the
    three `component$` boundaries. What carries the whole loader result is the
    route's client-navigation payload, `/qwik/editorial/q-data.json` (955 bytes
    with this projection), so returning the entire detail tray would ship the
    tracklist and every image variant to any visitor arriving through a Qwik
    City link. Projecting is the idiomatic loader shape and changes no rendered
    byte. It lives in a named function so the pre-merge guard drives the same
    projection the served page does, not a copy that could drift.

16. **An edge failure returns `fail(503, …)` and a branded fallback**, not a
    thrown exception. This is the matrix's second request-time variant, so a
    live data-plane failure is a real runtime state; slice B added the
    equivalent for react-next (`app/editorial/error.tsx`) because nothing had
    forced that path before. The fallback renders inside `Shell`, which has no
    data dependency of its own and so cannot fail the same way again.

17. **`vitest.config.ts` + `test/master-identity.test.ts` — the pre-merge
    master-identity guard, in the VARIANT workspace.** Same hole as slices
    A–C close (CI's browser legs only ever serve the FIXTURE, so crate-flavoured
    copy would first be compared on the deployed plane, AFTER merge), and the
    same reason slice C kept its guard out of `tools/repo-checks`: rendering
    these components needs `qwikVite()`, and hosting that in repo-checks would
    route every repo-wide structural check through one variant's Vite plugin.

    The mechanism is the most direct of the four: Qwik's own
    `renderToString` from `@builder.io/qwik/server`. Three measured details
    shaped it:
    - `containerTagName: "body"` would be tidiest but Qwik rejects it ("`<body>`
      can not be rendered because its parent is not a `<html>` element"), so the
      render uses a `<div>` container that the test UNWRAPS as a DOM operation
      before normalizing — string surgery on the serialized output got the
      indentation wrong, which is how that was found.
    - Outside a production build no chunk exists for a QRL, so the render aborts
      with "QRLs can not be dynamically resolved". `symbolMapper` is the
      documented hook; a deterministic stub is honest here because bundle layout
      is a build concern this guard makes no claim about — and the REAL chunk
      names are proven against the served page by `editorial.test.ts`, which
      fetches every chunk an `on:*` attribute actually names.
    - Comparison policy is the drift gate's own `PAGE_NORMALIZE` over
      `linkedom` (the slice-B precedent), because Qwik emits `class` last and
      stamps `q:key` on component hosts — exactly what the registered noise and
      the normalizer's attribute sorting exist to forgive.

    Proven non-vacuous by sabotage: changing one word of the CRATE essay fails
    the crate leg and only the crate leg. `@pm/qwik#test` is `cache: false` in
    turbo.json because its true inputs span the reference renderer and both
    committed snapshots.

18. **`PERMITTED_NOISE["qwik"]` is the first registration that is ALL
    mechanism** — `behaviorAttrPatterns: ["^q:", "^on:", "^on-document:"]`, with
    `attrPatterns` and `classPatterns` empty and no `dropElementSelectors`.
    Measured from real served output:
    - `^q:` covers the container attributes Qwik puts on the `<html>` ELEMENT
      (`q:container`, `q:version`, `q:render`, `q:route`, `q:base`, `q:locale`,
      `q:manifest-hash`, `q:instance`) plus per-element bookkeeping (`q:key` on
      every `component$` host, `q:id` on elements the serialized state
      references). The `<html>` attributes are why a registration is needed at
      all — the normalizer treats the document element's own attributes as
      contract surface.
    - `^on:` covers the resumable listener bindings; `^on-document:` covers the
      document-level ones, and is a SEPARATE prefix that `^on:` does not match.
    - `^on-window:` is deliberately absent (no `useOnWindow` on this page), and
      there is no wrapper ELEMENT to excuse — unlike slice B's App Router
      wrapper and slice C's rejected `<astro-island>`. Qwik's own component and
      dynamic-text markers are COMMENTS, which the normalizer already drops
      while merging the text runs they split.

    `tools/repo-checks/test/noise-class-discipline.test.ts` is what keeps the
    labelling honest: registering any of these under `attrPatterns` (as inert
    residue) fails the build. That claim was only two-thirds true when this slice
    first made it — the guard's `BEHAVIOR_PROBES` were `hx-get`, `hx-post`,
    `on:click`, `on:input`, `q:id`, none of which a `^on-document:` pattern
    matches, so the one class this slice introduced could have been mislabelled
    silently. Fixed in the guard rather than in this sentence: an
    `on-document:qinit` probe (and an `on-window:` one for slice E) now make it
    true as written.

    **The registration is bounded, proven by sabotage rather than by argument.**
    Three deliberate divergences were introduced and each failed the comparison:
    dropping a real `aria-label` from the feature aside, renaming a contract
    class (`pm-footer__fiction` → `pm-footer__fictional`), and — the one that
    actually tests the patterns rather than the gate — adding an `onclick`
    attribute, a colon-less lookalike that `^on:` must NOT match. It didn't:
    the divergence surfaced. Since the master carries no attribute whose name
    begins `q:`, `on:`, or `on-document:`, the stripping can only ever remove
    attributes Qwik itself added.

    **And the non-vacuity checks themselves needed fixing, which is the more
    interesting failure.** Both legs originally enumerated attribute names from
    the whole page — the HTTP leg over raw bytes, the browser leg over
    `querySelectorAll("*")`. Qwik City emits a
    `<script on-document:qcinit=… on-document:qinit=…>` unconditionally, and the
    normalizer DELETES script elements, so `^on-document:` could have satisfied
    every "earning its place" gate while excusing nothing the gate compares.
    Demonstrated, not theorised: swapping `useOnDocument` for `useVisibleTask$`
    (point 12 calls both valid) leaves `on-document:*` on that script alone —
    and under the old checks all three guards stayed green. Both legs now filter
    to the elements the comparison keeps, mirroring `normalize.ts`'s
    `DROP_ELEMENTS`, and re-running the same sabotage fails them with
    "registered behaviorAttrPattern ^on-document: matches nothing in the served
    page". The general rule this bought: derive non-vacuity from what the gate
    compares, never from the raw page.

19. **No JSX `key` on any element the drift gate compares**, and that is a
    measured decision rather than an oversight. (Scoped deliberately: the
    starter's `router-head.tsx` keeps `key={m.key}`/`key={l.key}` on its
    `head.meta`/`head.links` loops, which are genuinely dynamic lists. Those sit
    in `<head>` — a declared ADR-0008 serialization freedom the normalizer drops
    whole — so their `q:key` is invisible to the contract. An earlier draft of
    this point said "used nowhere", which was simply false: a verify-slice
    finding.) Qwik SERIALIZES a JSX key as a `q:key` ATTRIBUTE on the
    element (React's does not render at all) — verified by removing the keys:
    the essay's mapped `<p>` elements lost their `q:key="0"`/`"1"`/… Neither of
    this page's lists is ever reordered or re-rendered, so the keys were habit.

    **What that does NOT buy, stated because it is easy to over-claim:** it does
    not make the page free of `q:key`. An element's `q:key` comes from its JSX
    node's key, and Qwik's OPTIMIZER assigns node keys for its own bookkeeping —
    so after removing every author key the served page still carries `q:key` on
    seven elements (`<article>`, a `<blockquote>`, `<li class="pm-release-card">`,
    the three `component$` host elements, and one qwik-city `<script>`), and
    `q:id` on four (including two masthead links with no listener). Removing the
    author keys removes the noise this variant would have ADDED; the rest is the
    paradigm's, and is registered rather than argued away.

    The same measurement forced one more thing: Qwik reorders an element's
    attributes and stamps a generated `q:key` on it when the element is an ARRAY
    child, so the stylesheet `<link>`s emitted from `.map()` come out as
    `<link href=… rel="stylesheet" q:key=…>`. fonts.css is therefore authored
    directly beside the two font preloads in `root.tsx` — the three of them are
    the canonical font-loading markup, and ADR-0003 §8 requires it VERBATIM
    modulo base path. The other eight sheets stay a list.

20. **Fonts and CSS are served as raw `public/` assets, not imported.**
    `scripts/prepare-build.mjs` copies `@pm/tokens`' `css/` + `fonts/` untouched
    into `public/assets/pm/`; vite copies `public/` verbatim into the client
    output. Importing them so vite bundled them would hash the files and rewrite
    `fonts.css`'s own `@font-face` URLs, failing both halves of ADR-0003 §8 in
    one move (the slice-C finding, unchanged here). The other eight sheets are
    raw by CHOICE, matching slices A–C so the four editorial columns stay
    comparable; `variants/astro/DIFF-TO-STARTER.md` point 4 records the
    cross-variant bundling question that raises, which belongs to the
    benchmark-publication arc rather than to any one slice.

21. **`entry.ssr.tsx`: `containerAttributes.lang` is `"en"`, not the starter's
    `"en-us"`; and `<body>` in `root.tsx` carries no `lang`.** Qwik serializes
    container attributes onto the `<html>` element, and the drift gate treats
    the document element's own attributes as contract surface (a dropped or
    altered `lang` is pixel-neutral a11y drift). The master serves
    `<html lang="en">` and a bare `<body>`; the starter would have shipped
    `lang="en-us"` on one and a second, competing `lang="en"` on the other.

22. **`router-head.tsx` trimmed.** Beyond the favicon link (point 1): the
    starter's `<link rel="canonical" href={loc.url.href}>` is removed because
    that URL differs per environment (local dev, CI's composed origin, the
    deployed plane), which would put a per-environment byte difference in a
    variant whose whole job is byte-identical output — and nothing on the matrix
    publishes a canonical link. `head.styles`/`head.scripts` rendering is
    removed because this surface sets neither and both branches carry
    `dangerouslySetInnerHTML`, which is not a code path a slice should leave
    lying around unexercised. The viewport meta is the master's own string
    (`width=device-width, initial-scale=1`, no trailing `.0`).

23. **`@pm/data-contract` and `@pm/tokens` added as dependencies**; the baked
    projection is typed against the shared tray contract with `Pick` rather than
    re-declared loosely, so a drifting field name is a type error here instead
    of a missing string on the page.

## Measured framework behaviours worth carrying forward

Recorded because the next slices and the bench-accounting work (issue #16) will
want them, and because each was measured against a real scaffold rather than
recalled:

- **Escaping is byte-identical to the reference renderer's `esc()`** — all five
  characters, apostrophe decimal (`&#39;`), in both text and attribute values.
  So the origin suite reuses vanilla's `esc` unchanged. (Astro's html-escaper
  matches too; React emits `&#x27;`, which is why slice B needed a second
  escaper.)
- **No text-node splitting for non-reactive interpolation.** `text {expr} text`
  emits one continuous run with no comment markers, so the served bytes carry
  the same text-node shape as the master. Reactive (store-derived) text DOES get
  `<!--t=…-->` markers; the essay is not reactive. The essay is nonetheless
  authored as one template literal per run — not for slice B's reason but for
  reflow-immunity, since natural JSX prose depends on the compiler's
  trim-and-join rule and a formatter run could move a space mid-sentence.
- **Void elements and boolean attributes are bare** (`<img …>`,
  `data-pm-cart-count`, `crossorigin`) — the astro shape, so the canonical font
  markup needs none of slice B's renderer-shaped tolerances. The one tolerance
  that IS needed: Qwik appends a `q:head` marker attribute to every element it
  manages inside `<head>`.
- **Attribute names pass through verbatim**, so `datetime` is authored lowercase
  to match the master byte-for-byte (`dateTime`, the DOM-property spelling
  react-next uses, would ship a differently spelled attribute).
- **Conditional attributes vanish**: `aria-current={cond ? "page" : undefined}`
  emits no attribute at all.
- **Attribute ORDER: `class` is emitted last** (before `q:key`), with everything
  else in source order. The drift gate is unaffected — its normalizer sorts
  attributes — but raw-substring assertions in the origin suite are written in
  Qwik's order.
- **Three generated artifacts are served that nothing references**, accounted
  for here rather than left unexplained: `dist/qwik/404.html` (759 B),
  `dist/qwik/sitemap.xml` (EMPTY — `<urlset>` with no entries, because this
  route is dynamic and qwik-city's SSG step found nothing to prerender), and
  `dist/qwik/q-manifest.json` (the build's own chunk metadata). All three are
  qwik-city's own output rather than starter demo files, none is referenced by
  the page, and none is fetched by a visitor — so they cost nothing measured and
  are kept as framework fidelity. Worth knowing they exist: `/qwik/sitemap.xml`
  and `/qwik/robots.txt`-style artifacts are meaningless on a composed origin
  whose root belongs to pm-front (which is why the starter's `robots.txt` was
  removed outright, per point 1) — this one is empty, so it makes no claim.
- **Delivery shape, for issue #16:** Qwik ships its chunks as EXTERNAL `.js`
  files under `/qwik/build/`, referenced by `modulepreload` and an `async`
  module script. That makes it the third distinct shape across the editorial
  columns — vanilla's single external file, astro's INLINED bundle (invisible to
  the KB accounting today), and qwik's many external files — which is exactly
  the spread the scheduled bench-accounting fix needs to validate against.
- **A qwik-specific accounting hazard the scheduled fix must inherit** (found by
  this slice's adversarial pass; NOT fixed here, because where the byte boundary
  sits is exactly the ADR-0001 §3 methodology decision issue #16 owns). Qwik is
  the only live variant that fetches anything after the `load` event: its
  preloader runs inside `requestIdleCallback(…, {timeout: 2000})`.
  `tools/bench-runner/src/collect.ts` snapshots `initialEntries` after
  `waitForLoadState("networkidle")` (500 ms of quiet) and then computes
  `interactionBytes` as a POSITIONAL slice past that snapshot's length. Under the
  bench's own CPU-throttled profiles, or on a loaded runner, the idle callback
  can be starved past networkidle — so the same page and the same build can
  produce two different receipts, with `initialJsBytes` under-reporting qwik's
  load cost and `interactionBytes` over-reporting the cost of one localStorage
  write. The clean fix removes the class rather than this instance: await an
  in-page `requestIdleCallback` before the snapshot, the trick `collect.ts`
  already uses for the INP flush, so any framework's post-load idle work lands
  on the load side by construction.
