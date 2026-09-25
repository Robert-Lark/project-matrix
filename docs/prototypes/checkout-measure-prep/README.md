# checkout-measure-prep — the record's loose files (unit 7, 2026-09-24)

The unit's account is the build-log entry "The form that could not place an
order, and the summary that moved the form" and the decision-map node
`checkout-measure-prep`; the decisions are ADR-0008 addendum D and ADR-0001
addendum V. This directory holds what those cite and what a reader would
want to re-run.

- `suite-runs-2026-09-24.md` — every origin-suite run of the day, as it
  happened, including the four that died on the plane and the one that
  failed on a recorded flake. The two that stand: fixture 666/666, crate
  666/666.
- `sabotage-2026-09-24.md` — round 1 (39 rows) and round 2 (over the
  verify-slice fixes), with the runner defect that made the first pass
  worthless and the control row that exposed it.
- `probe-checkout.mjs` — the inline probe that measured the layout shift
  before and after the fix, the empty summary's geometry, the 320 px
  overflow check and the JS-off POST. Run it against a held plane:
  `PM_HOLD=1 node tools/origin-suite/run-local.mjs` in one shell, then
  `node docs/prototypes/checkout-measure-prep/probe-checkout.mjs <label>`
  in another. It reads the fixture's priced ids from the committed trays
  and writes one screenshot per case into the current directory.
- `probe-first-input.mjs` — which entry web-vitals' INP reduces to for each id, in
  three modes (the first draft, what ships, the rejected priming); the suite's
  own guard for the same claim is `bench-checkout.browser.test.ts`.
- `probe-samples.browser.test.ts` — the six `measureVisit` samples the records
  quote, as a reproducing step (its header says how to run it).
- `probe-fill-events.mjs` — the probe that established that Playwright's
  `fill()` registers no event-timing interaction while clicks and
  keystrokes do; the fact ADR-0001 addendum V rests on.

Numbers quoted in the records come from these runs and from the suite's
own legs, never from a tally by eye.
