# DIFF-TO-STARTER — react-next

**Scaffold command (exact, pinned):**

```sh
npx create-next-app@latest react-next \
  --typescript --eslint --app --src-dir --import-alias "@/*" \
  --no-tailwind --no-react-compiler --use-pnpm --skip-install --disable-git --yes
```

Resolved by that command: `next@16.2.10`, `react@19.2.4`, `react-dom@19.2.4`
(exact versions in the committed `pnpm-lock.yaml`). Adapted with OpenNext
`@opennextjs/cloudflare@1.20.1` — the verified current adapter
(`docs/prototypes/cf-composition/FINDINGS.md` §3: `@cloudflare/next-on-pages`
is deprecated, repo archived 2025-09-29).

## Deviations from the starter output, and why

1. **No Tailwind, no React Compiler.** This repo's design system is
   `@pm/tokens` (two-tier CSS custom properties, ADR-0003) — Tailwind would
   be a second, unwanted styling system. The React Compiler is a build-time
   optimization orthogonal to what this surface measures; enabling it would
   change what "idiomatic default" means without ADR sanction.
2. **No `eslint-config-next` / no per-package `eslint.config.mjs`.** The
   generated config pulls `eslint-plugin-import` → `eslint-import-resolver-typescript`
   → `unrs-resolver`, a native-binary package whose install script pnpm's
   supply-chain gate blocks by default — under this repo's `hoist: false`
   isolation, that turns into a hard failure on `pnpm install`/any
   `pnpm run <script>` (deps-status-check), not just a warning. Lint rides
   the root shared `eslint.config.mjs` like every other workspace; the
   `lint` script and `eslint`/`eslint-config-next` deps were removed
   (turbo's `//#lint` task is root-scoped only — no per-package `lint`
   script is ever invoked by CI regardless).
3. **`next.config.ts`: `basePath: "/react-next"`, `trailingSlash: true`,
   `output: "standalone"`, `initOpenNextCloudflareForDev()` gated to the dev
   phase only.** The front Worker forwards every request untouched (never
   rewrites paths) — the app itself must own its prefix, matching the
   composed-origin contract. `trailingSlash` matches the URL convention
   every other variant already serves (`/vanilla/editorial/`).
   `output: "standalone"` is what OpenNext's Cloudflare bundler packages
   into the Worker (a bare `next build` never emits `.next/standalone/`
   without it — `@opennextjs/aws` sets this via `NEXT_PRIVATE_STANDALONE`
   internally too, so this is a belt-and-suspenders explicit config, not
   strictly required, but the honest idiomatic-Next setting to declare).
   `initOpenNextCloudflareForDev()` — OpenNext's dev-mode hook for resolving
   Cloudflare bindings under `next dev` — is real code here (used if
   iterating with `next dev` directly), but must be gated to
   `PHASE_DEVELOPMENT_SERVER` (the config function form, not a plain
   object): calling it unconditionally makes it run during `next build`
   too, where it spins up a Miniflare platform proxy that OpenNext's own
   build orchestration doesn't expect — see point 6 for the concrete
   failure this caused.
4. **`open-next.config.ts`: no incremental-cache override, no
   `WORKER_SELF_REFERENCE` binding.** The editorial route is 100%
   force-dynamic SSR — no ISR/SSG anywhere in this variant. Per
   opennext.js.org/cloudflare/caching: "SSR route will work out of the box
   without any caching config"; the self-reference binding is documented
   as needed only for revalidation features (`res.revalidate`, R2/KV
   incremental cache), none of which this slice uses.
