# DIFF-TO-STARTER — astro

**Scaffold command (exact, pinned):**

```sh
pnpm create astro@5.2.2 astro \
  --template basics --no-install --no-git --skip-houston --yes
```

Run from `variants/`. Resolved by that command: `astro@7.1.3` (the starter
declares `"astro": "^7.1.3"`; the exact resolution is pinned in the committed
`pnpm-lock.yaml`). **No adapter** — `docs/prototypes/cf-composition/FINDINGS.md`
§3: "Fully static builds need **no adapter** (plain Workers Static Assets)",
per Cloudflare's own Astro framework guide. `@astrojs/cloudflare` would only be
needed for on-demand rendering, which this surface does not have: the editorial
page's whole data dependency is resolved at build time (ADR-0002 §7 —
build-time variants bake the snapshot in).

Deliberately NOT `create cloudflare@latest --framework=astro`: that bakes in
Cloudflare-specific scaffolding, which would defeat the starter-then-diff
fairness mechanism (ADR-0003's 2026-07-12 addendum; the same call slice B made
for `create-next-app`).

## Deviations from the starter output, and why

1. **Starter demo files removed:** `src/pages/index.astro`,
   `src/components/Welcome.astro`, `src/layouts/Layout.astro`,
   `src/assets/*.svg`, `public/favicon.{ico,svg}`, and the starter `README.md`.
   Nothing references them once the editorial route replaces the demo page, and
   an unreferenced favicon in `public/` would still be copied into the served
   dist — dead bytes on a byte-measured plane. `.vscode/` is kept as scaffold
   fidelity.
1b. **`AGENTS.md`'s Development section is REPLACED (the file and its
   `CLAUDE.md` symlink are otherwise kept).** The starter writes "When starting
   the dev server, use `astro dev --background`" — and creates `CLAUDE.md` as a
   symlink to it, so it auto-loads as project instructions for any agent
   working in this directory. Followed here it produces confidently wrong
   results: this variant is never served by Astro's dev server but as one
   Worker inside a composed origin, so `astro dev` yields a page with no
   injected chrome, no `/_pm/*` measurement client, and every `/assets/img/*`
   404ing — while looking superficially fine (a verify-slice finding; the file
   had in fact already loaded into that reviewing session). The section now
   points at `pnpm run origin-suite` / `pnpm run dev` and explains why. The
   documentation links below it are kept verbatim — they are genuinely the
   guides that were read for this slice.
2. **`package.json` renamed to `@pm/astro`, private, with the repo's script
   shape.** `dev` is `wrangler dev --port 8794 --inspector-port 9237` — NOT
   `astro dev` — matching every other variant exactly, so `run-local.mjs`'s
   generic `pnpm run dev` spawn and the port registry hold unchanged (the
   composed origin is served by workerd in local dev, not by a framework dev
   server). `preview` was dropped for the same reason: `wrangler dev` is the
   preview. `astro` (the CLI passthrough) is kept.
3. **`astro.config.mjs`: `output: "static"`, `base: "/astro"`,
   `outDir: "./dist/astro"`, `trailingSlash: "always"`,
   `build.format: "directory"`.** The front Worker forwards every request
   UNTOUCHED and never rewrites paths (ADR-0004 §3), so the app owns its own
   prefix. `base` handles the URLs Astro generates; it does **not** change the
   on-disk layout (config reference: base "will use this path as the root for
   your pages and assets"), and `astro build` writes pages at the `outDir`
   root — so the prefix has to appear in `outDir` too, or wrangler's `./dist`
   asset directory would serve the page at `/editorial/` instead of
   `/astro/editorial/`. `trailingSlash`/`format` match the URL convention every
   other variant already serves. `output`/`format` are the defaults, written
   explicitly because this variant's whole claim is that nothing renders per
   request.
4. **Fonts and CSS served as raw `public/` assets, not imported.**
   `scripts/prepare-build.mjs` copies `@pm/tokens`' `css/` + `fonts/`
   untouched into `public/assets/pm/` before `astro build`; Astro copies
   `public/` verbatim into the output. Astro's other route — importing
   stylesheets so Vite bundles them — is genuinely more idiomatic for a
   design system. For the FONT files and `fonts.css` that is forced, and was
   rejected on evidence: bundling hashes the files and rewrites `fonts.css`'s
   own `@font-face` URLs, failing both halves of ADR-0003 §8 (canonical loading
   markup verbatim, files byte-identical to the `@pm/tokens` sources) in one
   move.

   **Stated honestly, because §8 does not cover the other eight sheets:**
   ADR-0003 §8 pins fonts only; §2 leaves the shared component/surface CSS to
   "its own idiomatic delivery" and calls delivery the measured variable. Those
   eight are raw here by CHOICE — matching slices A and B so the three
   editorial columns stay comparable, and so the origin suite's byte-identity
   assertion holds the same way for every variant. The consequence is real and
   should not be discovered later from a chart: astro's CSS delivery is
   currently byte-identical to vanilla's (same nine unbundled sheets, same
   bytes, same request count), so the editorial reading table will show
   Astro's CSS pipeline buying nothing — a fact about this configuration, not
   about Astro, which would minify and concatenate the eight into one request
   if they were imported. Whether each variant should bundle the shared CSS its
   own way is a CROSS-VARIANT methodology question (it applies to react-next
   identically), so it is recorded as an ADR-0003 §2 addendum question for the
   benchmark-publication arc rather than decided unilaterally inside one slice
   — the PRD's own fence: a slice that thinks the spec is wrong records the
   question, it does not improvise.
