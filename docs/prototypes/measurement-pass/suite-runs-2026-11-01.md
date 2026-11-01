# Origin-suite runs, the constant's two stated limits (post-runbook unit 1, 2026-11-01)

Every run of this unit, in order, as it happened. Each ran ALONE (pre-flight
`pgrep -fl 'wrangler|workerd|run-local' | grep project-matrix | grep -v -E 'pgrep|zsh -c source'`
printed nothing and `lsof -nP -iTCP:8787` printed nothing before each start, and after each
end), from the worktree `.claude/worktrees/constant-limits`, in the background with stdout
and stderr redirected to a log and the exit code appended, never piped through `tail`. The
tree under test is `24cd504` plus this commit's code edits (the gate, the fixtures, the
control leg, the probe), after `pnpm run check` had passed on it (40 successful, 40 total,
27 cached, 12.581 s). Playwright 1.61.1, Chromium revision 1228 (the suite's own build).
`wrangler` is still 4.110.0 here; the bump is the next unit, and a crash in these runs
would be recorded as that unit's evidence, not as this unit's flake.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fixture | `node tools/origin-suite/run-local.mjs` | 17:01:33Z | 17:04:15Z | 26 passed (26) | 670 passed (670) | 145.75 s | 0 | 0 |

Run 1's `tools/origin-suite/.dev-logs/front.log` ends with the run-local teardown
(`Logs were written to …`, then `[ELIFECYCLE] Command failed.`, which is wrangler
reporting the signal run-local sends it at the end of a green run) and carries no
`✘ [ERROR]` and no "please create an issue" banner (`grep -c` 0).

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 2 | crate, attempt 1 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:04:57Z | 17:10:09Z | 22 failed, 4 passed (26) | 351 failed, 181 passed, 38 skipped (570) | 300.86 s | 80 | 1 |

Run 2 is the plane, not the code, in the first recorded class and its LATE shape:
wrangler 4.110's front crash. `front.log` is 2,722 lines with 1,187 `200 OK` responses
before the empty `✘ [ERROR]` (line 2716) and the "please create an issue" banner (line
2719); the legs in flight died on `Test timed out` (98) and `page.goto: Timeout` (35),
with 80 refused connections after that. The identical tree had just passed 670 of 670 in
fixture mode (run 1). No process was left behind (`pgrep`, `lsof` both empty), so no
kill was needed. The signature, verbatim from the log's last lines (ANSI stripped): an
empty `✘ [ERROR]`, two blank lines, then "If you think this is a bug then please create
an issue at https://github.com/cloudflare/workers-sdk/issues/new/choose". This is the
same class PR-3 met twice in six runs, evidence for the wrangler bump, the next unit.
Re-run alone as run 3.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 3 | crate, attempt 2 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:10:28Z | 17:22:36Z | 18 failed, 8 passed (26) | 128 failed, 404 passed, 38 skipped (570) | 711.94 s | 0 | 1 |

Run 3 is the plane in the THIRD recorded class, PR-2's: every browser leg at the 30 s
wall (`page.goto: Timeout 30000ms exceeded.` 56 times), every fetch leg at exactly 5 s
(`Test timed out in 5000ms.` 45 times), one `Hook timed out in 300000ms.`, zero refused
connections, no `✘ [ERROR]` and no banner in `front.log` (7,352 lines by the end, the
Worker still answering 200 throughout). Checked at 17:19Z the suite looked hung: four
fetch suites at "(0 test)", the vitest workers idle at 0.0% CPU for eleven minutes, and
`kill -TERM` to the run-local process did nothing in sixty seconds (its handler cannot
run while `spawnSync` holds the loop); the run then ended on its own at 17:22:36Z when
the five-minute hook timeout fired, run-local tore the tree down itself, and `pgrep` and
`lsof -nP -iTCP:8787` were both empty afterwards, so no kill was needed. The identical
tree had passed 670 of 670 in fixture mode (run 1). Re-run alone as run 4.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 4 | crate, attempt 3 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:23:24Z | 17:47:06Z (vitest signalled) | 2 stuck at "(0 test)" | 171 red, 0 green by 17:46Z (570) | 1,422 s, no summary | 0 | 143 |

Run 4 is the third class again, with the hang point visible this time. `front.log`
stopped growing at 3,966 lines: its last 34 responses are `POST /blog/admin/login 503
Service Unavailable` at 7.8 s each, then nothing, while every variant Worker's log still
ends at its `Ready on` line, so the front Worker itself stopped answering, not a variant
behind it. From then on every fetch leg died at exactly 5 s (125 of the first 144 reds)
and every browser leg at the 30 s wall, with no refused connection and no banner. The
run did not end on its own as run 3 had: by 17:46Z (23 minutes) it was still burning
30 s per browser leg with 0 green, so `kill -TERM` was sent to the vitest runner alone
(PID from `pgrep -f 'vitest.mjs run'`), which let run-local's `spawnSync` return and its
own teardown run: exit 143, `pgrep` and `lsof -nP -iTCP:8787` empty afterwards, no
further kill needed. Load average when it was signalled: 2.65. Three crate failures in a
row on a tree that passed fixture mode 670 of 670, two of them the hang class with
different last requests (a qwik PDP 200 in run 3, the blog login 503s here), one the
wrangler 4.110 crash; the same tree's code change is build-time only (the gate) and
probe-side (the warm-up), neither on the plane's request path. Re-run alone as run 5.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 5 | crate, attempt 4 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:47:23Z | 17:49:58Z | 1 failed, 25 passed (26) | 1 failed, 669 passed (670) | 149.58 s | 0 | 1 |

Run 5 ran to its summary: one red leg, `bench.browser.test.ts` "pages report the
chrome's own web-vitals; the chromeless tray reports null, never invented",
`AssertionError: expected null not to be null`, issue #16's INP-null flake class (PR-3's
run 5 was the same leg the same way). No refused connection, no banner, nothing left
behind. Re-run alone as run 6.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 6 | crate, attempt 5 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:50:31Z | 17:55:48Z | 2 failed, 24 passed (26) | 643 passed, 27 skipped (670) | 301.00 s | 0 | 1 |

