<!--
  Handoff prompt: the finish line — from the spec layer (ADR-0008, merged)
  to a published, benchmarked, publicly-addressed product. Drafted
  2026-07-17 by the surface-design session. Paste the fenced block into a
  fresh session; the same prompt re-enters cleanly at any point because the
  decision map + progress log carry the state (artifacts are the memory).
-->

```
Carry Project Matrix from its spec layer to the finish line. Work under the
standing best-judgment authorization: decide from the recorded decisions
(docs/decision-map.md is the state of record; docs/adr/ is the rationale of
record and wins every conflict; CONTEXT.md owns the vocabulary), and roll
into the next unblocked step without pausing between them. Read this file's
"## Progress log" FIRST and docs/decision-map.md second — never redo what
the world shows done.

── FIRST ACTION ──
git fetch origin --prune; base a fresh worktree on origin/main. Verify the
surface-design spec layer is merged (ADR-0008 in docs/adr/ on main and the
instrument strip on the deployed sample pages). If it is NOT merged, do the
merge leg first — its runbook is docs/prototypes/merge-watch-handoff-prompt.md
(gate: the thumb probe there must return 200 before pushing main).

── THE REMAINING ARC (in dependency order — one unit per session, then
   hand off; a unit = one decision-map ticket or one sliced issue) ──

1. VARIANT BUILDS — the store, five ways. For each surface, in this order:
   editorial → pdp → plp → checkout → a11y → how-it-was-built.
   The spec each build consumes is ADR-0008 (masters under
   packages/reference/surfaces/ are the contract of record; the "what a
   variant may vary" section lists the serialization freedoms). Binding
   per-build duties: scaffold from the framework's official starter and
   publish the diff-to-starter (ADR-0003 2026-07-12 addendum); register the
   variant in SURFACE_CONTROLS + add origin-suite page assertions (the
   build's definition of done); register paradigm noise classes in
   PERMITTED_NOISE (behavior attrs are their own declared class); the drift
   gate must pass for every page the build serves. Surface-specific owed
   items: PLP brings the edge Worker's canonical ?genre/style/format/sort/q
   params (ADR-0005 §5), the interaction-registry entries (plp-*,
   checkout-* — ADR-0005 §3 / ADR-0008 consequences), and the chrome's
   per-interaction readout + replay wiring; the first content-surface build
   owes the deployed-smoke leg that re-renders masters from the RESOLVED
   snapshot (ADR-0008 §9). Size each session's slice yourself (/to-prd →
   /to-issues for the first build is the precedent; a whole surface across
   five variants is usually too big for one session — slice per variant or
   per variant-pair and chain).

2. FIRST PUBLICATION — the numbers. Only after at least the spine surfaces
   are served: run the bench batches (median-of-N, three profiles, one
   SHA), the WebPageTest directional cross-check for any throttled verdict
   (ADR-0001 §A), re-measure the chrome cost constant (§F — an ADR-0008
   obligation), publish lab bundles to /_pm/lab/{surface}.json (the typed
   receipt schema in packages/switcher/src/lab.ts; fit lines only where
   bands don't overlap, §C), build the plain-language methodology page,
   cost cells per §E (plane telemetry calibration first), and flip home's
   tense + catalogue tokens row-by-row (ADR-0007 §4 designed for this).
   C2 binds everywhere: no verdict without a published receipt.

3. DOMAIN CUTOVER — roblark.com onto the plane (decision-map ticket:
   registrar/DNS call, beacon WAF rule, legacy redirects, and the Discogs
   ToS/attribution decision — item e — which now also covers the store
   surfaces' cover art).

── SESSION DISCIPLINE (all standing, all load-bearing) ──
- One unit per session; before its commit run the saved verify-slice
  workflow in the background (sequential lenses, disk-streamed findings,
  resume with resumeFromRunId + byte-identical args) while you probe
  inline; refute findings inline before adopting. Commit with explicit
  paths, one commit per slice; push the branch (CI is the second check);
  merging to main deploys and is Rob's call unless he has said otherwise
  for that slice.
- Record as you go: decision-map answers, build-log phase notes, ADR
  addenda when a recorded decision gets qualified — and append a dated
  line to this file's Progress log at every completed step. On any
  session-limit death the successor re-VERIFIES from the world (git SHAs,
  HTTP probes, CI runs continue server-side) and never re-executes what
  completed; fan-outs are sequential and resumable, never parallel near
  the wall.
- Every number, date, or SHA in any artifact comes from a manifest, tray,
  or tool output — never typed (the rule has now caught its authors three
  times).
- Effort calibration (Rob's token feedback, 2026-07-17): full ultracode
  (panel + multi-lens everything) is for design-heavy or publication
  tickets; mechanical variant builds run standard effort with verify-slice
  as the constant gate. When in doubt, spend tokens on probes over agents.

── DO NOT ──
No redesign of the spec layer (ADR-0008 + the seven-lens panel already
ran); no live Discogs calls outside the fenced demonstration path; no lab
throttle faked at a visitor; nothing merged that turns the deployed smoke
red.
```

## Progress log

(Successor sessions: read this first; verify, don't redo. Append one dated
line per completed unit.)

- 2026-07-17 — spec layer committed as a886de1 on worktree-store-surfaces
  (branch CI green); merge leg in progress in the surface-design session
  itself (remote thumb seed running; merge + deploy-watch to follow). The
  merge-watch runbook file exists as contingency only.
- 2026-07-18 — merge leg COMPLETE: main = a886de1, deployed, post-deploy
  smoke green (CI run 29630914441 after seed + rerun). Next unit: the
  editorial variant build (arc step 1).
- 2026-07-18 — editorial build PRD'd + SLICED: committed in-repo as
  docs/prds/editorial-build{,-issues}.md (worktree-store-surfaces
  d3e6e62, pushed, docs-only). Six chained slices: vanilla → react-next
  → astro → qwik → htmx → remix3. Verified: adr-fact-checker + seams
  lenses completed (7+8 findings); zero-bias + hostile-staff
  limit-killed, hand-walked inline (round-three precedent); 17 distinct
  defects adopted pre-commit (headliners: cart storage contract existed
  nowhere; turbo cache would replay fixture dists onto the crate plane;
  NoiseSpec can't express ADR-0008's behavior-attribute class). GitHub
  issue mirror PENDING — the permission gate required a human-named
  publish; exact commands in the issues file's header. Next unit:
  slice A (vanilla editorial — host-variant pattern, cart contract,
  snapshot-selector minting, NoiseSpec class, deployed re-render leg);
  implementation does not wait on the mirror.
- 2026-07-18 — ticket commit MERGED per Rob ("merge in"): main = d3e6e62
  (fast-forward), deploy + post-deploy smoke green (CI run 29659521631).
  The PRD + slice specs are now the spec of record on main. Next unit
  unchanged: slice A.
- 2026-07-19 — SLICE A COMPLETE (vanilla editorial): committed as 30c85b1
  on worktree-store-surfaces, REBASED onto the blog-plane merge (main =
  022e307; blog took ports 8791/9234 — vanilla moved to 8792/9235; front
  Worker now carries VANILLA + BLOG bindings), pushed, branch CI green
  (run 29690187470; the pre-rebase commit was independently green too).
  Local proof BOTH modes: origin suite 182/182 fixture (blog legs
  included) and 158/158 against a crate-seeded local plane — the ADR-0008
  §9 re-render leg ran against real crate pages before any deploy.
  Minted for B–F: PM_SNAPSHOT (turbo env + tray inputs on
  @pm/vanilla#build; crate on the deploy build step; run-local DERIVES it
  from PM_SEED_DIR), CART_CONTRACT (packages/reference/render/shell.mjs —
  incl. the "9+" badge cap and the cart-anchor aria-label the lenses
  forced), NoiseSpec.behaviorAttrPatterns + the repo-checks
  class-discipline guard, the snapshot-aware drift comparison (DOM + three
  pixel profiles, doubles as the §9 leg), and the repo-checks pre-merge
  variant-vs-master textual-identity guard (both snapshots; extend per
  variant). verify-slice: 4 lenses, 11 findings, all refuted inline, all
  adopted (narrative: build-log Phase 8). MERGE IS ROB'S CALL (merging
  deploys /vanilla/editorial/ to the plane). Next unit: slice B
  (react-next editorial, ISSUE B) — remember pm-edge must deploy BEFORE
  any variant that binds it (reorder the CI deploy step when B lands).
- 2026-07-19 — SLICE B SESSION START: verified from the world (not
  redone): 30c85b1 (slice A) is merged into main via fast-forward (main
  == origin/worktree-store-surfaces == 30c85b1); no rebase needed, work
  continues in the existing worktree-store-surfaces worktree. Checked
  the post-deploy smoke per the standing gate: it has NOT run since
  d3e6e62 — both CI run 29660750346 (022e307, blog plane) and run
  29691610855 (30c85b1, slice A merge) fail at the "Deploy blog Worker
  (resources + migrations first)" step (D1 migrate:remote → Cloudflare
  API code 7403, "account not authorized" — the same D1:Edit token gap
  already tracked as Rob-gated). Because that step precedes "Deploy
  front Worker" / "Wait for the deployed origin" / "Post-deploy smoke"
  in the deploy job, ALL of those are SKIPPED, not just failed — the
  live plane is still serving the pre-blog-plane front Worker (last
  full green deploy: d3e6e62/29659521631). Net effect: neither the blog
  plane nor slice A's vanilla editorial variant is actually live yet,
  though both are merged to main. This is Rob's token re-mint to fix,
  not a code fix; not attempted here. Does not block slice B (branch
  CI's check+origin jobs are unaffected; merge-to-main deploy remains
  Rob's call as always). Proceeding to slice B (react-next editorial,
  ISSUE B).
- 2026-07-19 — SLICE B COMPLETE (react-next editorial, ISSUE B): the
  OpenNext-on-Cloudflare variant serves /react-next/editorial/ through
  the composed origin, request-time SSR fetching trays via its own
  pm-edge service binding (front's own EDGE binding doesn't reach a
  variant server-side). Registered: SURFACE_CONTROLS (react-next moved
  plannedVariants → variants), PERMITTED_NOISE (new dropElementSelectors
  NoiseSpec field — content-aware whole-element removal, generalizing
  the chrome-slot special-case — registered for App Router's own SSR
  streaming-metadata wrapper), the drift-gate comparison (DOM + 3 pixel
  profiles), origin-suite assertions incl. observed noise, run-local
  ports 8793/9236, CI deploy line with pm-edge reordered BEFORE the
  variants (a request-time variant now binds it directly). New
  mechanism minted: a linkedom + react-dom/server pre-merge
  variant-master-identity guard (render.tsx is framework-neutral,
  callable directly — no browser, no server needed, mirroring slice A's
  in-process guard for a paradigm with no synchronous render-to-string
  entry point of its own). Also new: the matrix's first error boundary
  for a live per-request data-fetch failure (app/editorial/error.tsx),
  since react-next is the first REQUEST-TIME variant — vanilla is
  build-time and has no live failure mode at all.
  verify-slice: four lenses, 8 findings, all verified against source,
  all real, all adopted pre-commit — headline: the deploy script never
  ran copy-tokens.mjs, and because CI's "origin"/"deploy" jobs share a
  turbo cache key on the same SHA, the very first real deploy would
  have shipped a Worker with all CSS/fonts 404ing (completely unstyled
  production page) — fixed by making `deploy` self-sufficient like
  `build`. Also fixed: a React-entity-encoding mismatch in a raw-string
  test assertion, an unexercised pre-merge noise-registration (now has
  a dedicated proof case), zero JS-on interactive coverage for the cart
  islands (cart.browser.test.ts parametrized over all live variants),
  missing turbo `inputs` for the fixture files react-next statically
  imports, and a positional (not content-aware) element-removal selector
  that could have silently hidden future real markup. Local proof BOTH
  modes: origin suite 199/199 fixture AND 199/199 against a
  crate-seeded local plane. Full repo turbo lint/typecheck/test 22/22
  (root eslint.config.mjs gained .next/.open-next/generated-.d.ts
  ignores along the way — the repo-wide lint had picked up ~16,000
  errors from Next's/OpenNext's own build output before that fix).
  DIFF-TO-STARTER.md: 22 recorded deviations, several verified
  empirically rather than assumed (Next 16's own AGENTS.md warns its
  APIs differ from training data). Next unit: slice C (astro editorial).