5. **`wrangler.jsonc`: `workers_dev: false`, `assets.directory: "./dist"`, and
   NO `services` entry.** `workers_dev: false` matches every variant
   (reachable only through pm-front's service binding, so the single origin
   cannot be bypassed). The absent `services` block is the load-bearing
   difference from slice B: react-next binds `pm-edge` itself because a
   request-time variant fetches trays per request and the front Worker's
   `EDGE` binding does not reach a variant server-side. Astro is build-time —
   its pages are already baked, and at request time it talks to nothing.
   Reflected in `workers/README.md`'s deploy-order note.
6. **`src/index.js`, the one-line ASSETS forwarder**, verbatim from the
   vanilla/placeholder-static mold: serving assets through a service binding
   *without a script* is undocumented (spike hardening 1), so every static
   variant ships a default handler and every hop stays a documented behavior.
7. **Snapshot parameterization lives in a pre-build step, not in component
   frontmatter.** `scripts/prepare-build.mjs` reads `PM_SNAPSHOT` (the
   selector minted by slice A — `fixture` default, `crate` on the deploy job),
   resolves the featured release through `scripts/resolve-snapshot.mjs`, and
   writes the payload to git-ignored `src/data/snapshot.json`, which
   `src/pages/editorial/index.astro` statically imports. Reading the trays
   from inside frontmatter instead looks simpler and is a trap: Astro's static
   build renders through a Vite SSR bundle written to a temp directory, so
   `import.meta.url` in a component resolves to that temp chunk and any
   repo-relative path computed from it silently points at nothing. A plain-Node
   pre-build step has no such ambiguity, and it makes the resolved payload a
   declared build input rather than a hidden read.
8. **`@pm/astro#build` declares `env: ["PM_SNAPSHOT"]` and both snapshots'
   `*.json` as `inputs`** (turbo.json) — the `@pm/vanilla#build` precedent,
   same hazard: the origin job and the deploy job share the
   `turbo-origin-*` cache family, so without the env declaration the deploy
   job would replay the origin job's fixture-flavored dist straight onto the
   crate-serving plane. It also declares **`src/data/snapshot.json` as an
   `output` alongside `dist/**`** — a verify-slice finding, reproduced rather
   than argued: that file is as much a build product as `dist/` is, and
   without declaring it a cache HIT replays only `dist/`, never runs the
   script, and leaves the generated module absent, so `astro check` fails with
   ts(2307). The turbo-driven `check` job happens to stay green today because
   typecheck's hash is coupled to build's and hits alongside it, but that
   coupling is incidental — the direct `pnpm run typecheck` inside this
   workspace fails immediately in that state, and any future task that
   consumes the file would too. `public/assets/pm/**` is deliberately NOT
   declared: nothing consumes it after the build (Astro copies it into
   `dist/`, which is restored), so listing it would only duplicate ~1 MB of
   fonts in every cache entry.
