# wrangler-bump: the record's loose files (post-runbook unit 2, 2026-11-18)

The unit's account is the build-log entry "The runtime that stopped answering, and the
bump that made it say so (2026-11-18)" and the `repo-hygiene` node's dated 2026-11-18
bullet (the node that carried the bump as owed since 2026-10-05). This directory holds
what those cite and what a reader would want to re-run or check.

- `bump-2026-11-18.md`: the one lockfile change and how it was made (what pnpm rewrote
  that was not asked for, and the revert), the versions before and after from the
  lockfile, pnpm's default minimum-release-age gate and the publish times it was measured
  against, what the new wrangler brings (a beta Miniflare, a new unmet optional peer),
  this repo's wrangler CLI surface against the changelog between 4.110.0 and 4.164.0 with
  the entries quoted, and the entries that speak to the three plane failure classes.
- `suite-runs-2026-11-18.md`: every origin-suite run of the unit, as it happened: the
  bumped tree in fixture and crate mode (the green ones and the two that hung), the run
  on the OLD lockfile written back (the sabotage table's F3 row), and the diagnostic
  runs with the front Worker's per-request logging silenced, each with its front-log
  tail and the load average at its start.
- `hang-2026-11-18.md`: the hung runs dissected: what the dev proxy reported (and did
  not on 4.110), the direct probes of every Worker's port, the two CPU samples of the front's runtime with the two threads that held it, the suite's own bench CPU profiler found on the front's inspector port and its timeline from wrangler's debug logs beside the green runs', what this is and is not, and how to
  reproduce or disprove it.
- `workerd-sample-run2-2026-11-18.txt`, `workerd-sample-run3-2026-11-18.txt`: the main-thread and inspector-thread stacks from the two samples, trimmed of addresses (macOS `sample`).
- `sabotage-wrangler-bump.mjs`: the runner, re-rowed for this unit: the frozen install
  as the lockfile's guard (a specifier moved alone; a resolution hash altered; the OLD
  lockfile written back, which it admits, the stated limit), the private-details guard
  (a mirror host in a prototype lockfile, caught; the same host in `pnpm-lock.yaml`, which
  the repo's guard does not read but pnpm's own supply-chain policy check refuses; the same
  host in `.npmrc`, which nothing reads; a mailbox in a record), the node's
  cap and pointer legs, the glyph rule, the log ceiling, the masters' anchors.
  `SCRATCH=<dir> node docs/prototypes/wrangler-bump/sabotage-wrangler-bump.mjs [rowId…]`
  from the repo root, after `git add` of the new files, with no plane running; F3 runs
  last and the table is followed by `pnpm install --frozen-lockfile --offline`.
- `sabotage-2026-11-18.md`: the table, with CONTROL rows, round by round.
- `verify-slice-2026-11-18.md`: the lenses' findings, folds and refutations.
