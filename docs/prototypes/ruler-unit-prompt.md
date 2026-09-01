# Next unit — FIX THE RULER, AND CLOSE THE TWO ANTI-RIGGING HOLES

Work under the standing best-judgment authorization: decide from the recorded
decisions and roll forward without pausing. Ultracode is ON (this unit's
central question is a **measurement-methodology decision**, and it is recorded
as UNSETTLED — it is yours to settle with evidence). Read
`docs/prototypes/finish-line-handoff-prompt.md`'s `## Progress log` FIRST — the
last entry is dated 2026-08-15 and is the state of record — then
`docs/decision-map.md`'s `bench-instrumentation-dilution` ticket, then
**ADR-0001 IN FULL** (all three addenda; the lettered claims G–N are what you
are amending) before any code.

──────────────────────────────────────────────────────────────────────────────
## NORTH STAR (why this project exists)

The site is a live-benchmarking portfolio: one Discogs-powered store built in
several rendering paradigms, instrumented so a **SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED**. The thesis is **fit, not a leaderboard** —
misapplication is costly, correct application is huge. Evidence for staff-level
frontend judgment; later a conference talk and an article.

**A confident wrong number costs this project more than a missing one.** This
unit is the purest expression of that rule in the whole arc: it is a unit whose
entire product is *a more honest number*, and whose failure mode is *publishing
a differently-wrong one with more confidence*. The bias you are fixing runs in
the direction that **flatters the site's own headline cells**. Do not replace a
flattering estimator with one you cannot defend.

──────────────────────────────────────────────────────────────────────────────
## STATE OF THE WORLD (verified 2026-08-15 — VERIFY IT AGAIN ANYWAY)

**Every handoff in this chain has had at least two facts go stale before it was
read. Re-verify from the world, never from this prompt.**

- **`main` = `5f26a6e`** — PR #25 merged `record-repair` with a MERGE commit.
  CI run 31841376970 green first try. Check:
  `git merge-base --is-ancestor <sha> origin/main`.
- **Branch `pdp-controls` = `b7f0cfb`, ONE commit, UNPUSHED and UNMERGED —
  merging is Rob's call.** Worktree `.claude/worktrees/pdp-controls`. It made
  the PDP's controls real and cut the format group (ADR-0008 **addendum A**;
  ADR-0002's guardrail amended in all four places). Final tree: turbo **30/30**,
  `@pm/reference` **37/37**, origin suite **348/348 fixture** and **347/348
  crate**. verify-slice: 4 lenses, **23 findings, all adopted** (run
  `wf_7911d7e7-416`).
- **If `pdp-controls` is still unmerged when you start, branch off it, not off
  main** — the ruler unit re-measures the editorial batch, and the cart
  contract's uniqueness clause (which changed client JS bytes) must be in the
  tree being measured or you will publish receipts for a tree that is about to
  change again.

**Live and verified in production:** `/methodology/` (carrying the dilution
magnitude), `/_pm/lab/editorial.json` (three profiles), receipt-linked readings
with min–max bands on every editorial page, home's receipt-linked spread,
`/remix3/editorial/`, and the vanilla PDP (~500 URLs, 200s).

──────────────────────────────────────────────────────────────────────────────
## TASK 0 — RECONCILE

1. `git fetch origin --prune`. Determine whether `pdp-controls` has been merged
   or pushed. Branch accordingly (see above).
2. Confirm the PDP's state on the plane: the zoom fix and the thumb-wrap fix
   are NOT deployed until `pdp-controls` merges. `curl` the deployed
   `/vanilla/assets/pdp.js` and grep for `pm-gallery__zoom` — 0 means the dead
   control is still live in production.
3. **Do NOT re-run `wf_7911d7e7-416`.** Its 23 findings are all adopted. Its
   journal and the three `findings-*.md` files are the durable record.

──────────────────────────────────────────────────────────────────────────────
## THE UNIT — `bench-instrumentation-dilution`

The ticket is in `docs/decision-map.md`. It **hard-blocks any PDP byte
publication**, on the rule that held the first editorial batch behind issue #16.
Rob's 2026-07-24 precedent: **a ruler change is its own unit.**

