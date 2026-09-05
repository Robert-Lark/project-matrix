# plp-data-plane — build record (built 2026-09-04, verified and landed 2026-09-18)

Unit 5 of the 2026-08-29 audit runbook. Prompt: `../plp-data-plane-prompt.md`.
Decisions of record: ADR-0005 addendum (2026-09-04), ADR-0004 §2 addendum bullet,
decision-map node `plp-data-plane`. The build-log phase entry "The controls come
back, and the tier learns what it may hold" (Phase 15, 2026-09-04 / 2026-09-18)
is the narrative and carries every verification number.

- `design-note.md` — the design as put in front of the four-lens critique
  (`plp-design-critique`, wf_189aaf4e-b5c: 33 findings, 6 kills; all folded in —
  see the ADR addendum for what changed). The note predates the critique; the
  addendum is the record.
- `kv-ceiling.mjs` — measures the KV key-space ceiling with the real query module
  (`node docs/prototypes/plp-data-plane/kv-ceiling.mjs tools/snapshot-capture/crate`).
  Re-run 2026-09-18: reproduces the addendum's table to the digit.
- `suite-fixture-run-1.log` — the first origin-suite run on the tree (2026-09-04):
  567 passed, 6 failed, all six in the two NEW suite files (`plp.test.ts`,
  `plp.browser.test.ts`). Kept because it documents the six defects the fixes
  answered.
- `suite-runs-2026-09-18.md` — the day's six runs, summarised (final tree: fixture
  579/579, crate 579/579; one crate attempt lost to a wrangler crash, re-run).

## How the unit was verified (2026-09-18; details in the build log)

1. Origin suite ALONE, fixture then crate (`node tools/origin-suite/run-local.mjs`;
   `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs`).
   One timeout-shaped failure on the first fixture run was re-run before being
   believed, per the runbook rule, and did not recur.
2. The react-next junk-filter 404 was read off a held plane (`PM_HOLD=1`) and its
   shape pinned in `plp.test.ts` — Next's `__next_error__` shell, the PDP precedent.
3. Sabotage table: 36 rows, one deliberate defect each, the owning guard must fail.
   35 caught after four test gaps were closed; the one honest miss (the front
   Worker's `x-pm-partial` pass-through) is proven by the plane's log instead.
4. verify-slice (4 lenses, sequential): 20 raw findings across the four lenses (6 + 7 + 2 + 5); 13 real defects fixed, each with a guard a second sabotage round proves bites; one recorded in the ADR addendum rather than fixed (the RUM `none`/`default` blend on hand-typed conditions); one resolved by the build-log entry landing (the decision-map node had cited it before it existed). The proof of one fix also found the suite's own race against htmx's 20 ms settle window.
5. `pnpm run check`: 35 of 35 tasks (the bench runner gained its first test task).

The transient files this folder carried while the unit was in progress
(`build-log-phase-DRAFT.md`, `sabotage-DRAFT.sh`, `verify-slice-context.md`) were
folded into the build-log entry and deleted when it landed.
