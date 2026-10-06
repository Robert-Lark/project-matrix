# repo-hygiene: the record's loose files (unit 10, 2026-10-05)

The unit's account is the build-log entry "The sweep that measured its own waste,
and the three calls that stayed Rob's (2026-10-05)" and the decision map's
`repo-hygiene` node (items 1 to 7) plus the lines under `domain-cutover`'s
sub-decision (e) (item 8). This directory holds what those cite and what a reader
would want to re-run or check.

- `eslint-timing-2026-10-05.md`: one-liner 1 measured in the main checkout before
  and after the worktree ignore: file counts and three timed runs each, raw output
  verbatim, medians derived.
- `lint-input-probe.mjs`: the mechanism behind one-liner 2. Appends one line to a
  file, reads turbo's `//#lint` hash before and after from its own dry run,
  restores the bytes, exits 0 when the hash moved and 1 when it did not (the
  stale-PASS state). `node docs/prototypes/repo-hygiene/lint-input-probe.mjs
  workers/front/lab/fit.d.mts` from the repo root.
- `sabotage.mjs`: the runner (unit 9's, re-rowed): one row per defect, fresh
  backups per row, restores verified by byte equality, `bash -c` guards, exit codes
  printed. `SCRATCH=<dir> node docs/prototypes/repo-hygiene/sabotage.mjs [rowId…]`
  from the repo root, on a tree with nothing else running.
- `sabotage-2026-10-05.md`: the table, with CONTROL rows, round by round.
- `suite-runs-2026-10-05.md`: every origin-suite run of the unit, as it happened,
  the hung one included.
- `worktree-inventory-2026-10-05.md`: item 7, the inventory presented to Rob
  (branch, how merged, porcelain, size) and his call: remove none, defer.
- `branch-protection-2026-10-05.md`: item 6, what was verified (404, `[]`,
  PUBLIC), the two incidents, the ruleset a yes would create (unrun), and his
  call: no, or defer.
- `discogs-tos-2026-10-05.md`: item 8, the Terms as fetched (URL, dates, hashes
  of the fetched copy), the clauses verbatim, what the plane serves, what each
  clause means as read, and his call: defer, no call yet.

The guard the unit adds is `tools/repo-checks/test/repo-hygiene.test.ts` (13 legs:
the eslint ignore live through a stdin probe with a control; eslint's own file list
inside turbo's resolved lint inputs; every variant `deploy` one deploy command with
the front Worker's exemption held live; every `uses:` a full SHA with its release
and every `runs-on:` a dated image). Numbers quoted in the records come from the
commands these files show, never from a tally by eye.
