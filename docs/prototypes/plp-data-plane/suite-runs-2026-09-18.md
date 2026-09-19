# Origin-suite runs, 2026-09-18 (summaries; logs not committed)

Every run alone on the machine, per the runbook rule. Tree = `05a4f58` + the day's fixes.

| run | mode | tree | result | duration | note |
|---|---|---|---|---|---|
| fixture 2 | fixture | resumed WIP + 404-leg fix | 572 passed / 1 failed | 673 s | the one failure: `bench.browser.test.ts` one-command-reproduce at its 600 s cap; timeout-shaped, re-run |
| fixture 3 | fixture | same | 573 / 573 | 144 s | the hang did not recur |
| crate 1 | crate | same | 573 / 573 | 143 s | |
| fixture final | fixture | + verify-slice fixes (6 new legs) | 579 / 579 | 143 s | |
| crate final (attempt 1) | crate | same | 0 / 206 reached the plane | — | the front Worker's `wrangler dev` died 7 s in with an empty internal error; not the code |
| crate final (attempt 2) | crate | same | 579 / 579 | 142 s | |

The first fixture run on the tree (2026-09-04, 567 / 6 failed) is `suite-fixture-run-1.log`,
kept because it documents the six defects the resume answered.
