<!--
  The editorial build's six slice issues, verified alongside the PRD
  (editorial-build.md). Publication to GitHub is one command per issue:
    gh issue create --repo Robert-Lark/project-matrix --label ready-for-agent \
      --title "<TITLE>" --body-file <(this section's BODY)
  Create the PRD issue first, then substitute #{PRD} with its number and
  #{A} with issue A's number in the bodies below. The 2026-07-18 session
  drafted these but the harness permission gate (correctly) required a
  human-named publish; artifacts-are-the-memory, so the specs live here.
-->

# ISSUE A
TITLE: Editorial/vanilla: the host variant — real-variant pattern, cart contract, deployed re-render leg
BODY:
First slice of the editorial build (PRD: #{PRD}). The designated host variant for the editorial surface (ADR-0008 §6 link map), and the pattern every later variant copies.

**Scope**
- `variants/vanilla` workspace: hand-authored static editorial page + a build script in the `placeholder-static` mold, snapshot-parameterized (`fixture` default, `crate` for the deploy) — served DOM must equal `packages/reference/surfaces/editorial/index.html` modulo the ADR-0008 serialization freedoms, plus the `<div id="pm-chrome-slot"></div>` after the skip link (variants only).
- **Mint the snapshot selector** (no such env var exists yet): name it; declare it as turbo `env` on every snapshot-parameterized build task with tray files as `inputs` (the `@pm/front#build` precedent in turbo.json — the origin and deploy jobs share the `turbo-origin-*` cache family, so an undeclared selector replays fixture dists onto the crate plane); set it to `crate` on the deploy job's bare `pnpm exec turbo run build` step, `fixture` default everywhere else; thread it through `run-local.mjs`'s turbo build derived from `PM_SEED_DIR`, keeping the documented local-crate verification run (and run-local's "one command holds either way" promise, lines 117–121) true for build-time variants.
- Composition wiring: `pm-vanilla` Worker (assets + the one-line `env.ASSETS.fetch(request)` forwarder), service binding + `VARIANTS` entry in `workers/front`, `run-local.mjs` entry, CI deploy line (a package `deploy` script invoked via `pnpm --filter` — the placeholder precedent), `workers/README.md`. The variant self-serves under `/vanilla/` — the front Worker never rewrites paths.
- **Extend `NoiseSpec` with the behavior-attribute class** (`normalize.ts:48-53` carries only `attrPatterns`/`classPatterns`, so ADR-0008's "behavior attributes get their own declared registry class" is currently inexpressible): e.g. `behaviorAttrPatterns`, stripped identically, auditable as its own class — landed here so slices D/E/F never touch shared drift-gate types (B–F depend on A only).
- **Cart storage contract** (PRD contract item 3): define + commit key, value schema, count semantics, and the status-announcement copy; implement vanilla add-to-cart against it (localStorage cart, masthead count populated client-side, `data-pm-status` announcement — canonical served state stays EMPTY).
- `SURFACE_CONTROLS`: move `vanilla` from `editorial.plannedVariants` to `editorial.variants` (the chrome's "Served by N of M" recounts from the arrays — `chrome.ts:159` sums them, so a non-move double-counts).
- `PERMITTED_NOISE`: nothing to register — vanilla IS the `NO_NOISE` control; assert that.
- Drift gate: the first real variant-vs-master comparison joins `drift.browser.test.ts` for `/vanilla/editorial/`, all three profiles.
- Origin-suite assertions for `/vanilla/editorial/`: canonical markup + slot; chrome injected, `data-pm-variant="vanilla"`, `data-pm-surface="editorial"`, serving cell `aria-current`; fonts a controlled constant (ADR-0003 §8): the canonical loading markup (`packages/tokens/fonts/loading-markup.html`) verbatim modulo base path, files byte-identical to `@pm/tokens` (FamiljenGrotesk + PMCrateSymbols preloaded, PMWarnGlyph served unpreloaded).
- **Deployed-smoke re-render leg** (ADR-0008 §9 obligation, owed by the first content-surface build): the post-deploy suite re-renders the editorial master from the RESOLVED snapshot (`/api/snapshot`) and compares the served page — CI keeps proving fixture-equivalence; the plane proves the crate.
- `DIFF-TO-STARTER.md`: records that no official starter exists for the paradigm; the whole (small) tree is the diff.

**Acceptance**
- `/vanilla/editorial/` serves locally (fixture) and deployed (crate) through the composed origin; drift gate + origin suite green in CI; post-deploy smoke green including the new re-render leg.
- Cross-surface links in the served page are exactly the master's absolute designated-host targets; no assertion requires the not-yet-built targets to resolve.

**Verification:** verify-slice in the background + inline probes before the single commit (explicit paths). Merging to main deploys — Rob's call.

# ISSUE B
TITLE: Editorial/react-next: heavy hydration on the OpenNext adapter
BODY:
Editorial build slice B (PRD: #{PRD}; pattern from #{A}). The planning-time villain on this surface — which is exactly why it must be the idiomatic default, not a strawman (ADR-0003 2026-07-12 addendum).

**Scope**
- Scaffold `variants/react-next` from `create-next-app` (pinned), adapt with OpenNext `@opennextjs/cloudflare` (the verified current adapter — cf-composition FINDINGS; next-on-pages is deprecated/archived). Commit `DIFF-TO-STARTER.md`: exact command, pins, every deviation + why.
- Editorial page as an idiomatic Next route; trays fetched through the edge Worker at request time (SSR is the paradigm's real shape, ADR-0002 §7) — **the variant binds pm-edge itself** (`services` in its own wrangler.jsonc; the front's EDGE binding doesn't reach a variant server-side; wrangler's local dev registry resolves it, run-local already spawns edge) and the CI deploy step moves pm-edge BEFORE any variant that binds it. Add to cart consumes #{A}'s cart contract via idiomatic React state. Base-path config for the `/react-next/` prefix is an expected `DIFF-TO-STARTER.md` entry (the front Worker never rewrites paths).
- `PERMITTED_NOISE`: register Next's hydration/runtime residue as declared classes (measured from real output, not guessed).
- Composition wiring (binding, `VARIANTS`, run-local, CI deploy line), `SURFACE_CONTROLS` move, drift-gate comparison, origin-suite assertions incl. observed noise — the per-slice duties table in #{PRD}.

**Acceptance:** `/react-next/editorial/` green everywhere the PRD's AC list demands; the noise registry entry is part of the published diff story.

# ISSUE C
TITLE: Editorial/astro: islands — static output, an island only if idiomatic
BODY:
Editorial build slice C (PRD: #{PRD}; pattern from #{A}).

**Scope**
- Scaffold `variants/astro` from the official `create astro` starter (pinned). Static output is adapter-free on Workers (cf-composition FINDINGS; `@astrojs/cloudflare` only if the build genuinely needs SSR — editorial should not).
- Snapshot-parameterized build baking trays at build time (build-time is the paradigm's real shape here); turbo env/inputs declared per #{A}'s precedent.
- Add to cart consumes #{A}'s cart contract — as an island if that is Astro's idiomatic shape for one interactive button, otherwise the smallest idiomatic mechanism; the choice and why goes in `DIFF-TO-STARTER.md`.
- `PERMITTED_NOISE`: register Astro's scoping/island markers as declared classes (from real output).
- Composition wiring, `SURFACE_CONTROLS` move, drift-gate comparison, origin-suite assertions — the per-slice duties table in #{PRD}.

**Acceptance:** `/astro/editorial/` green everywhere the PRD's AC list demands.

# ISSUE D
TITLE: Editorial/qwik: resumability on the official cloudflare-workers adapter
BODY:
Editorial build slice D (PRD: #{PRD}; pattern from #{A}).

**Scope**
- Scaffold `variants/qwik` from `create qwik` (pinned), official `cloudflare-workers` adapter (v1 stable — cf-composition FINDINGS). `DIFF-TO-STARTER.md` per the mechanism.
- Trays through the edge Worker at request time; Add to cart consumes #{A}'s cart contract through idiomatic Qwik resumable handlers.
- `PERMITTED_NOISE`: `on:*`/`q:*` behavior attributes registered through #{A}'s `behaviorAttrPatterns` class (mechanism, not residue — ADR-0008 freedoms list), plus any inert residue separately. The variant binds pm-edge itself (the slice-B precedent).
- Composition wiring, `SURFACE_CONTROLS` move, drift-gate comparison, origin-suite assertions — the per-slice duties table in #{PRD}.

**Acceptance:** `/qwik/editorial/` green everywhere the PRD's AC list demands.

# ISSUE E
TITLE: Editorial/htmx: hypermedia — server HTML from a Worker
BODY:
Editorial build slice E (PRD: #{PRD}; pattern from #{A}).

**Scope**
- `variants/htmx`: a server-rendered-HTML Worker + the pinned `htmx.org` npm package **vendored into the variant's own assets and served same-origin** as a script tag (htmx's documented install IS a script tag — never a CDN include: the suite's request tracker fails any request off the composed origin; `DIFF-TO-STARTER.md` records the starterless call and the minimal shape).
- Trays through the edge Worker at request time (binds pm-edge itself — the slice-B precedent). Editorial's one interaction is client cart state, which htmx does not own — the honest idiomatic shape (a minimal script consuming #{A}'s cart contract) is recorded, not disguised.
- `PERMITTED_NOISE`: `hx-*` behavior attributes through #{A}'s `behaviorAttrPatterns` class IF the page idiomatically carries any — an editorial page with zero `hx-*` is an honest hypermedia statement, and then nothing registers.
- Composition wiring, `SURFACE_CONTROLS` move (completes the five: `plannedVariants` empties), drift-gate comparison, origin-suite assertions — the per-slice duties table in #{PRD}.
- **Home editorial-row flip** (ADR-0007 §4 — rows update one at a time as surfaces land, "a one-word edit per the design"): this slice completes the surface, so it flips the row's landed state. The publication-time tense/verdict flips stay out.

**Acceptance:** `/htmx/editorial/` green everywhere the PRD's AC list demands; the chrome's reading table shows five live columns; home's editorial row reflects the landed surface.

# ISSUE F
TITLE: Editorial/remix3: the fenced frontier exhibit
BODY:
Editorial build slice F (PRD: #{PRD}; pattern from #{A}). Fenced from every number; never pairs with another slice.

**Scope**
- **Re-verify the beta first** (fast-moving; `3.0.0-beta.5` was newest 2026-07-11): pin exactly via the lockfile; the remix3 spike's `test.sh` is the canary on any bump.
- `variants/remix3`: hand-rolled Workers entry on the canonical plane (ADR-0004 second addendum; the spike's ~15-line entry + prebuilt client assets are prior art, incl. the workerd `clientEntry()` stable-id and esbuild frictions recorded in FINDINGS).
- Three-layer labeling, FINDINGS §7(c)'s enumeration exactly: (1) on-surface plaque — `data-pm-fenced="true"`, exact version, "excluded from every benchmark number" (final copy is this slice's job); (2) chrome — the switcher lists remix3 with a pre-release tag in the control itself (the one chrome touch: a fenced exhibit entry on `SurfaceControls`, never a reading-table column — ADR-0005 §7), HUD RUM-only; (3) receipts — the bench runner REFUSES a remix3 variant id (§7(c)3: mechanism, not policy), with a test.
- Drift gate in ADVISORY mode (warns, never fails CI — ADR-0003 first addendum); register the FINDINGS §7(b) noise list (`rmx:f`/`rmx:h` comments, `#rmx-data`, `<style data-rmx>`, `rmxc-*`) — plus `rmx-target`/`rmx-src` mechanism attributes if they appear in served DOM (FINDINGS §2; this slice's registration call).
- **Drift-normalizer extension, scoped**: the plaque is an element-level divergence the noise registry cannot excuse — extend the normalizer + pixel-leg neutralize step to drop `[data-pm-fenced]` subtrees **only in the fenced variant's own comparison** (an unconditional drop would let any core variant hide divergent DOM from the gate by marking it fenced); add the origin-suite assertion that core-variant editorial pages carry NO `[data-pm-fenced]` element. Green-by-default, so an advisory warning means REAL drift.
- **FINDINGS §8 hand-offs** (named so this build can't inherit them silently): prefix-mounting under the composed origin — route mapping, frame `src`/`rmx-src` generation, anchor hrefs, asset URLs all prefix-aware at `/remix3/editorial/` ("this exhibit's largest unexercised seam") — and committed automated browser coverage of the §5 behaviors (frame reload, `run()` anchor interception, history); `test.sh` covers only the HTTP-observable side.
- Composition wiring + origin-suite assertions per the PRD duties table (labeling asserted, not just present).

**Acceptance:** `/remix3/editorial/` serves through the composed origin with all three labeling layers asserted; advisory drift wired and demonstrably non-blocking; core CI cannot be failed by this variant.