Run 6 lost two browser files at their hook, not at a leg: `bench.browser.test.ts`
(`TimeoutError: page.goto: Timeout 30000ms exceeded.` in its setup) and
`bench-interaction.browser.test.ts` (`Error: Hook timed out in 300000ms.`), their 27 legs
skipped, every other leg green, no refused connection, no banner, nothing left behind.
The third class's shape confined to two files. Re-run alone as run 7.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 7 | crate, attempt 6 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 17:56:13Z | 18:05:54Z (vitest signalled) | 4 stuck at "(0 test)" | 83 red, 0 green by 18:05Z (570) | 581 s, no summary | 0 | 143 |

Run 7 is the third class once more: 67 fetch legs at exactly 5 s, 16 browser legs at
the 30 s wall, 0 green, four fetch suites never past their hook, no refused connection,
no banner, the front Worker still logging 200s (4,663 lines, last `GET /_pm/measure.js
200 OK (21ms)`) while nothing it answered reached a leg in time. Signalled the same way
as run 4 (`kill -TERM` to the vitest runner alone), exit 143, nothing left behind. The
machine's load average with nothing of this unit's running afterwards was 5.70 (1 min),
4.90, 4.43; `ps` showed a Virtualization.framework VM at about 31% CPU and two other
`claude` sessions throughout the afternoon, none of them this worktree's. That is the
most likely reason the hang class, which PR-3 met 0 times in 6 runs on 2026-10-17,
appeared in 4 of this unit's 6 crate runs, with the wrangler crash in a fifth and issue
#16's flake in the sixth; it is a reason, not a proof, and it is recorded as such.

## The final tree, after every verify-slice fold

Same command shape, same pre-flight (nothing listening, no leftover process), the check
green first (40 successful, 40 total, 31 cached, 11.433 s; masters regenerated,
byte-identical), load average 3.26 at the start.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 8 | fixture, final tree | `node tools/origin-suite/run-local.mjs` | 18:39:39Z | 18:42:16Z | 26 passed (26) | 670 passed (670) | 143.99 s | 0 | 0 |

## Where this leaves the suite

Fixture mode: 670 of 670 alone, twice (run 1 on the code tree, run 8 on the final tree). Crate mode: six attempts, none a clean 670; the
closest, run 5, was 669 of 670 with the one red the INP-null flake class issue #16
already names, and run 6 was 643 green with 27 skipped behind two hook timeouts. No
crate-mode leg asserted red on the code under test in any run; every failure is a
timeout or a refused connection, the three plane classes the record already carries.
The crate re-run on a quiet machine is the one verification step this unit leaves open,
stated in the entry and the hand-off rather than rounded up to a pass.
