# Verify-slice, the re-probe (post-runbook unit 1 follow-up, 2026-11-17)

`Workflow({scriptPath: ".claude/workflows/verify-slice.js"})`, run `wf_54bafaf6-562`, the
four lenses in sequence (correctness, issue/ADR conformance, seams and integration,
anti-rigging skeptic), each streaming its findings to the session scratchpad as it went,
while the main session probed inline. Started 22:43Z after sabotage round 1 and the five
suite runs; the lenses reported between 22:52Z and 23:14Z, and the tree moved under the
later ones as the earlier ones' folds landed (each lens re-opened its citations on the
tree as it stood and dropped what a concurrent fold had already fixed; the seams lens
records the 2026-11-01 owed tail as folded "by the parent mid-review"). The slice under
review: the new artifact, every record of this unit, the node's bullet and Status, the
ADR note, the log entry and sub-entry. No code changed. Accepted knowns given to the
lenses and not reported: the entry's verification paragraph pending; the home PLP row
Rob-gated and not edited; the qwik stepper smoke red as unit 3's; the wrangler bump as
unit 2's; P6, P7 and W1 as stated limits; the crate run's load average; the post-probe
edge HITs not proving HITs at run 0; the long task's cause not claimed.

## Findings, folds and refutations

| # | lens | finding | verdict | what was done |
|---|---|---|---|---|
| 1 | correctness | The record and the entry named renderer-local firsts (first parse of the stylesheet, first decode of the font, first compile of `measure.js`) as the shapes that fit the run-0 long task; every recorded visit opens a fresh context and Chromium never shares a renderer across contexts, so every with-chrome visit pays those, and six of seven report 0 ms | confirmed against `chrome-constant.ts` (`newContext` per visit) and Chromium's process-model doc, which the lens fetched | FOLDED in both: the renderer-local firsts are excluded by the probe's own design; what is left is process-wide (one network process, one GPU process) or plane-side, named as candidates |
| 2 | correctness | The runner's `caught=` counted `/^CAUGHT/`, which also matches "CAUGHT (expected MISSED, the stated limit was wrong)"; carried from the 2026-11-01 runner | confirmed by reading the verdict strings | FOLDED: `/^CAUGHT$/`, with a header note; zero such rows in either unit's rounds, so the figures were right |
| 3 | correctness | README indexes `verify-slice-2026-11-17.md`, not yet in the tree | confirmed, expected mid-pass | this file |
| 4 | correctness | The entry said PR #94 was "a private-details redaction in three docs"; the commit touched six files (a prototype lockfile and its `.npmrc` too) | confirmed by `git show --stat` | FOLDED: a mailbox address in three docs and a prototype lockfile's mirror URLs |
| 5 | conformance | The 2026-11-01 bullet's Owed sentence was deleted from the node, not moved; the sub-entry claimed only two lists moved | confirmed by string search over HEAD's map and the staged log | FOLDED: the sentence is in the sub-entry verbatim as a third block; "three owed lists" everywhere |
| 6 | conformance | The record said the parked worktrees were gone; `git worktree list` has 8 entries, five of them parked | confirmed by the command | FOLDED: the tool's output, by name, and the prune still Rob's question |
| 7 | conformance | "The 20 ms the delta grew by is the without-chrome arm": 16 ms is, 4 ms is the with-chrome arm slower | confirmed by `jq` on both artifacts' medians | FOLDED in the record and the entry |
| 8 | conformance | The ADR note, the node bullet and the Status stated the cause as settled ("proved", "was the cold process") where the record itself says one artifact is one data point; with no bias the largest of seven lands off run 0 six times in seven | confirmed as a strength-of-claim gap | FOLDED: "answered" in the Status; "on one artifact" on the node; the ADR note reads as one artifact's word with the next mint as the second data point; the record states the six-in-seven base rate and that the four-for-four prior is what gives the finding its weight |
| 9 | conformance | README index, as 3 | confirmed | this file |
| 10 | conformance | No blank line between the moved-narrative sub-entry's last quoted line and the entry's heading | confirmed by `sed -n l` | FOLDED: one blank line; masters byte-identical after |
| 11 | seams | Two quoted grep results did not reproduce: "grep 'DISCARDED warm-up' … finds nothing" finds the artifact itself and its gitignored receipts copy; "grep '+72' … finds only unrelated fixture receipts" finds nothing in the test and suite trees | confirmed by re-running both | FOLDED: both reworded to what the command returns; the substantive claims (no test asserts the sentence; nothing pins +72) hold |
| 12 | seams | The ADR note's record path was bare and relative to `docs/`, not resolvable from `docs/adr/`; the ADR's own precedent is a `../prototypes/` link | confirmed | FOLDED: a relative link in the ADR's form |
| 13 | seams | README index, as 3 and 9 | confirmed | this file |
| 14 | skeptic | The entry stated a `wc -c` figure for the log (805,429 B) that the staged file no longer had (806,412 B after folds) | confirmed | FOLDED: the sentence now carries the figure measured after the last edit, as the verification paragraph records it |
| 15 | skeptic | README index, as 3, 9 and 13 | confirmed | this file |
| 16 | skeptic | "Where the words went" said two owed lists moved; three did | confirmed | FOLDED: three |
| 17 | skeptic | The long-task narrative said the first with-chrome visit does something "later ones do not"; two of the four earlier artifacts carry a second with-chrome sample at run 5 (64, 51 ms), which the ADR's L note and the record's own table already show | confirmed from `git show` over both artifacts | FOLDED in the record and the entry: six non-zero samples across five artifacts, four at run 0 and two at run 5, none without the chrome; run 0 is the modal position, not the only one; the cause stays unclaimed |

Refuted or dropped by the lenses themselves, recorded here so the next reader does not
re-raise them: "addendum F = order of magnitude" is the methodology page's phrase under
F's rule, a paraphrase the node's PR-3 bullet already used, not a backwards citation; the
post-deploy smoke seam cannot split a cached page from a cached artifact (both served from
the same origin, `max-age=0, must-revalidate`, compared by the leg itself); CI's readiness
wait polls for a 200 and not for the attested SHA, pre-existing and not this slice's; the
A0 row's "52 throw sites" is the test's own regex count (a plain grep of `// refusal:`
counts the header comment too); the three subresource headers re-fetched by the seams lens
at 23:08Z matched the record; the plane, the PR and the CI run matched the record's
preconditions.

## Where the folds left the unit

No code moved: the probe and the gate are as PR #56 merged them. The artifact is
unchanged by any fold. The node is 7,057 B of 7,168 after the folds (`node-bytes.mjs`),
its Status quoting three log titles, each an exact heading. The sabotage table was re-run
in full after the folds (round 2, `sabotage-2026-11-17.md`).

## Verification of the folds

Each fold was followed by the glyph count over the edited files (`grep -c` of the U+2014
byte sequence, 0), the node measured with `node-bytes.mjs`, the masters regenerated and
compared by `md5` (byte-identical each time), and the files re-staged by path; the seams
lens re-ran the four docs guards on the folded tree (26 of 26) and the skeptic lens
measured the node at 7,057 B. Then `pnpm run check`, both reported in the entry.