5. **`wrangler.jsonc`: `workers_dev: false`, own `services` entry binding
   `pm-edge`, no `WORKER_SELF_REFERENCE`.** `workers_dev: false` matches
   every other variant (reachable only through pm-front's service binding —
   ADR-0004 §3, the single-origin contract). The `EDGE` service binding is
   the load-bearing deviation: trays are fetched through the edge Worker at
   REQUEST time (SSR is the paradigm's real shape, ADR-0002 §7), and the
   front Worker's own `EDGE` binding doesn't reach a variant server-side —
   each request-time variant binds pm-edge itself (editorial-build PRD's
   per-slice binding duties). Reflected in: `workers/front/wrangler.jsonc` +
   `src/index.js` (`VARIANTS.react-next = "REACT_NEXT"`), `run-local.mjs`
   (edge already starts first; react-next added among the variants), and
   the CI deploy step (`pm-edge` moved BEFORE the variants — it deployed
   last before this slice, since no prior variant bound it directly).
6. **Package scripts deviate from the officially-documented OpenNext
   trio, and `open-next.config.ts` pins `buildCommand` explicitly — a real
   bug found by actually running the build, not by inspection.** `build` is
   `node scripts/copy-tokens.mjs && opennextjs-cloudflare build` (copies
   `@pm/tokens` css/fonts into `public/assets/pm/` untouched BEFORE
   `next build`, so they ship as byte-identical static assets — see
   point 8), because turbo's generic `build` task (every variant's dist,
   `outputs: [".open-next/**"]` for this workspace) needs a `pnpm run build`
   that produces the full OpenNext bundle, not just `next build`. That
   collides with `@opennextjs/aws`'s own `buildNextjsApp()`, which — with
   no `buildCommand` configured — shells out to `${packager} build`: for
   pnpm, literally `pnpm build`, i.e. THIS package's own `build` script.
   Running `pnpm run build` therefore recursed infinitely (verified by
   actually running it locally: `.open-next/worker.js` never got produced,
   the process re-printed "OpenNext — Building Next.js app" and re-ran
   `node scripts/copy-tokens.mjs` from scratch every ~15s until killed).
   Fixed by setting `config.buildCommand = "pnpm exec next build"` on the
   object `defineCloudflareConfig()` returns in `open-next.config.ts` —
   note `buildCommand` is NOT part of `defineCloudflareConfig`'s own
   `CloudflareOverrides` parameter type (only Cloudflare-specific fields:
   `incrementalCache`/`tagCache`/`queue`/...), so it must be set on the
   returned config object directly, not passed into the constructor call.
   `dev` is `wrangler dev --port 8793 --inspector-port 9236` directly (not
   `next dev` or `opennextjs-cloudflare preview`) — matching every other
   variant's `dev` script shape exactly, so `run-local.mjs`'s generic
   `pnpm run dev` spawn + port-registry story holds unchanged. `deploy` is
   `node scripts/copy-tokens.mjs && opennextjs-cloudflare build &&
   opennextjs-cloudflare deploy` — NOT OpenNext's documented `build &&
   deploy` pair verbatim; the `copy-tokens.mjs` prefix is load-bearing, not
   redundant (verify-slice finding, caught before this was ever
   deployed): CI's "deploy" job runs `pnpm --filter @pm/react-next run
   deploy` directly, entirely outside turbo — it does NOT inherit
   whatever turbo did in the earlier "Build worker dists" step. On a
   normal push, the "deploy" job's turbo cache is a guaranteed HIT (it
   shares the exact `turbo-origin-${{ runner.os }}-${{ github.sha }}` key
   the "origin" job already populated for the same SHA), so that earlier
   step doesn't even re-run `@pm/react-next`'s "build" script — meaning
   `public/assets/pm/` (copy-tokens.mjs's git-ignored output, not a
   declared turbo output) never exists on the deploy job's runner at all.
   Without the fix, `deploy`'s bare `opennextjs-cloudflare build` would
   then re-run `next build` fresh, find nothing in `public/`, and bundle
   a Worker with all 9 CSS files and 2 fonts 404ing — a completely
   unstyled production page, on the first real deploy.
7. **`@pm/tokens`/`@pm/data-contract` as workspace dependencies**, plus
   `@cloudflare/workers-types` + a generated, committed `cloudflare-env.d.ts`
   (`wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`,
   `cf-typegen` script) for a typed `env.EDGE` binding, and `server-only`
   guarding the edge-fetch module from ever entering a client bundle.
8. **Fonts/CSS served as raw static assets, not `import`ed.** Next's
   recommendation for stylesheets ("Unsupported Metadata" table:
   `<link rel="stylesheet" />` → "import stylesheets directly") runs them
   through the bundler (hashed/processed) — incompatible with ADR-0003 §8's
   controlled-constant requirement (byte-identical files, canonical loading
   markup verbatim). Instead: `scripts/copy-tokens.mjs` copies
   `@pm/tokens/{css,fonts}` untouched into `public/assets/pm/` before
   `next build`, and `src/app/layout.tsx` renders an explicit `<head>`
   element with plain `<link>` children (preload × 2 fonts, stylesheet × 9
   files) as a sibling of `<body>`. Verified empirically, correcting an
   initial wrong assumption: rendering these `<link>`s as children of
   `<body>` does NOT get them hoisted into `<head>` by React — they stay
   exactly where authored in the DOM (checked via a real served response,
   not guessed) — so an explicit `<head>` is what actually places them
   there; Next's own Metadata-API output (title, viewport meta) merges into
   the same `<head>` without conflict. `<head>` content is exempt from the
   drift gate's DOM contract regardless (ADR-0008: "the `<head>` subtree"
   is a named serialization freedom) — this only has to satisfy this
   variant's own font-parity origin-suite assertion, which it's written to
   match.
9. **No root route (`app/page.tsx` removed).** This slice ships
   `/react-next/editorial/` only; `/react-next/` 404s, same as
   `/vanilla/`'s root today (vanilla's `build.mjs` never writes a root
   `index.html` either — no store surface is built at a variant's bare
   prefix until a surface says otherwise).
10. **Cart contract via idiomatic React state, not vanilla's DOM
    manipulation.** Three small client islands (`CartCount`,
    `AddToCartButton`, `CartStatus`) share cart state through
    `src/lib/cart.ts` plus two `window` `CustomEvent`s (`pm:cart-changed`,
    `pm:cart-announce`) — they sit in unrelated branches of the shell (no
    common client ancestor to lift state into; the shell itself is a
    Server Component), the same shape a real cross-component client store
    takes in this framework. Every island's initial `useState` reads
    nothing from storage (only an effect does, post-hydration), so
    server-rendered HTML always matches the master's canonical EMPTY cart
    state without any extra handling.
11. **Essay content ported to JSX, not template strings.** Vanilla
    (slice A) re-types the essay copy as escaped HTML-string template
    literals; here the identical prose is JSX children (`<em>{d.title}</em>`
    etc.) so React's own text-escaping applies — no `dangerouslySetInnerHTML`
    needed anywhere on this page. `src/lib/render.tsx` is deliberately
    framework-neutral (no Next-specific imports) so the pre-merge identity
    guard (`tools/repo-checks/test/variant-master-identity.test.ts`) can
    call it directly with `react-dom/server`, exactly as slice A's guard
    calls `variants/vanilla/render.mjs` directly.
12. **Featured-release id resolved from committed files, not fetched.**
    Which snapshot is served is only knowable at request time (the
    manifest's `crate` field), but the featured-id POLICY (953800 for the
    real crate, per ADR-0008 §9's recorded design constant; the fixture's
    own `curation.json` value otherwise) is a small build-time constant —
    `src/lib/snapshot.ts` imports the fixture's committed `manifest.json` +
    `curation.json` directly (a relative path outside `src/`, which
    Turbopack resolves without issue) rather than hardcoding the fixture's
    crate-name string, keeping the discriminator tool-derived.
13. **`pnpm-workspace.yaml` gained one `packageExtensions` entry.**
    `@opennextjs/cloudflare`'s bundler step imports `esbuild` directly but
    does not declare it as a dependency (assumes a hoisted install) — under
    this repo's `hoist: false` isolation that's an unresolvable import, not
    just a warning. `packageExtensions: "@opennextjs/cloudflare": { dependencies:
    { esbuild: "^0.25.4" } }` is pnpm's documented mechanism for exactly
    this gap (a package's own dependency declaration is wrong/incomplete),
    scoped to the one package that needs it.
14. **No snapshot-selector turbo `env`/`inputs` declaration
    (`@pm/vanilla#build`'s precedent).** That mechanism exists for
    build-time snapshot-parameterized variants; react-next fetches trays at
    request time through the edge Worker, so no build-time snapshot
    selection applies here — there is nothing for the turbo cache to get
    wrong across the fixture/crate boundary.
