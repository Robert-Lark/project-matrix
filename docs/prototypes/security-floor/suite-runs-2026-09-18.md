# Origin-suite runs — security floor (unit 6), 2026-09-18

Every run alone on the machine (no agents, no builds, no edits), per the
standing rule; logs in the session scratchpad
(`suite-fixture-1.log`, `suite-crate-1.log`, `suite-fixture-final.log`,
`suite-crate-final.log`). Base tree: `17b39ce` + this unit's working tree.

| run | mode | result | wall | notes |
|---|---|---|---|---|
| 1 | fixture | 622 / 622, 23 files | 143 s | 579 legs before this unit + 43 new (security-floor.test.ts 43 → see file; data-plane +3; blog +4); front log: 8 `chrome-slot-count` errors, all the recorded 404 shapes (Next `__next_error__` on PDP/PLP junk, qwik root) — none this unit's |
| 2 | crate | 622 / 622, 23 files | 143 s | same eight recorded 404-shape `chrome-slot-count` errors in the front log, none this unit's; `/vanilla/editorial/` header block 202 → 308 B on the wire with the floor (the 106 B the module spells) |
| final | fixture | 622 / 622, 23 files | 143 s | on the final tree — after the verify-slice fixes, the record rewrites and the master regeneration; 0 leftover processes |
| final | crate | 622 / 622, 23 files | 143 s | same; front log: the eight recorded 404-shape slot-count errors, nothing of this unit's |

Per-file counts for the new legs come from the vitest summary lines in the
logs (`grep -E '✓|×' … | wc -l`), never tallied by eye.
