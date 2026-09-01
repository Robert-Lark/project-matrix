# Next units: crate derivatives, then the publication pipeline

Read this whole file before acting. Caffeinate the machine for the duration.
You operate under Rob's standing best-judgment authorization: decide technical
questions yourself per the ADRs, roll through the chain without pausing, and
stop only for the gates named below (push/PR/merge, and anything that leaves
the machine).

## The project and the north star

project-matrix is a public benchmark plane: the same catalog surfaces built
in competing frontend paradigms (vanilla build-time, react-next, astro, qwik,
plus placeholders), served through ONE composed origin (a front Worker
dispatches by first path segment and injects the switcher/HUD chrome), with
published byte and timing measurements. The north star is ADR-0001 §9: every
published number must survive a hostile reader — tool-derived, receipt-backed,
reproducible, with stated limits instead of silent gaps. The overarching goal
is an honest paradigm comparison that carries the frontend architecture
argument (cache-first, SSR-at-the-edge, HTML-first, islands over hydration)
on evidence rather than taste. When a guard can pass vacuously, it is not a
guard; when a number cannot be re-derived, it is not a measurement. Rigging
in EITHER direction — flattering or punishing a paradigm — is the failure
mode the whole repo is built to prevent.

Authoritative context, in reading order: `docs/decision-map.md` (the ticket
ledger — read the `pdp-build` ticket end to end), `docs/build-log.md` Phase 14
(how the last unit was built and what it adopted), ADR-0001 and its addenda
(P/Q provenance, the receipts discipline), ADR-0008 + addenda (the PDP spec
layer). The progress log lives at the bottom of
`docs/prototypes/finish-line-handoff-prompt.md` (untracked, MAIN checkout).

## Where the last unit left off (2026-08-27)

PR #30 merged to main as `607b66c` — a MERGE COMMIT, deliberately not
squashed: the records pin `6daa15d` (the astro slice) as the reproduction
point for the qwik chunk-freeze proof's PRE state. All four PDP variants
serve `/{variant}/pdp/{slug}/`; `SURFACE_CONTROLS.pdp` has no
`plannedVariants`; the serving floor is registry-driven over a measured
`PDP_SERVING` table. Numbers at merge: turbo `check` 30/30; fixture origin
suite 468 passed / 0 failed / 24 environment-gated skips (492 total — the
skips are blog-credential, published-readings, and bench REMOTE gates, all
standing). The merge triggered a deploy: **verify it early** — post-deploy
smoke is the same suite with
`PM_ORIGIN=https://pm-front.robresearch87.workers.dev PM_EXPECT_BROTLI=1`.

Editorial byte cells are PUBLISHED and PINNED at their measurement SHAs.
PDP bytes are NOT published — that is what these units unblock. Explicitly
out of scope for both units below: interaction registry entries and PDP
batches (the unit after), and the live-origin demonstration (blocked on Rob
setting the Worker secret).

## Unit 1 — regenerate the crate's missing derivative class

The frozen crate capture (`tools/snapshot-capture/crate/`) predates the
`.thumb.avif` derivative class that pdp-build introduced for the PDP
gallery: its `img/` holds **0 thumbs out of 1,817 avif files**, where the
fixture (`tools/snapshot-fixture/snapshot/img/`) holds 29 of 58, minted when
it was regenerated. Consequence, measured 2026-08-27: the crate-mode suite
runs **447/492 with 21 failures of this ONE cause** — the data-plane sample
404 on `9861004-primary.thumb.avif` plus 20 PDP pixel legs failing their
broken-image fail-closed guard (the one-image master's legs pass, being the
only PDP page with no thumb list — the mechanism confirmed from inside the
failure set).

The unit: mint the missing thumbs the same way the fixture's were minted.
Find that path in the capture tooling first (`tools/snapshot-capture` — the
derivative step, sharp-based) and reuse it; do not invent a second thumb
recipe, or the two snapshots stop being comparable. Constraints:

- **Add-only.** The capture is frozen and provenance-managed. Hash every
  existing file before and after (`shasum` the directory) and prove zero
  mutations; only new `*.thumb.avif` files may appear.
- **With a receipt.** Record what tool, what settings, what commit minted
  them — a quiet 900-file drop into a frozen directory is exactly what this
  repo's discipline forbids, and is why the last unit recorded the baseline
  instead of "fixing" it inline.
- Note the crate `img/` dir is large and lives in the MAIN checkout;
  worktrees see it through an untracked symlink
  (`tools/snapshot-capture/crate/img`) — NEVER stage that symlink.

