# Verify-slice, the constant's two stated limits (post-runbook unit 1, 2026-11-01)

`Workflow({scriptPath: ".claude/workflows/verify-slice.js"})`, run `wf_6daf2655-469`, the
four lenses in sequence (correctness, issue/ADR conformance, seams and integration,
anti-rigging skeptic), each streaming its findings to the session scratchpad as it went,
while the main session probed inline. Started 18:06Z after sabotage round 1 and the
suite runs; the lenses reported between 18:13Z and 18:40Z, and the tree moved under the
later ones as the earlier ones' folds landed (each lens re-opened its citations on the
tree as it stood and dropped what a concurrent fold had already fixed). The slice under
review: the gate (`admitChromeConstant`), the fixture constant and its rows, the probe's
warm-up visit, and every record of this unit. Accepted knowns given to the lenses and not
reported: the ceiling observation pending the push; crate mode's plane failures; the
medians-not-runs limit (P6); the untested warm-up (W1); the re-probe as a follow-up; Rob's
Terms call recorded verbatim beside the older "notices owed" sentence.

## Findings, folds and refutations

| # | lens | finding | verdict | what was done |
|---|---|---|---|---|
| 1 | correctness | The method sentence and the loop comment say "every artifact" put its largest with-sample at run 0; the record's own table says six of seven (`fabcb9a`, the first local probe, peaked at run 6) | confirmed by `jq` over `git show` across the file's history | FOLDED: both now read "six of the seven artifacts before 2026-11-01, and all four measured on the deployed plane" |
| 2 | correctness | ADR L note and log entry say three of four deployed-plane artifacts carry their ONLY long-task sample at run 0; two of them (`770a6d8`, `7c5be98`) carry a second at run 5 (51, 64 ms) | confirmed from the same loop's `longTaskMs` lists | FOLDED: "carry a long-task sample there (55, 57 and 118 ms; two of them a second one at run 5, 64 and 51 ms)" in both |
| 3 | correctness | `conditions.*.medians`, which the runner writes beside the runs, is read by nothing and reconciled with nothing; a hand-edited stored median publishes in the raw artifact | confirmed: `grep -n medians publish.mjs` had no reader | FOLDED: fourth site `cc-stored-median` (checked after the delta, so a run edit breaking both is named by the published figure), fixture row `cc-stored-median`, counts updated everywhere |
| 4 | correctness | README indexes `verify-slice-2026-11-01.md`, not yet in the tree | confirmed, expected mid-pass | this file |
| 5 | correctness | The limits record says one commit prints nothing from the history loop; two do (`ae97f8e` and `019449f` both removed the artifact) | confirmed by `git cat-file -e` | FOLDED: the sentence names both |
| 6 | correctness (caveat) | The without-chrome warm-up never requests the chrome's own subresources (stripped from that document), so a plane-side cold hit on `/_pm/chrome.css`, the mono and `measure.js` is still first at run 0's with-chrome visit; whether that path is edge-cached is unverified | stated, not a defect: the warm-up's claim is about the browser process | FOLDED as a sentence in the limits record and the log entry: the first place to look if the re-probe still spikes at run 0 |
| 7 | conformance | ADR L note, probe comment, limits record and log entry cite addendum S as the rule the probe follows; S names the probe as its stated EXCEPTION (it routes, so the cache is off in both arms), and the fresh-context fact belongs to section 4 | confirmed at ADR-0001 addendum S's "Stated exception" paragraph | FOLDED in all four places: fresh context per visit (section 4); the probe is S's exception, cache off within every visit, so nothing carries either way |
| 8 | conformance | `cc-runs-count` holds the list LENGTH, not the usable-sample count; the lens built an artifact with six of seven with-chrome FCPs null and the recomputed delta written in, and the gate admitted a one-sample median beside "7 runs per condition" | confirmed by the lens's own script against the gate with stand-in deps | FOLDED: fourth site `cc-usable-samples` (every run carries a finite value for every metric, the receipts gate's `incomplete-run-set` shape), fixture row, placed before the delta check so it is named first |
| 9 | conformance (note) | The probe header's bullet still said "round-robin interleaved (with, without, with, …)" while the loop and the method sentence say ABBA; pre-existing text | confirmed, pre-existing | FOLDED: the bullet now says pair-interleaved in alternating order |
| 10 | seams | With `cc-usable-samples` in the gate, the probe would still exit 0 and write an artifact carrying a null paint, which the build then refuses after the mint, the step that costs an hour on the attested plane; the probe's own `--runs` comment says a tool that exits 0 for an unpublishable measurement lies at the point of use | confirmed from `chrome-constant.ts` (`median` over non-null, no refusal before `writeFileSync`) | FOLDED: after the loop the probe throws on any run whose FCP or LCP is null, naming the run and condition, and writes nothing |
| 11 | seams | README line says "the two refusal sites" fifteen lines above "the gate's four new sites" | confirmed | FOLDED: "four" |
| 12 | seams | The log entry cites an eight-shape median comparison "in the limits record"; the record had no such one-liner | confirmed by `grep` | FOLDED: the one-liner and its eight outputs are in the record under "The gate" |
| 13 | seams | Same as 4 | confirmed | this file |
| 14 | skeptic | Same as 4 and 13; the two extra sites rest on a document not yet written | confirmed | this file |
| 15 | skeptic | README and limits record say the warm-up sentence is the LAST entry of the `method` array; it is the seventh of eight, before the scope sentence | confirmed (`awk` over the array: 8 entries; the sentence at line 617, scope at 618) | FOLDED: both records say seventh, before the scope sentence that stays last |

