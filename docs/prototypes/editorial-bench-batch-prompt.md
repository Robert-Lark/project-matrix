Build arc step 2: the FIRST EDITORIAL BENCH BATCH — the moment this site
starts publishing numbers. Work under the standing best-judgment
authorization: decide from the recorded decisions and roll forward without
pausing. Ultracode is ON for this unit by recorded calibration (it is
design-heavy). Read docs/prototypes/finish-line-handoff-prompt.md's
"## Progress log" FIRST (never redo what the world shows done),
docs/decision-map.md second, then the ADRs named below IN FULL before any
code.

── NORTH STAR (why this unit is the whole project's hinge) ──
The site is a live-benchmarking portfolio: one Discogs-powered store built
in several rendering paradigms, instrumented so a SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED. The thesis is fit, not a leaderboard —
misapplication is costly, correct application is huge. Until now the site
has been pure instrument: the chrome's reading table renders em-dashes and
says "No published runs yet. When a number lands here it carries its
receipt — or it doesn't land at all." THIS unit makes that sentence come
due. Every choice bends to: reproducible, receipt-backed, honestly framed.
A confident wrong number costs this project more than a missing one.

── STATE OF THE WORLD (verified 2026-08-12; re-verify, don't trust) ──
main = db626cb ("Land the remix3 fenced frontier exhibit", PR #22,
DEPLOYED — post-deploy smoke green after one rerun; that red was the
flake's THIRD signature: the smoke read the five EXISTING editorial URLs
while they still served pre-deploy chrome, so their switcher rows lacked
the new fenced anchor — any commit that changes the CHROME will likely hit
this again; remedy: probe the live plane first, then
`gh run rerun <id> --failed`). THE EDITORIAL BUILD IS CLOSED: all six
slices live (vanilla, react-next, astro, qwik, htmx + the fenced remix3
exhibit, which the bench runner structurally REFUSES — assertBenchableTarget
in runBatch, tested). The measurement ruler is FIXED and merged (issue #16,
d561677): inline bytes decomposed by uncompressed content share
(decomposeDocument), CPU summed over the serving path per visit
(LOCAL_PLANE_INSPECTORS complete, missing inspector = named hard error,
--local-cpu refused against remote origins), all settles signal-based
(in-page requestIdleCallback before the snapshot; the vitals beacon waits
for the expected metric SET). Local baselines: origin suite 324/324
fixture, 323/324 crate (the 1 miss is the git-ignored
9861004-primary.thumb.avif, pre-existing). Turbo 30/30.

── TASK 0 (reconcile the record before anything) ──
decision-map's editorial-build status still says slice F "merge is Rob's
call" — verify PR #22 merged + deployed, then update the status and Answer
to merged/deployed (the standing Task-0 pattern). Fold this docs edit into
this unit's commit.

── FIRST ACTIONS ──
1. git fetch origin --prune; fresh worktree off origin/main (branch name
   your call, e.g. editorial-bench-batch; .claude/worktrees/ convention).
   Copy the git-ignored tools/snapshot-capture/crate/img/ (1,817 files)
   from the main checkout or crate-mode runs can't seed.
2. pkill -9 workerd and sweep BOTH port ranges (8787–8797 AND inspector
   9230–9240) — orphaned workerd holds inspector ports too.
3. READ, in full, before designing: ADR-0001 (measurement methodology —
   ALL addenda; addendum F is the chrome-constant re-measure this unit
   must do FIRST, addenda G–J are the fixed ruler's method+limits,
   addendum C forbids verdicts when bands overlap); ADR-0007 (home — §4/§5
   for exactly which tense/verdict flips are publication-gated and the
   catalogue-row/decision-token design); ADR-0005 §6–§7 (published cells,
   fenced never a column); ADR-0008 (chrome anatomy; C2 = a lab value
   structurally cannot render without its receipt);
   packages/switcher/src/lab.ts (SurfaceLabBundle — the type the chrome
   already consumes: PublishedReading{value,unit,receipt{url,profile,date,
   commitSha,location}}, fit{sentence,receipt}, bandsOverlap;
   READING_METRICS; "the front build hands the bundle to renderChrome;
   nothing here fetches"); tools/bench-runner/* (runBatch, receipts,
   cli, cost calculator — `pnpm bench`, `pnpm cost from-receipt`).

── THE UNIT (what done means) ──
ADR-0001's promise, executed for the editorial surface:
- **Chrome-constant re-measure FIRST** (ADR-0001 addendum F names the
  duty; read it for the method — the chrome grew a sixth switcher entry
  and the fenced-exhibit note since it was last measured).
- **The batch**: all FIVE core editorial variants, one SHA, one run,
  median-of-N (~7–10, ADR-0001 §4), all three published profiles, cold and
  warm as separate columns, receipts minted by the existing runner. remix3
  and /blog/ stay out by mechanism.
- **Publication**: receipts + the per-surface lab bundle served from
  /_pm/lab/ (the roadmap's recorded shape); the front Worker's build embeds
  the bundle and passes `lab` to renderChrome — today that argument is
  simply never passed; C2 then does the rest. The reading table's em-dashes
  become receipt-linked numbers ONLY where a real run exists.
- **Fit lines per ADR-0001 addendum C**: bandsOverlap must render
  "Indistinguishable at this sample size" — no verdict where bands overlap.
  Verdicts are what receipts say, never planning-time hypothesis (the
  decision-map matrix table's villain/contender language is explicitly NOT
  publishable copy).
- **Methodology page** (ADR-0001 §9): plain-language, with the
  limits-of-data framing. Decide its home against the ADRs (the
  how-it-was-built surface is unbuilt — a minimal standalone page on the
  canonical plane may be the honest interim; record the call either way).
- **Home flips** (ADR-0007 §4): the publication-time tense/verdict flips
  deferred by the editorial build. Read the ADR for the exact list; rows
  update one at a time, copy stays verdict-free where receipts don't
  support a verdict.
- **Open judgment call this unit OWNS** (recorded at slice D): how the
  reading table frames qwik's eager 26.83 kB (resumability defers binding,
  not bytes). Ground truth to check any batch against (measured, composed
  origin, JS-on): vanilla 1.35 kB · astro 0 requests (~1.2 KB inline,
  now decomposed correctly) · qwik 26.83 kB/7 files · react-next
  145.05 kB; all fetch nothing on the click.
- **Open design question this unit must settle** (issue #16 residue): the
  post-deploy smoke runs a small bench batch, and a performance batch on a
  shared runner goes red for reasons that are not regressions (it already
  did once — a 30s goto timeout on a months-old page). Decide where the
  OFFICIAL batch runs (quiet local machine with receipts committed? a
  pinned runner? — ADR-0001 §9 imagined a pinned cloud runner +
  WebPageTest cross-check; scope honestly, record what is deferred) and
  keep perf assertions OUT of blocking gates.

── TRAPS THIS CHAIN HAS ALREADY PAID FOR (don't repay) ──
- OFFICIAL NUMBERS NEED A QUIET MACHINE: the crate plane + Playwright +
  a concurrent agent fleet produced a 37-failure goto-timeout storm (580s
  vs 65s wall-clock). One heavy job at a time; verify-slice runs while you
  probe INLINE, never while a batch measures.
- vitest runs suite files in parallel — sibling traffic inflates CPU
  samples; magnitude assertions belong to `pnpm bench` on a quiet plane
  only (the bench.browser.test.ts header says exactly this).
- Never `| tail` a background run's output — it destroyed a failure's
  diagnosis this chain needed (record the full log, grep after).
- Numbers from tools, never typed — and never write a count before its
  run finishes: this chain wrote "322/323 crate" pre-run and the run came
  back 37-failed. The record-not-code class survives review; verify-slice
  catches it every single slice. Citations must BE assertions: a
  "measured" claim whose cited test didn't exist was DISPROVEN the moment
  the citation was made real.
- Only run-local.mjs builds variants with the matching snapshot selector —
  never trust a hand-started plane for ID-sensitive checks (it serves
  whatever PM_SNAPSHOT the dists were last built with).
- Deployed-origin suite runs need PM_ORIGIN + PM_EXPECT_BROTLI=1 (+
  NODE_EXTRA_CA_CERTS on this machine).
- Receipts pin commit SHA + dirty flag: official batches run on a CLEAN
  checkout at the published SHA.
- "Wait for the real signal, never a proxy" (tools/drift-gate/README.md
  standing rule) — when a gate goes red and the page looks right by hand,
  suspect the WAIT, fix it by making it more precise, never by loosening
  the assertion.
- pnpm resolution changes need a node_modules WIPE to test —
  `pnpm install --force` lies.

── SESSION DISCIPLINE (standing) ──
One unit = this batch-and-publication. verify-slice workflow in the
background (args: issue/scratchDir/context/repoDir — repoDir MUST be the
worktree) while probing inline; refute findings inline before adopting;
re-run BOTH suite modes on the FINAL tree and only then write the numbers
into the record. One commit, explicit paths (never git add -A) — a second
commit is permitted ONLY when reviewability demands it (the NUL-detox and
slice-D cart-fix precedents), flagged to Rob. Push; CI is the second
check; MERGE IS ROB'S CALL (merging deploys — and this unit changes the
CHROME, so expect the stale-old-URL smoke signature on the merge deploy:
probe the live plane, then rerun --failed). Record as you go: decision-map
status, build-log section, a dated line in
docs/prototypes/finish-line-handoff-prompt.md's progress log (main
checkout — untracked), and the branch-state memory.

── DO NOT ──
No live Discogs calls. No remix3 or blog numbers anywhere (mechanism
already refuses; don't weaken it). No verdict copy the receipts don't
support — bands-overlap renders indistinguishable, planning-time
villain/contender framing never ships. No new primitive tokens, no
spec-layer redesign (masters, chrome anatomy, SURFACE_CONTROLS semantics
are ADR-0008's; a needed change is an ADR addendum question, not an
improvisation). No perf assertions in blocking CI gates. Nothing that
publishes a number without a receipt one click away — C2 is a type, keep
it one.

── AFTER THIS UNIT ──
The editorial column of the matrix is fully told: built six ways, measured
honestly, published with receipts. Next per the surface order of record:
the PDP build (the thesis flip — same React/Next, opposite verdict;
interactivity earns JS), which consumes this unit's publication pipeline
as-is. Roadmap artifact if needed:
https://claude.ai/code/artifact/53a5aa72-172a-4657-b985-7cb157e68d49
