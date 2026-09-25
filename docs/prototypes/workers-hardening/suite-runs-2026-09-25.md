# Origin-suite runs — workers hardening (unit 8), 2026-09-25

Every run alone on the machine as far as this session controls it (no
agents, no builds, no edits during a run). Logs in the session scratchpad
(`suite-fixture-1.log` …). Base tree: `c7ed377` + this unit's working tree.

| run | mode | result | wall | notes |
|---|---|---|---|---|
| fixture-1 | fixture | 669 / 670, 26 files (1 failed) | 149.2 s | ONE failure: `bench.browser.test.ts` "pages report the chrome's own web-vitals" — a `body-click` run's INP beacon arrived null within the settle cap, the pre-existing bench-timing flake class (issue #16; unit 7 crate-3 met the same leg). No crash marker in front.log, 0 `ECONNREFUSED`, 0 leftover processes; re-run before belief |
| fixture-2 | fixture | **670 / 670, 26 files** | 143.8 s | 669 legs before this unit + 1 new (data-plane: the beacon value 400); 0 `ECONNREFUSED`; front log: the recorded eight `chrome-slot-count` 404 shapes, nothing of this unit's; 0 leftover processes |
| crate-1 | crate | **670 / 670, 26 files** | 143.8 s | 0 `ECONNREFUSED`; front log: the eight recorded shapes, nothing of this unit's; 0 leftover processes |