### The defect (unchanged, real, verified)

`decomposeDocument` (`tools/bench-runner/src/collect.ts:224`) apportions the
document's compressed `transferSize` across html/js/data/instrumentation **by
share of UNCOMPRESSED bytes** (the rule is stated at `:162`, `:216` and `:261`).
ADR-0001 addendum G states the limit; the injected chrome violates it hardest,
and **the bias scales with the chrome**, running toward flattering the site's
smallest published cells.

The bias is observable in this project's own receipts: **astro's published
initial JS moved 0.42 → 0.37 KB between the first batch and the 2026-08-14
re-run with no astro change**, because the chrome grew from empty to populated.
That is the shape a hostile reader is entitled to call rigging.

### THE CENTRAL DECISION IS THE ESTIMATOR, AND IT IS RECORDED AS UNSETTLED

Measured against the SAVED CLOUDFLARE-SERVED BODY (2026-08-14):

| Quantity | Value |
|---|---|
| Document uncompressed | 19,289 B (instrumentation 12,076 B, 62.6%) |
| **Cloudflare wire body** | **5,243 B — 3.68×** |
| node-brotli-q11 of the same body | 4,321 B — 4.46× |
| Current rule, astro's inline bundle | **347 B** |
| **The fix as written** (brotli each region, normalise to `transferSize`) | **660 B — 47.4% under-report** |

**The honest range is 34–47% and the two methods disagree by a third.**
Isolated-region brotli has a known upward bias for small regions — astro's
1,278 B bundle compresses only **2.2× alone against 3.68× in context** — so 47%
is probably high. The isolated parts sum to only 0.868× of the wire total, so
normalisation scales every part up by ~1.15. **A leave-one-out marginal
estimator removes that bias and is the obvious alternative**; it needs care,
because the carve-outs are non-contiguous and the marginals do not sum to the
whole either.

**Measure, choose, and publish the reasoning — do not inherit a number.**
Whatever you pick, the ADR must state what the estimator is, what it is biased
toward, and by roughly how much.

**A correction already made to the fix's own claim, do not re-introduce it:**
"local brotli gives the ratios, `transferSize` stays the authority on the total,
so no local-vs-Cloudflare quality mismatch leaks into the published number" is
**too strong**. Normalising fixes the LEVEL, not the between-region RATIOS.
Either measure at Cloudflare's actual quality, or publish the residual as a
stated limit.

### Consequences to plan for

- Needs an **ADR-0001 addendum superseding G's attribution rule.** Follow the
  in-place supersession precedent at `docs/adr/0001-…:319`
  (`> **SUPERSEDED — see addendum N.**`) — mark, never silently rewrite.
- **It invalidates every committed receipt.** The editorial batch re-runs a
  third time (~7 minutes for all three profiles, measured). Same discipline:
  clean tree, one nonce, all ten effective URLs pre-warmed to compressed first.
- Re-measure the chrome constant if the change touches what it reports.
- **Validate against the THREE delivery shapes that already exist** — vanilla
  (external single), astro (inlined), qwik (external-many). A fix validated
  against one shape is not validated.
- **`workers/front/methodology/index.html` already carries the magnitude,
  direction and "read the smallest JS cells as floors".** Update that copy when
  the fix lands, and pin the new sentence in
  `tools/origin-suite/suite/published-readings.test.ts` the way it pins the
  serialization caveat. (That file has only two `it(` blocks — it is small, and
  it is editorial-scoped in five distinct ways; see the pipeline note below.)
- **The `pdp-controls` unit added two byte deltas the re-run must absorb**, both
  already recorded in ADR-0008 addendum A: the cart uniqueness clause
  (+262–294 B raw / +80–105 B brotli-q11 over six cart files) and
  `surfaces/shell.css` (+629 B raw / **+243 B brotli on every page**).

### The two anti-rigging holes in ADR-0001 addendum N — this unit owns them

Both are recorded at `docs/adr/0001-…:413` onward. Neither is optional.

