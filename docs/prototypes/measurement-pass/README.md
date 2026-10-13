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