Refuted or dropped by the lenses themselves, recorded here so the next reader does not
re-raise them: the median filter difference (`v !== null` against finite number) admits
identical values for every artifact the runner can write, JSON carrying neither `NaN`,
`Infinity` nor `undefined`; `!==` on the recomputed delta is exact because a JSON number
round-trips to the same double and the gate performs the runner's own subtraction; `0`
and `-0` compare equal and `x - x` is `+0`; the warm-up visit disturbs neither the ABBA
order, the sample count, the mid-probe attestation re-fetch nor the fragment check (it
sits after `fetchRawTarget` and before the loop, pushes nothing, and the re-fetch is after
the loop); the 51st `// refusal:` line a plain grep counts is the header comment at line
19, which the test's marker-then-throw regex does not count; CI runs the refusals test
through `turbo run lint typecheck test`, `@pm/repo-checks#test` is uncached so the
docs-reading guards never replay stale, and the origin suite's constant leg reads kind,
dirty and the two paint deltas only.

## Where the folds left the gate

Four sites between the finite-delta check and the provenance bar, in this order:
`cc-runs-count` (list length), `cc-usable-samples` (finite value per run per metric),
`cc-delta-mismatch` (the published delta against the medians of the runs),
`cc-stored-median` (the stored per-condition medians against the same). Six fixture rows,
68 `CASES`, 60 fixture files, 82 refusals legs, 52 throw sites and 52 markers. The probe
refuses a null paint at mint. The sabotage table was re-run after each fold (rounds 3, 4
and 5), 25 rows each time, 16 caught, 7 controls, the same 2 expected misses.

## Verification of the folds

Each fold ran the refusals suite (82 of 82), the front typecheck (`tsc --noEmit` exit 0,
after two rounds of JSDoc casts the checked `.mjs` needed), the front build (exit 0, the
absent statement 0 times, the +72 ms figure once), the runner's typecheck and build, and
`pnpm run check` (40 of 40, five times across the unit). The sabotage runner's own anchors
drifted twice under the folds (G5's median line after the typecheck casts, G3's block tail
after the fourth site) and each time died on its `anchor not found` guard with every file
restored, which is the runner behaving as designed; both anchors were re-aimed and the
round re-run in full.