1. **The constant describes the chrome measured BEFORE the deploy it enables.**
   The front build regenerates the chrome fragment FROM the receipts, so the
   fragment that ships is not the one the probe hashed (11,931 B against 12,023
   B — 0.8%, but unbounded, and it grows with each surface added to the strip).
   `workers/front/build.mjs:333` gates only on
   `chromeConstant.measuredChrome?.populated !== true`, which BOTH fragments
   satisfy. **The obligation is structurally re-incurred by its own discharge.**
   Fix: after the front build renders the chrome it will ship, hash it with the
   probe's own regex and REFUSE when it differs from
   `chromeConstant.measuredChrome.sha256` — an explicit two-pass publish
   (build → measure → rebuild → deploy) instead of silent staleness.
2. **Nothing ties a receipt's `commit.sha` to the code the plane was serving.**
   `tools/bench-runner/src/git.ts:8` `commitPin` reads the LOCAL checkout, and
   `--origin` is now a REMOTE plane. `pnpm bench reproduce` is the published
   one-command path, so a skeptic following it measures a different tree than
   the receipt names, with no way to detect it. Fix: expose the build's SHA from
   the front Worker (`x-pm-commit` header or `/_pm/build.json`), record it as
   `originCommit` beside the local pin, and refuse a batch or probe whose origin
   SHA disagrees — with an explicit escape for deliberate cross-tree
   measurement.

──────────────────────────────────────────────────────────────────────────────
## PUBLICATION DISCIPLINE (unchanged, non-negotiable)

- Official batches run OUT OF BAND on a quiet machine, never in a CI gate; the
  post-deploy smoke asserts receipt SHAPE only, never magnitudes.
- Throttled timing cells publish numbers, **never verdicts**, until the
  WebPageTest cross-check exists. The fit line rides bytes.
- Every cell publishes its median WITH its min–max band; comparative language
  only where bands do not overlap, else "Indistinguishable at this sample size".
  This binds the chrome constant too.
- No initial-JS comparison between two hydrating frameworks publishes as a
  verdict without the addendum-M serialization caveat riding it.
- **No publication is a legitimate state**: the bundle builds empty and the
  pages say so plainly. Never a number-shaped hole. Corollary (2026-08-14): when
  a ruler defect is found, **caveat live receipted cells with the measured
  magnitude and direction — do not pull them.**
- The CSS cell is BARRED from publishing as a render-axis verdict until native
  CSS delivery lands (the PLP owns it).
- Nothing publishes a number without a receipt.

──────────────────────────────────────────────────────────────────────────────
## TRAPS THIS CHAIN HAS PAID FOR (don't repay)

- **A receipt records `commit.dirty` AS MEASURED.** Editing ANY tracked file
  while a batch runs makes every receipt it mints unpublishable — cost a full
  batch re-run. Commit everything first, then measure.
- The constant's own artifact left in the tree dirties the NEXT measurement.
- **Never `| tail` a background run** — it buffers all output to the end. And
  **`cmd > log; echo "EXIT=$?"` reports the ECHO's status, not the command's**
  (cost a false "green" this session) — append the exit code inside the
  redirect.
- **OFFICIAL NUMBERS NEED A QUIET MACHINE. One heavy job at a time.**
  verify-slice runs while you probe INLINE — *never* while a batch measures and
  **never while the origin suite runs**: 2026-08-15, `bench.browser.test.ts`
  blew its 300 s `beforeAll` hook under that contention and 17 tests skipped,
  which reads exactly like a regression.
- Playwright's `route.fulfill` IGNORES a declared `content-encoding` — a brotli
  body yields a corrupt document. The chrome-constant probe pads to equal bytes.
- Only `run-local.mjs` builds variants with the matching snapshot selector.
  **A hand-run `pnpm --filter @pm/vanilla build` re-bakes with the FIXTURE and
  every crate URL starts 404ing** (paid this session). `PM_HOLD=1` brings the
  plane up and HOLDS it.
- **A fresh worktree has NO `tools/snapshot-capture/crate/img`** — those bytes
  are git-excluded. Crate-mode suite runs need a symlink to the main checkout's
  copy; remove it before committing (it is untracked, **not** gitignored).
- Deployed-origin runs need `PM_ORIGIN` + `PM_EXPECT_BROTLI=1` +
  **`NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`**.