15. **`PERMITTED_NOISE["react-next"]` needed a new `NoiseSpec` field,
    `dropElementSelectors`** (`tools/drift-gate/src/normalize.ts`), because
    the one real noise this variant produces isn't an attribute or a class:
    App Router's SSR streaming boundary wraps the body in an empty
    `<div hidden><!--$--><!--/$--></div>` marker (measured from real served
    output). The comment nodes are already-permitted noise (stripped
    unconditionally); the wrapping element itself has no equivalent in the
    master and no attribute/class strip can excuse a whole extra element.
    Generalizes the chrome-slot removal (`div#pm-chrome-slot`, already
    hardcoded in the normalizer) into registry policy: any variant can now
    register CSS selectors for whole-element noise, not just this one.
16. **A local-dev-only gotcha, verified rather than assumed: `wrangler dev`
    on `localhost` serves react-next's HTML `Content-Encoding: identity`,
    breaking naive transport-parity testing — but `127.0.0.1` (what
    `run-local.mjs`'s `ORIGIN` actually uses) does not.**
    `@opennextjs/aws`'s `cloudflare-node` wrapper has a documented
    workaround (citing cloudflare/workers-sdk#8004) that forces
    `Content-Encoding: identity` specifically `if (url.hostname ===
    "localhost")`, to make streaming work under `wrangler dev`. Verified
    empirically: curling `http://localhost:8793/...` shows `identity`;
    curling `http://127.0.0.1:8793/...` (the same server) shows `br`,
    matching every other variant — ADR-0001 §6's "identical compression on
    every host" holds through `run-local.mjs` and on the real deployed
    plane (neither hostname is literally "localhost"); it only breaks a
    developer testing by hand against `localhost` instead of `127.0.0.1`.
17. **Essay body content is single template-literal strings, not JSX text
    interleaved with `{expr}` — found by the drift gate's own zero-tolerance
    pixel check, not by inspection.** JSX compiles `text {expr} more text`
    into SEPARATE DOM text nodes (React inserts empty `<!-- -->` comment
    markers between them, its hydration-boundary convention — confirmed in
    real served output). Comparing rendered pixels against the master
    (`comparePixels`: same-run, `includeAA: true`, zero tolerance by
    design) initially failed on all three profiles with ~0.01–0.02% of
    pixels differing, clustered on specific glyphs mid-paragraph — sub-pixel
    text-shaping noise from the extra node boundaries, not a re-valued
    token or any visible difference (crops of the same region looked
    identical to the eye; only a pixel-diff overlay showed it). Fixed by
    computing each prose block as ONE template-literal string per side of
    any embedded `<em>` (matching the master's own single-text-node shape
    exactly), with JSX used only to wrap the actual `<em>` element — not
    a tolerance threshold added to the gate, which stays untouched and
    strict for every variant.
18. **Root `eslint.config.mjs` gained two ignore patterns:
    `**/.next/**` and `**/.open-next/**`** (plus `**/next-env.d.ts` and
    `**/cloudflare-env.d.ts` for the generated ambient-type files). Found by
    actually running `pnpm exec turbo run lint typecheck test`: the root
    `//#lint` task (`eslint .`, repo-wide) picked up Next's dev/build cache
    and OpenNext's bundled Cloudflare Worker output — minified/generated
    CJS server code (`require`, `__dirname`, Turbopack runtime internals) —
    and reported ~16,000 errors from files nobody was ever meant to lint.
    Same class of exclusion as the pre-existing `**/dist/**` pattern, for
    the two new kinds of build output this slice introduces.
19. **`deploy` runs `copy-tokens.mjs` too, not just `build` — a
    production-breaking gap, found by verify-slice, not by inspection.**
    CI's "deploy" job runs `pnpm --filter @pm/react-next run deploy`
    directly, entirely outside turbo's cache/dependency graph — it does
    NOT inherit whatever the earlier "Build worker dists" turbo step did.
    On a normal push, that step's turbo cache for `@pm/react-next#build`
    is a guaranteed HIT (the "origin" and "deploy" jobs share the exact
    `turbo-origin-${{ runner.os }}-${{ github.sha }}` cache key for the
    same SHA), so `public/assets/pm/` — `copy-tokens.mjs`'s git-ignored
    output, not a declared turbo output — never gets created on the
    deploy job's runner. The bare `opennextjs-cloudflare build` `deploy`
    used to run would then rebuild fresh, find nothing in `public/`, and
    ship a Worker with all 9 CSS files and 2 fonts 404ing: a completely
    unstyled production page, on the first real deploy. Fixed by making
    `deploy` copy the tokens itself first, the same way `build` does.
20. **`@pm/react-next#build`'s turbo task gained explicit `inputs`** for
    the fixture's `manifest.json`/`curation.json` (`src/lib/snapshot.ts`'s
    static imports resolving the featured-id policy) — without them, a
    fixture regeneration touching neither file under `variants/react-next/`
    would replay a stale cached bundle, the exact hazard
    `@pm/vanilla#build`'s own `inputs` declaration already exists to
    prevent, here from a narrower cause (one variant-owned data import,
    not the whole tray).
21. **`dropElementSelectors` only removes an element if it has ZERO
    element children — content-aware, not just positional.** Traced to
    Next's own source (`node_modules/next/dist/esm/lib/metadata/metadata.js`
    `MetadataWrapper()`): the exact `<div hidden>` wrapper this variant
    registers is Next's App Router streaming-METADATA boundary, not a
    generic hydration artifact — it wraps whatever `generateMetadata()`
    resolves to. It is empty today only because this page's metadata is
    `{ title }`, and `<title>` is one of the few tags React 19 auto-hoists
    to `<head>` regardless of tree position. A future addition to
    `generateMetadata()` that does NOT auto-hoist (an icon, an `alternate`
    link) would render as a real child INSIDE this same div — and an
    unconditional selector-based removal would silently delete it before
    the drift gate, CI, or the pre-merge guard ever saw the divergence,
    exactly the failure class this whole gate exists to catch. Fixed in
    `tools/drift-gate/src/normalize.ts`'s `PAGE_NORMALIZE` (guard:
    `el.childElementCount === 0`) plus a new origin-suite assertion
    (`editorial.test.ts`) pinning the wrapper's exact empty-content
    substring, so either one fails loudly the moment that stops being true.
