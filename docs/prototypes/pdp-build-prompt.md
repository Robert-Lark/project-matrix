# Next unit — THE PDP BUILD (the thesis flip)

Build arc step 3. Work under the standing best-judgment authorization:
decide from the recorded decisions and roll forward without pausing.
Ultracode is ON for this unit by recorded calibration (design-heavy, and it
is the project's argument made visible). Read
`docs/prototypes/finish-line-handoff-prompt.md`'s "## Progress log" FIRST
(never redo what the world shows done), `docs/decision-map.md` second, then
the ADRs named below IN FULL before any code.

── NORTH STAR (why this unit is the project's argument) ──
The site is a live-benchmarking portfolio: one Discogs-powered store built
in several rendering paradigms, instrumented so a SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED. The thesis is **fit, not a leaderboard** —
misapplication is costly, correct application is huge.

**This unit is where the thesis becomes falsifiable.** Editorial published
React/Next at 154.88 KB of JavaScript against vanilla's 1.69 for the same
article — the planning-time "villain" reading. The PDP is the same variant
on a page where interactivity is genuine: gallery switching, format
choice, quantity, add-to-cart, cart state that survives. If the numbers
here say what editorial's said, the thesis is wrong and the site must
publish that. **The flip is a HYPOTHESIS this unit tests, never a result
to be arranged.** ADR-0005 §6 and ADR-0007 §1 bind it: published verdicts
are what receipts say, and the decision-map's villain/contender language is
planning-time framing that is explicitly NOT publishable copy.

A confident wrong number costs this project more than a missing one.

── STATE OF THE WORLD (verified 2026-08-14) ──
`main = 7c5be98` — the first editorial bench batch is MERGED and LIVE (PR
#23; deploy run 31810830636 green first try, all three jobs). Verified in
production this session: `/methodology/` 200, `/_pm/lab/editorial.json`
serving three profiles, its receipt URLs dereferencing 200, editorial pages
rendering receipt-linked values with `<small class="pm-chrome__band">`
bands + the methodology link, home's row carrying the receipt-linked
0.42–154.88 KB spread, `/remix3/editorial/` reading benchmarked columns
with none of its own.

**PR #23 merged with a MERGE COMMIT, not `--rebase` — and this constraint
is inherited.** Published receipts pin `85b97c4` and the chrome constant
pins `58d5101` BY HASH; a rebase would rewrite them into SHAs absent from
main's history, so every published number would name a commit a skeptic
could not check out. **If this unit publishes PDP receipts, its branch
carries the same constraint: multi-commit by necessity (a receipt records
`commit.dirty` AS MEASURED, so code lands before the artifact measuring
it), and it must NOT be squashed or rebased.**

Verified live, so you can stop worrying about it: the 1,817 crate thumb
derivatives ARE seeded on the deployed plane (`/assets/img/896191-primary
.thumb.avif` → 200). The local crate img/ dir is missing exactly one file
(`9861004-primary.thumb.avif`), which is why the crate suite reads
**334/335 locally and is NOT a defect** — that file serves 200 in prod.

── TASK 0 (reconcile the record before code) ──
`docs/decision-map.md`'s `editorial-bench-batch` ticket records the
chrome-constant re-measure obligation but NOT the second one (re-run the
batch against the deployed plane), which lives only in ADR-0001 addendum K
and on `/methodology/`. Add it, then discharge both (below). Fold the docs
edit into this unit's commit. Also confirm from the world (`gh pr view 23`,
`gh run list --branch main`) rather than trusting this file.

── THE TWO OBLIGATIONS THIS UNIT INHERITS (do these FIRST) ──
Both are cheap, both are recorded promises, and both are now possible
because the plane serves the publication:
1. **Re-measure the ADR-0001 addendum-F chrome constant against the
   DEPLOYED plane.** It was measured against a local plane only because the
   live plane could not yet render the populated chrome. Command shape:
   `node tools/bench-runner/dist/chrome-constant.mjs --origin https://pm-front.robresearch87.workers.dev --target /vanilla/editorial/ --profile slow-4g-mid-phone --runs 7 --out workers/front/lab/chrome-constant.json`
   (needs `NODE_EXTRA_CA_CERTS` on this machine — `route.fetch` runs in
   Node, which does not trust the corp MITM CA; the browser uses the
   keychain). Local figures to compare against: +224 ms FCP, +216 ms LCP,
   0 CLS, 1,908 B brotli, fragment 12,023 B.
2. **Re-run the editorial batch against the deployed plane**, which now
   serves the populated chrome. The published timing cells measured the
   PRE-publication chrome and understate by at most the constant (byte
   cells are unaffected — chrome bytes are stripped by path). This is the
   dated-snapshot model working as designed, not a defect.
**Both artifacts must be minted from a CLEAN tree** (the build refuses
dirty receipts) and, if committed, force the no-squash constraint above.

── FIRST ACTIONS ──
1. `git fetch origin --prune`; fresh worktree off `origin/main` (branch
   name your call, e.g. `pdp-build`). Copy the git-ignored
   `tools/snapshot-capture/crate/img/` (1,817 files) in from the main
   checkout — crate-mode runs need it.
2. `pkill -9 workerd` and sweep ports 8787–8797 / 9230–9240.
3. READ IN FULL before designing: **ADR-0008** (§7 cart/error contracts,
   §8's PDP paragraph, §11 derivative sizing + the 160 px thumb tier, the
   normative "What a variant may vary" section, and the 2026-08-14 budget
   addendum); **ADR-0001** (all addenda — C bands/verdicts, F/L the chrome
   constant, G+M the serialization caveat, K the run environment);
   **ADR-0002** §3 (the live-origin demonstration — the ONLY serve-time
   Discogs call in the whole project, and it lives on THIS surface);
   **ADR-0003** + its CSS-delivery addendum (below); **ADR-0005** §6.
   Then read `packages/reference/render/pdp.mjs` (156 lines — the
   executable contract) and `packages/reference/surfaces/pdp/index.html`
   (the committed master).

── WHAT IS ALREADY TRUE (do not rebuild it) ──
This differs structurally from every editorial slice, which each created a
NEW variant Worker. **The PDP is a new SURFACE on four EXISTING Workers.**
- **No new ports, no new Workers, no new CI deploy lines, no wrangler
  changes.** vanilla 8792/9235, react-next 8793/9236, astro 8794/9237,
  qwik 8795/9238 already run; deploy is per-workspace, not per-surface.
- **No front-Worker change**: dispatch is by path prefix and the surface is
  already read from path segment 2. The switcher's `swapHref` rewrites only
  the variant segment, so variant swapping works on PDP URLs unmodified.
- **The contract already exists**: `pdp.mjs` + the committed master + a
  fixed, ordered CSS set (gallery, format-switch, qty, tracklist, prose,
  plaque, surfaces/pdp.css) — all already shipped in `@pm/tokens` and
  already copied into each variant's assets.
- `SURFACE_CONTROLS.pdp` is registered with `variants: []`,
  `plannedVariants: ["vanilla","react-next","astro","qwik"]`, host
  `vanilla`. Each variant build MOVES its name from planned → variants (the
  editorial-slice discipline).
- **htmx and remix3 are correctly OUT of scope** for this surface.

── THE URL CONTRACT (get this right first) ──
**Slug-keyed, not id-keyed**: `/{variant}/pdp/{slug}/` where slug is
`{id}-{artist}-{title}`. All four variants ALREADY emit these hrefs from
their editorial release card, and the origin suite pins them in 6 places —
they 404 today by design. The edge API is **id-keyed and rejects
non-numeric** (`/api/pdp/{id}`, `^\d{1,15}$`), so request-time variants
must parse the leading id out of the slug.

── THE CONTRACT'S HARD PARTS (measured, not guessed) ──
- **Degenerate states are the COMMON path, and the committed master shows
  NONE of them.** Single-format **439/500** (87.8% — no `<fieldset>`, a
  `<dt>Format</dt><dd>` pair goes into the meta list instead); unpriced
  **44/500**, where `priceFrom === null` ⟺ `numForSale === 0` with zero
  exceptions (em-dash amount + "none for sale" + disabled CTA labelled
  "None for sale" — note lowercase stock line vs title-case CTA: reusing
  one string for both DRIFTS); 1-image **90/500** omits the whole thumb
  `<ul>`. Image distribution: 1×90, 2×64, 3×30, 4×71, 5×245.
- **OPEN DESIGN QUESTION this unit must settle:** the drift gate only ever
  compares the RICH path, because `build.mjs` renders one PDP from the
  featured id. How do the three degenerate branches get gated — extra
  fixture masters, or per-branch legs in the origin suite? ADR-0008 does
  not say. Whatever you choose, the fixture is already branch-covering
  (239/240 single-format, 24/240 unpriced, one 1-image, one 5-image).
- **OPEN DESIGN QUESTION this unit must settle:** how many PDP pages does a
  variant serve? One (then every release-card link but one 404s), a curated
  subset, or the whole catalogue (240 fixture / 500 crate)? This drives
  vanilla's and astro's build shape, build time, and bundle size. Nothing
  in the record settles it.
- Formatting is normative in `lib.mjs` (`formatPrice`, `stockLine`): the
  gate compares rendered TEXT, so a variant using `Intl.NumberFormat` will
  drift on the first non-USD or four-digit price.
- The master renders the **FIXTURE** release 9000016, not crate 896191.
  896191 (Explosions In The Sky, 3 formats / priced / 5 images) is the
  CRATE design constant — a curated choice like the crate itself, NOT a
  receipt, and not to be "derived".
- Thumbs are 160 px on the LONG side (only 810 of 1,817 are square) yet the
  contract hardcodes `width="160" height="160"`. The thumb tier saves
  ~74.8 KB on a 5-image PDP.
- The gallery mat is a fixed 1:1 box, so the LCP image cannot move the buy
  panel in any variant — CLS 0 by construction, as on editorial.

── PER-VARIANT TRAPS (all verified in source) ──
- **vanilla** (build-time): asset URLs are RELATIVE and hardcoded one
  directory deep (`../assets/pm/...`). A PDP page sits one level deeper and
  every stylesheet, font and script 404s unchanged. The reference renderer
  already has the fix shape (`extraDepth` / `depth`); decide whether vanilla
  adopts it or adds a second literal, and record the call.
- **astro** (build-time, `output: "static"`, NO adapter): **the single
  largest decision in this unit.** A per-release PDP forces either
  `getStaticPaths` over the catalogue or adding `@astrojs/cloudflare` —
  which changes the paradigm, needs an EDGE binding, and moves astro into
  the request-time CI deploy group. Its snapshot bake resolves exactly ONE
  editorial payload into one generated module; a second payload needs a
  matching turbo `outputs` entry or a cache hit ships a missing module.
- **react-next** (request-time): its ROOT layout hardcodes editorial's
  stylesheets, so every future route inherits editorial CSS. Same defect in
  **qwik**'s `root.tsx`. **astro is the only one already parameterized**
  (a `css` prop) — use it as the precedent.
- **react-next + qwik**: the masthead `current` marker is typed as a
  two-value union `"plp" | "editorial"` with no PDP member. (The PDP master
  deliberately marks `current: "plp"` — Records, not a PDP link.)
- **astro** types the PDP href literally instead of going through a HOSTS
  map; its Shell's HOSTS has no `pdp` key.

── THE PUBLICATION PIPELINE IS EDITORIAL-HARDCODED ──
The decision-map says the PDP "consumes this publication pipeline as-is".
**That is not literally true — verify before you rely on it.** Dropping a
`pdp-*.json` receipt into `workers/front/lab/receipts/` today FAILS THE
BUILD LOUDLY (`build.mjs` gates on the filename prefix `editorial-`), and
because `dist` is deleted before the throw and the Worker statically
imports a file inside it, the Worker bundle dies with it. What must
generalize: the filename→surface gate, `labProfiles` (keyed by profile
alone, so it cannot hold two surfaces), the single hardcoded
`editorial.json` output (ADR-0008 §3 specifies per-surface
`/_pm/lab/{surface}.json`), the Worker's single static import, the `FIT`
registry (one entry, hard-naming five editorial variants in prose AND in a
machine-checked `requires`), home's and the methodology page's
editorial-named markers, and `published-readings.test.ts` (editorial-only
in five distinct ways, incl. the 13 KiB fragment budget asserted on
editorial pages only). Already generic: `bundleFromReceipt`'s derivation,
the `SurfaceLabBundle` type, the chrome renderer, and `labFor`'s lookup.

**A real trap:** the no-fetch-on-click refusal (`build.mjs`) is applied
UNCONDITIONALLY to every receipt, not scoped to the fit sentence that makes
the claim. **A PDP add-to-cart that legitimately fetches would refuse the
build.** Decide whether that guard becomes a property of the fit template.
(Related latent inconsistency: the bands-overlap early return skips the
no-fetch verification entirely.)

── MEASUREMENT (the interaction question is yours) ──
`INTERACTIONS` holds exactly three ids: `none`, `body-click`,
`editorial-add-to-cart`. **No `pdp-*` id is reserved anywhere in the
record** — ADR-0008 reserved only `checkout-*`, ADR-0005 only `plp-*`.
This surface's whole point is that interactivity is genuine, so choosing
what to measure IS the unit's measurement design: gallery switch? format
change? add-to-cart? Each is a different claim. Note the CLI applies ONE
`--interaction` to every target, so multiple interactions mean separate
batches or a CLI change. ADR-0005 §3 also requires the registry SHAPE to
grow to `{ prime?, measure }` — for the PLP; decide whether the PDP needs
it early.
**The INP cell finally means something here.** On editorial it measured a
single storage write (24–32 ms, honestly near-nothing). On the PDP it can
measure real work — which is the flip's evidence.

── PUBLICATION DISCIPLINE (unchanged, and non-negotiable) ──
- Official batches run OUT OF BAND on a quiet machine, never in a CI gate;
  the post-deploy smoke asserts receipt SHAPE only, never magnitudes.
- Throttled timing cells publish numbers, **never verdicts**, until the
  WebPageTest cross-check exists. The fit line rides bytes.
- Every cell publishes its median WITH its min–max band; comparative
  language only where bands do not overlap, else "Indistinguishable at this
  sample size".
- No initial-JS comparison between two hydrating frameworks publishes as a
  verdict without the addendum-M serialization caveat riding it.
- No publication is a legitimate state: the bundle builds empty and the
  pages say so plainly. Never a number-shaped hole.
- The CSS cell is BARRED from publishing as a render-axis verdict until
  native CSS delivery lands. ADR-0003's addendum assigns that to "the
  PDP/PLP builds" (plural, no single owner — **an ambiguity this unit
  should resolve explicitly, even if the answer is "PLP owns it"**), and
  pre-authorizes how the gate adapts: it must NOT assert CSS byte-identity,
  only rendered identity.

── THE LIVE-ORIGIN DEMONSTRATION (this surface owns it) ──
ADR-0002 §3: the ONLY serve-time Discogs call in the project, fenced, with
mandatory self-explaining copy, presented as a demonstration and never a
"mode". It is already in the master as
`<aside class="pm-plaque pm-plaque--fenced" data-pm-fenced="true">` with
four required copy blocks and an `<output data-pm-live-origin>`. **Note the
asymmetry:** the editorial suite hard-asserts core pages carry NO
`data-pm-fenced` element — correctly editorial-scoped. Do not copy that
assertion to the PDP, and check the remix3 drift leg's zero-fenced
assertion against a surface whose master legitimately has one.

── FIX BEFORE THE FIRST VARIANT COPIES IT ──
`pdp.mjs`'s qty stepper glyphs (U+2212 / +) are NOT `aria-hidden`, so the
accessible names read "−Decrease quantity" / "+Increase quantity" —
inconsistent with the tracklist header two lines away, which hides its
glyph. Decide it in `pdp.mjs` NOW: after the first variant lands, four
variants have copied it and the master is the thing they are all held to.
(Also open, lower stakes: ADR-0008's "456/500 within 2%" reproduces only
under `|w−h|/height ≤ 0.02`; the mat renders ~649 CSS px against a 600 px
asset ceiling, ~1.08× upscale at DPR 1 — accepted cost, or narrow the
column?)

── TRAPS THIS CHAIN HAS ALREADY PAID FOR (don't repay) ──
- **A receipt records `commit.dirty` AS MEASURED.** Editing ANY tracked
  file while a batch runs makes every receipt it mints unpublishable — this
  cost a full batch re-run last unit. Commit everything first, then measure.
- The constant's own artifact left in the tree dirties the NEXT
  measurement. Write to a scratch path, or remove-then-measure.
- **Never `| tail` a background run** — it buffers all output to the end.
- **OFFICIAL NUMBERS NEED A QUIET MACHINE**: crate plane + Playwright + a
  concurrent agent fleet once produced a 37-failure goto-timeout storm. One
  heavy job at a time; verify-slice runs while you probe INLINE, never
  while a batch measures.
- Playwright's `route.fulfill` IGNORES a declared `content-encoding` — a
  brotli body yields a corrupt document (measured: 3,660 bytes, no chrome
  node). The chrome-constant probe pads to equal bytes instead.
- Only `run-local.mjs` builds variants with the matching snapshot selector
  — never trust a hand-started plane for anything ID- or snapshot-sensitive.
  It now takes `PM_HOLD=1` to bring the plane up and HOLD it.
- Deployed-origin suite runs need `PM_ORIGIN` + `PM_EXPECT_BROTLI=1` (+
  `NODE_EXTRA_CA_CERTS`).
- `pnpm install --force` lies about resolution changes — wipe node_modules.
- Numbers from tools, never typed, and never written before the run
  finishes. The record-not-code class survives review; verify-slice catches
  it every single slice.

── SESSION DISCIPLINE (standing) ──
One unit = this surface. Run the saved `verify-slice` workflow in the
background (args: issue/scratchDir/context/repoDir = the worktree) while
probing inline; refute findings inline before adopting.
**READ ITS RESULT PROPERLY: an empty findings array is what a DEAD run
looks like.** Last unit all four lenses died on a model limit and returned
four `findings: []` — confirm against `journal.jsonl` (`type=result` count)
and the `findings-*.md` files before believing "no findings". The resumed
run then returned 26 findings, 18 distinct, three of which invalidated
already-"finished" artifacts.
Re-run BOTH suite modes on the FINAL tree and only then write numbers into
the record. Explicit paths, never `git add -A`. Records to update at the
end: `build-log.md` (a new Phase), `decision-map.md` (the ticket + Task-0),
any ADR addenda your decisions require, a dated line in
`docs/prototypes/finish-line-handoff-prompt.md`'s progress log (main
checkout, untracked), and the branch-state memory.

── DO NOT ──
No live Discogs calls except the fenced live-origin demonstration this
surface owns (ADR-0002 §3), and never in a measured path. No verdict copy
the receipts don't support — bands-overlap renders indistinguishable, and
the villain/contender framing never ships. No perf assertions in blocking
CI gates. Nothing that publishes a number without a receipt. No new
primitive tokens and no spec-layer redesign — ADR-0008 owns the masters,
the chrome anatomy and SURFACE_CONTROLS semantics; a needed change is an
ADR addendum, not an improvisation. Don't rig the variant to fit the
instrument (the rejected `assetsInlineLimit: 0` precedent) — fix the
instrument or state the limit.

── AFTER THIS UNIT ──
The PDP column is built and, if measured, published — and the thesis has
either survived its first real test or been corrected in public. Next in
the recorded order: PLP (the data axis, which owns the Apollo fence
mechanism, the frames-partial generalization, and the `{prime, measure}`
registry shape), then Checkout, a11y, and "How it was built" — whose
arrival moves the methodology page from its recorded interim home.