9. **`deploy` is bare `wrangler deploy` — it deliberately does NOT rebuild.**
   This is the inverse of slice B's point 19 and it matters just as much.
   CI's "Deploy service-bound Workers" step runs
   `pnpm --filter @pm/astro run deploy` outside turbo and **does not set
   `PM_SNAPSHOT`** (that env is scoped to the "Build worker dists" step). A
   rebuild inside `deploy` would therefore default to `fixture` and overwrite
   the crate-baked dist with the fixture essay moments before uploading it —
   shipping "the fixture never leaves CI" prose to production. Relying on the
   turbo-built dist is safe here in a way it was NOT for slice B, and for a
   specific reason: everything astro serves lands inside the declared
   `outputs: ["dist/**"]` (the copied tokens included, because Astro copies
   `public/` into the output), so a cache hit RESTORES a complete dist, while
   react-next's `public/assets/pm/` was an undeclared, git-ignored input that
   a cache hit never recreated. The post-deploy smoke is the backstop either
   way: it re-renders the master from whatever `/api/snapshot` reports and
   compares the served page (ADR-0008 §9). The remaining "what if `dist/` is
   not there at all" case was checked rather than assumed: with the directory
   absent, `wrangler deploy` **fails loudly** ("The directory specified by the
   `assets.directory` field in your configuration file does not exist")
   instead of uploading an empty site — so a missing build cannot quietly
   ship a variant that 404s everything.
10. **Add to cart is a plain bundled `<script>`, NOT an island — the slice's
    explicit judgment call, decided on measurement.** Astro's own docs put a
    plain `<script>` first for interactivity "without the need for a UI
    framework like React, Svelte, or Vue. This avoids the overhead of shipping
    framework JavaScript." Astro processes a bare `<script>` (TypeScript,
    import bundling, dedupe, automatic `type="module"`, inlining when small),
    so `src/scripts/cart.ts` is real TypeScript that Astro compiles and
    minifies — a genuine paradigm delivery mechanism, not a hand-written
    `<script>` blob.

    The island was measured before being rejected. A scratch Astro project
    with `@astrojs/preact` and the same button behind `client:load` emits:

    ```html
    <astro-island uid="…" component-url="/_astro/AddToCart.…js"
      renderer-url="/_astro/client.…js" props="{}" ssr client="load"
      opts="…" await-children><button class="pm-button" type="button">Add to
      cart</button><!--astro:end--></astro-island>
    ```

    That is a custom **element** wrapping the button — and it has element
    children, so `NoiseSpec.dropElementSelectors` could not excuse it even if
    it were registered: `PAGE_NORMALIZE`'s content-aware guard
    (`el.childElementCount === 0`, minted by slice B) removes a matched
    element only when it is empty, precisely so a registration can never
    become a bulk content eraser. So an island here would force a choice
    between failing the drift gate and widening the noise policy until it
    could hide real divergence. The plain script has neither problem, and
    `script` is already a named ADR-0008 serialization freedom. On this
    surface the honest answer is that the islands paradigm has no island to
    place: one button's click handler is not a component boundary. (`display:
    contents` on `astro-island` means the wrapper is visually transparent, so
    the PIXEL leg would have passed — only the DOM check catches it. Worth
    recording: the pixel gate alone would not have surfaced this.)
11. **A bundled script cannot read frontmatter, so the release rides a JSON
    `<script type="application/json" id="pm-cart-item" is:inline>` hook.**
    Astro's docs recommend `data-*` attributes for server→client data; that
    was rejected deliberately. A `data-*` attribute would sit on a CONTRACT
    element (the button) and need a `PERMITTED_NOISE` entry to excuse it —
    and it would be a mislabelled one, because `data-*` is not an Astro
    mechanism at all (the registry's behavior-attribute class exists for
    `hx-*`/`on:*`/`q:*`, a framework's own wire format) but a variant-invented
    attribute. A `script` element is free by contract, so the canonical DOM
    stays clean and the noise registry stays honest. `is:inline` is explicit
    because Astro emits a build hint otherwise: a `<script>` carrying any
    attribute besides `src` is already treated as inline, and the docs ask for
    the directive to say so on purpose.
12. **`PERMITTED_NOISE` has NO astro entry — a measured result, not a design
    choice.** Astro's two noise species are both opt-in and this page opts into
    neither. `data-astro-cid-*` scoping attributes are emitted only for
    components that carry a `<style>` block (measured: a probe component with
    one `<style>` stamped a cid on `html`, `body`, and every element in the
    component) — this variant authors no scoped styles, because the design
    system arrives as plain `<link>`s per point 4. `<astro-island>` appears
    only around framework components with a `client:*` directive, and there are
    none per point 10. That makes astro the second variant to register nothing,
    but for a different reason than vanilla: vanilla IS the `NO_NOISE` control
    by design, while astro's emptiness is an outcome. Because it's an outcome
    it is asserted, not assumed: `editorial.test.ts` and the drift leg both
    check the raw served bytes for `data-astro-cid-` and `<astro-island`, so
    adding either later fails loudly instead of letting the NO_NOISE
    comparison quietly start lying.
13. **`compressHTML` (Astro's default) strips inter-element whitespace the
    master's own serialization carries** — the newlines between the masthead
    nav's two anchors, the footer nav's four, the release card's price/stock
    pair, and so on. This is legitimate, and the reason generalizes rather than
    resting on two examples (an earlier draft of this note named only the two
    navs — corrected after verify-slice pointed out the record was narrower
    than the claim): on this page EVERY container whose children are
    inline-level is a flex or grid container — `.pm-masthead__nav` (flex),
    `.pm-footer__nav` (flex), `.pm-release-card__foot` (flex),
    `.pm-masthead__cart` (inline-flex), `.pm-grid` (grid),
    `.pm-editorial__feature-body` (grid) — and whitespace-only children never
    become flex or grid items. Every other container (`.pm-prose`,
    `.pm-editorial__head`, `.pm-release-card__body`) holds block-level children,
    where inter-element whitespace does not render either. So the invariant to
    watch is specific and worth stating: **a tokens-tier edit that takes any of
    those six containers out of flex/grid — e.g. rewriting
    `.pm-release-card__foot` as inline text — would make the master render a
    collapsed space that Astro's compressed page does not**, and the
    zero-tolerance pixel leg (`comparePixels`, `includeAA`, no threshold)
    across all three profiles is what would catch it. It is what establishes
    the claim today, too; none of the above is assumed. The reverse risk is real and was designed
    against: Astro emits a template's whitespace *as authored*, so any element
    whose inline content is whitespace-sensitive (the brand, the cart anchor,
    every prose-bearing element) is authored on ONE line in `Shell.astro` and
    `EditorialArticle.astro`. A reflowed line break inside an inline run would
    insert a space mid-sentence — the same text-run hazard that cost slice B a
    pixel-level debugging session, arriving here through a different door.
14. **Essay prose is escaped-HTML strings rendered through `set:html`, not
    Astro markup with `{expr}` holes.** Both render identical bytes; the
    strings keep the copy in one reviewable module (`src/lib/essays.ts`) and
    keep every paragraph off the ~400-character single line that point 13's
    hazard would otherwise demand. `set:html` is Astro's documented mechanism
    for content HTML and is what its own content-collection pipeline uses.
    `src/lib/format.ts`'s `esc()` is the security boundary on that path (frozen
    data is still external data, ADR-0002) — everything else interpolates
    through `{expr}`, which Astro escapes itself.
15. **Astro's `{expr}` escaping is byte-identical to the reference renderer's
    `esc()` — verified, not assumed.** Astro escapes through `html-escaper`
    (v3.0.3 as installed), which maps the same five characters to the same
    entities, apostrophe included: `&#39;`, decimal. React does **not** (it
    emits `&#x27;`, which is why slice B's origin-suite assertions needed a
    second `reactEsc` helper). Two consequences: this variant's origin-suite
    assertions reuse vanilla's `esc` unchanged, and the whole page comes out
    byte-comparable to the master rather than merely DOM-comparable.