22. **`variants/react-next/src/app/editorial/error.tsx`** — an on-brand
    error boundary for `loadManifest`/`loadFeatured` failures
    (`src/lib/edge.ts`), added after verify-slice pointed out this is the
    FIRST request-time variant in the whole matrix (vanilla is build-time,
    so it has no live per-request failure mode at all) and nothing forced
    the path where `pm-edge` answers non-2xx. Without it, a visitor would
    have landed on Next's generic, unbranded default fallback (confirmed
    by tracing the compiled bundle: `.open-next/.../app-page-turbo.runtime
    .prod.js` really does ship "This page couldn't load" as the built-in
    default, wired in via `global-error.js`'s `DefaultGlobalError`) — no
    raw exception leaks either way (Next always shows a generic message
    server-side, per its own `error.digest` convention), but with none of
    Long Decay Records' own chrome. Reuses `Shell` directly (it has no
    data dependency of its own, so the fallback can't itself re-throw the
    same error) with `unstable_retry` (Next 16.2's replacement for
    `reset()` — actually re-fetches, not just clears client error state).
    Verified end-to-end by temporarily pointing `edgeFetch` at a
    guaranteed-404 path, rebuilding, and checking the ACTUAL RENDERED DOM
    via Playwright (a raw `curl`/fetch can't: the failure path streams an
    RSC payload a non-JS client can't resolve into visible text) — the
    custom message rendered correctly inside the full canonical shell,
    then the sabotage was reverted. **Disclosed scope limit:** this
    verification was manual, not a committed automated test — forcing a
    real edge failure from within the origin-suite would need either a
    test-only fault-injection hook in production code (rejected: added
    risk for a testing convenience) or stopping the edge Worker mid-run
    (rejected: fragile, would affect the shared composed-origin run for
    every other test in the same suite). Left as a follow-up if this
    variant, or the request-time variants after it (Qwik, HTMX), want a
    permanent regression test for this path.

23. **`div#pm-chrome-slot` (Shell, render.tsx) carries
    `suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }}`.**
    Found post-push, via a CI-only failure invisible on every local
    machine: the front Worker injects the switcher/HUD chrome into this
    div by rewriting the HTTP response in transit, so the served HTML
    already contains it, but React's own vdom for the element has zero
    children — a real hydration mismatch, not a test artifact. React's
    mismatch-recovery (`popHydrationState`/`throwOnHydrationMismatch` in
    `react-dom`'s own source) silently re-renders the subtree from the
    client's empty output, deleting the chrome moments after every page
    load — invisible when hydration is fast, a real CLS bug on any
    visitor's machine slow enough to notice, and exactly what stalled the
    CI runner long enough to fail a geometry assertion. Reproduced on
    demand locally with Playwright's `Emulation.setCPUThrottlingRate: 4`.
    `dangerouslySetInnerHTML` with a non-null `__html` is the one fix
    that works: it makes `shouldSetTextContent` return true, which is the
    specific condition `popHydrationState` checks to skip the
    child-mismatch walk entirely. `suppressHydrationWarning` alone does
    NOT prevent the deletion — confirmed by reading both functions in the
    installed `react-dom-client.development.js`, not assumed from the
    prop's name.

## Verified against primary sources (not training recall)

Next.js 16 ships with an explicit warning that its APIs/conventions may
differ from a coding agent's training data (`AGENTS.md`, generated at
scaffold time: "This version has breaking changes... Read the relevant
guide in `node_modules/next/dist/docs/` before writing any code"). Read
before implementing: the v16 upgrade guide (Cache Components is opt-in via
`cacheComponents: true`, NOT the default — this variant does not enable it,
so the classic `export const dynamic = "force-dynamic"` route-segment
config still applies exactly as before), the rendering-philosophy and
caching guides, the `basePath` reference (only `next/link`/`next/router`
auto-apply it; raw `<link>`/`<img>` need it written in by hand), and the
Metadata API's "Unsupported Metadata" table (point 8 above). OpenNext's own
docs (opennext.js.org/cloudflare/get-started, /bindings, /caching) verified
the scaffold command split (official `create-next-app`, not
`create cloudflare@latest --framework=next` — the latter bakes in
Cloudflare-specific scaffolding that would defeat the starter-then-diff
fairness mechanism), `getCloudflareContext()`'s signature (`env` typed via
global `CloudflareEnv` augmentation, not a generic parameter — confirmed by
reading `@opennextjs/cloudflare`'s own `.d.ts` after install rather than
guessing), and the caching/self-reference-binding behavior in point 4.
