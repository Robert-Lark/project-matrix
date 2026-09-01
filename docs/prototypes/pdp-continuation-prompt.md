# Next unit — FIX THE RECORD, FIX THE RULER, FINISH THE PDP

Work under the standing best-judgment authorization: decide from the recorded
decisions and roll forward without pausing. Ultracode is ON (design-heavy, and
this unit repairs published claims). Read
`docs/prototypes/finish-line-handoff-prompt.md`'s `## Progress log` FIRST
(never redo what the world shows done), `docs/decision-map.md` second, then the
ADRs named below IN FULL before any code.

──────────────────────────────────────────────────────────────────────────────
## NORTH STAR (why this project exists)

The site is a live-benchmarking portfolio: one Discogs-powered store built in
several rendering paradigms, instrumented so a **SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED**. The thesis is **fit, not a leaderboard** —
misapplication is costly, correct application is huge. Evidence for staff-level
frontend judgment; later a conference talk and an article.

**A confident wrong number costs this project more than a missing one.** That
is not a slogan this unit can quote and move past — this unit exists largely
because the last one produced several.

The PDP is where the thesis becomes falsifiable: editorial published React/Next
at 154.88 KB of JS against vanilla's 1.69 for the same article. The PDP is the
same variant where interactivity is genuine. If the numbers here say what
editorial's said, **the thesis is wrong and the site must publish that**. The
flip is a HYPOTHESIS, never a result to be arranged. ADR-0005 §6 and ADR-0007
§1 bind it; the decision-map's villain/contender language is planning-time
framing and is explicitly NOT publishable copy.

──────────────────────────────────────────────────────────────────────────────
## STATE OF THE WORLD (verified 2026-08-14)