16. **Astro emits bare boolean attributes and does not self-close void
    elements**, so the canonical font-loading markup matches VERBATIM modulo
    base path — `crossorigin` stays `crossorigin`, `<link …>` stays `<link …>`,
    `data-pm-cart-count` stays bare. Slice B needed explicit tolerances for
    both (React renders `crossorigin=""` and `<link …/>`); slice C needs none,
    so `editorial.test.ts`'s font-leg assertion for astro is the strict
    string-for-string form vanilla uses.
17. **Asset URLs are built from `import.meta.env.BASE_URL`**, Astro's
    documented base-aware URL root, rather than typing `/astro/` a second time
    — so `base` in `astro.config.mjs` is the single source of the prefix. Since
    the front Worker never rewrites paths, a disagreement between `base` and
    `outDir` would serve HTML 200 with every stylesheet 404 — a silently
    unstyled page. `editorial.test.ts` therefore dereferences EVERY `/astro/…`
    URL the served page references (the set derived from the page, since
    Astro's bundled asset names are build hashes), not just a sampled few.
18. **`@pm/data-contract` added as a dependency, type-only.** The baked payload
    is typed against the shared tray contract (`ReleaseDetail`/
    `ReleaseSummary`) rather than re-declared loosely, so a drifting field name
    is a type error here instead of a missing string on the page.
19. **The pre-merge master-identity guard lives in `variants/astro/test/`, not
    in `tools/repo-checks/` where slices A and B put theirs.** It closes the
    same hole (CI's browser legs only ever serve the FIXTURE, so crate-flavored
    copy would first be compared on the deployed plane, after merge), using
    Astro's OWN render-to-string entry point: the Container API
    (`experimental_AstroContainer` from `astro/container`) with
    `partial: false`, which renders the real `.astro` component tree in-process
    for each snapshot's data. Loading a `.astro` file requires Astro's
    compiler, so the test needs `getViteConfig` (Astro's documented vitest
    setup) — and hosting that in `repo-checks` would route every repo-wide
    structural check through Astro's Vite plugin, letting an Astro upgrade
    break guards that have nothing to do with Astro. It is still reached
    pre-merge: CI's `check` job runs `turbo run lint typecheck test`, and
    `@pm/astro#test` is declared `cache: false` in turbo.json because its real
    inputs span the reference renderer and both committed snapshots — a set
    easy to under-declare, and an under-declared input means turbo replays a
    stale PASS while crate copy has actually drifted. Comparison policy is the
    drift gate's own `PAGE_NORMALIZE` over `linkedom` (the slice-B precedent),
    so one normalizer governs the browser leg and the pre-merge leg alike.
    The guard also renders the **PAGE**, not only the document component — a
    verify-slice finding. The component proof covers both snapshots, but the
    page is the only consumer of the baked payload and nothing else exercised
    it pre-merge: CI's browser legs serve the built page with only the FIXTURE
    baked, so a page-level wiring bug affecting just the crate flavor (a
    swapped import, a `name` override, a renamed tray field the
    `as EditorialData` cast swallows) would have passed everything and turned
    the post-deploy smoke red. The page is therefore asserted to be a faithful
    PASS-THROUGH of whatever is baked; composed with the both-flavor component
    proof, a faithful pass-through of a correct component is correct for both
    flavors. Proven non-vacuous by sabotage: with the crate baked and the page
    overriding `name` to `"fixture"`, the guard fails. Disclosed limit: a page
    bug conditional on the data itself would still slip past, since only one
    flavor is on disk per run.
20. **`typecheck` is `astro check`** (`@astrojs/check` + `typescript` as
    devDependencies) — Astro's own diagnostics, which type `.astro` templates
    rather than only the `.ts` files `tsc` would see. `vitest.config.ts` needed
    `/// <reference types="vitest/config" />`: `getViteConfig`'s parameter is
    Vite's `UserConfig`, and Vitest's `test` key reaches it through module
    augmentation that only loads with those types referenced. Found by running
    it, not by inspection.
21. **Root `eslint.config.mjs` gained `**/.astro/**`.** The root `//#lint` task
    is repo-wide (`eslint .`) and picked up Astro's generated type surface
    (`.astro/types.d.ts`, `.astro/content.d.ts`) — 6 errors from files written
    to Astro's conventions and git-ignored by the starter's own `.gitignore`.
    Same class of exclusion as the `**/.next/**` and `**/.open-next/**`
    patterns slice B added, for the build output this slice introduces.
22. **`.gitignore` gained `.wrangler/`, `public/assets/pm/`, and
    `src/data/snapshot.json`.** The last two are generated by
    `scripts/prepare-build.mjs`. `src/data/snapshot.json` is the one that
    matters: a committed copy would be a stale, snapshot-specific artifact
    sitting exactly where the build expects fresh output — the
    fixture-onto-the-crate-plane hazard point 8's turbo declaration exists to
    prevent, re-entering through the front door.

23. **What slice B's CI-only failure class corresponds to here: nothing, and
    that is structural rather than lucky.** Slice B's bug was hydration —
    React's mismatch recovery deleting the front Worker's injected chrome from
    `div#pm-chrome-slot`, invisible on a fast machine. Astro does not hydrate
    this page at all: there is no client component tree, so nothing ever
    reconciles against the served DOM and no injected chrome can be reverted.
    The one timing question that remains is whether the cart listener is
    attached before a test (or a fast visitor) can click, and that is settled
    by the spec rather than by luck: Astro emits the bundled script as
    `type="module"`, which is deferred and therefore executes after parsing but
    BEFORE `DOMContentLoaded` — so by the time `load` fires (what every
    browser-driven test waits for) `mountCart()` has already run. The cart
    suite also polls via `waitForFunction` rather than asserting immediately,
    so even a late run would not produce a false failure.

## Open question raised by this slice, NOT decided in it

> **Tracked as [issue #16](https://github.com/Robert-Lark/project-matrix/issues/16),
> scheduled for the session immediately after slice D (qwik) lands** — Rob's
> call, 2026-07-24: documented properly and addressed at the right time rather
> than deferred to the end of the project. See `docs/decision-map.md` →
> `bench-accounting-fix` for the timing rationale.

**Astro inlines the cart bundle, and the bench runner's KB accounting cannot
see inline script bytes — so the render axis's headline number would read
"astro: 0 KB initial JS" while this page ships 1,247 B of JavaScript.**

Measured, not inferred: the built page carries exactly one
`<script type="module">` of 1,247 B and zero external script `src`s (Astro
inlines a bundle under Vite's `assetsInlineLimit`). `tools/bench-runner/src/collect.ts`
derives both `buckets.js` and `initialJsBytes` from resource-timing entries
classified by URL extension (`bucketOf`), and an inline script produces no
resource-timing entry at all — so its bytes are absorbed into `buckets.html`
via `nav.transferSize` and the JS headline is zero.

Two consequences, on the one surface whose whole thesis is how much machinery
prose needs:

- The editorial reading table would publish vanilla — the NO-RUNTIME control —
  as shipping ~1 KB of initial JS and astro as shipping none, for the
  byte-for-byte same enhancement. The comparison would be inverted by an
  instrument blind spot.
- It is discontinuous: grow `src/scripts/cart.ts` past Vite's inline threshold
  and Astro emits a file instead, so the number jumps from 0 to its true value
  with no change in what the paradigm actually does.

**Deliberately not fixed here, and not worked around here.** The tempting
workaround — forcing `vite.build.assetsInlineLimit: 0` so Astro emits a
separate file the instrument can see — was rejected: it invents a request this
paradigm would not otherwise make, i.e. it rigs the variant to suit the
harness, which is the same error in the opposite direction. The real fix is in
the harness (count inline `<script>` bytes toward JS and stop counting them as
HTML), and that is an **ADR-0001 §3 methodology decision** — it changes
published numbers for every variant and has to settle the double-counting
question — so it is recorded as an addendum question and an obligation bound to
the benchmark-publication arc, per the PRD's own fence ("a slice that thinks the
spec is wrong records an ADR addendum question, it doesn't improvise"). Nothing
in this build publishes a receipt, so no false number ships from here; the
obligation is that none ships from the publication step either.

Two adjacent gaps found alongside it, both PRE-DATING this slice and recorded
for the same arc rather than patched inside it:

- `tools/bench-runner/src/cpu.ts`'s `LOCAL_PLANE_INSPECTORS` lists only
  `pm-front`, `pm-placeholder-static`, `pm-placeholder-ssr` and `pm-edge`, so a
  LOCAL bench of any real variant attributes zero CPU to the Worker that
  actually served the page — `pm-vanilla` (9235) and `pm-react-next` (9236) are
  missing too, not just `pm-astro` (9237). Adding ports is not a one-line fix
  because `CdpConnection.open` throws when an inspector is absent, so the list
  and its failure tolerance need deciding together.
- ADR-0003 §2's "CSS its native way" is satisfied only nominally across all
  three editorial variants today (see point 4).

## Verified against primary sources (not training recall)

The starter ships its own `AGENTS.md` (symlinked as `CLAUDE.md`) pointing at
the docs to consult before writing code. Read before implementing: the routing
guide, the Astro-components basics, the framework-components guide (which is
what establishes that islands require a UI-framework integration at all — the
basis for point 10), the styling guide, the client-side-scripts guide (script
processing, `is:inline`, and the data-passing recommendation in points 10–11),
and the configuration reference (`base`, `outDir`, `build.format`,
`trailingSlash`, `build.assets`, `output` — point 3).

Checked against the INSTALLED package rather than docs or recall where the
exact behavior carries risk: `astro/container`'s real export name and
`renderToString` options including `partial` (`dist/container/index.d.ts`);
`getViteConfig`'s presence and signature (`dist/config/index.d.ts`);
`html-escaper`'s character mapping, compared byte-for-byte against
`packages/reference/render/lib.mjs`'s `esc()` (point 15); and the
`<astro-island>` markup in point 10, taken from a real build's output rather
than described from memory.

Unlike Next 16, Astro 7's scaffold carries no "this is not the framework you
know" warning — but the same caution was applied anyway, which is how points
10, 12, 15, 16, and 20 came to be measurements instead of assumptions.
