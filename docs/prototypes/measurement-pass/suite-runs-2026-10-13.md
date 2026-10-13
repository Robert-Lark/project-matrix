# Origin-suite runs, measurement pass PR-2 (2026-10-13)

Every run of the pass, in order, as it happened. Each ran ALONE (pre-flight
`pgrep -fl 'wrangler|workerd|run-local' | grep project-matrix` printed nothing before
each start, and nothing after each end), from the worktree
`.claude/worktrees/measurement-pass-receipts`, in the background with stdout and
stderr redirected to a log and the exit code appended, never piped through `tail`.
The tree under test is `a0ae215` plus this commit's uncommitted edits (the gate, the
two fixture rows, the six published receipts, the records), after
`pnpm run check` had passed on it (40 successful, 40 total, 22 cached, 14.144 s).

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fixture | `node tools/origin-suite/run-local.mjs` | 02:08:05Z | 02:10:46Z | 26 passed (26) | 670 passed (670) | 145.78 s | 0 | 0 |
| 2 | crate | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 02:10:51Z | 02:13:31Z | 26 passed (26) | 670 passed (670) | 144.56 s | 0 | 0 |

No plane failure of either recorded class (the wrangler 4.110 front crash with its
`ECONNREFUSED 127.0.0.1:8787` signature, or the frozen vitest worker) and no INP-null
`body-click` flake. The suite's own count is unchanged by this commit: the gate is one
more refusal inside the publication module, proven by `workers/front/test`'s refusals
leg (76 tests, two of them new) and `tools/bench-runner/test`'s fixture schema leg (43,
two new), both inside `pnpm run check`, not by a new origin-suite leg. What the origin
suite proves here is the composed plane serving the new publication: the PDP's lab
bundle non-empty for the first time, every bench and methodology leg against it green
in both snapshot modes.

The final-tree runs (after the verification folds) are appended below as they happen.

## Final tree, after the verify-slice folds and sabotage round 2

Same command shapes, same pre-flight (nothing listening, no leftover process), the
check green first (40 successful, 40 total, 23 cached, 13.365 s; masters regenerated,
byte-identical).

| # | mode | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|
| 3 | fixture | 03:04:12Z | 03:06:50Z | 26 passed (26) | 670 passed (670) | 144.58 s | 0 | 0 |
| 4 | crate, attempt 1 | 03:06:55Z | killed 03:21Z | 16 of 26 reported, every one red or hook-timed-out | 0 passed of those reported | 14 m 30 s when killed | 0 | killed |
| 5 | crate, attempt 2 | 03:21:48Z | 03:24:27Z | 26 passed (26) | 670 passed (670) | 144.02 s | 0 | 0 |

Run 4 is the plane, not the code, and is recorded as it happened: the identical tree
had just passed 670 of 670 in fixture mode (run 3) and had passed crate mode earlier in
the day (run 2). Its signature was neither of the two recorded wrangler classes: zero
`ECONNREFUSED`, no "please create an issue" banner in
`tools/origin-suite/.dev-logs/front.log`, which was still logging `200 OK` asset
responses when it was read; instead every browser leg died on
`TimeoutError: page.goto: Timeout 30000ms exceeded` (cart.browser 23 of 36, each at
30,0xx ms; pdp-controls.browser 22 of 28; drift.browser 72 of 115) and every fetch
suite's `beforeAll` on `Hook timed out in 300000ms` (data-plane, security-floor,
published-readings reporting 0 tests; chrome.test 17 of 17; how-it-was-built 6 of 6 at
30,013 ms). Thirty-one `chrome-headless-shell` processes were alive, the front
`workerd` was listening on 8787, load was 2.96. Killed by PID per the standing rule:
48 processes in the run tree took `TERM` (0 left after 4 s), the browsers `KILL`;
`lsof -nP -iTCP:8787` then printed nothing. Re-run alone as run 5.