- 2026-07-19 — SLICE B CI-ONLY FAILURE, FOUND AND FIXED: the pushed
  commit (24db316) went green on `check` but CI's `origin` job failed
  once, on the cart geometry test for react-next, at the exact step
  that had passed locally every time. Root cause was a genuine race, not
  flakiness: `div#pm-chrome-slot` (Shell, render.tsx) has zero React
  children, but the front Worker's HTMLRewriter injects the
  switcher/HUD chrome into it by rewriting the HTTP stream in transit —
  the browser's initial parse already has the chrome, React's hydration
  doesn't expect it, and react-dom's own mismatch-recovery path
  (`popHydrationState` → `throwOnHydrationMismatch`, read directly from
  the installed `react-dom` source) silently re-renders that subtree
  empty. Invisible on a fast machine (resolves within the same paint
  frame); reproduced locally on demand via Playwright's
  `Emulation.setCPUThrottlingRate: 4` (4/8 runs failed with the exact CI
  signature, unfixed). Also a real shipped bug independent of the test:
  the switcher/HUD vanishes a moment after every react-next page load on
  any visitor's slow-enough machine. Fixed with `dangerouslySetInnerHTML`
  on the chrome-slot div — confirmed against react-dom's
  `shouldSetTextContent` source as the one condition that makes
  hydration skip the mismatch walk; `suppressHydrationWarning` alone
  does not. Re-verified 8/8 under the same throttle with the fix, then
  209/209 both snapshot modes at normal speed, turbo lint/typecheck/test
  22/22 (incl. the variant-master-identity guard, unaffected). Unrelated
  finding along the way, not a code issue: this machine had accumulated
  dozens of orphaned wrangler/workerd processes from past sessions
  (run-local.mjs only cleans up its own run's children), which produced
  a red-herring 522s suite timeout-storm before the real fix was
  isolated — cleared manually. build-log.md Phase 8 postscript and
  decision-map.md carry the full narrative. Committing + pushing this
  fix now; next unit remains slice C (astro editorial).
- 2026-07-24 — SLICE C DONE (astro editorial), committed + pushed as
  `a1a3e90` on worktree-store-surfaces, UNMERGED (Rob's call). Note main
  had moved to `8079e11` (a blog editor publish/settings-drawer fix)
  ahead of what the prompt said — always re-check origin/main. Local:
  227/227 origin suite in BOTH snapshot modes, turbo 26/26, astro check
  0/0/0. astro@7.1.3, static output, NO adapter; the first variant that
  adds nothing to the shared tooling (no NoiseSpec field, no normalizer
  change, no PERMITTED_NOISE entry at all — the empty registration is a
  MEASURED outcome and is asserted against raw served bytes, not assumed).
  The island question was settled by building a throwaway
  @astrojs/preact probe: a client:load island wraps its content in an
  <astro-island> element WITH element children, which
  dropElementSelectors' content-aware guard cannot excuse — and since
  the wrapper is display:contents, the PIXEL leg would have passed and
  only the DOM check catches it. So add-to-cart is a plain bundled
  <script> (what Astro's docs put first for interactivity without a UI
  framework) plus a JSON script data hook; on prose with one button the
  islands paradigm has no island to place. Astro's escaping is
  byte-identical to the reference renderer's (html-escaper, decimal
  &#39; — React emits &#x27;, which is why slice B needed a second
  escaper), and Astro emits bare boolean attributes without
  self-closing void elements, so the canonical font markup matches
  VERBATIM and this variant needed none of slice B's renderer-shaped
  tolerances. TWO CI-only failures caught before pushing, both green
  locally: astro check fails on a FRESH CLONE because the page imports
  the generated snapshot module (fixed by a build dependency AND by
  declaring that file a build output — a cache hit otherwise replays
  dist without it), and root eslint picked up Astro's generated .astro/
  types. The pre-merge identity guard uses Astro's OWN Container API and
  so lives in variants/astro/test/, not tools/repo-checks (loading a
  .astro file needs Astro's compiler; hosting that in repo-checks would
  route every repo-wide guard through Astro's Vite plugin). verify-slice:
  four lenses, 13 findings, 10 adopted pre-commit — two of them holes in
  this slice's own earlier fixes. **THREE findings were ESCALATED, not
  fixed — they became the `bench-accounting-fix` ticket (issue #16) in
  decision-map.md, now RESOLVED (2026-08-01, ADR-0001 addendum G–J /
  ADR-0003 CSS-delivery addendum) before any bench batch publishes.**
  Headline: Astro inlines
  the cart bundle and the KB accounting derives JS from resource-timing
  entries keyed by URL extension, so the render axis would publish astro
  at 0 KB initial JS while the page ships 1,247 B — printing vanilla,
  the NO-RUNTIME control, as shipping more JavaScript than the islands
  variant, on the one surface whose thesis is how much machinery prose
  needs. The easy workaround (assetsInlineLimit: 0) was rejected as
  rigging the variant to fit the instrument. Also fixed a PRE-EXISTING
  bench-runner defect found while verifying (INP recorded null on 2 of 3
  local runs; web-vitals leaves the metric at -1 and refuses to emit
  below 0 even on a forced report, while the runner waited a fixed 400ms
  for a hop that defers through requestIdleCallback) — that one arguably
  wanted its own commit, flagged to Rob.
  MERGED to main as `0b1f050` (PR #15, rebase-merged so history stays
  linear — Rob asked for the merge, and a PR respects git.md's documented
  convention, unlike slice B's direct push).
  **Next unit: slice D (qwik editorial)** — request-time, so copy
  variants/react-next, NOT vanilla or astro: it must bind pm-edge itself
  in its own wrangler.jsonc.
  **THEN, immediately after slice D and BEFORE slices E/F: the
  `bench-accounting-fix` session (issue #16).** Rob's explicit call
  2026-07-24 — document the measurement defects well and address them at
  the RIGHT time, not at the end of the project. That slot is deliberate:
  Qwik ships the most JS of any paradigm and has its own delivery shape,
  so fixing the accounting right after D validates it against three
  different shapes at once (vanilla = external file, astro = inlined,
  qwik = its own) while only three variants need re-verifying. Scope:
  inline `<script>`/`<style>` bytes are invisible to the KB accounting
  (astro would publish 0 KB initial JS while shipping 1,247 B);
  `cpu.ts LOCAL_PLANE_INSPECTORS` omits every real variant's inspector;
  ADR-0003 §2 "CSS its native way" is nominal across all three variants.
  Needs an ADR-0001 §3 addendum for the double-counting decision.
  Hard-blocks the first editorial bench batch.
- 2026-07-24 — **NEW DEPLOY-FLAKE CLASS, will hit slices D/E/F once each.**
  Slice C's merge deploy went check ✅ origin ✅ **deploy ❌** on
  `content-encoding for /astro/editorial/: expected '' to be 'br'`. NOT a
  config fault and NOT the known 404-propagation race: on the deployed
  plane a **brand-new URL's first hit is a cache MISS, and Cloudflare
  serves that MISS UNCOMPRESSED.** Verified live afterwards — same URL
  serves `br` with `cf-cache-status: HIT`, headers byte-identical to
  vanilla's, and the variant's own drift+pixel legs had PASSED against
  the crate master in that same failing run. Cleared with
  `gh run rerun 30143140382 --failed` → deploy green, main healthy, crate
  plane serving slice C. Because every new variant adds exactly one new
  URL, this was a guaranteed red deploy for each remaining slice, so
  `wireEncoding` (tools/origin-suite/suite/editorial.test.ts) now warms
  the URL until an encoding appears — bounded, gated on PM_EXPECT_BROTLI,
  nothing loosened. On branch `slice-c-followups` → **PR #17, awaiting
  Rob's merge** (it also carries the issue-#16 scheduling docs).
  Branch hygiene: after a `--rebase` PR merge the remote branch keeps the
  pre-rebase sha, so follow-ups went on a fresh branch rather than
  force-pushing; `worktree-store-surfaces` is merged and can be deleted —
  branch fresh from origin/main for slice D.
- 2026-07-26 — **SLICE D DONE (qwik editorial), branch `slice-d-qwik`** off
  `origin/main` = `49d502e` (PR #17 from slice C had already merged; the two
  commits it carried, `56e0b26` + `49d502e`, are on main). Local proof: origin
  suite **250/250 in BOTH snapshot modes** (fixture and
  `PM_SEED_DIR=tools/snapshot-capture/crate`), turbo lint/typecheck/test
  **28/28**. Qwik v1 stable `1.20.0` — NOT v2, which is still beta and would
  make this a fenced exhibit under ADR-0003's first addendum. Request-time:
  binds pm-edge itself, `routeLoader$` per request, no PM_SNAPSHOT anywhere.
  **The structural risk was measured away BEFORE any code was written** with a
  throwaway scaffold: Qwik emits `<html>` itself and puts `q:container` &co on
  it (contract surface — the normalizer compares the document element's own
  attributes), but it adds **no wrapper ELEMENT anywhere**, so this is NOT
  slice C's `<astro-island>` problem — it is a registration question. Result:
  the first registry entry that is all mechanism (`behaviorAttrPatterns:
  ["^q:","^on:","^on-document:"]`, `attrPatterns`/`classPatterns` empty, no
  `dropElementSelectors`). `^on-document:` is a SEPARATE prefix `^on:` does not
  match. Bounded, proven by three sabotages incl. a colon-less `onclick`
  lookalike that must not be stripped — it wasn't.
  Two expectations from earlier slices INVERTED on measurement: Qwik's escaping
  is byte-identical to the reference `esc()` (no second escaper, unlike slice
  B), and it does NOT split `text {expr} text` into separate text nodes.
  Prefix mounting derives from ONE value (`base` → router basePathname,
  clientPublicOutDir, `q:base`, `import.meta.env.BASE_URL`) — nicer than slice
  C, which kept `base`/`outDir` aligned by hand; forcing it with `build.outDir`
  instead is a recorded trap (applies to both vite builds, second wipes the
  first). Two starter defects fixed with evidence: assets binding named `ASSET`
  while qwik-city's own middleware calls `env.ASSETS.fetch` (latent), and
  **`@builder.io/qwik-city@1.20.0` declares `@builder.io/qwik` in neither
  dependencies nor peerDependencies** — fatal under the repo's no-hoisting
  isolation, fixed by `packageExtensions` (slice-B precedent). The framework
  CLI is a third instance (`ignore`, then `semver`) and was dropped from the
  pipeline instead of chased.
  NEW SHARED TEST, valuable beyond this slice: `cart.browser.test.ts` now
  asserts, for EVERY live variant under a 4x CPU throttle applied before
  navigation, that the front Worker's injected chrome survives load AND a cart
  interaction — the slice-B CLS bug generalized into a matrix-wide regression
  guard. All four variants pass.
  Pre-merge master-identity guard uses Qwik's OWN `renderToString` (the most
  direct of the four; needs a `symbolMapper` stub because no chunk exists
  outside a production build, and a `<div>` container that the test unwraps as
  a DOM operation — Qwik rejects `containerTagName: "body"`). Sabotage-proven on
  crate copy. Also verified inline: fresh-clone typecheck+build from wiped
  trees; a real turbo cache HIT restores BOTH `dist/**` and `server/**` (the
  latter is outside dist/ because dist/ is the public asset dir, so it needed
  its own outputs entry) and `wrangler deploy --dry-run` then resolves; the
  `.assetsignore` claim with a negative control (200 without it, 404 with);
  and `q-data.json` passes through the composed origin as untouched JSON while
  the HTML gets chrome. `DIFF-TO-STARTER.md`: 23 numbered deviations + a
  measured-behaviours section.
  NOTE for the crate-mode run in a FRESH worktree: `tools/snapshot-capture/crate/img/`
  is git-ignored, so `PM_SEED_DIR` seeding fails until you copy it in from
  another checkout (3634 files).
  **verify-slice: 4 lenses, 20 findings, ALL adopted** (correctness 4,
  issue/ADR-conformance 6, seams 5, anti-rigging 5; several caught
  independently by two lenses). It earned its keep on the RECORD rather than
  the code — 14 of the 20 were false or unqualified claims in my own
  comments/receipt, which is exactly the class that survives review and then
  gets quoted into a reading table. The two that mattered most, both
  self-flattering:
  (a) **"no JavaScript for the click is downloaded until the click" was FALSE.**
  Measured (JS-on, resource timing, composed origin): qwik fetches **7 files /
  26.83 kB encoded / 62.16 kB decoded at LOAD and NOTHING on the click**. Cause:
  the cart contract forces a load-time storage read → that read is a QRL →
  resolving any QRL needs the framework core (50,917 B) → and rollup co-located
  `src/lib/cart.ts` so the qinit chunk statically imports the CLICK chunk
  (verified in the built bundle). Resumability defers the BINDING, not the bytes.
  (b) **"one lazy chunk at startup" understated it ~20x** and appeared in three
  places the reading table would quote. Same-run comparison, now in the receipt:
  vanilla 1.35 kB · astro **0 requests** (inlined — issue #16's defect
  reproducing independently) · qwik 26.83 kB · react-next 145.05 kB; all four
  fetch nothing on click. A new origin-suite assertion PINS the import chain so
  the numbers can't rot silently.
  Also adopted: the noise non-vacuity gates were satisfiable by a `<script>` the
  normalizer deletes (both legs now scope to compared elements only —
  swapping `useOnDocument` for `useVisibleTask$` would previously have left
  `^on-document:` excusing nothing, all guards green); the registry audit note's
  counts were wrong and unscoped (now regex-derived and scoped: 6 COMPARED body
  elements with q:key, 4 with q:id, 16 `<!--qv-->` markers / 14 keyed, 8 head
  links sharing `q:key="Ro_1"`); `q:key` is NOT a component$-host thing at all
  (the optimizer assigns node keys, so inline markup gets it — `<article>`,
  `<blockquote>`, `<li>`); TypeScript was pinned 5.4.5 while the repo is ^6.0.3
  AND my tsc was type-checking `@pm/drift-gate`'s raw source (bumped; dropped
  `vite-tsconfig-paths`, whose only effect was dragging `tsconfck@^5` in for an
  alias no file used); the `packageExtensions` entry pinned the framework
  exactly under `dependencies`, so a bump would install TWO cores — now a
  `peerDependencies: "*"`, verified one instance on a fresh install; and
  `404.html` now joins `.assetsignore` (it was reachable as a stray 200 HTML
  page with no chrome slot via a 307 from `/qwik/404.html`).
  **Sabotage lesson worth keeping:** to test a pnpm resolution change you must
  WIPE node_modules — `pnpm install --force` keeps the previously-resolved
  symlink and will tell you a load-bearing entry is dead config.
  **Escalated, NOT fixed (belongs to issue #16, now on that ticket):** qwik is
  the only variant fetching anything after `load` (its preloader runs in
  `requestIdleCallback`), and `collect.ts` snapshots `initialEntries` at
  networkidle then slices `interactionBytes` POSITIONALLY — so under CPU
  throttling the same build yields two different receipts. Fix that removes the
  class: await an in-page `requestIdleCallback` before the snapshot.
  **Found in slice B's code, FIXED as its own commit `cc69255` on the same
  branch** (kept out of slice D's commit so the qwik diff stays reviewable —
  drop it if you'd rather it were only filed): `react-next`'s `readCart()`
  returned the module-level `EMPTY_CART` and `addToCart` mutated it in place, so
  a failed `setItem` violated the contract's "changes nothing" clause and the
  pollution persisted for the page's lifetime. Reproduced with a warm-up click
  first (needed — a naive probe races Qwik's lazy handler and mis-accuses qwik):
  vanilla/astro/qwik store qty 1 after two failed adds + one real one,
  react-next stored **4**. Fixed by building the next cart immutably; regression
  test parametrized over every live variant (suite now 254). With the fix
  reverted it fails for react-next only.
  **Harness trap that cost two wrong conclusions today:** an ad-hoc composition
  bring-up (not `run-local.mjs`) serves whatever `PM_SNAPSHOT` each variant's
  dist was last built with, so vanilla/astro can be crate-baked against a
  fixture-seeded plane and their featured IDs disagree with the suite's. Only
  `run-local.mjs` builds every variant with the matching selector — never trust
  a hand-started plane for anything ID- or snapshot-sensitive.
  **MERGED to main on Rob's call ("merge this work in"): PR #18,
  `gh pr merge --rebase`** — main went `49d502e` → `c71ce1a` (slice D) →
  `f3e1bef` (the cart fix). Rebase minted new SHAs, so the local branch was
  verified `git diff HEAD origin/main` EMPTY and then reset to origin/main.
- 2026-07-27 — **POST-MERGE HARNESS FIX, main green again: `b08b662`
  ("Wait for image decode before the pixel shot"), PR #19, rebase-merged on
  Rob's call.** Slice D's merge went check+origin green and **deploy RED twice,
  with TWO DIFFERENT failures** — a reminder that "rerun it" is not a diagnosis.
  (a) A 30s `page.goto` timeout in `bench.browser.test.ts` against
  `/placeholder-static/sample/`, a months-old page, while 218 assertions passed;
  the same URL served in 0.22s from a workstation seconds later. Not recurred,
  nothing changed for it, but it is now an explicit design question on the
  issue-#16 ticket: a post-deploy gate that runs a PERFORMANCE batch will go red
  for reasons that are not regressions, and that blocks main.
  (b) `pixels-slow-4g-mid-phone-vanilla-editorial`: 421,656 differing pixels at
  identical dimensions, on a variant slice D never touched. Diagnosed from the
  `smoke-dev-logs` CI artifact (it carries actual/expected/diff PNGs — download
  it, don't guess): every glyph matched, exactly ONE image was blank on the
  served side — the article figure, the only one with `decoding="async"`.
  Root cause: NOTHING in the pre-shot pipeline waited for a frame to be DECODED.
  `settleImages` waited for `img.complete` (bytes arrived) and
  `captureStablePixels` waits for FONTS then screenshots; an async-decoded image
  may be painted before its frame is ready. Fixed with `img.decode()`, the real
  paintable signal (it also rejects on a genuinely undecodable image, so those
  now fail loudly instead of quietly diffing). Measured before fixing: decode
  needed 1.3-2.3 ms per image AFTER `complete` on a fast workstation — small
  there, unbounded on a loaded two-core runner.
  **My first diagnosis was WRONG and is recorded as such in the commit:** I
  blamed the mobile profile's CPU/network throttling; `profileContextOptions`
  applies only the VIEWPORT axis and runs JS-off, so throttling was never
  involved (the conclusion — a decode race — survived, the reason didn't).
  Verified where it actually failed: full drift leg **49/49 against the DEPLOYED
  origin** (NODE_EXTRA_CA_CERTS + PM_ORIGIN + PM_EXPECT_BROTLI), plus 254/254
  locally in BOTH snapshot modes and turbo 28/28.
  **THIRD instance of one pattern, so it is now a standing rule** in
  `tools/drift-gate/README.md` ("Settling: wait for the real signal, never a
  proxy"): a fixed 400ms wait returning a null INP (slice C), a bytes-arrived
  flag standing in for paintable (this), and a network-quiet heuristic standing
  in for idle-work-finished (open, issue #16 defect 4). When a gate goes red and
  the page looks right by hand, suspect the WAIT before the page — and fix it by
  making the wait more precise, never by loosening the assertion.
  A ready-to-paste prompt for the next unit is at
  `docs/prototypes/bench-accounting-fix-prompt.md`.

  **Next unit: the `bench-accounting-fix` session (issue #16)** — Rob's
  explicit 2026-07-24 call, deliberately BEFORE slices E/F. A ready-to-paste
  prompt for it lives at
  `docs/prototypes/bench-accounting-fix-prompt.md` (untracked, main checkout):
  it carries all FOUR defects, the measured eager-JS ground-truth table to check
  a fixed harness against, every standing-discipline trap this session hit, and
  the one open judgment call (how the reading table frames qwik's 26.83 kB)
  which is explicitly NOT that unit's to settle. THEN slice E (htmx), which
  also owes the home editorial-row flip.

- 2026-08-01 — **`bench-accounting-fix` DONE (issue #16), worktree
  `bench-accounting-fix` off `main` (b08b662); merge is Rob's call.** All four
  defects + the 2026-08-01 audit's measurement-integrity and drift-gate findings,
  as one accounting session. The ruler: document bytes are decomposed
  (`decomposeDocument`) — one compressed `transferSize` split by UNCOMPRESSED
  content share into html/js/data + STRIPPED instrumentation markup, summing
  EXACTLY (no double-count). Inline executable script → JS (Astro's inlined
  ~1.2 KB bundle is no longer "0 KB"), inline non-executed script (json/qwik-json)
  → data, injected chrome markup + `/_pm/` tags → instrumentation (audit
  collect.ts:303). CPU: `LOCAL_PLANE_INSPECTORS` completed (9235–9238), summed
  over the SERVING PATH per visit (front + variant + edge), not the whole plane
  (verify-slice caught the whole-plane over-attribution); a missing serving-path
  inspector is a NAMED hard error, not a silent under-attribution;
  `--local-cpu` refused against a remote origin (binding E, audit cli.ts:42).
  Settle is signal-based, bounded: interaction bytes wait for network-idle
  (audit :171), the vitals beacon waits for delivery to quiesce (audit :254),
  and post-load idle work (Qwik's preloader) is awaited onto the initial byte
  side before the snapshot (defect 4). Drift-gate integrity (audit §A): pixel
  threshold 0.1 → 0 with a `solidPng` sensitivity proof; self-hosted check is a
  delimited origin match re-asserted AFTER the shot (late @font-face);
  `dropElementSelectors` rejects text-node content, not just element children.
  Decisions of record: ADR-0001 addendum G–J, ADR-0003 CSS-delivery addendum
  (deferred to PDP/PLP, CSS cell barred from publishing as a verdict meanwhile),
  ADR-0002 provenance addendum (`SnapshotManifest.source` union so the fixture is
  truthful). Task 0 reconciled stale state-of-record (decision-map: blog live
  since 2026-07-19, slice D merged PR #18; workers/README runbook step 2;
  finish-line dead pointer). New tests: `origin-suite/suite/decompose.test.ts`
  (8, incl. a negative-rounding boundary) + `pixels.test.ts` (5); turbo 28/28;
  full origin suite 269/269 fixture, 268/269 crate (the 1 miss the git-ignored
  crate thumbnail absent locally). verify-slice (4 lenses) ran to completion,
  every finding adopted or documented (incl. two it caught that a probe hadn't:
  CPU whole-plane over-attribution → serving-path per visit; negative rounding →
  largest-remainder). **Pushed `9132519`, CI check+origin GREEN** — after ONE
  CI-only red found+fixed: the vitals-beacon wait had used quiescence (no new
  beacon for 150 ms), but web-vitals sends each metric separately and the loaded
  CI runner spaces CLS/INP >150 ms after the early ones, so it exited in the gap
  and nulled them; fixed to wait for the EXPECTED metric SET, bounded (amended
  into the same commit). Deploy is main-only (skipped on the branch) — check its
  OWN conclusion at merge. What this unit is NOT: no bench PUBLICATION (next arc
  step), no variant changes, blog/edge SECURITY findings held as a SEPARATE
  track. THEN slice E (htmx), which also owes the home editorial-row flip.
- 2026-08-09 — **SLICE E DONE (htmx editorial) — THE EDITORIAL SURFACE IS
  COMPLETE across all five core paradigms.** Committed as `deb30ef` on branch
  `slice-e-htmx` off main (`d561677`), pushed; branch CI running; MERGE IS
  ROB'S CALL (merging deploys /htmx/editorial/ + the home row flip to the
  plane). The third request-time variant (own pm-edge binding) and second
  starterless one: a hand-written Worker renders per request — the paradigm
  IS the template — so the pre-merge identity guard is the vanilla
  byte-strict mechanism (both snapshots, first-probe pass, sabotage-proven).
  htmx.org pinned EXACT 2.0.10 (4.x is alpha/beta = fence territory),
  vendored, served same-origin, asserted byte-identical to the
  lockfile-installed package. ZERO hx-* on the page (ISSUE E's honest
  hypermedia statement) → nothing registered in PERMITTED_NOISE, emptiness
  asserted against raw bytes in both suites; the runtime still ships
  (site-wide install is the paradigm's real shape): measured 51,238 B raw /
  14,996 B brotli, click fetches nothing. Completion duties: plannedVariants
  GONE (hardened 4 suite assertions on the absent key; disclosure unit guard
  retargeted to checkout + a synthetic mixed-surface test), home editorial
  row flipped to "Public today · open the surface" → /vanilla/editorial/
  (ADR-0007 §4; publication-time tense flips stay out). pm-htmx on
  8796/9239 incl. LOCAL_PLANE_INSPECTORS (serving-path CPU hard-errors
  without it); CI deploys @pm/htmx behind pm-edge. verify-slice: 4 lenses,
  7 distinct findings, 6 ADOPTED (headliners: branded-503 boundary didn't
  cover render-time throws — moved render inside the guard + first-ever
  test of that branch, in-process stub-EDGE harness in repo-checks; the
  identity guard never executed snapshot.mjs's crate policy — a typo'd
  featured-id would merge green/smoke red — guard now derives through the
  variant's own module; zero-hx regex missed hx-on:*/valueless/data-hx-;
  same-origin claim was a quote-sensitive regex, now parsed-subresource
  origin check), 1 REFUTED. All four lenses independently caught the
  DIFF-TO-STARTER misdescribing its own script order — the record-not-code
  class again. Final-tree proof: origin suite 291/291 fixture, 290/291
  crate (the known git-ignored thumb miss, 9861004-primary.thumb.avif),
  turbo 28/28, deploy dry-run clean. Task-0 reconcile: decision-map's
  bench-accounting "pending merge" line was stale — PR #20 verified MERGED
  as d561677, deploy green. Watch the eventual merge deploy for the
  slice-C first-hit-uncompressed class: wireEncoding warms the new URL,
  but the deploy leg has gone red once per new variant historically.
  **Next unit: slice F (remix3, the fenced frontier — re-verify the beta
  pin first; it always runs alone) — or the first editorial bench batch
  (arc step 2), whose accounting prerequisite (issue #16) is now merged;
  slice F first keeps the surface story clean.**
- 2026-08-09 — SLICE E MERGED + DEPLOYED per Rob ("merge this work in"):
  PR #21, `gh pr merge --rebase` → main `a0cf7ab` (rebase minted a new SHA;
  local verified diff-empty and reset to origin/main; remote branch
  slice-e-htmx can be deleted). The deploy run (31338002883) went
  check ✅ origin ✅ **deploy ❌ once** — the PREDICTED class, but a
  different signature than slice C's: not content-encoding (wireEncoding's
  warm-up held) but the drift leg finding NO injected chrome on
  /htmx/editorial/ (count 0 = the front Worker's plain-text 502 while the
  new HTMX binding propagated — the slice-B smoke-raced-propagation class;
  the same run's htmx CART tests passed, proving injection worked moments
  later). Live plane probed healthy BEFORE rerunning (200 + br + chrome
  stamped + home row flipped), then `gh run rerun --failed` → ALL GREEN.
  Production now serves all five editorial variants; home's editorial row
  reads "Public today · open the surface". Next unit: slice F (remix3,
  fenced, runs alone — re-verify the beta pin first) or the first
  editorial bench batch (arc step 2).
- 2026-08-12 — **SLICE F DONE, MERGED + DEPLOYED — THE EDITORIAL BUILD IS
  CLOSED, all six slices, all live in production.** Per Rob ("merge this
  work into main"): PR #22, `gh pr merge --rebase` → main `a0cf7ab` →
  `5468310` (NUL detox) → `db626cb` (slice F); local verified diff-empty
  and reset to origin/main; remote branch slice-f-remix3 + the worktree
  are deletable (Rob's call). Deploy run 31616165230 went check ✅
  origin ✅ **deploy ❌ once — the PREDICTED once-per-variant class, THIRD
  distinct signature**: not content-encoding (slice C) and not the new
  URL's chrome (slice E) — the post-deploy smoke read the FIVE EXISTING
  editorial URLs while they still served pre-deploy chrome
  (propagation/cache staleness), so their switcher rows lacked the new
  remix3 fenced anchor; the NEW /remix3/ URL itself passed everything.
  Live plane probed healthy BEFORE rerunning (all five core pages serving
  the fenced anchor; the exhibit's three labeling layers verified live),
  then `gh run rerun --failed` → ALL GREEN. Production now serves the
  complete editorial surface: five benchmarked paradigms + the fenced
  Remix 3 frontier. TWO commits deliberately (slice-D
  reviewability precedent, flagged for Rob): `0543f36` detoxes four
  pre-existing literal NUL bytes that made batch.ts diff as BINARY (the
  fence mechanism would have been unreviewable in the PR), then `9d94d92`
  is the slice, whose batch.ts changes now diff text-to-text. Beta pin
  re-verified before code (3.0.0-beta.5 still newest; sub-packages
  unchanged since 2026-07-01; lockfile is the pin; canary never fired).
  Hand-rolled Workers entry (spike prior art; NO nodejs_compat; esbuild
  prebuilt client; router built per request with env closed over;
  drain-before-respond so render throws land in the branded 503 — all
  recorded in DIFF-TO-STARTER). Three-layer fence as MECHANISM: DS plaque
  (version tool-derived from the package pin), SurfaceControls
  .fencedExhibits tagged switcher cell (never a column, never counted),
  assertBenchableTarget refusal inside runBatch with every target path
  canonicalized ONCE at entry. Advisory drift ENCODED (advisory funnels
  wrap the throwing helpers; mechanism-proof feeds BOTH deliberate drift);
  dropFencedSubtrees is a call-site flag never a NoiseSpec field; fenced
  count pinned at exactly 2 (plaque + frames demo), core pages asserted
  fence-free. §5 browser coverage committed (one-partial-fetch interception,
  Navigation API history, JS-off fallback). PERMITTED_NOISE measured-empty;
  #rmx-data IS served and pinned PRESENT — the earlier "measured absent"
  claim was DISPROVEN when verify-slice forced its citation to become an
  assertion (the record-not-code class, again the headline). verify-slice:
  4 lenses, 14 distinct findings, 12 adopted (fence URL-normalization
  bypass; plaque.css never linked — unstyled boundary invisible to every
  gate BY CONSTRUCTION, since comparisons drop fenced subtrees; NUL detox;
  advisoryPixelsEqual unproven; HEAD bodies on non-200 exits; crossorigin
  spec misquote; rmx-* discipline probes; fence-registry cross-check pin;
  + more), 1 informational (ISSUE F's literal "register the §7(b) list" vs
  the measured-empty outcome — documented deviation for Rob to see), 1
  partially refuted; survived a session-limit death mid-run and resumed
  from cache next morning. Final tree: origin suite 324/324 fixture,
  323/324 crate (the KNOWN git-ignored 9861004-primary.thumb.avif miss),
  turbo 30/30, advisory legs clean in both modes, exhibit + plaque + demo +
  chrome bar screenshot-verified against the real crate. New shared
  touches: front Worker passes /remix3/editorial/frames/* partials through
  untouched (variant-scoped; PLP build owns the generalization);
  packageExtensions for @remix-run/render-middleware's types-only d.ts
  leak (third instance of the class). TRAP for the merge deploy: the
  first-hit classes WILL likely hit once (new URL uncompressed MISS or
  binding-propagation chrome-count-0) — probe the live plane first, then
  `gh run rerun <id> --failed`. Next unit: the FIRST EDITORIAL BENCH BATCH
  (arc step 2 — median-of-N, three profiles, one SHA, receipts to
  /_pm/lab/, methodology page, home tense flips; ADR-0001 addendum F
  chrome-constant re-measure first) — design-heavy, warrants full
  ultracode effort per the recorded calibration.
- 2026-08-14 — **THE FIRST EDITORIAL BENCH BATCH IS PUBLISHED (arc step 2) —
  the reading tables carry receipt-linked numbers with min-max bands, and
  the site states how they were made.** Branch `editorial-bench-batch` off
  main (`db626cb`), **SEVEN commits, each a measurement boundary** — a
  receipt records `commit.dirty` AS MEASURED and the build refuses a dirty
  one, so code must be committed before the artifact that measures it.
  They CANNOT be squashed: receipts pin `85b97c4` and the constant pins
  `58d5101` by SHA. That tension with one-commit-per-branch is flagged for
  Rob, not papered over. **PUBLISHED (warm medians, avg-broadband, all
  band-qualified): initial JS astro 0.42 · vanilla 1.69 · htmx 19.38 ·
  qwik 29.48 · react-next 154.88 KB; TTFB ~120 ms build-time vs ~226 ms
  request-time; CLS 0.00 everywhere; INP (scripted) 24-32 ms; interaction
  bytes 0, every run proving it settled.** Three official batches (5 var x
  3 profiles x cold+warm x 7 runs, one nonce, all URLs pre-warmed to
  compressed first). Publication is MECHANISM: receipts committed under
  workers/front/lab/receipts/ -> served verbatim at /_pm/lab/receipts/;
  /_pm/lab/editorial.json GENERATED by the front build and IMPORTED by the
  Worker from dist (served == embedded, cannot drift); the build REFUSES
  dirty/mixed-SHA/mixed-date/mixed-location receipts, disagreeing batch
  shapes, a fit naming unmeasured variants, unsubstituted values,
  overlapping bands between ANY adjacent pair, bands from an incomplete run
  set, an unsettled no-fetch claim, a non-finite constant, and a constant
  measured against an unpopulated chrome. Methodology page at
  /methodology/. Home flips carry a receipt link. **Chrome constant
  (addendum F): +224 ms FCP / +216 ms LCP, 0 CLS, plus 1,908 B brotli** —
  processing and wire costs kept apart, measured against the POPULATED
  chrome on a local plane (the live plane cannot render it until this
  deploys; re-measure there is a bound obligation).
  **VERIFY-SLICE IS THE HEADLINE: it died on a model limit and returned
  four EMPTY findings arrays that read exactly like a clean pass** (journal
  said 4 started / 0 result, no findings files). Resumed on Opus 5: **26
  findings, 18 distinct, ALL adopted** — and three invalidated finished
  work: the constant was measured over an uncompressed document AND
  against the empty-state chrome; the reading table published bare medians,
  leaving addendum C's first clause unimplemented (proven with my own
  receipts: vanilla 448 vs astro 492 ms LCP, bands fully overlapping); and
  the fit's strongest claim was unfalsifiable, since zero interaction bytes
  is also what a swallowed settle timeout produces — which forced the
  batches to be RE-RUN on a harness that records `interactionSettled`.
  Also: the methodology page claimed a runner fence for the Apollo exhibit
  that does not exist (fence is variant-prefix; Apollo is a path under a
  live variant — copy narrowed, mechanism deferred to the PLP build);
  `INTERACTIONS` was a bare record lookup (`--interaction valueOf` would
  have minted a valid receipt having clicked nothing).
  **NEW TRAPS PAID FOR:** (1) editing ANY tracked file while a batch runs
  makes every receipt it mints unpublishable — cost one full batch run;
  (2) the constant's own artifact left in the tree dirties the next
  measurement; (3) `| tail` on a background run buffers all output to the
  end (the recorded trap, repaid); (4) Playwright's `route.fulfill` ignores
  a declared content-encoding — a brotli body yields a corrupt document
  (measured: 3,660 bytes, no chrome node), so the probe pads to equal bytes
  instead. Bands blew ADR-0008 §5's 12 KiB budget (12,396 largest, vanilla
  passing by 5 bytes) -> zero-width bands omitted, `<small>` not `<span>`,
  budget re-set to 13 KiB with an ADR-0008 addendum. Task-0: PR #22
  verified merged (`db626cb`) + deploy green; decision-map reconciled.
  Final tree: origin suite **335/335 fixture**, **334/335 crate** (the
  known git-ignored 9861004-primary.thumb.avif), turbo **30/30**, dry-run
  clean. Decisions of record: ADR-0001 addenda K-M, ADR-0008 addendum.
  **MERGED + DEPLOYED per Rob ("merge this work in"): PR #23, merged with a
  MERGE COMMIT (`7c5be98`) — deliberately NOT `--rebase`, breaking this
  chain's linear-history habit for the first time, because the published
  receipts pin `85b97c4` and the constant pins `58d5101` BY HASH and a
  rebase would rewrite both into SHAs absent from main's history, leaving
  every published number naming a commit a skeptic could not check out.
  Verified after merge: both SHAs are ancestors of main.** Branch CI green
  (check 38s, origin 2m42s); the main deploy run 31810830636 went
  check+origin+deploy **GREEN ON THE FIRST TRY** — the once-per-new-URL
  flake did NOT fire even though this shipped brand-new URLs
  (/methodology/, /_pm/lab/*), because the smoke's `wireEncoding`
  compression assertion only covers the variant editorial URLs, which were
  already warm. Live-verified in production: /methodology/ 200 carrying the
  measured constant, /_pm/lab/editorial.json serving all three profiles,
  its receipt URLs dereferencing 200, every editorial page rendering
  receipt-linked values with `<small class="pm-chrome__band">` bands and the
  /methodology/ limits link, home's row carrying the receipt-linked
  0.42–154.88 KB spread, and /remix3/editorial/ reading the benchmarked
  columns with ZERO columns of its own plus its RUM-only fenced note.
  Remote branch `editorial-bench-batch` + its worktree are deletable (Rob's
  call). **Next unit: the PDP build** (the thesis flip - same React/Next,
  opposite verdict; interactivity earns JS), consuming this pipeline as-is.
  Its first duties are the two obligations this unit BOUND: re-measure the
  chrome constant against the DEPLOYED plane (it can now render the
  populated chrome), and re-run the batch there (this one measured the
  plane before the publication reached it).
- 2026-08-14 — **PDP BUILD: PARTIAL. Both inherited obligations discharged,
  the spec layer fixed, vanilla shipped — and the thesis flip is NOT
  measured, blocked by a ruler defect the obligations themselves
  surfaced.** Branch `pdp-build` off `7c5be98`, **four commits, unmerged,
  MUST NOT be squashed or rebased** (`b12b8d9` carries receipts pinning
  `7c5be98` by hash). Final tree: turbo **30/30**, `@pm/reference` 36/36.
  **Obligation 1 (chrome constant, deployed plane):** +104 ms FCP /
  +104 ms LCP / 0 CLS / 0 long-task ms / 1,913 B brotli — against the
  local +224/+216/1,908 on a BYTE-IDENTICAL 12,023 B fragment
  (`populated: true`). Less than half. The local figure was inflated by
  local subresource service; the methodology page's local-origin caveat
  now renders itself away (`ccLocal` false for https).
  **Obligation 2 (batch re-run, deployed plane):** three profiles, one
  nonce, all ten effective URLs pre-warmed to compressed first, clean
  `7c5be98`, `interactionSettled` true on every run. Addendum K's
  prediction held exactly: timing up (LCP +30..+120 ms, TTFB +30..+55 ms
  on the request-time three), bytes flat.
  **THE HEADLINE FINDING — the instrument flatters its own best number.**
  astro's cell moved 0.42 → 0.37 KB with NO astro change. Root-caused:
  `decomposeDocument` splits `transferSize` by UNCOMPRESSED share, but on
  the live `/astro/editorial/` the injected chrome is 12,168 B of 19,381
  uncompressed (63%) and only 1,885 B of 4,290 on the wire (44%) — it
  compresses 6.46x against the document average 4.52x. Every non-chrome
  bucket is therefore under-attributed, the bias SCALES WITH THE CHROME,
  and it runs toward flattering the fit sentence's opener and home's
  published minimum. Measured: the astro cell **under-reports by 33.6%**.
  Filed as decision-map ticket `bench-instrumentation-dilution`, and it is
  a **HARD PREREQUISITE for any PDP byte publication** (the issue-#16
  rule). Deliberately NOT fixed in this unit — a ruler change is its own
  unit (Rob's 2026-07-24 precedent), it invalidates every committed
  receipt, and fixing it here would have invalidated the very obligation
  artifacts this unit was bound to produce.
  **Spec layer (ADR-0008 addendum):** the PDP now renders FOUR masters, not
  one — the three degenerate arms (439/500 single-format, 44/500 unpriced,
  90/500 one-image: the COMMON path) were ungated BY CONSTRUCTION, since
  the gate only compares against a master and `build.mjs` rendered only the
  rich featured release. `render/lib.mjs pdpMasterIds` is the single
  derivation (reference build + variant builds + gate re-render). Each
  degenerate master ISOLATES one branch; the first draft did not — "lowest
  id exhibiting the branch" resolves single-format and unpriced to the SAME
  fixture release (9000001 is both), gating two branches together and
  neither apart. Duplicates now refused, isolation asserted for BOTH
  snapshots, sabotage-proven (reverting the predicate fails 3 tests naming
  the duplicate ids). Per-axis coverage asserted; full COMBINATION coverage
  deliberately not claimed (16 crate combinations vs 4 masters). Also fixed
  before four variants copied it: the qty steppers' `−`/`+` were bare text
  nodes, so accessible names read "−Decrease quantity" — now aria-hidden,
  matching the tracklist header two lines above.
  **vanilla PDP shipped:** matches ALL FOUR masters exactly after
  whitespace collapse + delivery strip. One static page per release (240
  fixture / 500 crate) — published as the real cost of static generation on
  a catalogue surface, not avoided. The recorded depth trap was real: every
  asset URL was the literal `"../"`; the base is now derived from page
  depth and all 16 relative refs from a built PDP page are asserted to
  resolve. `pdp.js` does gallery/qty/add-to-cart (immutable next-cart — the
  slice-D bug).
  **NOT LANDED:** react-next, astro, qwik; the drift-gate + origin-suite
  PDP legs; the publication pipeline's generalisation off the `editorial-`
  filename gate; interaction registry entries + batches.
  **EXTERNALLY BLOCKED:** the live-origin demonstration. The edge Worker has
  NO live route today (verified: `/api/plp`, `/api/pdp/:id`,
  `/api/snapshot`, `/api/beacon`, `/assets/img/*`) and arming it needs the
  Discogs token as a Worker secret — that leaves this machine and is
  **Rob's to set**. The button is wired; its output slot states the absence
  rather than being a silent no-op.
  **DECIDED, UNBUILT:** astro stays `output: "static"` + `getStaticPaths`,
  NO `@astrojs/cloudflare` (an SSR adapter would confound the cross-surface
  comparison with a paradigm change); its bake needs a second generated
  module AND a matching turbo `outputs` entry. URL contract 404s on a
  non-canonical slug (never 301 — the build-time variants cannot serve one,
  so it would be an observable paradigm divergence). `{prime?, measure}` is
  NOT needed here, it stays with the PLP. ADR-0003's CSS-delivery
  ambiguity resolved: **the PLP owns it.**
  **verify-slice was STILL RUNNING at session end** (run
  `wf_f6eb8c8a-279`, journal showed 1 line / type=started, no findings
  files) — treat it as UNVERIFIED, not clean. Resume per the standing
  protocol: `Workflow({name:"verify-slice", args:<same>,
  resumeFromRunId:"wf_f6eb8c8a-279"})`, and check journal type=result
  counts + the findings-*.md files before believing any empty array.
  **Next unit: `bench-instrumentation-dilution` (fix the ruler) — it hard-
  blocks the PDP publication, exactly as issue #16 blocked the editorial
  one. Then finish the PDP: three variants, the gate/suite legs, the
  pipeline generalisation, the batches.**
- 2026-08-14 — **THE RECORD IS REPAIRED; THE VANILLA PDP TURNS OUT TO HAVE
  SHIPPED TWO DEAD CONTROLS.** Branch `record-repair` off main (`1f91d89`),
  **three commits, UNPUSHED and UNMERGED** (Rob's call), worktree
  `.claude/worktrees/record-repair`. Final tree: turbo **30/30**,
  `@pm/reference` **37/37**. Origin suite NOT run (needs a live plane).
  **TWO HANDOFF FACTS WERE STALE BY THE TIME THEY WERE READ, and both cost
  real time — re-verify from the world, never from the prompt.** (1) The
  prompt said `pdp-build` was unmerged; all four commits are ancestors of
  `1f91d89` (PR #24, MERGE commit), CI run 31836566192 green, and
  `/vanilla/pdp/{slug}/` serves 200 in production. (2) The prompt said
  verify-slice `wf_f6eb8c8a-279` returned 8 findings from one lens; the
  journal showed 4 started / 3 result on arrival and the run COMPLETED
  during this session — **30 findings across four lenses (8/10/12/11)**.
  The anti-rigging lens, the most valuable one, was the one the handoff
  never saw. `findings-*.md` files never existed: the lens agents reported
  "file writes are blocked here", so the disk-streaming resilience did NOT
  engage — the journal was the only durable record.
  **ADOPTED AND FIXED (`deca3f9`).** Falsified by their own artifacts:
  "LCP +30 to +120 ms" (real: **−36 to +128 over 30 medians, 4 DOWN** —
  vanilla and astro on slow-4g, both columns); "TTFB +30 to +55" (real
  **+29.7 to +72.2**); "the crate has 16 combinations" (**8 possible, crate
  7, fixture 4**); "any two masters differ by exactly one rendering
  decision" (**3 of 6 pairs — a STAR centred on single-format**);
  "byte cells did not move" (omitted astro's −12%); tracklist.css's "5,116
  rows" (**4,516**); "the local figure was inflated by local subresource
  service" (the two probes served different pages, 18,635 vs 18,017 B — the
  causal claim is withdrawn). Overclaims narrowed: `pdpRenderClass`'s "and
  nothing else" (it takes three more branches — absent notes, null
  duration, null year — and **0 of 4 fixture masters exercise any**);
  ADR-0008's "the degenerate branches are gated" → "CAN now be gated" (no
  origin-suite leg opens a variant PDP at all); "one derivation shared by
  every variant build and the gate's re-render" (only the reference build
  consumes it). Made structural: `unpriced`/`one-image` now pin
  `formats.length <= 1` and `pdpMasterIds` THROWS unless each degenerate
  class differs from the centre on exactly one axis — **sabotage-proven
  both ways** (the guard fires on a non-isolating set; both snapshots
  resolve identical ids, so masters are byte-unchanged). Also: `turbo.json`
  `@pm/reference#test` read the crate trays and never declared them an
  input (a cached PASS could replay against data the test never read);
  `drift.browser.test.ts` listed eight masters so the three PDP masters had
  ZERO health coverage; `qty.css` and `tracklist.css` still documented
  pre-fix bare-glyph markup — the contract three more paradigms re-implement
  from. ADR-0001 gains **addendum N** (both obligations discharged, L's
  figures marked superseded in place, the long-task median's one-sided
  0–64 ms band stated).
  **THE DILUTION MAGNITUDE WAS RE-DERIVED AND MY OWN FIRST ANSWER WAS
  WRONG.** Measured against the saved Cloudflare-served body: CF compresses
  at **3.68×** where node-brotli-q11 makes **4.46×**, so every figure in the
  ticket was in the wrong units. Current rule gives astro **347 B**; **the
  fix as written (brotli each region, normalise to transferSize) gives
  660 B — 47.4%**, not the 33.6% the ticket claimed (that came from the
  ticket's OTHER formula). Isolated-region brotli inflates small regions
  (astro's bundle compresses 2.2× alone vs 3.68× in context), so 47% is
  likely high. **Honest range 34–47%; the ESTIMATOR CHOICE is the ruler
  unit's central decision and is recorded as unsettled.** `/methodology/`
  now carries the magnitude and direction and tells readers to treat the
  smallest JS cells as floors — addendum M's precedent (caveat, never pull
  receipted cells), decided rather than left asymmetric.
  **THE VANILLA PDP HAD NEVER BEEN VERIFIED** (the earlier run's context
  named only the two spec-layer commits). Its first pass — a fresh
  verify-slice, run `wf_f0689dcb-ad6`, 13 findings across two lenses —
  found **two of its four advertised interactions DEAD on 500 deployed
  pages**: the **Zoom button can never toggle** (`gallery.css` implements
  the pressed state, `pdp.js` has `grep -c zoom` = 0, and `aria-pressed`
  is not CSS-settable — WCAG 4.1.2), and the **format radio group is
  entirely unwired** (pdp.js's only "format" matches are the unrelated
  live-origin `body.formatted`, so selecting format 2 leaves price, stock,
  meta and the cart payload on format 0 — the store takes an order for a
  format the visitor did not pick). Also `pm-pdp__scroll` carries
  `role="region" tabindex="0"` and matches **0 lines** in
  `packages/tokens/css/` — a keyboard focus stop on a container that cannot
  scroll. FIXED in `7bac2c6`: the typed quantity was never clamped (typing
  250 wrote `qty: 250`; pressing "+" then DROPPED it to 99, falsifying the
  comment directly above it), and CART_CONTRACT did not cover add-N so the
  three remaining variants would have shipped increment-by-one and diverged
  silently. RECORDED not fixed in `3846bfe`: the dead controls, because
  making them real changes master markup and the cart payload shape
  (ADR-0008 addendum work) and half-fixing one of two is worse than either.
  **The benchmark consequence is the point:** ADR-0002 makes zoom/cart/
  quantity/format-switch the propagated interaction set the render-axis flip
  is measured over, so if the other three variants implement all four and
  vanilla implements two, **vanilla's JS and INP cells are artificially low
  on the very surface whose thesis is that interactivity earns JS.**
  **STRUCTURAL GAP, unclosed:** `@pm/vanilla` contributes **ZERO** tasks to
  turbo's 30 (`--dry=json`), so "Turbo 30/30" has never covered this variant;
  `variant-master-identity.test.ts` has three describes, all editorial, and
  no test anywhere reads `renderPdpPage`. All 740 pages DO still match in
  both snapshots — an unguarded true statement, which by this repo's standard
  is the defect. **Next unit: the PDP's controls + its guard** (decision:
  make the two controls real in the spec, or take the cut explicitly and
  REMOVE them so no variant copies a dead toggle) — it hard-blocks the three
  variants, which are about to copy whatever the master says. Then
  `bench-instrumentation-dilution` (the ruler), then the variants, the gate
  legs, the pipeline generalisation and the batches.
- 2026-08-15 — **THE PDP'S CONTROLS ARE REAL, AND THE CLASS IS GUARDED.**
  Branch `pdp-controls` off `5f26a6e`, **ONE commit `b7f0cfb`, UNPUSHED and
  UNMERGED** (Rob's call). Worktree `.claude/worktrees/pdp-controls`.
  **BOTH stale facts in the last prompt were stale again, as it warned:**
  `record-repair` HAD been merged (PR #25, `origin/main` = `5f26a6e`, CI run
  31841376970 green) — so this ran on a fresh branch, not on `record-repair`.
  Verified: `git merge-base --is-ancestor` for all three of its commits.
  **THE DECISION WENT AGAINST THE HANDOFF ON FORMAT, and the argument is the
  unit.** Zoom: WIRED (five lines; `aria-pressed` is not CSS-settable, so it
  announced a state it could never enter — WCAG 4.1.2). Format group: **CUT**,
  where the handoff said "never take the cut for format". The premise it was
  written on is false: a Discogs `formats` array is the composition of ONE
  physical release, not a menu. `schema.ts:45` types `format` as the PRIMARY
  label, `normalize.ts:127` builds it from `formats[0]`, `priceFrom` and
  `numForSale` are **one per release**, crate `896191` is one $30.00 product
  whose three entries are two vinyl variants AND a CD, and **39** crate
  releases carry a component named **"All Media"**. There was no wrong format
  to take an order for — wiring it needed **invented per-format prices**, a
  fabricated number beside a real one. The interactivity claim survives:
  gallery/zoom/quantity/add-to-cart remain and BOTH PLANNED
  interactions are untouched — `INTERACTIONS` holds only none/body-click/
  editorial-add-to-cart, so neither PDP id exists in code yet. The
  DATA survives and grows — the meta list now renders the full composition for
  EVERY release; **309 of 500 crate meta lines byte-unchanged, 191 move**
  (239/1 fixture), computed over every tray. ADR-0002's guardrail is AMENDED,
  not dropped. `pm-pdp__scroll`: STYLED (it matched 0 CSS lines).
  **THE NEW GUARD FOUND SOMETHING BIGGER THAN ITS BRIEF, on CRATE data only:**
  the gallery thumb strip never wrapped, so the gallery column grew to its
  content and pushed the DOCUMENT sideways at 320 px — `scrollWidth` 332 (4
  images) and 412 (5) against a 320 viewport, on **316 of the crate's 500
  releases**. WCAG 1.4.10, live on the majority of deployed PDP pages, and
  invisible to CI because the FIXTURE's probe release has TWO images. One line
  of `flex-wrap: wrap`; the reflow leg now probes the WIDEST gallery in the
  served snapshot and fails closed under four. **The fixture is not a scale
  model of the crate.**
  **FOUR GUARDS, every one sabotage-proven against the tree that shipped:**
  `pdp-controls-wired` (fails **nine** ways against main's `pdp.js`; in the 30,
  so it BLOCKS a merge) · PDP master identity over **all 740 trays, both
  snapshots, ~90 ms** (sabotaged: 1/240 fixture, 152/500 crate) ·
  `master-glyph-names` (finds **seven** bare glyphs in main's masters) · the
  JS-ON browser leg, headlined by "no button may change nothing when pressed".
  **MY OWN HEADLINE GUARD WAS VACUOUS ON ITS FIRST DRAFT** — scoped to
  `document.body` it PASSED against the dead-zoom build, because the injected
  chrome's HUD writes a live LCP value after any interaction (measured:
  `data-pm-hud-live="LCP"` "–" → "60ms"). Scoping to `.pm-page` plus an
  explicit QUIESCENCE assertion fixed it; it then produced a second false
  positive (a decrement button at its minimum, correctly refusing), so it now
  PRIMES each control by rules stated in terms of markup, never control names.
  **Also landed:** CART_CONTRACT gained the UNIQUENESS clause it had always
  stated and never checked (one add gave 3 on editorial, 4 on the PDP) — all
  seven `read()`s; `namedGlyph` + the bare-glyph repairs in `pdp.mjs`,
  `shell.mjs` `releaseCard`, `checkout.mjs` and the five variants' re-typings
  (byte-neutral on every page served today, so no editorial receipt moves).
  **I CAUGHT ONE OF MY OWN RECORD-NOT-CODE ERRORS** mid-session: a draft said
  "439 meta lines unchanged", which is the single-format COUNT — re-deriving
  gave 309/191. Re-derive, never re-read.
  **verify-slice: 4 lenses, 23 findings (8/7/3/5), ALL ADOPTED** (run
  `wf_7911d7e7-416`). It paid for itself three times over: it caught a BLOCKER
  this unit CREATED — `.pm-sr-only` was defined in `components/gallery.css`,
  which only the PDP links, so `namedGlyph`'s hidden text would have rendered
  VISIBLY on the PLP (5×) and checkout; it caught the SERVED chrome still
  advertising the cut control (`SURFACE_CONTROLS.pdp.proves`); and it caught a
  string of numbers I had written and not re-derived, including "439
  unchanged" **twice more after I thought I had fixed it**, a byte cost stated
  for six files from a three-file sample, "seven masters" for a six-master
  sabotage, and an ADR-0002 cite that was §4 not §5. Also closed: the guards
  were vanilla-hardcoded; `SCRIPT_ONLY_STATE` omitted `aria-current`, the
  second script-only state on the page it guards; and **nothing compared a
  variant's STYLESHEET LIST to the master's** — the exact axis this unit
  changed — now a sabotage-proven test. **`findings-<lens>.md` files WERE
  written this run (3 of them) — the first time the disk-streaming resilience
  has actually engaged**, and they carry "VERIFIED TRUE" / "ALREADY FIXED"
  sections the journal never sees. Read the FILES, not only the journal.
  **Do not run the origin suite while a lens works:** `bench.browser`'s 300 s
  hook blew under that contention and 17 tests skipped, which reads exactly
  like a regression.
  Final tree: turbo **30/30**, `@pm/reference` **37/37**, origin suite
  **348/348 fixture** and **347/348 crate** (the one miss is the known
  git-excluded `9861004-primary.thumb.avif`, which serves 200 in prod).
  A fresh worktree has NO `crate/img` — symlink the main checkout's copy for
  crate-mode runs, and remove it before committing (untracked, NOT ignored).
  Decisions of record: **ADR-0008 addendum A**; ADR-0002's guardrail amended
  in all four places an implementer reads it (ADR, decision map, CONTEXT.md,
  and the chrome's served `proves` copy).
  **Next unit UNCHANGED: `bench-instrumentation-dilution` (fix the ruler)** —
  the estimator choice (34–47%, two methods disagreeing by a third) is its
  central decision, it still hard-blocks any PDP byte publication, and it owns
  the two ADR-0001 addendum-N anti-rigging holes. Then react-next/astro/qwik,
  the gate + suite PDP legs, the pipeline generalisation, the batches.
- 2026-08-15 — **THE RULER IS FIXED, AND BOTH ADDENDUM-N HOLES ARE CLOSED BY
  MECHANISM.** Branch `ruler-unit` off `pdp-controls` (`b7f0cfb`, which is
  still UNMERGED and unpushed beneath it — this branch carries pdp-controls
  with it, so merging ruler-unit merges both; that is Rob's call). TWO
  commits: `49e00e5` (the unit) + `d7a04d2` (the re-measured constant, the
  lens adoptions, the committed evidence). Worktree
  `.claude/worktrees/ruler-unit`.
  **THE CENTRAL DECISION (recorded UNSETTLED, 34–47%) WENT TO NEITHER
  RECORDED METHOD.** Settled by measurement on the three live delivery
  shapes under two probes built from the plane's own pages: (A) swap the
  chrome on a fixed page — the recorded defect's own shape — and (B) inline
  a copy of vanilla's real cart.js against the same file's actual external
  wire cost (1,351 B, which standalone brotli-q4 reproduces EXACTLY).
  Chosen: **leave-one-out brotli marginals at a per-document wire-calibrated
  quality, normalised to transferSize by the existing largest remainder.**
  Old rule: 14.1% drift on a chrome-only change, 40.5% low against external
  truth. Chosen rule: 0.3% and −2.2%. The handoff's "fix as written"
  (isolated regions) LOST on both probes (astro's bundle compresses 2.23×
  alone vs 3.68× in context); Shapley measured no better at 3× the
  compressions. **Cloudflare's wire is brotli q4 within 0.1–0.3% on all
  three shapes** — the quality mismatch collapsed from a stated risk to a
  per-run recorded residual (`kb.docAttribution`, with content-encoding
  recorded verbatim). Old rule's under-report, settled: **40.5–47.5%**
  (astro 347→661 B, qwik 257→448 B). Identity-encoded wires degrade to
  EXACT uncompressed share. The shipped decomposeDocument reproduces the
  lab numbers exactly on all three real bodies, and the ENTIRE decision
  evidence is COMMITTED (`tools/bench-runner/estimator-lab/`, bodies
  sha256-manifested) so addendum O re-derives offline forever.
  **HOLE 1:** the probe records the fragment's sha256 + full renderContext;
  the front build re-renders the fragment it ships (real renderer,
  esbuild-bundled, against the very lab bundle the Worker imports) and
  REFUSES on mismatch — sabotage-proven both ways. Extraction is
  single-sourced in @pm/switcher (`chromeFragmentOf`). **HOLE 2:** the
  plane attests its build at `/_pm/build.json` (build stamps it; run-local
  and `dev` re-stamp against turbo cache replays; `deploy` REBUILDS —
  a bare re-stamp would write HEAD onto a stale dist, worse than none).
  Batches and probes record `originCommit` beside the local pin, refuse
  cross-tree/unattested origins (`--allow-cross-tree` is the visible
  escape), AND re-fetch after the last run — any mid-run transition
  refuses, including null→attested, which is what this unit's own merge
  looks like to a batch in flight. Publication: provenance grandfathering
  is bounded by DATE (2026-08-16+ receipts must carry originCommit +
  docAttribution), degraded/fallback estimators cannot publish, a
  brotli-calibrated split fitted to a non-brotli wire cannot publish, and
  the constant is held to the same bar (one bootstrap artifact exempt by
  explicit commit pin, removed when the re-run replaces it).
  **THE CONSTANT, RE-MEASURED** (deployed plane, 7×2 runs,
  slow-4g-mid-phone, pinned clean at 49e00e5, originCommit null with the
  escape — the visible bootstrap; fragment byte-identical to this tree's
  render): **+76 ms FCP / +76 ms LCP / 0 CLS; long tasks 0 ms median,
  0–57 ms one-sided (all non-zero samples with-chrome)** — N's exact
  hidden-signal class, now composed onto the methodology page from the
  artifact's runs WITH per-condition paint bands (closing N's
  never-implemented band obligation). Wire: **2,322 B at calibrated q4**;
  the old q11-default pricing understated the same fragment on the same
  body by **17.1%** — the uncalibrated default flattered the instrument.
  **TRAPS:** paid the listed `git restore` trap ONCE (restored the
  committed constant over the fresh uncommitted probe artifact during the
  sabotage proof — one 4-min re-probe; scratchpad-copy FIRST next time).
  The first crate-mode suite run was killed externally mid-run; re-ran
  clean. verify-slice findings files were NOT written this run (journal
  only) — read the journal, don't wait for files.
  **verify-slice: 4 lenses, 20 findings, 19 distinct, ALL adopted** (run
  `wf_5b0b24f6-ef4`) — headliners: mid-run attestation drift unguarded in
  both runners; the probe's fragment guard skipped every without-condition
  visit and threw inside a Playwright route handler (no reliable
  propagation); grandfather-by-absence forgeable forever; docAttribution
  recorded but never gated (degraded-all-html would have republished the
  issue-#16 defect through honest labels nobody read); the decision
  evidence lived only in the session scratchpad.
  Final tree: **turbo 30/30**, origin suite **355/355 fixture** and
  **354/355 crate** (the one miss is the known git-excluded
  `9861004-primary.thumb.avif`, 200 in prod).
  Decisions of record: **ADR-0001 addendum O/P/Q, addendum G superseded in
  place**; decision-map ticket answered; build-log Phase 13.
  **Every committed receipt is invalidated; cells stay live behind
  /methodology/'s floors caveat (caveat, never pull). The third batch
  re-run is POST-MERGE** (runbook: addendum O — quiet machine, checkout at
  the merge SHA, one nonce, pre-warm to compressed, ~7 min, then the
  two-pass constant cycle the P gate now FORCES: local-interim constant →
  merge/deploy → deployed-plane constant; the floors sentence and its
  published-readings pin leave in the re-run commit together).
  **Next unit UNCHANGED: react-next / astro / qwik PDPs** (decision-map
  `pdp-build`; per-variant traps in the ruler prompt's AFTER-THIS-UNIT
  section), with the batch re-run owed the moment the merge deploys.
- 2026-08-16 — **RULER UNIT MERGED + DEPLOYED (PR #26 → main `76bd5d14`,
  deploy green FIRST TRY incl. post-deploy smoke — no flake). The plane
  attests its build, the zoom is live in production, the new constant
  serves with bands, and the fragment sha on the live plane matches the
  constant's pin.** Then the owed batch re-run began, and ITS OWN GATES
  refused the first two attempts — both refusals CORRECT:
  **Attempt 1: the wire changed codecs.** Chromium negotiates **zstd** and
  Cloudflare serves it — every br-only measurement (curl, undici) had seen
  brotli, but the bench browser's documents ride a zstd wire. The ruler
  recorded `loo-brotli-normalised` fitted to a `zstd` wire and the
  publication gate refused it: finding [4.7]'s gate caught the actual CDN
  on day one. **Attempt 2: dirty pin** — the codec fix was uncommitted when
  the batch ran (the 'commit first, then measure' trap, paid AGAIN).
  **The codec generalization is COMMITTED and fully verified on branch
  `editorial-rerun` (`ff272fc`, worktree `.claude/worktrees/editorial-rerun`)
  — UNPUSHED, waiting on Rob's merge call:** the estimator becomes
  `loo-wire-normalised` — leave-one-out marginals priced by THE WIRE'S OWN
  CODEC (brotli q0–11 / zstd L1–19 via node:zlib zstdCompressSync / zlib
  gzip+deflate), RFC-9110 case-insensitive token matching + x-gzip alias,
  codec recorded beside quality, target, target-SOURCE and residual.
  **zstd level 2 reproduces Cloudflare's zstd wire within +4 B (0.08%)**
  (evidence committed + CI-pinned: sha256, level-2 fit, byte-identity with
  the brotli body). Publication gate: codec must match the wire, the fit
  must be a compressed-BODY fit within 2% (64 B floor, absence refused),
  identity-on-compressed-wire refused, transfer-size-fallback fits labeled
  and unpublishable. verify-slice `wf_7567df7a-7a8`: 13 findings, 11
  distinct, ALL adopted. Final tree: turbo 30/30, decompose 19/19, origin
  suite **360/360 fixture** / **359/360 crate** (known thumbnail).
  **The methodology floors caveat is DELIBERATELY untouched in this commit**
  (it leaves with the receipts commit, so this commit can deploy alone).
  **THE GATE-FORCED CHOREOGRAPHY FOR THE REST OF THE RE-RUN** (the
  provenance gate refuses a local checkout measuring a plane on a different
  SHA — by design, so a ruler change can never mint publishable receipts
  from a branch): (1) merge `editorial-rerun` → deploy at merge SHA M;
  (2) clean checkout at M, pre-warm the ten effective URLs with
  browser-shaped Accept-Encoding (zstd!), run the three profiles (~10 min,
  nonce `editorial-batch3-…`, receipts to SCRATCH first — the tree must
  stay clean across all three); (3) receipts commit: replace the three
  editorial receipts + DELETE the stale bootstrap chrome-constant (the
  fragment changes with new readings; absent-constant is the designed
  state) + floors caveat leaves + pin moves + decision-map/build-log
  records; (4) run-local PM_HOLD on that clean commit → local-interim
  constant probe → constant commit; (5) PR, merge, deploy; (6) deployed-
  plane constant re-measure (the L→N cycle, now mechanical). Attempt-1/2
  receipts kept in the session scratchpad as refusal evidence.
- 2026-08-17 — **THE RE-RUN IS PUBLISHED. THE DILUTION IS UNDONE IN PUBLIC,
  AND THE WHOLE CHAIN IS ATTESTED.** Four PRs landed this arc's finish:
  **#27** (`1c543ac6`, the codec generalization — deploy's post-deploy smoke
  flaked once on the recorded 30 s goto class, plane probed healthy,
  `gh run rerun --failed`, green), **#28** (`932bf4ff`, the third batch's
  receipts + the local-interim constant), **#29** (`28d01fc2`, the
  deployed-plane constant). **THE PUBLISHED CELLS (avg-broadband, warm):
  astro 0.37 → 0.76 KB, vanilla 1.69 → 1.81 KB, htmx 19.54, qwik 29.69,
  react-next 154.98** — fit sentence re-derived, all five bands separable,
  floors caveat gone from /methodology/ (its pin moved with it).
  **The batch that published: minted at the attested merge SHA, one date,
  one nonce, 210 runs, all conforming** (loo-wire-normalised, zstd on the
  zstd wire, encoded-body fits in bound, settled). One profile of the
  first clean attempt died to the same transient 30 s goto class and
  re-ran on the same nonce. **The final constant is the arc's cleanest
  artifact: +88 ms FCP/LCP, 0 CLS, 0 long tasks in ALL 14 runs (ABBA
  ordering), wire 2,321 B at calibrated q4, residual −1 B, commit pin ==
  origin attestation on the deployed plane, fragment hash-verified —
  no cross-tree escape anywhere in the published chain.**
  `bench-instrumentation-dilution` is CLOSED in the decision map;
  build-log Phase 13 carries the re-run coda.
  **Next unit: react-next / astro / qwik PDPs** (decision-map `pdp-build`;
  per-variant traps in the ruler prompt's AFTER-THIS-UNIT section: shells
  hardcode editorial CSS in react-next/qwik — astro's `css` prop is the
  precedent; astro stays static, no @astrojs/cloudflare; slug mismatch →
  404; each build moves its name plannedVariants → variants and the
  pdp-controls guards then FAIL until pointed at that variant's
  enhancement — deliberate). Byte publication is UNBLOCKED: any future
  receipt carries the fixed ruler + attestation by construction.
- 2026-08-22 — **pdp-variants SLICE 1 (react-next PDP) COMMITTED** as
  `9b33c7a` on branch `pdp-variants` (worktree
  `.claude/worktrees/pdp-variants`, off `28d01fc`; UNPUSHED — merge is
  Rob's call, slices 2–3 stack on the same branch). `/react-next/pdp/
  {slug}/` serves through the composed origin: route groups → multiple
  root layouts over one Document(css); leading-id parse + slug-mismatch
  404 (NO loading.tsx/Suspense — streaming would lock the status before
  notFound()); gallery/zoom/qty/cart/live-origin islands; qty clamps on
  the NATIVE change event (blur-only draft reproduced diverging from
  vanilla on Enter-commit — now pinned per variant in the browser leg).
  **Headline: adding the route leaked 7,984 raw bytes of PDP island code
  into EDITORIAL's pinned served chunks** (Turbopack groups client
  components by importing server module); fixed to measured byte-parity
  by three splits (pdp.tsx / self-contained pdp-cart.ts — importing
  cart.ts helpers un-tree-shook exports (+494) / pdp-format.ts + inlined
  error-boundary skeleton (+76)); 7/8 chunks name-identical to prod, 8th
  size-identical, one renumbered module id (irreducible route-add floor);
  the leak CLASS is now a pdp.test.ts leg. Slice 1 also landed the owed
  PDP legs for BOTH live variants: origin-suite pdp.test.ts (fail-closed
  arms, URL-contract 404s, slash 307/308 + encoded-spelling 307/200 pins
  as measured, transport parity, served stylesheet list, editorial
  chunk-leak guard) and drift PDP legs (4 masters re-rendered via
  pdpMasterIds, plaque COMPARED never dropped, pixels rich×3 +
  degenerate×1 recorded scope), all with registry-completeness ties to
  SURFACE_CONTROLS.pdp.variants. react-next 404s serve Next's
  __next_error__ shell (multiple root layouts defer the branded boundary
  to hydration) — accepted+recorded, status is the contract. verify-slice
  wf_86c59859-909 ran TWICE (first pass died on the session limit after
  ONE lens; dead lenses' empty arrays treated as dead runs, resumed after
  reset): 6 distinct adopted, 1 refuted with evidence. Final tree: turbo
  30/30, fixture origin suite **405/405** (16 files; baseline 360 + 45
  added this slice, tool-derived), repo-checks 95+1skip. Crate-mode
  full-suite re-run owed at UNIT end (identity guards already run crate
  in-process). NEXT: slice 2 astro (drafts in session scratchpad:
  second baked module src/data/pdp.json + turbo outputs entry,
  getStaticPaths over ALL details, PdpDocument/PdpArticle.astro,
  self-contained scripts/pdp.ts — do NOT import cart.ts, editorial's
  inlined bundle is pinned; diff built editorial HTML pre/post), then
  slice 3 qwik (root.tsx stylesheet param via useServerData("url") —
  qwik-city's own pattern, editorial head bytes preserved; measure
  editorial chunk graph pre/post — rollup may re-group; branded 404 via
  fail(404)).
- 2026-08-22 — **pdp-variants SLICE 2 (astro PDP) COMMITTED** as `6daa15d`
  (stacked on 9b33c7a, branch UNPUSHED). Second baked module
  src/data/pdp.json (turbo-outputs + gitignore BOTH — verify-slice caught
  the ignore half missing, with the untracked output polluting the build's
  own turbo input hash), getStaticPaths over ALL details (240 fixture pages
  / 331 ms), self-contained scripts/pdp.ts (editorial's inlined 0.76 KB
  bundle frozen: dist HTML cmp-identical pre/post; the freeze suite leg
  pins delivery SHAPE — one inline module, zero non-/_pm/ externals).
  Container identity guard over 740 trays ~2.2 s sabotage-proven +
  page-level pass-through + slug-uniqueness guard. verify-slice
  wf_30f57d1a-197 two passes (limit killed two lenses mid-run AGAIN;
  resumed after reset — the durable design's second real save): 7 distinct
  adopted, conformance walk PASSED, seams clean. Incidents: held plane
  WEDGED after ~6 h (kill+restart is the cure) and the provenance gate
  refused a bench leg when slice 1's commit outran the plane's stamped
  attestation (re-stamp workers/front stamp-build.mjs; addendum Q working).
  Final tree: turbo 30/30, fixture suite **431/431**. NEXT: slice 3 qwik
  (drafts in scratchpad/draft-qwik: root.tsx stylesheet param via
  useServerData("url") — qwik-city's own pattern at index.qwik.mjs:698,
  editorial head bytes preserved because the editorial STYLESHEETS map
  call-site is untouched; MEASURE editorial's 7-chunk/26.83 kB graph
  pre/post route add — rollup may re-group, the slice's headline risk;
  fail(404) branded 404s; qwik onChange$ IS the native commit event so the
  clamp is free; pdp-cart self-contained, updates CartContext store not
  window events). Then unit end: crate-mode full suite + records.
- 2026-08-27 — **pdp-variants SLICE 3 (qwik PDP) COMMITTED as `d777736` —
  THE UNIT'S VARIANT WORK IS DONE** (branch: 9b33c7a → 6daa15d → d777736
  off 28d01fc, UNPUSHED — merge is Rob's call). /qwik/pdp/{slug}/:
  routeLoader$ id-parse + branded fail(404) + fail(503); root.tsx
  stylesheet pick via useServerData("url") with the offset derived from
  BASE_URL; pdp-cart/pdp-format self-contained; editorial chunk graph
  frozen by measurement (6 chunks / 62,635 B identical pre/post; probe
  artifacts purged by the tmp cleaner — provenance in the record, PRE
  reproducible at 6daa15d). "Served by 4 of 4", plannedVariants GONE,
  serving floor registry-driven over the measured PDP_SERVING table.
  verify-slice wf_e15bd1af-15a (limit-killed after two lenses — third
  kill this unit) + completion run wf_55ab9563-9c0: 11 adopted, 0
  refuted; the completion run's headline was the chunk-freeze leg's
  missing STATE-SCRIPT channel (qwik/json QRLs) — now three channels +
  an import closure + an exact pin at 6, sabotage-proven (which caught
  a word-boundary bug in the fix itself: state-script QRLs ride behind
  a U+0002 escape, so \b before q- never matches there). Astro bake
  guard upgraded to DEEP equality. Final tree: turbo 30/30, fixture
  suite 468 passed/24 env-gated skips. CRATE baseline WIDENED: 447/492,
  all 21 failures = the frozen capture has ZERO .thumb.avif derivatives
  (0/1,817 vs fixture 29/58 — predates pdp-build's thumb class);
  one-image master legs pass, confirming the mechanism. NEXT units, in
  order: crate derivative regeneration (capture tooling, with a
  receipt), publication-pipeline generalisation off the editorial-
  filename gate (PDP bytes publish only after it), then interaction
  registry + PDP batches. Plane note: crate-mode plane last held at
  d777736, attestation re-stamped.
- 2026-08-27 (later) — **pdp-variants MERGED to main: PR #30 →
  `607b66c`, a MERGE COMMIT (not squashed — 6daa15d stays reachable as
  the qwik freeze-proof PRE point).** Main checkout pulled. The merge
  triggered a deploy; post-deploy smoke is owed to the next session.
  Next units queued in
  docs/prototypes/crate-derivatives-and-publication-pipeline-prompt.md
  (crate thumb regeneration with a receipt, then the publication
  pipeline off the editorial- gate). Local plane/caffeinate torn down.
- 2026-08-28 — **PR #30 MERGED RED — THE DEPLOY NEVER RAN.** The
  2026-08-27 entry above says "the merge triggered a deploy"; verifying
  it found both CI runs (PR + main, 33132628047) FAILED the check job —
  the react-next PDP identity sweeps (740 trays, React SSR + linkedom)
  measured 9,648/8,903 ms on ubuntu-latest against vitest's 5 s default
  (~1 s locally), deploy SKIPPED, production still serves 28d01fc:
  /qwik/pdp/ 404s live, /vanilla/editorial/ 200s. The owed post-deploy
  smoke cannot run until a green deploy. Fix committed as `b44ee84` on
  branch `ci-sweep-timeouts` (worktree of the same name): the qwik
  sweeps' existing 60_000 budget applied to the react-next legs
  (measured failure) and astro legs (2.6 s local, never reached in CI —
  turbo aborted first; crosses the default at the measured ~8× runner
  slowdown); vanilla's byte-strict sweep stays default (90 ms, 50×
  margin). No assertion changes; turbo 30/30. UNPUSHED — Rob's merge
  call, and it BLOCKS the PDP variants reaching production.
- 2026-08-28 — **CRATE THUMBS REGENERATED — crate suite at FIXTURE
  PARITY 468/0/24** (was 447 with 21 failures; the 2026-07-11
  one-failure baseline retires with it — same absence, one leg).
  Diagnosis CORRECTED from the entry above: the capture does NOT
  predate the thumb tier — images-index.json has carried all 1,817
  thumb pins since a886de1 (2026-07-17, spec layer) and deployed R2
  serves them (sample probed, bytes == pin); only this machine's
  untracked img/ lacked the files (loss mechanism unrecorded; likely a
  cleaned worktree held the real dir — conjecture, labeled). Re-minted
  via `pnpm capture run --until derive` (normalize deliberately NOT
  run — it rewrites committed artifacts and unlinks orphans): 1,817 new
  files in 62 s, add-only proven (before/after sha256 manifests: 0
  mutated, 1,817 added, all thumbs), every disk file == committed index
  pin (0 mismatches over 3,634), receipt at
  tools/snapshot-capture/crate/regenerations.json. Fixture suite
  untouched 468/24/0; turbo 30/30. verify-slice `wf_f365845a-a57`: 4
  lenses ALL COMPLETED (first no-death run), 5 distinct findings, all
  adopted — all receipt/record class (manifest-hash recipe + missing
  after-hash, this handoff entry itself, the "prevents" overclaim, the
  unmeasured zero-API-requests claim, servedSample underspecified) +
  the .gitignore dir-only pattern that left the worktree img symlink
  stageable (fixed, check-ignore-proven both ways). Branch
  `crate-derivatives` (stacked on b44ee84), commit follows this entry.
  NEXT: unit 2, publication-pipeline generalisation off `editorial-`
  (recon complete: gate at workers/front/build.mjs:418; per-surface
  registry via a labBundle flag on SURFACE_CONTROLS; editorial
  artifacts must stay byte-identical; PDP batches stay with the
  interaction-registry unit per the decision map).
- 2026-08-28 — **PUBLICATION PIPELINE GENERALISED OFF `editorial-` —
  PDP BYTE PUBLICATION IS UNBLOCKED.** Branch `publication-pipeline`
  (stacked on crate-derivatives), commit follows this entry, UNPUSHED.
  `labBundle` on SURFACE_CONTROLS is the whole registration: the build
  derives its surface roster from the flagged entries, emits
  /_pm/lab/{surface}.json per surface, and GENERATES the Worker's
  LAB_BUNDLES module from that same roster (workers/front/generated/,
  outside dist so it is not downloadable, gitignored + turbo-outputs).
  The old one-line `editorial-` filename gate is replaced by three
  agreeing identity checks (filename surface half vs registry, filename
  profile half vs receipt.profile.id, every target's own surface field)
  plus refusals for: no FIT template, a singleton surface, and a batch
  whose variants are not exactly the surface's registered variants.
  Batch integrity moved out of the `published` branch and runs per
  surface, never across (two surfaces may legitimately publish batches
  from different days/SHAs). **PINNED CELLS PROVEN: 17 of 18 front dist
  artifacts byte-identical** (editorial.json, all 3 receipts, home,
  methodology, chrome constant); the 18th is the new EMPTY pdp.json.
  **No PDP receipt minted, no PDP cell published — batches stay with
  the interaction-registry unit per the decision map.**
  verify-slice `wf_5e2e486a-eec`: 4 lenses ALL COMPLETED (second clean
  no-death run), 16 findings → 7 distinct, ALL adopted, 0 refuted. The
  unanimous one (4/4 lenses) was a defect in this slice: the registry
  tie stopped at SERVING and never reached the EMBED — deleting both
  Worker import lines left all 478 legs green — fixed by generating the
  module. The second was my own new guard reproducing the
  DESCRIBED_VARIANTS anti-pattern (it skipped published surfaces, so a
  typo'd SURFACE_PAGE row passed, and it would have hit ZERO assertions
  the day PDP publishes); replaced with a both-directions per-surface
  render leg. 14 sabotages across the unit, each watched failing.
  Final tree: turbo 30/30, fixture AND crate suites both **479/0/24**.
  **BOUND OBLIGATION ON THE NEXT UNIT: /methodology/ states editorial's
  batch as the whole site's, and this slice makes a divergent second
  batch legal — publishing the PDP batch REQUIRES making that batch
  statement per-surface first**, or a reader on a PDP page follows the
  link and reads a description of a different batch, falsified by the
  receipt links on the cells they just read.
  NEXT UNIT: interaction registry entries (`pdp-gallery-switch`,
  `pdp-add-to-cart`) + the PDP batches, carrying that obligation.
  **STILL BLOCKING PRODUCTION: `92d7820` (branch ci-sweep-timeouts).**
  PR #30 merged RED and the deploy was SKIPPED, so the plane serves
  pre-merge 28d01fc with no PDP routes. That commit also fixes a
  SECOND, pre-existing cliff nobody had hit: qwik's crate identity
  sweep projects 58.3 s against its own 60 s budget at the measured 9.0×
  runner factor (derived from a CI-GREEN test — a timed-out test's
  reported time is a lower bound and cannot give a ratio) and had never
  run in CI at all, so fixing repo-checks alone would have moved the red
  one package down. All four heavy sweeps now 300_000.
  Stack: `92d7820` → `c180a63` (crate thumbs) → publication-pipeline.
- 2026-08-28 (later) — **ALL THREE UNITS MERGED AND DEPLOYED. PRODUCTION
  SERVES THE PDP, AND THE PDP LAB BUNDLE IS LIVE (EMPTY).** Four PRs:
  **#31 `c5707f6`** (sweep budgets → 300_000 — THE ONE THAT UNBLOCKED
  THE DEPLOY), **#32 `8137785`** (crate thumb tier, receipted),
  **#33 `e467fa5`** (publication pipeline per-surface), **#34** (record
  repair, open at time of writing). Verified from the world:
  /_pm/build.json attests the merge SHA clean; all four
  /{variant}/pdp/896191-…/ answer 200; /_pm/lab/pdp.json serves
  {"surface":"pdp","profiles":{}} — the designed empty state before a
  surface's first batch.
  **PR #31's OWN CI RUN FALSIFIED THIS SESSION'S OWN CLAIM, and the
  record was corrected BEFORE merging rather than after.** Draft two of
  the timeout fix projected qwik's crate sweep at 58.3 s against its
  60 s budget from a single 9.0× scalar. The run measured it at
  **13.51 s — 4.4× margin, never near a cliff** — so "fixing
  repo-checks alone would have moved the red one package down" is
  RETRACTED, and astro's legs (2.78/3.96 s) are UNDER the 5 s default
  the draft said would fail them. Measured CI, all eight legs: vanilla
  0.52/0.68, react-next **13.61/15.44** (these are what actually failed
  PR #30), astro 2.78/3.96, qwik **26.07**/13.51 s. The durable finding
  is that real local→CI ratios span **2.1×–15.5× on one runner in one
  run** and the ordering INVERTS, so no budget may be extrapolated from
  a local timing. 300_000 stands as a hang-catcher: 11.5× margin on the
  measured worst leg.
  PR #34 repairs the record-not-code half nobody caught first time: the
  three sweep COMMENTS still carried the retracted projection after the
  build-log and decision-map were corrected, and ADR-0008 + the
  decision map both cited `collect.ts:26` for the INTERACTIONS registry
  when it is `:33` — the exact line the next unit reads.
  One deploy flake seen and cured: post-deploy smoke ECONNRESET on a
  single editorial asset leg (465 passed / 1 failed), the recorded
  transient class; `gh run rerun --failed` was green. The deploy STEPS
  had already succeeded, so the plane was correct throughout.
  **NEXT UNIT: interaction registry + PDP batches. Its prompt is
  `docs/prototypes/interaction-registry-and-pdp-batches-prompt.md`,
  written from a five-agent source recon.** It leads with two
  structural problems that would each have cost a spent batch:
  (1) `pdp-gallery-switch` FETCHES ~25–34 KB (the full-size AVIF the
  thumb's `.thumb.avif` derivative replaced), and the build's
  `interactionBytes !== 0` refusal is HARDCODED, not driven by the fit
  sentence — so that publication is impossible today and fails at BUILD
  time after the batches are spent; (2) the CLI takes ONE --interaction
  per batch while the pipeline allows ONE receipt per (surface,
  profile), so the decision map's "two batch families" cannot both
  publish under one profile. Both are the unit's decisions and must be
  settled before a batch runs. It also carries the verified DOM hooks
  (`.pm-pdp__buy button.pm-button`, `.pm-gallery__thumb` — use
  `.nth(1)`, `.nth(0)` is already selected and records a meaningless
  cell), the bench target (rich master 896191; the one-image master has
  no thumbs and the unpriced one has a disabled button), three
  comparability limits the PDP has and editorial did not (render
  placement differs across the four variants, so TTFB is not
  like-for-like), and the BOUND OBLIGATION: /methodology/ states
  editorial's batch as the whole site's, and publishing any PDP cell
  requires making that per-surface first.

- **2026-08-28 — `interaction-registry` (branch, NOT merged; nine code
  commits + records off main `832e9cd`).** The unit set out to publish the
  PDP's first numbers and found **two defects in the ruler instead**, both
  live on every run the project has ever published, neither able to fail
  any existing test. (1) The interaction byte boundary was
  `waitForLoadState("networkidle")` — a document-lifecycle LATCH; it
  returned in 0–1 ms (re-timed) and recorded a 25,194 B fetch as
  `interactionBytes: 0` with `interactionSettled: true`. (2) The vitals
  beacon capture used `page.route`, and **Playwright documents that
  "Enabling routing disables http cache"** — so the runner had the browser
  cache OFF for every measured visit, which is what manufactured qwik's
  "52,032 B paradigm cost". With the cache on, all four variants measure
  **25,194 B**, so Gate 1 dissolved and `PdpGallery.tsx` needed no change
  at all. Gate 2 resolved the other way: qwik's PDP INP reads 8 / 0 / 8 /
  24 ms across profiles and interactions while the other three hold at 24,
  so **the PDP publishes no INP row** — declared in the fit template,
  dropped at bundle time, with the reason on the row, in the sentence and
  on `/methodology/`. Also landed: the no-fetch refusal is now DECLARED
  per surface (`interactionFetch`), the INP row names its interaction,
  `%%LAB_BATCH_STATEMENT%%` and `%%LAB_RUNS%%` are per-surface (PR #33's
  bound obligation, discharged), and `chrome-constant.ts` turned out to
  carry the SAME latch. **verify-slice `wf_0785a61e-e76`: 4 lenses, 26
  findings, all 26 confirmed against source; six were defects in this
  unit's own new work.** Thirteen sabotages. turbo 30/30; fixture AND
  crate suites both 17 files / 510 passed / 0 failed. **Nothing is
  measured or published yet** — the batches need the merge first (the
  provenance gate refuses a local checkout measuring a plane on a
  different SHA), and the post-merge pass owes: the chrome constant
  re-measured against the deployed plane (deliberately absent on the
  branch), the PDP batch, the editorial re-run, and the
  `harness.quiescence` gate that lands with those receipts.
