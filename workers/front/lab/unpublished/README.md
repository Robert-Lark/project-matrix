# Evidence receipts: measured, recorded, not published

These three receipts are the `pdp-add-to-cart` batch, minted 2026-10-13 against the
deployed plane at its attested commit `a0ae215` (nonce `pdp-add-to-cart-2026-10-13`,
three profiles, cold and warm, seven runs each, the same ruler and the same day as the
published `pdp-gallery-switch` batch in `../receipts/`). They publish no cell.

**Why they are here and not in `../receipts/`.** The front build reads every `*.json`
in `../receipts/` and publishes one receipt per (surface, profile): the slot is keyed
by surface, and a surface publishes ONE interaction, the one `lab/fit.mjs` declares
(`FIT.pdp.interactionId: "pdp-gallery-switch"`, ADR-0001 addendum T). Filed under
their own name the build refuses them by filename (`publish.mjs`, `filename-profile`;
its instruction to rename the file is misleading for this one, since the renamed file
is then refused by interaction); written over the gallery receipts it refuses them by
interaction (`wrong-interaction`). Both refusals are sabotage-proven in
`docs/prototypes/measurement-pass/`. So the evidence lives one directory up, where
nothing serves or embeds it, and this README is the pointer the decision record cites.

**What they are evidence FOR.** The decision, taken by the interaction-registry unit
(decision map, `interaction-registry`; ADR-0001 addendum T), that the PDP publishes
NO INP row: Chromium closes an interaction's event-timing entry at the first paint
after the handler's synchronous processing returns, and Qwik's resumed handler
returns having only scheduled its render, so its entry closes on a paint that carries
nothing. The 2026-08-28 probe showed one column swinging 0 to 24 ms across conditions
while the other three held at 24, and switching interactions did not escape it. These
receipts are the re-measurement of that second interaction on the fixed ruler, so the
claim "switching to the other interaction does not escape it" rests on an artifact a
reader can open, not on the probe's memory. Warm-column INP medians per variant per
profile, in ms, with every run behind each median, read from the files with `jq`:

| profile | vanilla | react-next | astro | qwik |
|---|---|---|---|---|
| avg-broadband-desktop | 24 (runs 24, 24, 32, 24, 16, 32, 16) | 24 (runs 16, 32, 24, 32, 24, 24, 24) | 24 (runs 24, 16, 24, 24, 24, 16, 32) | 8 (runs 8, 8, 8, 8, 8, 8, 8) |
| fast-wifi-laptop | 24 (runs 24, 16, 24, 16, 24, 16, 24) | 24 (runs 24, 24, 16, 24, 16, 24, 24) | 24 (runs 16, 32, 24, 16, 32, null, 24) | 8 (runs 8, 8, 8, 8, 8, 8, 8) |
| slow-4g-mid-phone | 24 (runs 24, 24, 24, 24, 24, 24, 24) | 32 (runs 32, 32, 32, 32, 24, 32, 32) | 24 (runs 24, 24, 24, 24, 24, 24, 24) | 24 (runs 24, 24, 24, 24, 24, 24, 24) |

The published gallery batch, same day, reads qwik 8 ms on average broadband and on
slow-4G and 24 ms on fast-wifi, with 0 ms runs inside both 8s; here it is 8 ms on the
two faster profiles and 24 on the slow one. Which column carries the race moves with
the condition; that it is qwik's column, and that the other three hold at 24, does
not. A `null` is a run that produced no INP; the median is over the runs that did.

Interaction bytes: the add-to-cart click fetches nothing on any variant, 0 B in
every run of every column on every profile (`jq '[.targets[].columns[].runs[].kb.interactionBytes]|unique'`
prints `[0]` for each file).

**Provenance, the same bar as a published receipt.** `commit.sha` = `originCommit.sha`
= `a0ae215`, `commit.dirty` false, `originCommit.dirty` false, `harness.quiescence`
`"in-flight-tracked"`, every run `interactionSettled: true`, one UTC date. Reproduce:
`pnpm bench reproduce workers/front/lab/unpublished/<file> --nonce pdp-add-to-cart-2026-10-13`
from a checkout at the SHA the plane attests at `/_pm/build.json` (the merge that
carries this file, or later), the methodology page's own instruction; the runner
refuses a checkout the plane is not serving, so a checkout at `a0ae215` itself needs
`--allow-cross-tree` and mints a receipt that records the disagreement and that the
publication build would refuse (`tools/bench-runner/README.md`). The fresh receipt
pins the tree it measured, exactly as these do.
