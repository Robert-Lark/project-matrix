# Origin-suite runs: repo hygiene (unit 10), 2026-10-05

Every run alone on the machine as far as this session controls it (no agents, no
builds, no edits during a run). Logs in the session scratchpad (`suite-fixture-2.log`
…), each ending in the runner's own `exit=` line; a wrapper script ran fixture then
crate with a `pgrep` gate between them (`wrangler|workerd|run-local`, filtered to
`project-matrix`, must print nothing). Base tree: `f0be557` + this unit's working tree
(the four config edits, the guard, the two DIFF-TO-STARTER rewrites), in the worktree
`.claude/worktrees/repo-hygiene`, the crate's image bytes reached through a symlink to
the main checkout's directory, as the brief says. A config-only unit still runs both
modes: `//#lint`'s inputs and two `deploy` scripts are in play, and `run-local.mjs`
builds every dist before it serves.

| run | mode | tree | result | wall | notes |
|---|---|---|---|---|---|
| fixture-1 | fixture | edited tree | **the environment, not the code**: 44 failed marks, killed by hand after 19 min | 1,140 s (killed) | not the wrangler crash class: 0 `ECONNREFUSED`, no "please create an issue" banner, `front.log` serving 200s at 60–86 ms throughout. Two browser legs in `chrome.browser.test.ts` ran 979,401 ms and 981,299 ms and the file 1,035,205 ms; every plain-fetch leg sharing that worker then failed at its 5,001–5,003 ms timer, the shape of a frozen test worker (timers fire late, together). Machine at the time: a VM at 29% CPU (`com.apple.Virtualization.VirtualMachine`), the Jamf daemon at 14%, the headless Chromium at 78%, load 2.4–3.0 over 16 cores. Torn down by PID (129 processes, TERM then KILL, `pgrep` clean, ports 8787–8790 free), log kept as `suite-fixture-1-hung.log`; re-run before belief |
| fixture-2 | fixture | same tree | **670 / 670, 26 files** | 155 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes; 670 legs is unit 8's count, a config unit adds none |
| crate-2 | crate | same tree | **670 / 670, 26 files** | 158 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |

## The final tree

After the verify-slice folds, both sabotage rounds and every record; nothing was
edited after these runs except this table's rows, the sentence in the build-log
entry that quotes them, a comment reflow in `eslint.config.mjs` and one clause in
`.github/workflows/ci.yml`'s header (neither reaches the plane), followed by one
more `pnpm run check`.

| run | mode | tree | result | wall | notes |
|---|---|---|---|---|---|
| fixture-final | fixture | FINAL tree | **670 / 670, 26 files** | 166 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |
| crate-final-1 | crate | FINAL tree | 338 failed / 194 passed / 38 skipped of 570, 23 files failed, **the plane, not the code** | 296 s (the hook cap) | the plane, not the code: wrangler 4.110's front dev server crashed under load, `tools/origin-suite/.dev-logs/front.log` ending in the "please create an issue" banner (which now names 4.147.0 as available), 172 `ECONNREFUSED 127.0.0.1:8787`, every browser leg at its 30 s timeout from the first test on, 338 failed at the hook cap; the failure class units 7, 8 and 9 recorded, re-run before belief; 0 leftover processes after teardown |
| crate-final-2 | crate | FINAL tree | **670 / 670, 26 files** | 164 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |
