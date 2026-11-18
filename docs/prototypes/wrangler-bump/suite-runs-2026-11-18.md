# Origin-suite runs, the wrangler bump (post-runbook unit 2, 2026-11-18)

Every run of this unit, in order, as it happened. Each ran ALONE from the worktree
`.claude/worktrees/wrangler-bump` (tree: `origin/main` = `76b4678` plus the one lockfile
change, wrangler 4.164.0, workerd 1.20261117.1; porcelain ` M pnpm-lock.yaml` and nothing
else, so the front's local build attestation reads `dirty` in every front log on the bumped
lockfile, runs 1 to 5 and 7 to 9; run 6, on HEAD's lockfile bytes, stamped clean), in the background with stdout and stderr redirected to a log and the
exit code appended, never piped through `tail`, the front Worker's log copied aside after
each run before the next overwrote it. Playwright and Chromium as the 2026-11-17 record
(`browsers.json` unchanged by this unit). The 1-minute load average at each start is in
its row; the box had another session's VM and `claude` process on it throughout.

Two pre-flight gotchas this unit paid for, both mine, recorded so the next unit does not:
the standing stray-process line `pgrep -fl 'wrangler|workerd|run-local' | grep project-matrix`
matches EVERY process whose path runs through a worktree named `wrangler-bump`, so the
check was re-aimed at the commands themselves (`wrangler\.js dev|wrangler-dist/cli\.js
dev|workerd serve|run-local\.mjs|vitest\.mjs run`), and the checking shell's own argv
carries those patterns, so it is excluded by `grep -v -E 'zsh -c|pgrep'`, the gotcha the
2026-11-09 brief already names. Three queued runs aborted at that check before any plane started and were re-queued; they
are not rows. One abort was real: a vitest fork of run 2 was still alive about ten seconds
after its teardown (gone before the re-queued run started); the other two were the
checking shell's own argv, matched by the path and by the pattern. `lsof` on the
composition ports was empty each time.

Every run below printed nothing at its stray check and nothing on `lsof -nP -iTCP:8787`
before its start, and `pgrep` printed nothing after its teardown (one vitest fork
lingered about ten seconds after run 2's teardown and was gone before run 3 started).

## The bumped tree: fixture and crate mode, twice each (and a third crate run)

| # | mode | command | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fixture, attempt 1 | `node tools/origin-suite/run-local.mjs` | 16:10:27Z (3.40) | 16:13:18Z | 26 passed (26) | 670 passed (670) | 144.06 s | 0 | 0 |

Run 1 ran to its summary green: `front.log` 15,347 lines, 7,152 `200 OK`, no empty
`✘ [ERROR]`, no "please create an issue" banner (`grep -c` 0 and 0), zero refused
connections, nothing left behind. The front log's fourth line is the new banner,
`⛅️ wrangler 4.164.0`, and its teardown tail is as before (`[ELIFECYCLE] Command failed.`, then `🪵 Logs were written to …`, wrangler reporting the signal run-local sends it; 4.159.0
made that exit status non-zero, which run-local never read). One new line in every
Worker's log this unit: "Wrangler detected this dev session is running in an AI agent"
(wrangler's `detectAgenticEnvironment` reads `CLAUDECODE` among other variables, present
in this session's shell), followed by a Local Explorer API notice; it was printed in the
green runs and the hung ones alike, so it does not separate them, but it is one
difference between this box and CI, where no such variable is set.

| # | mode | command | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 2 | crate, attempt 1 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 16:13:53Z (2.97) | 16:27:33Z (vitest signalled at 16:27:28Z) | 19 reported, 3 at "(0 test)" | 183 red, 0 green by 16:23Z | 820 s, no summary | 0 | 143 |

Run 2 HUNG, the third plane class by its suite shape (137 of the 183 red legs at exactly
5 s, 41 at the 30 s browser wall, five at slower timeouts, one in 2 ms at the signal
whose message was cut off; zero refused connections, no banner), and the front
Worker's log did something the 4.110 records never saw: after 213 `200 OK` responses
(the last at line 531, a crate thumbnail for a react-next PDP) it stopped serving and
reported every request from then on as

```
✘ [ERROR] Error inside ProxyWorker (the affected request failed; the dev server continues): PUT http://127.0.0.1:8787/blog/admin/api/posts/ (failed after 1 attempt): internal error; reference = 0hejh8gksq7pjgkioooudovk
```

147 such lines by teardown (123 GET at "3 attempts", 22 POST and 2 PUT/DELETE at "1
attempt"), not one more `[wrangler:info]` line, no empty `✘ [ERROR]`, no banner. wrangler's debug log puts the first of them at 16:19:52.056Z, six minutes into the plane and
5 min 43 s after the last console line the runtime forwarded: the proxy's time to give up
on its retries, not serving time (`hang-2026-11-18.md`). Every other Worker answered on its own port while the front did not (`curl -m 3`:
edge 404 in 2.5 ms, each variant and the blog 200 in 6 to 26 ms, the front `000` at the
cap). The front's runtime `workerd` was at 12 to 13% CPU with its main thread blocked in
`console.log` delivering a notification to an inspector session, and its inspector
thread blocked on a lock too, sampled; the inspector session was the suite's own bench
CPU profiler, started on the front 0.76 s before the last console event; the whole
dissection, with the debug-log timeline, is `hang-2026-11-18.md`. Signalled the way the
2026-11-01 record describes (`kill -TERM` to the vitest runner alone, PID from `pgrep -f
'vitest.mjs run'`); run-local's own teardown ran, exit 143, nothing on the ports after.
Re-run as run 3 was meant to be crate again; the queue ran fixture next.

| # | mode | command | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 3 | fixture, attempt 2 | `node tools/origin-suite/run-local.mjs` | 16:30:51Z (1.64) | 16:36:42Z (vitest signalled at 16:36:37Z) | 13 reported, 1 at "(0 test)" | 110 red, 0 green by 16:35Z | 351 s, no summary | 0 | 143 |

Run 3 HUNG the same way, on the quietest start of the unit (load 1.64): 704 `200 OK`
(the last at line 1596 of `front.log`, a vanilla stylesheet), then 42 ProxyWorker errors
(20 GET at three attempts, 21 POST and 1 DELETE at one), no `[wrangler:info]` after, no
banner; 76 of the 110 red legs at 5 s, 33 at 30 s, zero refused; the other ten Workers
answering directly; the front's runtime at 14.9% CPU on the same main-thread stack (the same 14 frames from `Builtin_ConsoleLog` to the inspector send, this one with one more frame above the mutex). Signalled the
same way at 16:36:37Z, exit 143, nothing left behind.

| # | mode | command | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 4 | crate, attempt 2 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 16:40:31Z (2.42) | 16:43:14Z | 26 passed (26) | 670 passed (670) | 145.16 s | 0 | 0 |
| 5 | crate, attempt 3 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 16:43:24Z (3.09, after a 10 s wait for the load to fall) | 16:46:05Z | 26 passed (26) | 670 passed (670) | 144.29 s | 0 | 0 |

Runs 4 and 5 ran to their summaries green: `front.log` 16,605 and 16,593 lines, 7,789
and 7,790 `200 OK`, no banner, no ProxyWorker error, zero refused connections, nothing
left behind. The third crate run was added because the first had hung; it was not in the
brief's "at least twice each".

**Where this leaves the 2x2.** Both modes are 670 of 670 alone on the bumped tree
(runs 1, 4, 5), so the suite holds on wrangler 4.164.0 and workerd 1.20261117.1, which is
what the bump had to show before merge. Two of five runs hung (one in each mode), against
one of five on 4.110 the day before and three of six on 2026-11-01; with counts this
small the rate is not shown to have moved either way. No run crashed in the first plane
class (the empty banner), in five runs; on 4.110 that class appeared in four of
seventeen, so five clean runs do not retire it. No leg asserted red on the code in any
run whose failure messages were captured (run 2's one 2 ms red was cut off by the signal).

## What each Worker writes per request (run 3's eleven logs, copied aside at its teardown)

The Worker's own per-request lines are its JSON log lines (`grep -c '^{"level"'`); the
request lines are `[wrangler:info] GET|POST|…`. (A first draft counted every line that
was not wrangler's output and got 752 for the front, which included 42 colour-coded proxy
errors and the binding table.)

| Worker | total lines | request lines | own console lines |
|---|---|---|---|
| front | 1,724 | 789 | 692 (one per dispatch, `workers/front/src/index.js:144`) |
| blog | 31 | 0 | 1 (`serve /blog/ 200`, served through the front's binding before the front wedged; its `log()` writes one per request it handles, `workers/blog/src/index.js:513` and `:517`, and the rest of run 3's blog traffic never reached it; run 9's blog log has 111) |
| edge | 28 | 0 | 0 |
| astro, htmx, placeholder-ssr, placeholder-static, qwik, react-next, remix3, vanilla | 26 to 36 each | 0 | 0 each |

Two Workers log per request by source, the front and the blog. The DevTools sessions on
the inspector ports are the bench leg's CPU profiler (`hang-2026-11-18.md`), which
connects to the Workers on each visit's serving path and never to the blog
(`tools/bench-runner/src/cpu.ts:218`): front, placeholder-static and edge in run 2; those
three and placeholder-ssr in run 3 (`grep -c 'DEVTOOLS WEBSOCKET CONNECTED'` per debug log).
So the blog is outside the profiler by design and is not a control for it; the front is
the one Worker that both logs per request and is profiled, and the one that wedged.

## Every run's front-log tail

The last two lines of each run's `front.log` (`tail -2`, the log path elided):

| # | run | last two lines |
|---|---|---|
| 1 | fixture | `[ELIFECYCLE] Command failed.` / `🪵 Logs were written to "…"` |
| 2 | crate, hung | `🪵 Logs were written to "…"` / `[ELIFECYCLE] Command failed.` (after 147 ProxyWorker errors) |
| 3 | fixture, hung | `🪵 Logs were written to "…"` / `[ELIFECYCLE] Command failed.` (after 42 ProxyWorker errors) |
| 4 | crate | `🪵 Logs were written to "…"` / `[ELIFECYCLE] Command failed.` |
| 5 | crate | `🪵 Logs were written to "…"` / `[ELIFECYCLE] Command failed.` |
| 6 | fixture, old lockfile | `🪵 Logs were written to "…"` / `[ELIFECYCLE] Command failed.` |
| 7 | fixture, `log()` silenced | `[wrangler:info] GET /_pm/build.json 200 OK (1ms)` / `[ELIFECYCLE] Command failed.` |
| 8 | fixture, `log()` silenced | `[wrangler:info] GET /_pm/build.json 200 OK (2ms)` / `[ELIFECYCLE] Command failed.` |
| 9 | fixture, `log()` silenced | `[wrangler:info] GET /_pm/build.json 200 OK (2ms)` / `[ELIFECYCLE] Command failed.` |

The order of the two teardown lines varies by run, and the silenced runs print no
`Logs were written` line; none of the nine carries the empty `✘ [ERROR]` or the "please
create an issue" banner (`grep -c` 0 and 0 in each).

## Phase 2: the old lockfile written back, and three runs with the front's logging silenced

Run 6 is the sabotage table's F3 row, done by hand so that a hang could not stall the
runner: the bumped `pnpm-lock.yaml` copied aside, `git show HEAD:pnpm-lock.yaml`
(origin/main's, wrangler 4.110.0) written over it, `pnpm install --frozen-lockfile
--offline` ("Packages: +15 -21", 3.2 s, the store still holding the old tree;
`readlink workers/front/node_modules/wrangler` naming `wrangler@4.110.0_…`), then the
suite; after it the bumped lockfile copied back (`cmp` byte-identical), the frozen offline
install again (resolving `wrangler@4.164.0_…`), porcelain ` M pnpm-lock.yaml` as before.

| # | mode | tree | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 6 | fixture, old lockfile | wrangler 4.110.0 (`⛅️ wrangler 4.110.0` in `front.log`; no "AI agent" line, that detection is newer than 4.110) | 16:46:45Z (3.28, after a 30 s wait) | 16:49:25Z | 26 passed (26) | 670 passed (670) | 144.04 s | 0 | 0 |

Run 6 ran to its summary green on the OLD version: `front.log` 15,198 lines, 7,151 `200
OK`, no banner, nothing left behind. That is the stated limit the brief asked to be shown:
a green run on 4.164.0 and a green run on 4.110.0 look the same, so a green run proves
the suite holds on the bumped tree and nothing about the crash or the hang. (It is also
the fifth green of six fixture runs on 4.110 this week, and the one that was not green
hung at load 1.02.)

Runs 7 to 9 are a DIAGNOSTIC, not a change: the hang record names the front's
per-request `console.log` as the call the stuck thread was in (the bench's CPU profiler,
the other factor present in both hangs, was found only after these runs, by the lenses),
so `log()` in
`workers/front/src/index.js` was made to return at once by a one-line scratch edit
(`git diff --stat`: 1 insertion), the suite run three times in fixture mode, and the edit
reverted with `git checkout --` (porcelain back to the lockfile alone, checked). Each
front log has zero JSON lines (`grep -c '^{"level"'`) where the runs with logging on have
one per dispatch.

| # | mode | tree | start (load) | end | files | tests | duration | refused | exit |
|---|---|---|---|---|---|---|---|---|---|
| 7 | fixture, `log()` silenced | bumped, scratch edit | 16:49:30Z (2.36) | 16:52:07Z | 26 passed (26) | 670 passed (670) | 143.80 s | 0 | 0 |
| 8 | fixture, `log()` silenced | bumped, scratch edit | 16:52:27Z (3.24, after 20 s) | 16:55:04Z | 26 passed (26) | 670 passed (670) | 143.90 s | 0 | 0 |
| 9 | fixture, `log()` silenced | bumped, scratch edit | 16:55:14Z (3.16, after 10 s) | 16:57:55Z | 25 passed, 1 failed (26) | 669 passed, 1 failed (670) | 149.06 s | 0 | 1 |

Runs 7 and 8 green; run 9's one red leg is `bench.browser.test.ts` "pages report the
chrome's own web-vitals; the chromeless tray reports null, never invented"
(`AssertionError: expected null not to be null` at `suite/bench.browser.test.ts:262`),
issue #16's flake class, a null web-vital on one visit, seen on 2026-09-26 and 2026-11-01
with the logging on; not the hang, not the code. Front logs 8,151, 8,180 and 8,204 lines
with 7,154, 7,151 and 7,149 `200 OK`, no ProxyWorker error, no banner, nothing left
behind. No hang in three runs with the logging off, against two in five with it on. The
profiler ran in all three (40 starts, each stopped, per front debug log), so these runs
vary the logging and keep the profiler: they say the profiler alone did not hang three
times, nothing more. Three runs are too few to call it either way (runs 4 and 5 went
green back to back with the logging on). The run that would separate the two factors,
the profiler off with the logging on, was not made.

## Where this leaves the suite

Nine runs: the bumped tree 670 of 670 in both modes (runs 1, 4, 5), the old lockfile 670
of 670 (run 6), the silenced front 670, 670 and 669 of 670 (runs 7 to 9, the red a
known flake class); two hangs (runs 2 and 3), both on the bumped tree with the logging on and the bench
profiler just started on the front, dissected in `hang-2026-11-18.md`. No leg asserted red on the code in any run whose
failure messages were captured; run 2's one 2 ms red was cut off by the signal before
vitest printed it.
