# Verify-slice, measurement pass PR-2 (2026-10-13)

Run as `.claude/workflows/verify-slice.js` by scriptPath against the worktree
(run `wf_5bf07c19-050`, four lenses in sequence, 43 minutes, 218 tool uses, the
session scratchpad as the findings directory), AFTER the sabotage table and with
inline probing in the foreground meanwhile. Raw: 23 findings (correctness 5,
issue-ADR conformance 5, seams 6, anti-rigging skeptic 7). Distinct: 12. Refuted
inline: 0. Folded: 11, with one content item recorded as owed rather than edited.
Every fold was re-verified by the round-2 sabotage table, the final `pnpm run
check` and the final-tree origin-suite pair.

| # | finding (lenses) | verdict | fold |
|---|---|---|---|
| 1 | Build-log "cells moved by 7 to 148 B": the smallest move is 2 B (astro, slow-4G, 771 to 769) (correctness, conformance, skeptic) | confirmed by `jq` over the two receipt sets | "2 to 148 B" |
| 2 | Build-log "runs span 24 to 40, three absent" is warm-only; the methodology page derives BOTH columns: 201 of 210 valued runs, 16 to 40 ms, nine absent; the retired set's "24 to 32" was both-columns with two absent (all four lenses) | confirmed against the built page | sentence rewritten with the scope stated and the page's derived figure quoted |
| 3 | Sabotage header "15 caught, 7 controls": the table holds 16 and 6 (seams) | confirmed by `grep -c` | header corrected with the correction noted; the runner now prints a derived summary line |
| 4 | `publish-refusals.test.js` header still says "the three receipts the plane actually publishes" (correctness, seams, skeptic) | confirmed, six files | comment reworded |
| 5 | `publish-fixtures.test.ts` lists three `schemaValid: false` exceptions, the generator now flags four (seams) | confirmed | the fourth named |
| 6 | `workers-hardening` node: "The three real receipts still admit under the pre-quiescence rule (unchanged)" is present tense and false after this commit (conformance, skeptic) | confirmed | past tense, retired by PR-2 |
| 7 | `interaction-registry` node keeps "it is what main publishes today" verbatim with the discharge appended; the runbook's PR-2 step 4 said to update that clause (seams) | confirmed against the runbook | "it was what main published until 2026-10-13" |
| 8 | `fit.mjs` PDP `interactionTiming` comment cites only the artifact-less 2026-08-28 probe (qwik slow-4G 0 ms) while the committed receipt reads 8 ms (conformance) | confirmed | one paragraph naming the committed batch's figures, the probe kept as the dated origin |
| 9 | Evidence README's reproduce step says "from a checkout at the attested SHA"; after this PR deploys the plane attests the merge SHA and `origin-commit.ts` refuses a checkout at `a0ae215` (correctness, skeptic) | confirmed by reading `origin-commit.ts:77-84` | instruction rewritten to the methodology page's form, with the `--allow-cross-tree` escape and what it costs |
| 10 | The open `measurement-pass` node (6,690 B) leaves PR-3 478 B under the cap; the PR-2 bullet repeated numbers the map's header says never to repeat (all four lenses) | confirmed with the cap guard's own `splitNodes` | bullet cut to decisions, the stated limit and the owed list (node 6,400 B); the PR-3 compaction obligation recorded in the entry and the node |
| 11 | The gate checks a self-reported literal; a pre-fix receipt with the key added by hand admits, and neither the comment nor the table states the limit (skeptic) | confirmed: `batch.ts` writes the literal, nothing derives it | stated in the gate's comment and in the entry; sabotage row R6 (all three HEAD receipts, key added by hand, expected MISSED) added and run in round 2 |
| 12 | The em-dash guard walks `git ls-files`, so on the uncommitted tree E0 proved only the three tracked receipts; the untracked set was unproven (skeptic) | confirmed | E0's text states the scope; the untracked set grepped by hand (0 glyphs); the guard re-run after `git add` before the commit |
| 13 | Home's PLP row still says "filters not yet served", false since 2026-09-18; the slice's own README justification applies to the served page (seams) | confirmed, pre-existing, ADR-0007 copy | NOT edited: recorded as owed in the node and the entry, Rob's content call (same class as the PDP measured line) |
| 14 | The record README cites `verify-slice-2026-10-13.md` before it exists (conformance, seams) | expected mid-pass | this file |

Nothing the lenses found moved a published number or a refusal; every fold is a
record, a comment, a row or a stated limit. The two findings that would have shipped
a falsehood beside the artifact that refutes it (1 and 2) are the class the entry
itself says the pipeline exists to prevent, caught here by the pass, which is what
the pass is for.