- `main` = `7c5be98` — the first editorial bench batch is merged and LIVE
  (PR #23, deploy run 31810830636 green first try). Editorial build closed at
  `db626cb`, all six slices live.
- **Branch `pdp-build`, four commits, UNMERGED, off `7c5be98`:**
  - `b12b8d9` — the two inherited obligations + Task 0
  - `83effeb` — the PDP spec layer (four masters, `pdpMasterIds`, qty a11y fix,
    ADR-0008 addendum)
  - `c38f458` — the vanilla PDP variant
  - `39cda09` — records (build-log Phase 11, `pdp-build` ticket)
- **THE BRANCH MUST NOT BE SQUASHED OR REBASED.** `b12b8d9` carries receipts
  pinning `7c5be98` BY HASH; a rebase rewrites it into a SHA absent from main's
  history and every published number then names a commit a skeptic cannot check
  out. This is the PR #23 precedent and it is inherited.
- Final tree at handoff: `pnpm turbo run test lint typecheck` **30/30**,
  `@pm/reference` 36/36, working tree clean.
- Worktree: `/Users/roblark/Work/project-matrix/.claude/worktrees/pdp-build`,
  deps installed, crate `img/` copied in (1,817 files).

**What is live and verified in production:** `/methodology/`,
`/_pm/lab/editorial.json` (three profiles) with dereferencing receipts,
receipt-linked readings with min–max bands on every editorial page, home's
receipt-linked spread, `/remix3/editorial/` reading benchmarked columns with
none of its own.

──────────────────────────────────────────────────────────────────────────────
## TASK 0 — COLLECT verify-slice AND REPAIR THE RECORD (do this FIRST)

`verify-slice` run **`wf_f6eb8c8a-279`** was launched against the pdp-build
branch and was **STILL RUNNING at handoff** — one lens complete (8 findings),
at least one more in flight.

```
Workflow({name:"verify-slice", args:<the same args>, resumeFromRunId:"wf_f6eb8c8a-279"})
```
args used: `issue` / `scratchDir`
(`/private/tmp/claude-502/-Users-roblark-Work-project-matrix/64f79308-d58d-492f-a5c3-0ca86f0e7e04/scratchpad/pdp/verify`)
/ `context` / `repoDir` = the worktree. Journal:
`~/.claude/projects/-Users-roblark-Work-project-matrix/64f79308-d58d-492f-a5c3-0ca86f0e7e04/subagents/workflows/wf_f6eb8c8a-279/journal.jsonl`.

**READ THE RESULT PROPERLY: an empty findings array is what a DEAD run looks
like.** Confirm against `journal.jsonl` (`type=result` count) and the
`findings-*.md` files before believing "no findings". Last unit four lenses
died on a model limit and returned four `findings: []` that read exactly like a
clean pass; the resumed run then returned 26 findings, three of which
invalidated finished work.

### The eight findings ALREADY returned — every one is against committed work

Refute each inline against source before adopting (that is the standing rule),
but they arrived with tool-derived evidence and most look correct.

1. **The coverage guard overclaims, and the overclaim is the exact class this
   repo keeps paying for.** `reference.test.ts:185` says "gates every rendering
   branch" and `lib.mjs:144` says the three axes are the branches `pdp.mjs`
   takes "and nothing else". **They are not.** `pdp.mjs:65` omits the whole
   notes `<section>` when `!d.notes`; `:91` renders an sr-only "No duration
   listed" for a null track duration; `:125` renders `—` for a null year.
   Fixture releases taking the uncovered arm: notes-absent 1, ≥1 null duration
   68, null year 19; crate: 61 / 259 / 0. **Either extend the model and the
   master set to cover them, or narrow the claim to exactly what is asserted.**
   Do not leave the sentence as-is.
2. **"LCP +30 to +120 ms across variants" is falsified by the receipts
   committed in the same commit.** `docs/decision-map.md:271` and `b12b8d9`'s
   commit message both say timing "moved up". On slow-4g two cells moved DOWN:
   vanilla **−20 ms**, astro **−16 ms** (cold is worse: vanilla −24, astro
   −36). Correct the record to what the receipts say — this is a published
   claim about published numbers.
3. **The `bench-instrumentation-dilution` ticket mixes two rulers.** The
   algebra checks out, but the inputs are node-brotli-q11, not the ruler under
   test. `collect.ts:584` feeds `decomposeDocument` the browser's
   `nav.transferSize`, and back-solving from the committed astro warm run
   (buckets html 1718 / js 377 / data 35) with D=19,381 and I=12,168 gives
   **T ≈ 5,724 B**, not 4,290. So "the current rule yields 282.9 B" contradicts
   the receipt's own **377–381 B**, and the headline **33.6%** is not the
   published cell's actual error. **Re-derive the whole finding from
   transferSize** before the ruler unit consumes it. The DIRECTION of the bias
   is almost certainly still real; the magnitude must be re-measured.
4. **"The crate has 16 combinations" is not derivable from anything.** Three
   binary axes ⇒ 8 possible; the crate populates **7**, the fixture **4**.
   Appears in `ADR-0008:465`, `reference.test.ts:196` and `83effeb`'s message.
5. **The isolation property is stated three ways and two are false.**
   `lib.mjs:197` claims each degenerate pick "holds the other two at the rich
   master's value" — but `unpriced` and `one-image` hold `formats` at
   **single**, the neighbour's value, not the rich master's **multi**. And of
   the 6 master pairs only **3** differ by one axis (rich↔unpriced and
   rich↔one-image differ by 2; unpriced↔one-image differ by 2), so ADR-0008's
   "any two masters differ by exactly one rendering decision" is false. The
   TEST asserts the true property (differences from the correct neighbour);
   the prose does not. Also: `pdpMasterIds` enforces the duplicate guard but
   **not** isolation — consider enforcing what the prose claims.
6. **`packages/tokens/css/components/qty.css:6-16` still documents the
   pre-fix bare-glyph markup.** ADR-0003 §1 makes "CSS + a canonical markup
   contract" the shared artifact every paradigm re-implements from, and
   ADR-0008's addendum claims the fix landed "in the master before the first
   variant copied it" — but the contract doc three variants will read still
   shows the old buttons.
7. **The origin-suite masters-health leg still lists eight masters.**
   `drift.browser.test.ts:464` `NEW_MASTERS` is unchanged, so the three new PDP
   masters get **no** normalizer-determinism, asset-404 or pixel-stability
   coverage. Also stale: three "eight" counts in `reference.test.ts:20/145/156`
   (`SURFACE_PAGES` is now 11).
8. **The chrome constant pins a SHA it cannot verify.**
   `chrome-constant.ts:339` uses `commitPin(repoRoot)` — a statement about the
   LOCAL checkout — while `--origin` is now the REMOTE plane (the first time
   this has been true; the prior artifact recorded `127.0.0.1:8787`, where
   local HEAD and served code are the same thing). And
   `workers/front/build.mjs:312-337` never ties the constant's SHA to the
   receipts' SHA, its origin to theirs, or `measuredChrome.sha256` to the
   chrome this build actually produces. **This is a real anti-rigging hole in
   the publication pipeline** — a constant measured against one plane can
   publish beside receipts from another.

**Fold the repairs into the branch as their own commit(s).** Do not amend
`b12b8d9` — its receipts are a measurement boundary.

──────────────────────────────────────────────────────────────────────────────
## THEN: THE `bench-instrumentation-dilution` UNIT (fix the ruler)

Ticket is in `docs/decision-map.md`. **It hard-blocks any PDP byte
publication**, on exactly the rule that held the first editorial batch behind
issue #16 — and Rob's 2026-07-24 precedent is that a ruler change gets its own
unit rather than being folded into a surface build.

**The defect.** `decomposeDocument` (`tools/bench-runner/src/collect.ts`)
apportions the document's compressed `transferSize` across
html/js/data/instrumentation **by share of UNCOMPRESSED bytes**. ADR-0001
addendum G states the limit — exact only if each part compresses at the
document's average ratio — and the injected chrome violates it hardest: on the
live `/astro/editorial/` the chrome is ~63% of the document uncompressed and
~44% of it on the wire. Every other bucket is under-attributed, **the bias
scales with the chrome**, and it runs toward flattering the site's leading
claim (the smallest JS cell is the fit sentence's opener and the minimum of
home's published spread). Observable in the project's own receipts: astro's
published cell moved **0.42 → 0.37 KB with no astro change** when the chrome
grew from the empty state to the populated one.

**Before writing the fix, re-derive the magnitude from `transferSize`** (Task 0
finding 3). Do not carry the 33.6% figure forward unchecked.

**Shape of the fix** (recorded, not binding): attribute each part by its OWN
compressed size rather than its uncompressed share — brotli each carved-out
region locally and normalise so the parts still sum exactly to `transferSize`
(local brotli supplies the RATIOS; `transferSize` stays the authority on the
TOTAL, so no local-vs-Cloudflare quality mismatch leaks into a published
number). Keep largest-remainder for exactness and non-negativity.

**Consequences to plan for:**
- Needs an **ADR-0001 addendum superseding G's attribution rule**.
- **It invalidates every committed receipt.** The editorial batch re-runs a
  third time on the fixed ruler — cheap, ~7 minutes for all three profiles
  (measured this session). Same discipline: clean tree, one nonce, all ten
  effective URLs pre-warmed to compressed first.
- The chrome constant should be re-measured too if the change touches what it
  reports.
- Validate the fix against the THREE delivery shapes that already exist —
  vanilla (external single file), astro (inlined), qwik (external-many) — the
  same reasoning that put issue #16 after slice D.

──────────────────────────────────────────────────────────────────────────────
## THEN: FINISH THE PDP

`docs/decision-map.md` → `pdp-build` ticket carries the full state. Landed:
spec layer + **vanilla**. Remaining:

- **react-next, astro, qwik.** New SURFACES on EXISTING Workers — no new ports,
  Workers, CI deploy lines or wrangler changes. Ports already run: vanilla
  8792/9235, react-next 8793/9236, astro 8794/9237, qwik 8795/9238.
  Each variant build MOVES its name from `plannedVariants` → `variants` in
  `SURFACE_CONTROLS.pdp` (vanilla is already moved). htmx and remix3 are
  correctly OUT of scope for this surface.
- **The drift-gate and origin-suite PDP legs** (all four masters × four
  variants; mirror the editorial legs in `drift.browser.test.ts`).
- **The publication pipeline's generalisation** off its `editorial-` hard-coding
  — see below.
- **Interaction registry + batches.**

### Decisions already made — do NOT re-litigate

- **URL contract:** slug-keyed `/{variant}/pdp/{id}-{artist}-{title}/`. The
  edge API is id-keyed and rejects non-numeric (`/api/pdp/{id}`, `^\d{1,15}$`),
  so request-time variants parse the leading id, fetch the tray, then **verify
  the tray's `slug` equals the requested slug; mismatch → 404**. A canonical
  301 was REJECTED: the build-time variants cannot serve one, so it would be an
  observable behavioural divergence between paradigms on the very surface that
  measures them.
- **astro stays STATIC:** `getStaticPaths` over the catalogue, **no
  `@astrojs/cloudflare`**. astro is the islands exemplar on the locked render
  axis; an SSR adapter changes what the column means and confounds the
  cross-surface comparison with a paradigm change rather than a surface change.
  **Trap:** its snapshot bake (`scripts/resolve-snapshot.mjs` →
  `src/data/snapshot.json`) resolves exactly ONE payload into one generated
  module; a second payload needs a matching `@pm/astro#build` turbo `outputs`
  entry or a cache hit ships a page importing a module that isn't there.
- **`{prime?, measure}` registry shape is NOT needed here** — neither planned
  PDP interaction needs a priming prefix. It stays with the PLP, which is what
  ADR-0005 §3 wrote it for.
- **ADR-0003's CSS-delivery ambiguity ("the PDP/PLP builds", no owner) is
  resolved: the PLP owns it.** Components multiply there; landing it here would
  move astro's and Next's LCP for a reason that is not interactivity,
  confounding the one comparison this surface exists to make. The PDP's CSS
  cell publishes as "held constant (raw sheets)" exactly as editorial's does.
- **Planned interactions:** `pdp-gallery-switch` (headline — the interaction
  this surface genuinely owns, where paradigms differ most: DOM swap vs state
  re-render vs resumed handler) and `pdp-add-to-cart` (the controlled
  cross-surface twin of `editorial-add-to-cart` — identical work, different
  page). The CLI applies ONE `--interaction` per batch, so these are two batch
  families. `INTERACTIONS` (`collect.ts:26`) currently holds only `none`,
  `body-click`, `editorial-add-to-cart`. **The live-origin button is never
  registered — the fence is that no registry id names it.**

### Per-variant traps (all verified in source this session)

- **react-next**: its ROOT layout (`src/app/layout.tsx`, `CSS_FILES`)
  hardcodes editorial's stylesheets, so every future route inherits editorial
  CSS. Same defect in **qwik**'s `src/root.tsx:94-101`. **astro is the
  precedent** — `Shell.astro` takes a `css` prop. Parameterise both.
- **react-next + qwik**: the masthead `current` marker is typed
  `"plp" | "editorial"`. **This needs NO change** — the PDP master deliberately
  marks `current: "plp"` (Records; there is no PDP masthead link). Recorded so
  nobody "fixes" a non-defect.
- **astro**: `Shell.astro`'s HOSTS map has no `pdp` key and
  `ReleaseCard.astro:26` types the href literally. The spec of record
  (`shell.mjs` HOSTS) already has `pdp: (slug) => ...`.
- **vanilla** (already fixed, for reference): asset URLs were the literal
  `"../"`, correct only one level deep. The base is now derived from page
  depth (`assetBase(depth)`).

### The publication pipeline is editorial-hardcoded — VERIFY before relying

Dropping a `pdp-*.json` receipt into `workers/front/lab/receipts/` today
**fails the build loudly**: `build.mjs:274` gates on the filename prefix
`editorial-`, and because `dist` is deleted at `:49` before the throw and the
Worker statically imports a file inside it, the Worker bundle dies with it.

Must generalise: the filename→surface gate (`:274`); `labProfiles` (`:261`,
keyed by profile alone so it cannot hold two surfaces); the single hardcoded
`/_pm/lab/editorial.json` output (`:296` — ADR-0008 §3 specifies per-surface
`/_pm/lab/{surface}.json`); the Worker's single static import
(`workers/front/src/index.js:28`, though `LAB_BUNDLES` at `:30` is already a
surface-keyed map); the `FIT` registry (`lab/fit.mjs`, one entry hard-naming
five editorial variants in prose AND in a machine-checked `requires`); home's
and the methodology page's editorial-named markers; and
`published-readings.test.ts` (editorial-only in five distinct ways, incl. the
13 KiB fragment budget asserted on editorial pages only).

Already generic: `bundleFromReceipt`, the `SurfaceLabBundle` type, the chrome
renderer, `labFor`.

**Related latent inconsistency:** `bundleFromReceipt`'s bands-overlap early
return skips the no-fetch verification entirely.

### The live-origin demonstration — EXTERNALLY BLOCKED, needs Rob

ADR-0002 §3: the ONLY serve-time Discogs call in the project, fenced, with
mandatory self-explaining copy, presented as a demonstration and never a
"mode". It lives on THIS surface and is already in the master as a
`data-pm-fenced` plaque.

- **The edge Worker has NO live route.** Verified: `workers/edge/src/index.js`
  routes are `/api/plp`, `/api/pdp/:id`, `/api/snapshot`, `/api/beacon`,
  `/assets/img/*`.
- Arming it needs the Discogs token as a **Worker secret**
  (`~/.config/project-matrix/discogs-token`). **That leaves this machine and is
  Rob's to set — ask, do not do it unprompted.**
- vanilla's `pdp.js` already wires the button to `/api/live-price/{id}` and its
  `<output>` states the absence plainly rather than being a silent no-op.
- The route needs rate limiting and generic-error handling (security.md).
- **The plaque is COMPARED by the drift gate like any other markup** — the
  fence excludes it from benchmark NUMBERS, not from the identity contract. So
  core PDP comparisons must NOT pass `dropFencedSubtrees`, and the fenced count
  on a PDP page is exactly 1. Editorial's "zero fenced on core pages"
  assertion is editorial-scoped and must be **re-scoped, not deleted**.

──────────────────────────────────────────────────────────────────────────────
## PUBLICATION DISCIPLINE (unchanged, non-negotiable)

- Official batches run OUT OF BAND on a quiet machine, never in a CI gate; the
  post-deploy smoke asserts receipt SHAPE only, never magnitudes.
- Throttled timing cells publish numbers, **never verdicts**, until the
  WebPageTest cross-check exists. The fit line rides bytes.
- Every cell publishes its median WITH its min–max band; comparative language
  only where bands do not overlap, else "Indistinguishable at this sample
  size".
- No initial-JS comparison between two hydrating frameworks publishes as a
  verdict without the addendum-M serialization caveat riding it.
- **No publication is a legitimate state**: the bundle builds empty and the
  pages say so plainly. Never a number-shaped hole.
- The CSS cell is BARRED from publishing as a render-axis verdict until native
  CSS delivery lands (PLP owns it).
- Nothing publishes a number without a receipt.

──────────────────────────────────────────────────────────────────────────────
## TRAPS THIS CHAIN HAS ALREADY PAID FOR (don't repay)

- **A receipt records `commit.dirty` AS MEASURED.** Editing ANY tracked file
  while a batch runs makes every receipt it mints unpublishable — this cost a
  full batch re-run. Commit everything first, then measure.
- The constant's own artifact left in the tree dirties the NEXT measurement.
  Write to a scratch path, or remove-then-measure.
- **Never `| tail` a background run** — it buffers all output to the end.
- **OFFICIAL NUMBERS NEED A QUIET MACHINE.** One heavy job at a time;
  verify-slice runs while you probe INLINE, never while a batch measures.
- Playwright's `route.fulfill` IGNORES a declared `content-encoding` — a brotli
  body yields a corrupt document. The chrome-constant probe pads to equal bytes.
- Only `run-local.mjs` builds variants with the matching snapshot selector —
  never trust a hand-started plane for anything ID- or snapshot-sensitive.
  `PM_HOLD=1` brings the plane up and HOLDS it.
- Deployed-origin runs need `PM_ORIGIN` + `PM_EXPECT_BROTLI=1` +
  **`NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`**
  (verified this session — `route.fetch`/`fetch` run in Node, which does not
  trust the corp MITM CA; the browser uses the keychain).
- `pnpm install --force` lies about resolution changes — wipe `node_modules`.
- The local crate `img/` dir is missing exactly one file
  (`9861004-primary.thumb.avif`), which is why the crate suite reads N−1
  locally. **NOT a defect** — that file serves 200 in prod.
- **Numbers from tools, never typed, and never written before the run
  finishes.** The record-not-code class survives review; verify-slice catches
  it every single slice — including this one, eight times.

### Two process traps this session paid for, new

- **The worktree/main-checkout path trap.** Bash `cwd` was the worktree while
  `Edit`/`Write` were given absolute paths into the MAIN checkout — edits
  silently landed in the wrong tree. **Use the worktree's absolute path in
  every file tool call**, or verify with `git -C <tree> status` after editing.
- **`git apply --3way` STAGES what it applies**, and a later `git commit` with
  a pre-populated index sweeps those files into an unrelated commit. Check
  `git diff --cached --name-only` immediately before every commit.
- Never issue two `Edit` calls to the same file in one parallel block — they
  race and both can silently no-op.

──────────────────────────────────────────────────────────────────────────────
## SESSION DISCIPLINE (standing)

One unit at a time. Run the saved verify-slice workflow in the BACKGROUND while
probing INLINE; refute findings inline before adopting. Re-run BOTH suite modes
(fixture and `PM_SEED_DIR=tools/snapshot-capture/crate`) on the FINAL tree and
only then write numbers into the record. Explicit paths, never `git add -A`.

Records to update at the end: `docs/build-log.md` (a new Phase),
`docs/decision-map.md` (the ticket), any ADR addenda your decisions require, a
dated line in `docs/prototypes/finish-line-handoff-prompt.md`'s progress log
(main checkout, untracked), and the branch-state memory.

## DO NOT

No live Discogs calls except the fenced live-origin demonstration, and never in
a measured path. No verdict copy the receipts don't support — bands-overlap
renders indistinguishable, and the villain/contender framing never ships. No
perf assertions in blocking CI gates. Nothing that publishes a number without a
receipt. No new primitive tokens and no spec-layer redesign — ADR-0008 owns the
masters, the chrome anatomy and SURFACE_CONTROLS semantics; a needed change is
an ADR addendum, not an improvisation. Don't rig the variant to fit the
instrument (the rejected `assetsInlineLimit: 0` precedent) — fix the instrument
or state the limit. Don't squash or rebase this branch.

## AFTER THIS

Merge is Rob's call (merging deploys the PDP to the plane; watch for the
once-per-new-URL deploy flake — three distinct signatures so far: first-hit
uncompressed, binding-propagation chrome-count-0, and stale chrome on the
existing URLs. Probe the live plane healthy FIRST, then
`gh run rerun <id> --failed`).

Then the recorded order: **PLP** (the data axis — owns the Apollo fence
mechanism, the frames-partial generalization, and the `{prime, measure}`
registry shape), then **Checkout**, **a11y**, and **"How it was built"** —
whose arrival moves the methodology page from its recorded interim home.
