# Compact the decision map — the split moment its header deferred has arrived

**Priority 8 of the 2026-08-29 audit.** The map is 194,751 bytes (~48k tokens), loaded in
full into every session, and its own 2026-08-29 header deferral ("the next call… cheaper
than either option is today") was falsified within hours of being written: the three nodes
appended THAT SAME DAY are the file's #1, #2 and #6 heaviest — plp-htmx ~21.0 KB,
plp-react-next ~16.7 KB, checkout-vanilla ~11.5 KB ≈ 49.3 KB, **25% of the file** — each
carrying verify-slice narratives and measured numbers the same-day restated rule
(`decision-map.md:5`: "Evidence, narrative, measured numbers… live in build-log.md and are
LINKED from here, never repeated") says belong in the log. The header's own size figure
("~182 KB") is 12.7 KB stale by its own command. Growth is ~4k tokens per unit and three
units landed in one day. A rule nothing enforces and everything violates is the state the
header itself called "worse than no rule".

All figures above tool-derived and re-verified 2026-08-29
(`git cat-file -s HEAD:docs/decision-map.md`; awk over `^### ` boundaries; `grep -c '^### '`
→ 29 nodes). Re-derive before editing — never type a count.

---

## The shape (compaction, not per-phase archive)

The verifier's analysis holds: cross-node `Blocked by:` edges are name-based and need
single-file lookup, and the build record's designated home already exists — `build-log.md`
(412 KB, append-only, NOT session-loaded). So: compact in place, move narrative to the log.

## Tasks

1. **Compact the ~10 heaviest resolved nodes** to the header's own stated shape — QUESTION,
   ANSWER as decisions with tradeoffs, and what is OWED — with a link to the build-log phase
   carrying the narrative. Before deleting any prose from the map, confirm it exists in
   `build-log.md` (or move it there in the same commit); the record must not lose a byte of
   provenance, only its duplicate copy. Leave open nodes untouched.
2. **Fix the falsehoods the audit pinned while you are in the file:**
   - `:376` interaction-registry "NOT MERGED" — merged as #35 (`ae97f8e`, 2026-08-28); the
     map self-contradicts at `:433`. (If the measurement pass has already fixed this, skip.)
   - `:528`'s "the first PAGE path in the repo that reaches KV" — false; request-time
     editorial pages have reached KV server-side since slice B.
   - The header's "~182 KB" — re-derive, or better, drop the number and keep the command.
3. **Enforce the rule instead of restating it:** a `tools/repo-checks` leg failing any
   RESOLVED node over a stated byte cap (derive the cap from the compacted file's
   distribution; the open-node exemption keeps active work unconstrained). Give it the
   non-vacuity clause the house style requires — zero resolved nodes must fail the leg, not
   pass it.
4. **Record the decision** as the map-header update the header itself promised ("That is
   the next call").

## What is given up (state it in the commit)

A future reader of the map alone loses the in-place narrative for compacted nodes and must
follow one link. That is the designed shape (`:5`); the current state — where sessions pay
~48k tokens before any work starts — is the one the header already ruled against.

## Done means

`git cat-file -s` on the new map comes in meaningfully under the current 195 KB with zero
provenance lost (every moved paragraph findable in build-log.md); the repo-checks leg bites
(sabotage: paste one narrative back into a resolved node, watch it fail, restore); the
header's rule, the leg, and the file agree.
