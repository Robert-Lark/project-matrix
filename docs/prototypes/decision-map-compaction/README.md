# decision-map-compaction — the record's loose files (unit 9, 2026-09-25)

The unit's account is the build-log entry "The map that had become the
record, and the guard its own header asked for" and the decision map's own
header (third paragraph — this unit has no node; the header is its record).
This directory holds what those cite and what a reader would want to re-run.

- `node-bytes.mjs` — the per-node byte table: a node is its `### ` heading
  line through the line before the next `### `, UTF-8 bytes (the span the
  repo-checks leg measures). `node docs/prototypes/decision-map-compaction/node-bytes.mjs docs/decision-map.md`.
- `node-bytes-table.mjs` → `node-bytes-2026-09-25.md` — that table for the map
  at `7a3f568` (main after unit 8's completing commit, `git show`) and for the
  map on disk, with the totals the entry
  and the cap derivation quote. The markdown is WRITTEN by the script, never
  edited by hand: `node docs/prototypes/decision-map-compaction/node-bytes-table.mjs`
  rewrites it (the conformance lens caught the first copy 18 B stale).
- `prove-provenance.mjs` — the whole-file proof that the compaction lost
  nothing and invented nothing: every non-blank line removed from the map
  is in `docs/build-log.md` verbatim, and every line added is a header line,
  a `Status:` line or a sentence-aligned substring of a removed line.
  `node docs/prototypes/decision-map-compaction/prove-provenance.mjs <(git show 7a3f568:docs/decision-map.md) docs/decision-map.md docs/build-log.md`
  (`7a3f568` is main after unit 8's completing commit, the base this branch was
  rebased onto; the unit branched at `f66d464`, where the map was 253,385 B)
  — exit 0 with `removedNotInLog: 0` and `addedUnexplained: 0` is the claim.
- `sabotage.mjs` — the runner: unit 8's, re-rowed. One row per defect,
  fresh backups per row, restores verified by byte equality, `bash -c`
  guards, exit codes printed; the narrative a row pastes back into a node is
  read out of the log's own "narrative moved" sub-entry.
  `SCRATCH=<dir> node docs/prototypes/decision-map-compaction/sabotage.mjs [rowId…]`
  from the repo root, on a tree with nothing else running.
- `sabotage-2026-09-25.md` — the table, with CONTROL rows and the one row
  whose MISSED verdict was stated before it ran.
- `suite-runs-2026-09-25.md` — every origin-suite run of the unit, as it
  happened.
- `ceiling-2026-09-26.txt`, `ceiling-2026-09-26-L8647.jpg` — the re-observation
  of GitHub's code view honouring `?plain=1#L<n>` on the build log at its new
  size (723,812 B at the pushed commit `d4fdfe1`), which the
  `how-built-links-resolve` guard demands before its ceiling moves: unit 8's
  script (`docs/prototypes/workers-hardening/observe-ceiling.mjs`), its two
  JSON observation lines verbatim (the receipt), and one screenshot (the
  entry's anchor). The ceiling went 640 → 768 KiB in the amend after the push.

The per-node checker the sixteen compactions were written against
(`verify-node.mjs`: verbatim lines or sentence-aligned substrings of exactly
one original line; `Status:` the only new line, its numbers, refs and dates
all from the original, its quoted titles all headings in the log) lived in
the session's scratchpad; `prove-provenance.mjs` encodes the same rule over
the whole file and is what a reviewer re-runs.

Numbers quoted in the records come from these scripts and from the suites'
own legs, never from a tally by eye.
