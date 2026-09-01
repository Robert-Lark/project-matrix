<!--
  Handoff prompt for the NEXT unit after editorial slice D: the
  bench-accounting-fix session (GitHub issue #16). Drafted 2026-07-26 by the
  slice-D session. Paste the fenced block into a fresh session.
-->

```
Continue work on Project Matrix (a live-benchmarking portfolio: one
Discogs-powered vinyl store built across several rendering paradigms,
instrumented to show real perf/UX/infra-cost tradeoffs — docs/decision-map.md
is the state of record, docs/adr/ is the rationale of record and wins every
conflict, docs/build-log.md is the narrative, CONTEXT.md owns the vocabulary).

North star. The project's value is credibility, not cleverness. Every published
number must be defensible to a hostile reader: identical DOM across paradigms,
one measurement ruler, dated snapshots, receipts attached to every figure, and
a refusal to state a verdict when the bands overlap. A variant that looks good
because the harness can't see its cost is worse than no variant. When in doubt,
choose the option that makes the comparison harder to fake.

── YOUR UNIT: bench-accounting-fix (GitHub issue #16) ──

This is THE unit now, by Rob's explicit call (2026-07-24): document the
measurement defects well and fix them at the right time, not at the end. It
HARD-BLOCKS the first editorial bench batch, and it runs BEFORE editorial
slices E (htmx) and F (remix3). Do not start a variant build instead.

Read first, in this order:
  1. docs/prototypes/finish-line-handoff-prompt.md — the running progress log,
     more current than this file. Read its LAST entries.
  2. docs/decision-map.md, the `bench-accounting-fix` ticket — it restates all
     FOUR defects in full ("artifacts are the memory"), including one added by
     slice D.
  3. GitHub issue #16.
  4. variants/qwik/DIFF-TO-STARTER.md point 12 + its "measured framework
     behaviours" section, and variants/astro/DIFF-TO-STARTER.md point 4.
  5. ADR-0001 (the measurement ruler; §3 is the KB accounting, §6 the
     strip-by-known-path rule) and ADR-0003 §2 (CSS its native way).

── STATE OF THE WORLD AS OF 2026-07-26 (verify it anyway) ──
main = `f3e1bef`; slice D merged as `c71ce1a` + `f3e1bef` via PR #18
(`gh pr merge --rebase`). `/qwik/editorial/` is LIVE on the deployed plane and
was verified directly, not assumed: `<html lang="en">`, chrome injected exactly
once, `data-pm-variant="qwik"`, the CRATE essay served with no fixture leakage,
`q:base="/qwik/build/"`, and `content-encoding: br`. Four of five editorial
variants now serve (htmx is slice E; remix3 is slice F).

That merge's deploy job FAILED TWICE, with TWO DIFFERENT failures, and the
follow-up commit `b08b662` ("Wait for image decode before the pixel shot") is
what fixed the second. Both are worth knowing before you touch the harness:

  (a) A 30s `page.goto` TIMEOUT in `bench.browser.test.ts` against
      `/placeholder-static/sample/` — a months-old page, nothing to do with the
      slice — while 218 assertions passed; the same URL served in 0.22s from a
      workstation immediately after. Has NOT recurred, so nothing was changed
      for it. **It is a live design question for YOUR unit:** a post-deploy gate
      that runs a performance batch will periodically go red for reasons that
      are not regressions, and that currently blocks main. Decide deliberately
      whether the bench leg belongs in the deploy gate.

  (b) `pixels-slow-4g-mid-phone-vanilla-editorial`: 421,656 differing pixels at
      identical dimensions. Root cause: `settleImages` waited for
      `img.complete` (bytes arrived) and `captureStablePixels` waits for FONTS
      then screenshots — nothing waited for a frame to be DECODED, and the
      article figure carries `decoding="async"`, which permits painting before
      decode. Fixed with `img.decode()`, the real paintable signal. Measured:
      decode still needed 1.3-2.3 ms per image AFTER `complete` on a fast
      workstation; unbounded on a loaded runner.
      A WRONG first diagnosis is recorded in that commit because you will reach
      for it too: it is NOT the mobile profile's throttling —
      `profileContextOptions` (tools/drift-gate/src/gate.ts) applies only the
      VIEWPORT axis and runs JS-off.

If a deploy fails on you: probe the live origin directly with a browser UA and
DOWNLOAD THE `smoke-dev-logs` ARTIFACT (it carries the actual/expected/diff
screenshots) BEFORE concluding anything. Do not rerun twice hoping — two
different failures means two different causes. And never buy green by loosening
a zero-tolerance assertion.

**Read `tools/drift-gate/README.md`'s new "Settling: wait for the real signal,
never a proxy" section before changing any wait in the harness.** Your defect 4
is the third instance of that exact pattern — a network-quiet heuristic standing
in for "idle work finished" — so the rule is already written for you.

── FIRST ACTIONS ──
git fetch origin --prune; git log --oneline -5 origin/main;
gh run list --branch main --limit 3. Confirm main is green INCLUDING the
deploy job (it is a separate job and has failed while the live origin was
healthy — check its own conclusion, and curl the deployed origin with a
browser UA if unsure: workers.dev edge 1010-blocks python-urllib).
Then branch fresh from origin/main in a NEW worktree (several stale ones
exist; do not reuse a merged branch — after a --rebase PR merge the remote
branch keeps its pre-rebase SHA and a plain push is rejected).
pnpm install, then pnpm exec turbo run lint typecheck test — expect 28/28 —
so you know green-before is real.

── THE FOUR DEFECTS (all four must be resolved before any bench publishes) ──

1. INLINE JS IS INVISIBLE TO THE KB ACCOUNTING. Needs an ADR-0001 §3 addendum.
   tools/bench-runner/src/collect.ts derives buckets.js / initialJsBytes from
   resource-timing entries classified by URL EXTENSION, so an inline <script>
   contributes zero and its bytes are absorbed into buckets.html. Astro inlines
   its cart bundle (1,247 B), so the render axis would publish "astro: 0 KB
   initial JS" against vanilla — the NO-RUNTIME control — at ~1 KB, for the
   byte-identical enhancement, on the surface whose whole thesis is how much
   machinery prose needs. Also discontinuous: past Vite's inline threshold the
   number jumps with no change in the paradigm. The fix is in the HARNESS
   (count inline script bytes as JS, stop counting them as HTML) and must
   settle DOUBLE-COUNTING. Rigging the variant (assetsInlineLimit: 0) was
   already considered and rejected — it invents a request the paradigm would
   not make.

2. LOCAL CPU ATTRIBUTION OMITS EVERY REAL VARIANT. cpu.ts's
   LOCAL_PLANE_INSPECTORS lists only pm-front 9230, pm-placeholder-static 9231,
   pm-placeholder-ssr 9232, pm-edge 9233. Missing: pm-vanilla 9235,
   pm-react-next 9236, pm-astro 9237, pm-qwik 9238. So a LOCAL bench attributes
   ZERO CPU to whichever Worker served the page, while the placeholders it is
   compared against ARE sampled. NOT a one-line fix: CdpConnection.open throws
   on an absent inspector, so the port list and its failure tolerance must be
   decided together (hard error vs recorded gap). pm-blog (8791/9234) stays
   OUT — ADR-0009 puts it outside every measurement fence.

3. "CSS ITS NATIVE WAY" IS NOMINAL. Needs an ADR-0003 §2 addendum. All FOUR
   editorial variants ship the shared component/surface stylesheets as raw
   verbatim copies, so their CSS cells are byte-identical by construction and
   Astro's, Next's and Vite's bundling pipelines all appear to buy nothing. §8
   forces this for the FONT files and fonts.css ONLY; the other eight sheets
   are raw by CHOICE, for cross-variant comparability. Whether each variant
   should deliver them its own way — and how the byte-identity assertions adapt
   if so — is a cross-variant question, which is why no slice decided it.

4. QWIK'S POST-LOAD IDLE WINDOW MAKES THE BYTE BOUNDARY NON-DETERMINISTIC
   (added by slice D). Qwik is the only live variant that fetches anything
   after the `load` event: its preloader runs inside
   requestIdleCallback(…, {timeout: 2000}). collect.ts snapshots initialEntries
   after waitForLoadState("networkidle") (500 ms of quiet) and computes
   interactionBytes as a POSITIONAL slice past that snapshot's length — so
   under the bench's own CPU-throttled profiles, or on a loaded runner, the
   idle callback can be starved past networkidle and the SAME page/build yields
   two different receipts: initialJsBytes under-reporting qwik's load cost
   while interactionBytes over-reports the cost of one localStorage write, with
   nothing failing. The fix that removes the CLASS rather than this instance:
   await an in-page requestIdleCallback before the initialEntries snapshot —
   the same trick collect.ts already uses (~:233-242) for the INP flush — so
   any framework's post-load idle work lands on the load side by construction.

── GROUND TRUTH TO CHECK YOUR FIX AGAINST ──

Slice D measured every live variant's eager JS at load through the composed
origin, with JS on, from resource timing (the same API collect.ts reads),
after letting post-load idle work land. Your fixed harness should reproduce
these, and defect 1 is why it currently cannot:

  variant     | JS/JSON requests at load | encoded   | decoded   | on click
  vanilla     | 1                        | 1.35 kB   | 2.80 kB   | nothing
  astro       | 0 (bundle INLINED)       | 0         | 0         | nothing
  qwik        | 7                        | 26.83 kB  | 62.16 kB  | nothing
  react-next  | 7                        | 145.05 kB | 509.42 kB | nothing

Three genuinely different delivery shapes is exactly why this unit was
scheduled here: vanilla = one external file, astro = inlined, qwik = many
external files. If your fix only handles one shape it is not done. Note astro's
0 is the defect reproducing independently, and note that NO variant fetches
anything on the click — so a receipt showing interaction bytes for editorial is
a symptom of defect 4, not a finding.

── WHAT THIS UNIT IS NOT ──
No variant changes to make numbers nicer (that is rigging — the north star).
No bench PUBLICATION: this unit fixes the ruler; the first batch, the lab
bundles at /_pm/lab/{surface}.json, the methodology page and the home tense
flips are the NEXT arc step. No new surfaces. No spec-layer redesign.

── STANDING DISCIPLINE (carried forward; apply all of it) ──
- Verify library/tool behaviour against installed source and official docs,
  never training recall. Slice D found: qwik-city declares its own framework
  dependency nowhere, and a starter's assets binding name disagreed with its
  own middleware. Read the source.
- Run the saved verify-slice workflow in the background while probing inline in
  the foreground: Workflow({name:"verify-slice", args:{issue, scratchDir,
  context, repoDir}}) — args are JSON, not a string; `issue` may be a
  non-numeric ticket name; repoDir is your worktree. Four sequential lenses,
  ~2h wall clock. On slice D it returned 20 findings and FOURTEEN were false or
  unqualified claims in that session's own comments and receipt — the class
  that survives review and then gets quoted into a published number. Expect the
  same of yourself. Adopt or refute every finding AGAINST SOURCE, never on
  authority, and prove new assertions non-vacuous BY SABOTAGE. If a lens
  stalls, resume with resumeFromRunId + byte-identical args (completed lenses
  replay from cache); if it dies twice, hand-walk the remaining lenses inline.
- Prove locally in BOTH snapshot modes before committing: default (fixture) and
  PM_SEED_DIR=tools/snapshot-capture/crate. Expect the full origin suite green
  in each (254/254 as of slice D).
- FRESH WORKTREE GOTCHA: tools/snapshot-capture/crate/img/ is git-ignored, so
  the crate-mode run fails to seed until you copy it in from another checkout
  (~3.6k files).
- HARNESS TRAP that cost slice D two wrong conclusions: an ad-hoc composition
  bring-up (anything but tools/origin-suite/run-local.mjs) serves whatever
  PM_SNAPSHOT each variant's dist was LAST built with, so vanilla/astro can be
  crate-baked against a fixture-seeded plane and their featured IDs disagree
  with the suite's — making a CORRECT test look broken. Only run-local.mjs
  builds every variant with the matching selector.
- PNPM TRAP: to sabotage-test a resolution change you must WIPE node_modules.
  `pnpm install --force` keeps the previously-resolved symlink and will tell you
  a load-bearing packageExtensions entry is dead config. (It told slice D that
  twice.)
- If a test fails only in CI, do not assume flakiness and do not loosen the
  assertion. Root-cause it. Known real classes: fresh-clone failures (a
  typecheck importing generated build output — declare a build dependency AND
  the generated file as a build output); generated framework output picked up by
  root `eslint .`; turbo cache-restore incompleteness (declare EVERY build
  product, not just the obvious directory); cold-cache compression on a
  brand-new deployed URL (hardened in wireEncoding, bounded, deployed-only);
  and hydration/timing races invisible on a fast machine (reproduce with
  Playwright + Emulation.setCPUThrottlingRate: 4).
- After any push to main, explicitly check the DEPLOY job's OWN conclusion.
  Green check+origin are NOT sufficient. For the origin suite against the
  deployed plane the corp proxy needs NODE_EXTRA_CA_CERTS (export the
  "Gateway CA - Cloudflare Managed" root from the System keychain).
- One commit per concern, explicit paths, NEVER `git add -A` (Rob drafts files
  in-tree in parallel). Update docs/build-log.md, docs/decision-map.md,
  docs/prototypes/finish-line-handoff-prompt.md (in the MAIN checkout,
  untracked) and memory.
- Merging is Rob's call. Push, report CI green, wait. When he says merge: open a
  PR and `gh pr merge --rebase` (keeps main linear, respects git.md). GitHub's
  rebase mints a new SHA, so verify `git diff <local> origin/main` is empty,
  then `git reset --hard origin/main`.
- Model: strongest available (Opus 5) at high effort — Rob's standing call;
  there is no deadline, so do not drop to a cheaper model to save budget.
- Long-running processes (dev servers, suites, verify-slice) ALWAYS in the
  background. Reap orphaned workerd/wrangler when done: run-local.mjs only
  cleans up its own run's children, and `pkill -f "wrangler dev"` misses the
  inner process — kill by port or `pkill -9 workerd`.

── ONE OPEN JUDGMENT CALL, NOT YOURS TO SETTLE ALONE ──
Slice D's measured result is that on the editorial surface Qwik's "no JS until
interaction" claim does not hold — because OUR cart contract requires a
load-time storage read (so the cart survives a variant swap), that read is a
QRL, and resolving any QRL pulls the framework core. Qwik still fetches ~5.4x
less than react-next. The reading table must NOT present 26.83 kB as a verdict
on resumability; the honest framing is a property of this contract on this
surface, and the product-page build (where qwik is already planned, and where
many interactive components exist) is where the paradigm gets a fair test.
Rob is aware; the wording decision belongs to the publication arc, not to this
unit. Do not quietly resolve it in a chart.

For the full shape of everything after this: the artifact "The Remaining
Pressings" ⧉ https://claude.ai/code/artifact/53a5aa72-172a-4657-b985-7cb157e68d49
```
