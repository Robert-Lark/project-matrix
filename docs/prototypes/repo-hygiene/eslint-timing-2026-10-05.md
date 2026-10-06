# One-liner 1, measured: eslint over the main checkout, before and after the worktree ignore (2026-10-05)

The measurement had to run in the MAIN checkout (`/Users/roblark/Work/project-matrix`,
at `cccac1d`, the `strip-em-dashes` branch whose squash is `f0be557` = origin/main),
because that is the checkout the parked worktrees sit under; the unit's own
worktree has none nested and would have measured nothing. The shared checkout was
never edited: AFTER is the committed config plus the one pattern the fix adds, passed
as `--ignore-pattern '.claude/worktrees/**'` on the command line, which is what the
`ignores` entry does. Script: the session's `time-eslint.sh` (its body is the four
commands below); raw output verbatim under "Raw".

`git worktree list | wc -l` printed 26 at the time: the main checkout, 24 parked
worktrees, and this unit's own (`repo-hygiene`, 276 files of them).

| | files `eslint .` visits | of them under `.claude/worktrees/` | wall, median of three |
|---|---|---|---|
| BEFORE (committed config) | 4,741 | 4,465 (94.2%) | 37.41 s |
| AFTER (`.claude/worktrees/**` ignored) | 276 | 0 | 2.45 s |

Counts: `pnpm exec eslint . --format json | jq -r '.[].filePath' | wc -l` and
`grep -c '/.claude/worktrees/'` over that list. Timings: `date +%s.%N` around
`pnpm exec eslint .`, three runs each, medians read off the sorted triples (35.73,
37.41, 37.83 and 2.42, 2.45, 2.65). eslint exited 0 in every run: the parked
worktrees held no lint error that day, so nothing was masked, which is the
condition under which this class of defect stays invisible.

The 2026-08-29 audit's figures (4,153 files, 3,914 in worktrees, ~33 s) were true
then; the tree grew 588 linted files since, 551 of them in worktrees and 37 in the
main tree, and one more worktree.

## The done-means' own shape: the lint task through turbo

The unit prompt's done-means asks for `pnpm check` timing. `pnpm check` runs lint as
turbo's `//#lint` task, which caches on its own hash, so it was measured as that
task alone with the cache bypassed (`pnpm exec turbo run lint --force`), three runs
before and after in the main checkout, the AFTER passing the one new ignore to the
lint script through turbo's `--` (`-- --ignore-pattern '.claude/worktrees/**'`), the
shared checkout never edited. Typecheck and test do not read the ignore, so the
whole of `pnpm check`'s drop is this task's. The unit's own worktree has no nested
worktrees, so measured there the drop would be zero: the main checkout is the only
place it exists, which is why this file measures there.

| | wall, median of three |
|---|---|
| BEFORE (`turbo run lint --force`) | 37.06 s (34.98, 37.06, 41.74) |
| AFTER (same, with the ignore passed through `--`) | 3.01 s (2.96, 3.01, 3.16) |

```
sha=cccac1d worktrees=26
before turbo-lint run=1 exit=0 secs=41.736547000
before turbo-lint run=2 exit=0 secs=34.981591000
before turbo-lint run=3 exit=0 secs=37.060826000
after turbo-lint run=1 exit=0 secs=3.158043000
after turbo-lint run=2 exit=0 secs=2.959217000
after turbo-lint run=3 exit=0 secs=3.012287000
done
exit=0
```

## Raw (the eslint runs)

```
sha=cccac1d8c6ffe91253c13384140facb387689a27 branch=strip-em-dashes
worktrees=26
--- file counts (one JSON run each) ---
before-json-exit=0
after-json-exit=0
before_total=4741
before_worktrees=4465
after_total=276
after_worktrees=0
--- timings (seconds, wall) ---
before run=1 exit=0 secs=35.733099000
before run=2 exit=0 secs=37.834348000
before run=3 exit=0 secs=37.409203000
after run=1 exit=0 secs=2.649338000
after run=2 exit=0 secs=2.420563000
after run=3 exit=0 secs=2.446208000
done
exit=0
```
