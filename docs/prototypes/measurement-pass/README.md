# measurement-pass, PR-2: the record's loose files (unit 1, 2026-10-13)

The pass's account is the build-log entry "The receipts that earned their flags, and
the gate that could only land with them (2026-10-13)" and the decision map's
`measurement-pass` node (its PR-2 bullet). The runbook the pass followed is one
directory up, `measurement-pass-runbook-2026-09-01.md`, and the original unit prompt
beside it. This directory holds what the entry cites and what a reader would want to
re-run or check.

- `mint-2026-10-13.md`: every batch as it happened, in order, the refused one
  included: the plane's attestation before and after, the pre-warm output, the
  nonces, wall-clock per profile, the runner's done-checks (`jq` over each receipt),
  machine load, and Rob's caffeinate instruction at the point it was given.
- `sabotage.mjs`: the runner (unit 10's, re-rowed, plus an `add:` field for the two
  rows that file an evidence receipt into the published directory): one row per
  defect, fresh backups per row, restores verified by byte equality, `bash -c`
  guards, exit codes printed. `SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage.mjs [rowId…]`
  from the repo root, on a tree with nothing else running.
- `sabotage-2026-10-13.md`: the table, with CONTROL rows, round by round.
- `gate-bites-2026-10-13.txt`: the runbook's own proof, verbatim: the front build
  refusing the three 1c543ac receipts restored from git (stash), then passing on the
  re-minted six.
- `suite-runs-2026-10-13.md`: every origin-suite run of the pass, fixture and crate
  mode, as it happened.
- `verify-slice-2026-10-13.md`: the four lenses' findings, which were folded, which
  were refuted, and the verification pass over the folds.

The gate the pass adds is one refusal site in `workers/front/lab/publish.mjs`
(`no-quiescence-attestation`) with two rows in
`workers/front/test/fixtures/publish/generate.mjs`; the evidence receipts and their
README are in `workers/front/lab/unpublished/`. Numbers quoted in the records come
from the commands these files show, never from a tally by eye.

## PR-3: the chrome constant (2026-10-17)

The pass's last PR, recorded in the build-log entry "The constant that waited for its
plane, and the pin that left with it (2026-10-17)" and the resolved `measurement-pass`
node (its PR-3 bullet). Same directory, dated files:

- `constant-2026-10-17.md`: the probe as it ran against the deployed plane at the
  attested `770a6d8`, every run's values, the done-check, the identity gate's outcome
  (admitted, no local interim), the pin's removal and the wording correction, each with
  the command that produced the figure.
- `sabotage-constant.mjs`: the runner, re-rowed for this PR (the constant through the
  real front build under four defects and two stated-limit rows, the pin re-introduced
  and a hand-edited delta no gate reconciles with the runs; the marker map; the resolved node's cap and both pointer legs; the glyph rule
  over the staged record; the log's size ceiling; the masters' anchors).
  `SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage-constant.mjs [rowId…]`
  from the repo root, after `git add` of the new files, with nothing else running.
- `sabotage-2026-10-17.md`: the table, with CONTROL rows.
- `suite-runs-2026-10-17.md`: every origin-suite run of this PR, fixture and crate mode.
- `verify-slice-2026-10-17.md`: the lenses' findings, folds and refutations.

The published artifact is `workers/front/lab/chrome-constant.json`, served verbatim at
`/_pm/lab/chrome-constant.json`; the gate that admits it is `admitChromeConstant` in
`workers/front/lab/publish.mjs`, now without the `BOOTSTRAP_CONSTANT_COMMIT` exemption.

## Post-runbook unit 1: the constant's two stated limits (2026-11-01)

The unit that closed the two limits PR-3 stated, recorded in the build-log entry
"The gate the runs had been waiting for, and the visit the artifact never sees
(2026-11-01)" and the `measurement-pass` node's dated 2026-11-01 bullet. Same
directory, dated files:

- `limits-2026-11-01.md`: the gate as built (the rule it borrows from the runner,
  the four refusal sites, the fixture's run lists and why their shape is the real
  artifacts'), the committed constant reconciled by that rule with the command, the
  probe's warm-up visit, and the run-0 evidence across every artifact in the file's
  history, each figure with the command that produced it.
- `sabotage-limits.mjs`: the runner, re-rowed for this unit (PR-3's expected-miss
  row P6 as the first live row; the committed constant under four more edits; the
  gate's own guards, its median rule inverted to a mean included; the warm-up visit
  deleted as a stated limit no test can catch; the node's cap and pointer legs; the
  glyph rule; the raised log ceiling; the masters' anchors).
  `SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage-limits.mjs [rowId…]`
  from the repo root, after `git add` of the new files, with nothing else running.
- `sabotage-2026-11-01.md`: the table, with CONTROL rows.
- `suite-runs-2026-11-01.md`: every origin-suite run of this unit, fixture and crate mode.
- `verify-slice-2026-11-01.md`: the lenses' findings, folds and refutations.

The gate's four new sites are `cc-runs-count`, `cc-usable-samples`, `cc-delta-mismatch`
and `cc-stored-median` in `admitChromeConstant` (`workers/front/lab/publish.mjs`), with six rows in
`workers/front/test/fixtures/publish/generate.mjs`; the probe's warm-up visit sits
before the run loop in `tools/bench-runner/src/chrome-constant.ts`, and its sentence
is the seventh entry of the artifact's `method` array, before the scope sentence that
stays last.
