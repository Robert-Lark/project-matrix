# Verify-slice, measurement pass PR-3 (2026-10-17)

Run as `.claude/workflows/verify-slice.js` by scriptPath against the worktree (run
`wf_28f45df5-778`, four lenses in sequence, 39 minutes, 168 tool uses, 693k subagent
tokens, the session scratchpad as the findings directory), AFTER sabotage round 1 and
with inline probing in the foreground meanwhile. Raw: 17 findings (correctness 3,
issue-ADR conformance 3, seams 3, anti-rigging skeptic 8). Distinct: 11. Refuted
inline: 0. Folded: 9, with two recorded as stated limits and owed follow-ups rather than
closed here. Every fold was re-verified by sabotage round 2, the final `pnpm run check`
and the final-tree origin-suite run.

| # | finding (lenses) | verdict | fold |
|---|---|---|---|
| 1 | The sabotage runner scores a guard that crashed, was killed or hit `maxBuffer` as CAUGHT: `run.status` is null, `?? -1` is non-zero (correctness) | confirmed against Node's `spawnSync` contract; the same shape is in PR-2's `sabotage.mjs` | a `RUNNER ERROR` verdict, counted in the summary line, never a pass; PR-2's runner left as the dated record it is |
| 2 | README cites `verify-slice-2026-10-17.md` before it exists (correctness, conformance, seams, skeptic) | expected mid-pass | this file |
| 3 | 6,855 B of log headroom for the verification paragraph still to come (correctness, skeptic) | confirmed by `wc -c` | the paragraph measured before and after the append; the final size stated in it |
| 4 | A fourth `collect.ts` comment (line 709, "includes response HEADER bytes") and two `decompose.test.ts` comments and titles still carry the reading the ADR note says is gone (conformance) | confirmed by `grep -n -i header`; the phrase search missed the paraphrase | all three reworded to the addendum-U reading; the ADR note's count corrected to four, one and two; the record's grep sentence rescoped |
| 5 | The new Q "Landed" note says PR-2's receipt removal is recorded under R; it is under T (conformance, skeptic) | confirmed: lettered headings at 730/790/871/1025, the note at 1016 | `(T, Landed)` |
| 6 | The `security-floor` node still presents the addendum-O flag as open, so two nodes in the map disagree about where the phrase lived (seams) | confirmed, node 5,532 B | one discharged clause appended; node 5,663 B |
| 7 | The PR-3 bullet says three of Rob's items are "listed in the log entry" and the entry named only the qwik flake (seams) | confirmed against the staged diff | the carry-forward paragraph names all of them |
| 8 | The sabotage table promised a round 2 it did not record, and the committed runner's N3 row differed from the one the table recorded (seams, skeptic) | confirmed | round 2 run over the whole table with the fixed runner and recorded |
| 9 | No gate reconciles `deltaMedians` or `runsPerCondition` with the artifact's own `conditions` runs; a hand-edited delta publishes beside bands from the runs (skeptic) | confirmed: `grep -n conditions publish.mjs` is empty; the committed artifact is self-consistent (sorted with-runs median 700, without 628) | NOT closed here: stated as a limit in the node and the entry, sabotage row P6 (expected miss) added, the check recorded as owed. Rejected closing it in this PR: the fixture constant carries no `conditions`, so the gate needs a fixture-shape change across twelve files and its own verification; the PR that closes the runbook is the wrong place for a new gate |
| 10 | The probe's first visit is always a with-chrome visit on a cold browser; in every artifact the largest with-sample is run 0, and the 118 ms long-task sample rides it (skeptic) | confirmed from `chrome-constant.ts` (one launch, run 0 opens `with`, no warm-up) and the four artifacts' run lists | NOT closed here (the probe is untouched by this slice): the confound stated in the entry, the record and the node; a discarded warm-up visit recorded as owed |
| 11 | The entry's "2,438 B" for the moved paragraphs reproduces as 2,437 by the guard's `splitNodes` rule and names no command (skeptic) | confirmed: my figure joined the lines with blank lines and no trailing newline | 2,437 B, the rule named |

Also noted by the correctness lens and left as a stated limit of the runner: vitest exits 0
when a `-t` filter matches nothing, so a control row on a filtered leg (C0, L0) passes
vacuously if the leg's title is reworded; its paired defect row then prints MISSED, which
is loud, so the shape is a false-fail, not a false-pass.

Nothing the lenses found moved a published number or a refusal; every fold is a record, a
comment, a row or a stated limit. The two that mattered most are the two left open on
purpose, both about what the constant's gate and probe do not yet prove, and both are in
the node's owed list where the next pass will find them.