Definition of done: crate-mode suite reaches fixture parity — 468 passed /
24 env-gated skips / 0 failed (`PM_SEED_DIR=tools/snapshot-capture/crate
node tools/origin-suite/run-local.mjs` with `PM_HOLD=1`, then `PM_HELD=1
pnpm exec vitest run` from `tools/origin-suite`); the fixture suite still
passes untouched; the widened-baseline records are UPDATED (the decision-map
`pdp-build` ticket paragraph and the handoff log both record 21-failures-
as-baseline — supersede, don't delete, per the record discipline). Own
branch, own commit, own verify-slice run.

## Unit 2 — generalise the publication pipeline off `editorial-`

The publication pipeline is hardcoded to `editorial-` filenames — the gate
that stops PDP byte cells from publishing. Scope the exact shape from the
code and the record, not from this file: grep the pipeline tooling for
`editorial-`, and read the decision-map's `pdp-build` ticket plus the ruler
ticket (Phase 13 "the ruler stops flattering the house") for what the
byte-headline block requires — the record, not memory, is authoritative on
whether the ruler conditions are fully discharged. Read
`tools/origin-suite/suite/published-readings.test.ts` for the publication
contract the pipeline must keep satisfying.

Definition of done: the pipeline handles surfaces generically (editorial
AND pdp, extensible to the next surface) with the special-casing gone;
every published EDITORIAL cell is byte-unchanged (the pinned-cells rule —
prove it, don't assert it: the published-readings legs and the receipts must
come through untouched); new pipeline behavior is guard-covered and every
new guard is SABOTAGE-PROVEN (break the thing it guards, watch it fail,
restore); records updated. This unit generalises the pipeline — whether any
PDP publication RUNS inside it is the decision-map's call: if the record
says batches belong to the interaction-registry unit, leave them there.

## Standing disciplines (non-negotiable, all learned the hard way)

- **Verify every slice** with the saved `verify-slice` workflow (sequential
  lenses, findings streamed to disk). A dead lens's empty findings is a DEAD
  RUN, never a clean pass — the journal distinguishes them. Resume needs
  byte-identical args; keep durable resume notes in the home session dir,
  NOT the scratchpad (a tmp cleaner purged mid-unit state once already).
  Never run the origin suite while a lens is working (contention once failed
  62 tests). Triage every finding against source before adopting; refute
  with evidence, never with agreement.
- **Sabotage-prove every new guard.** Green is not proof. In the last unit,
  sabotage-proving an adopted fix caught a bug in the fix itself (a `\b`
  that never matches behind the state script's U+0002-escaped QRLs).
- **One commit per slice**; subject <50 chars imperative, body wrapped at
  72, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, no
  Jira ID. Stage explicit paths — never `git add -A`, never the crate img
  symlink. Branch stays UNPUSHED; push/PR/merge only on Rob's explicit word.
- **Re-stamp `node workers/front/stamp-build.mjs` after ANY commit** — the
  provenance gate (ADR-0001 P/Q) refuses bench legs when HEAD outruns the
  plane's stamped attestation. It fired three times last unit.
- **Numbers are tool-derived at commit time** (`grep -c`, `wc -l`, vitest
  summaries) — never recalled, never estimated.
- **Records are part of the slice, in the same commit**: a `docs/build-log.md`
  section under the current phase, the decision-map ticket paragraph, a
  handoff-log line in MAIN `docs/prototypes/finish-line-handoff-prompt.md`
  (untracked — append, don't commit), and the branch-state memory. Record
  failures and detours honestly — the log's value is that it argues.

## Environment notes that will save you hours

- Work in a fresh worktree off `main` (`.claude/worktrees/<unit>`); run
  everything from absolute paths (pnpm resets cwd in worktrees).
- Local plane: `PM_HOLD=1 node tools/origin-suite/run-local.mjs` (add
  `PM_SEED_DIR=tools/snapshot-capture/crate` for crate mode). Probe
  `127.0.0.1:8787`, never `localhost` (measured transport difference). Suite:
  `PM_HELD=1 pnpm exec vitest run` from `tools/origin-suite`. A held plane
  WEDGES after ~6 h (connections hang, no refusal) — `pkill -f wrangler;
  pkill -f workerd; pkill -f run-local` and restart is the whole cure.
- vitest 4: no `--reporter=basic` (it tries to load a custom module). Never
  pipe a background command through `tail` — you lose the failure detail
  and only learn the exit code.
- Docker on this machine runs out of disk; npm scripts run against host
  `node_modules`. Prototype dirs need their local `.npmrc` or installs 401.
- Do not edit files while a turbo run is hashing the tree — a mid-run edit
  produced a transient task failure last unit.

When both units are done: full fixture suite + crate suite + turbo numbers,
all records, and the summary to Rob. Merge remains Rob's call — present the
branch, don't push it.
