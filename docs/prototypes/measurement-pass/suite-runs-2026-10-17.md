# Origin-suite runs, measurement pass PR-3 (2026-10-17)

Every run of this PR, in order, as it happened. Each ran ALONE (pre-flight
`pgrep -fl 'wrangler|workerd|run-local' | grep project-matrix | grep -v -E 'pgrep|zsh -c source'`
printed nothing and `lsof -nP -iTCP:8787` printed nothing before each start, and after each
end), from the worktree `.claude/worktrees/measurement-pass-constant`, in the background with
stdout and stderr redirected to a log and the exit code appended, never piped through `tail`.
The tree under test is `770a6d8` plus this commit's staged edits (the constant, the pin's
removal, the comments, the ADR notes, the map and log edits, the records), after `pnpm run
check` had passed on it (40 successful, 40 total, 28 cached, 13.187 s). Chromium 149.0.7827.55
(Playwright 1.61.1, revision 1228).

| # | mode | command | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fixture | `node tools/origin-suite/run-local.mjs` | 01:46:06Z | 01:48:55Z | 26 passed (26) | 670 passed (670) | 151.74 s | 0 | 0 |
| 2 | crate, attempt 1 | `PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs` | 01:49:21Z | 01:54:39Z | 23 failed, 3 passed (26) | 374 failed, 158 passed, 38 skipped (570) | 317.16 s | 262 | 1 |

Run 2 is the plane, not the code, in the first recorded class: wrangler 4.110's front
crash. `tools/origin-suite/.dev-logs/front.log` (1,039 lines, 459 `200 OK` responses
before it) ends with the signature verbatim, an empty `✘ [ERROR]`, then "If you think
this is a bug then please create an issue at
https://github.com/cloudflare/workers-sdk/issues/new/choose" and "Note that there is a
newer version of Wrangler available (4.151.1)". From that point every leg died on
`connect ECONNREFUSED 127.0.0.1:8787` (the first at a11y's shell leg, 5,004 ms); the
identical tree had just passed 670 of 670 in fixture mode (run 1). No process was left
behind (`pgrep`, `lsof` both empty), so no kill was needed. Re-run alone as run 3. The
wrangler bump (4.151.1 now available; 4.147.0 when PR-2 ran) stays Rob's, a lockfile change
with its own verification.

| # | mode | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|
| 3 | crate, attempt 2 | 01:55:07Z | 01:57:50Z | 26 passed (26) | 670 passed (670) | 146.66 s | 0 | 0 |

No frozen vitest worker, no 30 s `page.goto` wall (the third shape, PR-2's), and no
INP-null `body-click` flake in any of the three runs. The suite's own count is unchanged by
this commit: the constant's presence flips the methodology leg in
`published-readings.test.ts` from its absent branch to its populated branch (the leg
asserts both), and the gate change is proven by `workers/front/test`'s refusals leg (76
tests) inside `pnpm run check`, not by a new origin-suite leg.

## Final tree, after the verify-slice folds and sabotage round 2

Same command shapes, same pre-flight (nothing listening, no leftover process), the check
green first (40 successful, 40 total, 23 cached, 14.382 s; masters regenerated,
byte-identical).

| # | mode | start | end | files | tests | duration | ECONNREFUSED lines | exit |
|---|---|---|---|---|---|---|---|---|
| 4 | fixture, attempt 1 | 02:44:08Z | 02:47:42Z | 15 failed, 11 passed (26) | 221 failed, 362 passed, 27 skipped (610) | 213.47 s | 6 | 1 |

Run 4 is the plane again, the same wrangler 4.110 class as run 2, with a different
surface shape because the crash came LATE: `front.log` served 5,600 lines of `200 OK`
and beacon `204`s before the empty `✘ [ERROR]` and the "please create an issue" banner,
so the legs still in flight died on `Test timed out` (97) and `page.goto: Timeout` (15)
with only six refused connections, and the cart, drift and pdp-controls browser suites
carried most of the red. Twice in five runs on one tree that passed 670 of 670 three
times is a frequency worth Rob's attention when the wrangler bump (4.151.1) is weighed.
Re-run alone as run 5.
| 5 | fixture, attempt 2 | 02:48:12Z | 02:50:59Z | 1 failed, 25 passed (26) | 1 failed, 669 passed (670) | 150.05 s | 0 | 1 |

Run 5's one red is issue #16's recorded flake class and nothing else: `bench.browser.test.ts`,
"pages report the chrome's own web-vitals; the chromeless tray reports null, never
invented", `expected null not to be null` at the INP assertion (line 262) after the
scripted click, every other leg green, no plane signature. Re-run alone as run 6 for a
clean pass on the folded tree.
| 6 | fixture, attempt 3 | 02:51:20Z | 02:54:10Z | 26 passed (26) | 670 passed (670) | 149.86 s | 0 | 0 |

Six runs on one tree: three clean passes (1, 3, 6), two wrangler crashes (2, 4) and one
issue #16 flake (5). The crate-mode pass on the folded tree is run 3's tree plus record,
comment, ADR and map edits and the sabotage runner's verdict fix, none of which the
composed plane serves; the final-tree pass was taken in fixture mode.
