# Origin-suite runs — decision-map compaction (unit 9), 2026-09-25/26

Every run alone on the machine as far as this session controls it (no
agents, no builds, no edits during a run; the other session's runs were
waited out, never killed). Logs in the session scratchpad
(`suite-fixture-1.log` …), each ending in the runner's own `exit=` line.
Base tree: `f66d464` + this unit's working tree, in the worktree
`.claude/worktrees/decision-map-compaction` (the crate's image bytes reached
through a symlink to the main checkout's directory, as the brief says).

| run | mode | tree | result | wall | notes |
|---|---|---|---|---|---|
| fixture-1 | fixture | compacted map + appended log, before verify-slice and before the unit's own entry | **670 / 670, 26 files** | 143.5 s | 0 `ECONNREFUSED`, 0 leftover processes; 670 legs is unit 8's count — a docs unit adds none |
| crate-1 | crate | same tree | 244 failed / 339 passed / 27 skipped of 610, 17 files — **the plane, not the code** | 301.0 s (the 300 s hook cap) | wrangler's front dev server crashed under load: `tools/origin-suite/.dev-logs/front.log` ends in the "If you think this is a bug then please create an issue" banner (wrangler 4.110; the banner names 4.141.0 as available), 6 `ECONNREFUSED 127.0.0.1:8787`, every browser leg at its 30 s timeout from the first test on; the recorded failure class from units 7 and 8 — re-run before belief, 0 leftover processes after teardown |
| crate-2 | crate | same tree | **670 / 670, 26 files** | 144.3 s | re-run before belief: 0 `ECONNREFUSED`, no banner in front.log, 0 leftover processes |
| fixture-final-1 | fixture | FINAL tree (markers unfilled) | 669 / 670, 26 files (1 failed) | 148.6 s | ONE failure: `bench.browser.test.ts` "pages report the chrome's own web-vitals" — a `body-click` run's INP beacon arrived null, the pre-existing flake class (issue #16; unit 8's fixture-1 and unit 7's crate-3 met the same leg). 0 `ECONNREFUSED`, no banner, 0 leftover processes; re-run before belief |
| fixture-final-2 | fixture | FINAL tree | **670 / 670, 26 files** | 143.7 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |
| crate-final | crate | FINAL tree | **670 / 670, 26 files** | 148.9 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |

Nothing was edited after the three final runs except this table's rows and the two sentences in the build-log entry that quote them (and the byte figure that entry states for the log, converged in place).

## After the rebase onto unit 8's completing commit (`7a3f568`, PR #50), 2026-09-26

The branch was rebased onto main after PR #50 merged; the `workers-hardening` node was re-compacted from that commit's text and its narrative sub-entry rebuilt from that version's removed lines (docs only; `pnpm run check` 40/40 on the rebased tree, the ceiling leg green after the raise). The suites ran again, alone, on a machine carrying Spotlight indexing (`mds_stores` at 87% CPU), a VM and other sessions' idle processes — the environment unit 7 recorded for wrangler 4.110's front-server crash.

| run | mode | tree | result | wall | notes |
|---|---|---|---|---|---|
| rebased-fixture-1 | fixture | rebased | 669 / 670 (1 failed) | 149.9 s | the INP-null bench leg again (issue #16's class); 0 `ECONNREFUSED`, no banner |
| rebased-crate-1 | crate | rebased | 258 failed / 285 passed / 27 skipped of 570 — **the plane** | 301.3 s (hook cap) | wrangler's "Error inside ProxyWorker … internal error" and the "please create an issue" banner in front.log, 82 `ECONNREFUSED` |
| rebased-fixture-2 | fixture | rebased | **670 / 670** | 144.6 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |
| rebased-crate-2 | crate | rebased | 421 failed / 111 passed / 38 skipped of 570 — **the plane** | 383.6 s | the same crash, 154 `ECONNREFUSED`, banner present |
| rebased-crate-3 | crate | rebased | **670 / 670** | 145.1 s | 0 `ECONNREFUSED`, no banner, 0 leftover processes |

Two crate crashes in a row on one tree is the most this record has seen; the third run passed with the same code and the load average one point lower. The flag for Rob stands: wrangler 4.110 under load; 4.141.0 is available. The amend after the push — the ceiling observation in the test, the entry, the README and this line — edits docs and one test comment/constant only; no suite was re-run for it, and the PR's CI origin job runs the suite on the amended tree.