- `pnpm install --force` lies about resolution changes — wipe `node_modules`.
- The local crate `img/` dir is missing exactly one file
  (`9861004-primary.thumb.avif`), so the crate suite reads **347/348** locally.
  **NOT a defect** — it serves 200 in prod.
- **Numbers from tools, never typed.** This is the single most expensive class
  in the chain and it has now been caught in every slice. Last session alone:
  "439 unchanged" survived **three** correction passes (the tool answer is
  309 unchanged / 191 moved), a byte cost was stated for six files from a
  three-file sample, a sabotage count said seven masters when six fail, and an
  ADR cite said §5 when the fact is in §4. **Re-derive, never re-read.**
- **The worktree/main-checkout path trap.** Use the worktree's absolute path in
  every file tool call, or verify with `git -C <tree> status` after editing.
- **`git checkout <file>` discards uncommitted work** — it silently reverted a
  fix mid-session. Prefer restoring from a scratchpad copy.
- **`git apply --3way` STAGES what it applies.** Check
  `git diff --cached --name-only` immediately before every commit.
- Never issue two `Edit` calls to the same file in one parallel block.
- **A CSS-contract comment is part of the spec** — and it is also **wire bytes**
  (sheets are copied raw, no minifier). Change the contract comment in the same
  commit as the markup, and keep it load-bearing.
- **`jq` output spans multiple lines** — `jq ... | wc -l` is not a count of
  results. Use `jq -s 'length'`.

──────────────────────────────────────────────────────────────────────────────
## SESSION DISCIPLINE (standing)

One unit at a time. Run the saved verify-slice workflow in the BACKGROUND while
probing INLINE; **refute every finding inline against source before adopting —
agents overstate, and so do you.** The last pass returned 23 findings across 4
lenses and *all* were real; three were defects the slice itself had introduced,
including a BLOCKER caught before merge. **`findings-<lens>.md` files DO get
written now** (pass an absolute `scratchDir` under the session scratchpad) and
they carry "VERIFIED TRUE" and "ALREADY FIXED" sections the journal never sees —
read the FILES, not only the journal. A lens can go quiet for 15+ minutes and
still be alive; judge by the agent `.jsonl` mtime over several checks.

Confirm any empty findings array against
`jq -s '[.[]|select(.type=="result")|.result.findings|length]|add' journal.jsonl`
before believing it — a DEAD run looks exactly like a clean pass.

Re-run BOTH suite modes (fixture and `PM_SEED_DIR=tools/snapshot-capture/crate`)
on the FINAL tree and only then write numbers into the record. Explicit paths,
never `git add -A`. One commit per branch; amend to update.

**Records to update at the end:** `docs/build-log.md` (a new Phase — note that
the `how-it-was-built` master generates its index from the phase headings, and
`reference.test.ts` now FAILS if you forget to re-render), `docs/decision-map.md`
(the ticket), the ADR-0001 addendum your decision requires, a dated line in
`docs/prototypes/finish-line-handoff-prompt.md`'s progress log (main checkout,
untracked), and the branch-state memory.

## DO NOT

No live Discogs calls except the fenced live-origin demonstration, and never in
a measured path. No verdict copy the receipts don't support. No perf assertions
in blocking CI gates. Nothing that publishes a number without a receipt. **Don't
rig the variant to fit the instrument** (the rejected `assetsInlineLimit: 0`
precedent) — fix the instrument or state the limit. Don't fold the PDP variants
into this unit; a ruler change is its own unit, and that separation is Rob's
explicit precedent.

──────────────────────────────────────────────────────────────────────────────
## AFTER THIS UNIT — the recorded order

`docs/decision-map.md` → `pdp-build` ticket carries full state.

1. **react-next, astro, qwik PDPs.** New SURFACES on EXISTING Workers — no new
   ports, Workers, CI deploy lines or wrangler changes. Ports already run:
   vanilla 8792/9235, react-next 8793/9236, astro 8794/9237, qwik 8795/9238.
   Each build MOVES its name from `plannedVariants` → `variants` in
   `SURFACE_CONTROLS.pdp` — **and the `pdp-controls` guards will then FAIL until
   you point them at that variant's enhancement**, which is deliberate. htmx and
   remix3 are correctly OUT of scope.
   - **Per-variant traps (verified in source):** react-next's ROOT layout
     (`src/app/layout.tsx`, `CSS_FILES`) hardcodes editorial's stylesheets, and
     qwik's `src/root.tsx:94-101` has the same defect — **astro is the
     precedent** (`Shell.astro` takes a `css` prop). Parameterise both. astro's
     `Shell.astro` HOSTS map has no `pdp` key and `ReleaseCard.astro:26` types
     the href literally. The react-next/qwik masthead `current` marker typed
     `"plp" | "editorial"` needs **NO** change — the PDP master deliberately
     marks `current: "plp"`.
   - **astro stays STATIC:** `getStaticPaths` over the catalogue, **no
     `@astrojs/cloudflare`**. Its snapshot bake resolves exactly ONE payload
     into one generated module; a second needs a matching `@pm/astro#build`
     turbo `outputs` entry or a cache hit ships a page importing a module that
     isn't there.
   - **URL contract (settled):** slug-keyed
     `/{variant}/pdp/{id}-{artist}-{title}/`. Request-time variants parse the
     leading id, fetch the tray, then **verify the tray's `slug` equals the
     requested slug; mismatch → 404**. A canonical 301 was REJECTED.
2. **The drift-gate and origin-suite PDP legs** (all four masters × four
   variants), plus the JS-ON leg's extension — `pdp-controls.browser.test.ts`
   already iterates `SURFACE_CONTROLS.pdp.variants`, so it extends itself.
3. **The publication pipeline's generalisation off its `editorial-`
   hardcoding.** Dropping a `pdp-*.json` receipt into
   `workers/front/lab/receipts/` today **fails the build loudly**:
   `build.mjs:274` gates on the filename prefix, and because `dist` is deleted
   before the throw and the Worker statically imports a file inside it, the
   Worker bundle dies with it. Must generalise: the filename→surface gate; the
   `labProfiles` map (keyed by profile alone, so it cannot hold two surfaces);
   the single hardcoded `/_pm/lab/editorial.json` output (ADR-0008 §3 specifies
   per-surface `/_pm/lab/{surface}.json`); the Worker's single static import;
   the `FIT` registry; home's and the methodology page's editorial-named
   markers; and `published-readings.test.ts` (editorial-only in five ways).
   Already generic: `bundleFromReceipt`, `SurfaceLabBundle`, the chrome
   renderer, `labFor`.
4. **Interaction registry + batches.** `INTERACTIONS` (`collect.ts:26`) holds
   only `none`, `body-click`, `editorial-add-to-cart`. `pdp-gallery-switch` and
   `pdp-add-to-cart` are PLANNED and **registered nowhere** — say "planned", not
   "registered". The interaction set must be identical across all four variants
   or the comparison is confounded. **Format switch is OUT** (ADR-0008 addendum
   A) — do not re-add it; `formats` is the composition of one release, not a
   menu.
5. **The live-origin demonstration is EXTERNALLY BLOCKED.** The edge Worker has
   no live route; arming it needs the Discogs token as a Worker secret
   (`~/.config/project-matrix/discogs-token`). **That leaves this machine and is
   Rob's to set — ask, do not do it unprompted.** The plaque IS compared by the
   drift gate (the fence excludes it from NUMBERS, not from the identity
   contract), so core PDP comparisons must NOT pass `dropFencedSubtrees`, and
   the fenced count on a PDP page is exactly 1.

Then the recorded surface order: **PLP** (the data axis — owns the Apollo fence
mechanism, the frames-partial generalization, the `{prime, measure}` registry
shape, and ADR-0003's CSS-delivery question), then **Checkout**, **a11y**, and
**"How it was built"** — whose arrival moves the methodology page from its
recorded interim home.

**Merge is Rob's call** (merging deploys; watch for the once-per-new-URL deploy
flake — three signatures so far: first-hit uncompressed, binding-propagation
chrome-count-0, and stale chrome on existing URLs. Probe the live plane healthy
FIRST, then `gh run rerun <id> --failed`).
