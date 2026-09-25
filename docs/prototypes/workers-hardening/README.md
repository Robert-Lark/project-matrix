# workers-hardening — the record's loose files (unit 8, 2026-09-25)

The unit's account is the build-log entry "The gate that nothing re-proved,
and the plane that no one had typed" and the decision-map node
`workers-hardening`; the decision is ADR-0004's addendum of the same date
(the typed-JS boundary rule). This directory holds what those cite and what
a reader would want to re-run.

- `suite-runs-2026-09-25.md` — every origin-suite run of the day, as it
  happened.
- `sabotage-2026-09-25.md` — round 1 over every new guard, with CONTROL
  rows and exit codes, and round 2 over the verify-slice fixes.
- `sabotage.mjs` — the runner: one row per defect, fresh backups per row,
  restores verified by byte equality, `bash -c` guards, exit codes printed.
  `SCRATCH=<dir> node docs/prototypes/workers-hardening/sabotage.mjs [rowId…]`
  from the repo root, on a tree with nothing else running.
- `observe-ceiling.mjs`, `ceiling-2026-09-25.txt`, `ceiling-2026-09-25-L7920.jpg`
  — the re-observation of GitHub's code view honouring `?plain=1#L<n>` on
  the build log at its new size (533,209 B at the pushed commit), which the
  `how-built-links-resolve` guard demands before its ceiling moves: the
  script (Playwright's Chromium, headless), its two JSON observation lines
  verbatim (the receipt), and one screenshot (the entry's anchor).
  `SCRATCH=<dir> node docs/prototypes/workers-hardening/observe-ceiling.mjs <ref> 4342,7920`.
- `probe-pdp-cold.mjs` — the cold PDP read's cost, measured on a held plane
  (`PM_HOLD=1 node tools/origin-suite/run-local.mjs` in one shell, then
  `node docs/prototypes/workers-hardening/probe-pdp-cold.mjs` in another):
  the edge Worker's server time for `?cache=cold` against a warm hit, ten
  of each, the numbers the decision-map node quotes.

Numbers quoted in the records come from these runs and from the suites'
own legs, never from a tally by eye.
