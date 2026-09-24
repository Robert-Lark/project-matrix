# Origin-suite runs — checkout measure-prep (unit 7), 2026-09-24

Every run alone on the machine as far as this session controls it (no
agents, no builds, no edits during a run); the machine also carried
Spotlight indexing (`mds_stores`, ~30 % of memory), a Virtualization.framework
VM and another session's `wrangler dev` (a Discogs edge-worker on port 8798)
throughout — load average 8–17. Logs in the session scratchpad
(`suite-fixture-1.log` … `suite-crate-5.log`). Base tree: `7771bdc` + this
unit's working tree.

| run | mode | result | wall | notes |
|---|---|---|---|---|
| fixture-1 | fixture | 241 failed / 291 passed / 35 skipped | 301 s | PLANE: the front's wrangler (4.110) died mid-run with its empty internal error (`Error inside ProxyWorker … internal error; reference = ja2p6gbu142mbldmgtkee8kf` in the wrangler log); 40 legs met `ECONNREFUSED 127.0.0.1:8787`, 65 timed out at 5 s. The memory file's recorded class. |
| fixture-2 | fixture | **666 / 666, 26 files** | 144 s | 622 legs before this unit + 44 new; front log: the recorded eight `chrome-slot-count` 404 shapes, none this unit's; 0 leftover processes |
| crate-1 | crate | 297 failed / 243 passed / 27 skipped | 265 s | PLANE: the same wrangler crash (front.log carries the "please create an issue" banner); 134 `ECONNREFUSED`; the editorial pixel legs' "broken image loads" are images the dead front could no longer serve |
| crate-2 | crate | did not start | — | pre-flight: `port 8790 is already bound` — a socket still closing inside crate-1's five-second teardown window; no process held it a minute later (lsof) |
| crate-3 | crate | 665 / 666 | 152 s | ONE failure: `bench.browser.test.ts` "pages report the chrome's own web-vitals" — a `body-click` run's INP beacon arrived null within the settle cap, the pre-existing bench-timing flake class (issue #16); no crash marker; re-run before belief |
| crate-4 | crate | killed at the 10-minute cap | — | every `cart.browser` leg met a 30 s navigation timeout — the plane stalled; the cap's SIGTERM tore the tree down (0 leftovers) |
| crate-5 | crate | **666 / 666, 26 files** | 144.6 s | front log: the eight recorded slot-count shapes, nothing of this unit's; 0 leftover processes; the run that stands |

The new legs, counted from single-file runs on the held plane (the
non-TTY vitest reporter writes no per-file line for a passing file):
`checkout.test.ts` 11 · `checkout.browser.test.ts` 13 · `bench-checkout.browser.test.ts`
11 (8 before the verify-slice pass added the three first-input legs) ·
`security-floor.test.ts` +2 (36 → 38) · `drift.browser.test.ts` +10 (two
masters-health legs for `checkout/placed`, eight vanilla-vs-master legs
for the two checkout pages). 11 + 13 + 11 + 2 + 10 = 47 = 669 − 622; the
666 runs above were taken before the pass, and the skeptic lens refused
them as verification of the final tree — the two runs below are that.

| run | mode | result | wall | notes |
|---|---|---|---|---|
| final | fixture | **669 / 669, 26 files** | 144.0 s | the final tree: after the verify-slice fixes, the record rewrites and the master regeneration; `pnpm run check` 36/36 immediately before; front log: the eight recorded slot-count shapes; 0 leftover processes |
| final | crate | **669 / 669, 26 files** | 144.2 s | same tree, same eight recorded shapes, 0 leftover processes |

One edit followed the two final runs, and it is a comment: the bench leg had
claimed the suite log carries the samples it prints, and these two logs
showed vitest's non-TTY reporter carries no console output at all (zero
`stdout |` markers). The comment now says the samples are visible in a
single-file run and that `probe-samples.browser.test.ts` is the reproducing
step. No test outcome can depend on a comment.
