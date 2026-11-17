# Origin-suite runs, the re-probe (post-runbook unit 1 follow-up, 2026-11-17)

Every run of this unit, in order, as it happened. Each ran ALONE (pre-flight
`pgrep -fl 'wrangler|workerd|run-local' | grep project-matrix | grep -v -E 'pgrep|zsh -c source'`
printed nothing and `lsof -nP -iTCP:8787` printed nothing before each start, and after each
end), from the worktree `.claude/worktrees/re-probe`, in the background with stdout and
stderr redirected to a log and the exit code appended, never piped through `tail`.
Playwright 1.61.1, Chromium revision 1228 (`149.0.7827.55`, `browsers.json`). `wrangler`
is still 4.110.0 here (`workers/front/package.json` declares `^4.110.0`); the bump is the
next unit, and a crash in these runs would be recorded as that unit's evidence.

## The untouched tree: the crate run the last unit left open

The 2026-11-01 unit recorded six crate-mode attempts and no clean 670, with the machine's
load average at 5.7 and a VM plus two other sessions on it, and stated the crate re-run on
a quiet machine as open rather than rounding it up. This is that run, first thing in this
unit, on the untouched worktree at `origin/main` = `64725e2` (porcelain 0 after the
crate-image symlink, `pnpm install --offline` 9.7 s, `pnpm run check` 40 of 40 before it).
The box was not quiet by the last unit's standard: `uptime` read 3.32 (1 min), 3.30, 4.52
at the start, with the same Virtualization.framework VM at about 32% CPU and another
`claude` session on it (`ps -Ao pcpu,pid,comm -r`); the 1-minute figure had been 2.42
ninety seconds earlier, at the pre-flight. Recorded as it was, not as the brief asked.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | crate, untouched tree | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 22:04:51Z | 22:07:41Z | 26 passed (26) | 670 passed (670) | 150.12 s | 0 | 0 |

Run 1's `tools/origin-suite/.dev-logs/front.log` is 16,532 lines with 7,791 `200 OK`
responses and ends with the run-local teardown (`Logs were written to …`, then
`[ELIFECYCLE] Command failed.`, wrangler reporting the signal run-local sends it at the end
of a green run); it carries no empty `✘ [ERROR]` and no "please create an issue" banner
(`grep -c` 0 and 0). Nothing was left behind (`pgrep`, `lsof` both empty). So the open
item closes: crate mode is 670 of 670 alone on the tree the last unit shipped, in the
same 150 s the fixture mode takes, with the load average higher than the brief asked for
and lower than the afternoon the six failures were recorded on (5.7). One clean run is
one clean run; it says the code was never the reason, which the last unit already argued
from the fixture runs, and it says nothing about how often the plane classes recur.

## The final tree

The tree under test from here is `64725e2` plus this unit's one artifact change
(`workers/front/lab/chrome-constant.json`, the 2026-11-17 measurement) and its records;
the front build had admitted the artifact (exit 0) before the first run. Same pre-flight,
same command shape.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 2 | fixture, attempt 1 | `node tools/origin-suite/run-local.mjs` | 22:15:17Z | 22:26:11Z (vitest signalled) | 8 reported, 1 stuck at "(0 test)" | 69 red, 11 green by 22:25Z (670) | 654 s, no summary | 0 | 143 |

