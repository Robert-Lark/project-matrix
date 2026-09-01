<!--
  Handoff prompt: editorial-build slice F — the remix3 fenced frontier
  exhibit. Drafted 2026-08-11 by the slice-E session at Rob's request.
  Paste the fenced block into a fresh session. The decision map + the
  finish-line progress log carry the state (artifacts are the memory).
-->

```
Build editorial-build SLICE F: the Remix 3 fenced frontier exhibit —
/remix3/editorial/ on the canonical plane, excluded from every benchmark
number. Work under the standing best-judgment authorization: decide from
the recorded decisions and roll forward without pausing. Read
docs/prototypes/finish-line-handoff-prompt.md's "## Progress log" FIRST
(never redo what the world shows done), docs/decision-map.md second.

── STATE OF THE WORLD (verified 2026-08-11; re-verify, don't trust) ──
main = a0cf7ab ("Land the htmx editorial variant (slice E)", PR #21,
DEPLOYED — post-deploy smoke green after one rerun; the red was the
known propagation race: the drift leg found chrome count 0 on the new
URL while the fresh HTMX binding propagated. That class will hit slice F
once too — remedy: probe the live plane first, then
`gh run rerun <id> --failed`). The editorial surface is COMPLETE and
LIVE across all five core paradigms (vanilla, react-next, astro, qwik,
htmx); SURFACE_CONTROLS.editorial.plannedVariants is GONE; home's
editorial row reads "Public today". The bench ruler (issue #16) is
merged. Slice F is the LAST editorial column and it always runs ALONE.

── FIRST ACTIONS ──
1. git fetch origin --prune; fresh worktree off origin/main (branch
   slice-f-remix3; the .claude/worktrees/ convention). Copy the
   git-ignored tools/snapshot-capture/crate/img/ (1,817 files) from the
   main checkout or crate-mode runs can't seed.
2. RE-VERIFY THE BETA PIN before any code: 3.0.0-beta.5 was newest as of
   2026-07-11 and the project moves in 1–4-week betas. Check npm's
   `next` tag + GitHub tags; the spike's test.sh
   (docs/prototypes/remix3-frontier/, runnable per its README) is the
   canary on ANY bump. Exact-pin via the committed lockfile (the
   metapackage carets its sub-packages — the lockfile is the real pin).

── THE SPEC OF RECORD ──
ISSUE F in docs/prds/editorial-build-issues.md + the "Slice F
additionally owes" section of docs/prds/editorial-build.md are the
complete duties. Rationale: docs/prototypes/remix3-frontier/FINDINGS.md
(54/54 claims verified 2026-07-11), ADR-0004 second addendum (hosting =
hand-rolled Workers entry on the canonical plane), ADR-0003 first
addendum (advisory drift for a weekly-cadence beta), ADR-0008 (masters
are the contract; packages/reference/surfaces/editorial/). Headlines:
- variants/remix3: hand-rolled Workers entry (~15 lines, spike prior
  art; workerd needs a stable clientEntry() id — import.meta is empty
  there — and client assets must be PREBUILT with esbuild, the
  template's runtime asset server is Node-only). Request-time: binds
  pm-edge itself (the slice-B/D/E precedent).
- THREE-LAYER LABELING, FINDINGS §7(c) exactly: (1) on-surface plaque —
  data-pm-fenced="true", the exact version string, "excluded from every
  benchmark number" (final copy is this slice's job; CONTEXT.md: a
  plaque states a boundary, never alarms); (2) chrome — extend
  SurfaceControls with a fenced-exhibit entry (the ONE chrome touch;
  never a reading-table column — ADR-0005 §7), switcher shows a
  pre-release tag, HUD RUM-only; (3) receipts — the bench runner REFUSES
  a remix3 variant id, as MECHANISM with a test, not policy.
- Drift gate ADVISORY: warns, never fails CI — the suite must encode the
  distinction, not skip the check. Register FINDINGS §7(b) noise
  (rmx:f/rmx:h comments, #rmx-data, <style data-rmx>, rmxc-* classes) +
  rmx-target/rmx-src mechanism attrs IF they appear in served DOM
  (behaviorAttrPatterns — slice A's class; noise-class-discipline guard
  will hold you to it).
- Drift-normalizer extension, SCOPED: drop [data-pm-fenced] subtrees
  ONLY in the fenced variant's own comparison (an unconditional drop
  would let any core variant hide drift by marking it fenced); origin
  suite asserts core-variant editorial pages carry NO [data-pm-fenced]
  element. Green-by-default so an advisory warning means REAL drift.
- FINDINGS §8 hand-offs, not inheritable silently: prefix-mounting at
  /remix3/editorial/ (route mapping, frame src/rmx-src, anchor hrefs,
  asset URLs — "this exhibit's largest unexercised seam") + committed
  browser coverage of the §5 behaviors (frame reload, run() anchor
  interception, history) — test.sh covers only the HTTP side.
- The page still serves the CANONICAL editorial markup + the cart
  contract (packages/reference/render/shell.mjs CART_CONTRACT) — the
  fence excludes NUMBERS, not visual identity (FINDINGS §4). The plaque
  is the one element-level addition, handled by the scoped drop.

── WIRING (the slice-E shapes to copy) ──
Ports: 8797/9240 are next (run-local.mjs PORTS + spawn + waitFor).
Front Worker: REMIX3 binding + VARIANTS entry. CI: deploy @pm/remix3
with the request-time group behind pm-edge. LOCAL_PLANE_INSPECTORS:
DECIDE deliberately — the bench runner refuses /remix3/*, so no measured
serving path ever includes pm-remix3; the blog precedent (deliberately
OUT of the inspector list, outside every fence) likely applies, but
record the call either way. DIFF-TO-STARTER.md: the hand-rolled entry is
starterless-adjacent — record the spike as prior art and every deviation.
Identity guard: byte-strict in repo-checks if the renderer is plain
template literals (vanilla/htmx mechanism); the plaque means the guard
needs the same scoped [data-pm-fenced] strip the normalizer gets.

── TRAPS THIS CHAIN HAS ALREADY PAID FOR (don't repay) ──
- Orphaned workerd holds INSPECTOR ports (9230–9240), not just HTTP
  ports: pkill -9 workerd and sweep BOTH ranges before run-local.
- Local crate-mode = 290/291: the 1 miss is the git-ignored
  9861004-primary.thumb.avif, pre-existing, unrelated. Fixture = 291/291
  before your changes; both counts recorded in build-log.
- Only run-local.mjs builds variants with the matching snapshot
  selector — never trust a hand-started plane for ID-sensitive checks.
- hoist:false isolation: any framework package with undeclared peer
  deps needs packageExtensions (qwik precedent); to TEST a resolution
  change, WIPE node_modules — `pnpm install --force` lies.
- "Wait for the real signal, never a proxy" (drift-gate README standing
  rule) — and derive test non-vacuity from elements the gate COMPARES,
  not the raw page.
- Every number in any artifact comes from a tool, never typed; all four
  verify-slice lenses caught slice E's receipt misdescribing its own
  script order — the record-not-code class is the one that survives.

── SESSION DISCIPLINE (standing) ──
One unit = this slice. verify-slice workflow in the background (args:
issue/scratchDir/context/repoDir — repoDir MUST be the worktree) while
probing inline; refute findings inline before adopting; re-run both
suite modes on the FINAL tree. One commit, explicit paths (never
git add -A), push branch slice-f-remix3; CI is the second check; MERGE
IS ROB'S CALL (merging deploys). Record as you go: decision-map status,
build-log Phase 8 section, a dated line in
docs/prototypes/finish-line-handoff-prompt.md's progress log (main
checkout — the file is untracked), and the branch-state memory.

── DO NOT ──
No spec-layer redesign; no reading-table column for remix3, ever; no
live Discogs calls; nothing that lets remix3 fail core CI (advisory
means advisory — prove it can't block); no bench publication (that is
the NEXT arc step, and it needs the chrome-constant re-measure first,
ADR-0001 addendum F).

── AFTER THIS SLICE ──
The editorial build is fully closed. Next: the first editorial bench
batch (arc step 2 — median-of-N, three profiles, one SHA, receipts to
/_pm/lab/, methodology page, home tense flips) — a design-heavy unit
that warrants full ultracode effort per the recorded calibration.
Roadmap artifact if needed:
https://claude.ai/code/artifact/53a5aa72-172a-4657-b985-7cb157e68d49
```