Run 2 is the third plane class, on a QUIET box this time: the load average at the start
was 1.02 (1 min), 1.91, 3.28, the lowest of any run in this record or the last. The
front Worker's log stopped at 22:15:37Z, twenty seconds into the suite, at 6,183 lines
with a `200 OK` for a qwik build asset as its last line, and had not moved ten minutes
later (`wc -l` 6,183 at 22:25:46Z and again twenty seconds after; no `/blog/admin/login`
503s this time, four login lines, all before the stop); every variant Worker's log still
ends at its `Ready on` line. From the stop on, 63 of the 69 red legs died at exactly 5 s
and the other 6 at the 30 s browser wall, with zero refused connections, no empty
`✘ [ERROR]` and no "please create an issue" banner (`grep -c` 0, 0); the fetch suites
reported in turn as their legs timed out (`plp` 1 red, `how-it-was-built` 2, `checkout` 4,
`pdp-controls` 16, `blog` 23, `data-plane` 23), the two bench browser files skipped all 27
legs at their hooks, and `published-readings.test.ts` sat at "(0 test)". Checked at
22:25Z the vitest workers were idle (0.0% CPU, `ps`) while three `workerd` processes
sat at 12 to 13% each. Signalled the way the 2026-11-01 record describes (`kill -TERM`
to the vitest runner alone, PID from `pgrep -f 'vitest.mjs run'`, at 22:26:06Z); run-local's
own teardown ran, exit 143 at 22:26:11Z, `pgrep` and `lsof -nP -iTCP:8787` empty after.
The same tree had passed crate mode 670 of 670 twenty minutes earlier (run 1), and the
artifact change between the two runs is one JSON file the front build bakes into
`dist/` and serves verbatim, not on the request path of any leg that died. What this
run adds to the record: the hang class does not need a loaded machine. The last unit
offered the 5.7 load average as its most likely reason, "a reason, not a proof"; a hang
at 1.02 takes that reason away and leaves the plane, wrangler 4.110's `workerd`, which is
the next unit's subject. Re-run alone as run 3.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 3 | fixture, attempt 2 | `node tools/origin-suite/run-local.mjs` | 22:26:31Z | 22:32:37Z | 23 failed, 3 passed (26) | 422 failed, 110 passed, 38 skipped (570) | 358.16 s | 138 | 1 |

Run 3 is the plane in the first recorded class and its EARLY shape: wrangler 4.110's
front crash. `front.log` is 227 lines, 65 `200 OK` responses, then the empty `✘ [ERROR]`
and the "please create an issue" banner at line 224, followed this time by a line the
2026-11-01 record did not have: "Note that there is a newer version of Wrangler
available (4.164.0). Consider checking whether upgrading resolves this error." (the brief
of 2026-11-09 named 4.159.0 as current; wrangler's own banner names 4.164.0 today, so the
bump unit re-reads `npm view wrangler version` when it starts). From the crash on, 138
refused connections, 113 `Test timed out`, 60 `page.goto` timeouts at the 30 s wall. The
load average at the start was 11.43 (1 min), the teardown of run 2 and its workerd
processes having just ended twenty seconds earlier; the record keeps that figure beside
the crash and claims nothing from it, since the same crash landed at 2.39 on 2026-10-17.
No process left behind. Re-run alone as run 4, after the load dropped under 3.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 4 | fixture, attempt 3 | `node tools/origin-suite/run-local.mjs` | 22:34:02Z | 22:36:44Z | 26 passed (26) | 670 passed (670) | 149.62 s | 0 | 0 |

Run 4 ran to its summary green, load average 2.89 at the start: `front.log` 15,228 lines,
no `✘ [ERROR]`, no banner, zero refused connections, nothing left behind. Fixture mode is
670 of 670 on the final tree; runs 2 and 3 were the plane twice, in two of its three
recorded classes, on the same tree.

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 5 | crate, final tree | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 22:37:09Z | 22:39:49Z | 26 passed (26) | 670 passed (670) | 144.85 s | 0 | 0 |

Run 5 ran to its summary green, load average 2.61 at the start: `front.log` 16,586
lines, no `✘ [ERROR]`, no banner, zero refused connections, nothing left behind.

## Where this leaves the suite

Both modes are 670 of 670 alone on the final tree (runs 4 and 5), and crate mode is 670
of 670 on the untouched tree as well (run 1), the item the last unit left open. Of five
runs, two were the plane: a third-class hang on a quiet box (run 2, load 1.02) and a
wrangler 4.110 crash (run 3), on a tree whose only non-record change is one JSON file the
front build bakes into `dist/`. No leg asserted red on the code in any run. The hang at
load 1.02 is the one new fact for the wrangler bump, the next unit: the loaded-machine
reason the last record offered does not cover it.
