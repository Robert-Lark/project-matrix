# Run the post-merge measurement pass — the site's only blocker

**Priority 1 of the 2026-08-29 audit.** Every number the site publishes today rides three
editorial receipts minted 2026-08-17 at `1c543ac` on the **pre-#35 broken ruler** — their
`interactionSettled: true` flags are unearned (the repo's own words:
`tools/bench-runner/src/receipt.ts:223-232` "earned by nothing";
`docs/decision-map.md:402` "it is what main publishes today"). The ruler was fixed and merged
2026-08-28 (PR #35, `ae97f8e`), so everything below is unblocked. This is measurement, not
code — one session, mostly runbook.

Every file:line below was read from source and re-verified by an adversarial pass on
2026-08-29. Re-open each before acting — trust the code, not this document.

---

## Task 0 — correct the canonical record, and clean the tree

1. `docs/decision-map.md:376` still says the interaction-registry unit is
   **"CODE COMPLETE, NOT MERGED … The batches CANNOT run until it merges."** False on main:
   PR #35 (`ae97f8e`) is that unit (its commit body names the networkidle latch, the
   `page.route` cache defect, ADR-0001 addenda R/S/T; `git diff interaction-registry main --
   tools/bench-runner/` is empty; `collect.ts:90,:137` hold both PDP interaction ids). The map
   even contradicts itself — `:433` lists "interaction-registry (done)". Flip the status line
   to merged-as-#35 and re-head the `:404` owed list from "gated on Rob's merge call" to
   "unblocked".
2. **The tree must be porcelain-clean before any receipt is minted.**
   `tools/bench-runner/src/git.ts:13` flips `dirty` on ANY porcelain output and
   `workers/front/build.mjs:551-552` refuses dirty receipts. `docs/prototypes/` currently
   holds ~19 untracked `*-prompt.md` files plus the audit prompts this session may find
   (derive the count: `git status --porcelain | wc -l`). Commit them (they are landed-unit
   history — see `repo-hygiene-prompt.md`) or run the pass from a clean worktree.

## Task 1 — chrome constant, re-measured on the deployed plane

`workers/front/lab/` has **no chrome-constant.json on main** (removed by the identity gate
when the fragment grew; `build.mjs:846-849` tolerates absence and `/methodology/` renders
"not yet measured"). Re-measure against the deployed plane at the merge SHA under the
addendum-P two-pass cycle. The recorded local interim (+236 ms) is NOT publishable — the
repo's own record shows local constants run ~2× deployed (`decision-map.md:396`).

## Task 2 — re-run editorial and land the attestation gate IN THE SAME COMMIT

- Three profiles × cold+warm × 7 runs, one nonce, all effective URLs pre-warmed to
  compressed first, clean SHA — the `85b97c4` discipline.
- The new receipts will carry `harness.quiescence: "in-flight-tracked"`. Land the publication
  gate that **requires** it (beside the only existing interaction gate,
  `workers/front/build.mjs:300-306`) in the same commit as the receipts that satisfy it —
  the sequencing the map already decided (`decision-map.md:402`).
- Add the one `/methodology/` sentence disclosing the 2026-08-28 mechanism change
  (`grep -c 'latch\|networkidle\|quiescence' workers/front/methodology/index.html` → 0 today).

## Task 3 — the cold-column honesty call (methodology decision, take it explicitly)

New audit finding, mechanism confirmed at source: **the cold column is not cold for any
request-time variant.** Server-side tray fetches carry no query string
(`variants/react-next/src/lib/edge.ts:25,:35`, `variants/qwik/src/lib/edge.ts:85`,
`variants/htmx/src/render.mjs:260`), and the edge keys the bypass on the TRAY url's own
`cache=cold` (`workers/edge/src/index.js:61-90`) — so the "cold" tray leg reads the KV warm
tier every run, while the receipt's methodNote claims the edge tier and `batch.ts:8-16` says
"R2 every time, KV never touched". Receipt data confirms it (cold≈warm server think-time for
all three request-time variants). Blast radius is bounded — the site publishes the WARM
column only (`build.mjs:1032-1036`) — but the committed artifact and its stated method
disagree. Two honest options; take one and record it:

- (a) Forward `cache`/`run` from every request-time tray fetch — the htmx-PLP whitelist
  pattern already proves it (`variants/htmx/src/index.js:146` `PLP_KNOBS`). Then the re-run
  measures what the method says.
- (b) Scope the cold column to browser-visible fetches: amend the receipt methodNote +
  `/methodology/`'s cold/warm paragraph, and correct `decision-map.md:528`'s now-false
  "first PAGE path that reaches KV" claim (request-time editorial pages have reached KV
  server-side since slice B).

Either way the artifact/method disagreement must not survive the re-run.

## Task 4 — the PDP batches

- `pdp-gallery-switch` across three profiles (publishes; the INP row stays withheld with its
  reason per the merged decision).
- `pdp-add-to-cart` batches minted and committed as the withholding decision's evidence.
- Precondition already discharged: the per-surface methodology statement landed with PR #33
  (`decision-map.md:394`; live `/methodology/` reads "One batch per surface") — do not
  re-block on the stale `:321` note.

## Task 5 — route-level fence, BEFORE any PLP batch is ever minted

`tools/bench-runner/src/batch.ts:111` — `FENCED_VARIANT_PREFIXES = new Set(["remix3"])` keys
on the variant segment only, so the fenced Apollo exhibit `/react-next/plp/apollo/` is
benchable today (derivation: prefix = `react-next`), failing the runner's own remix3 standard
at `:104-107` ("a receipt naming it must be impossible to mint"). Known owed
(`decision-map.md:488`). Additionally the fence-drift test iterates `fencedExhibits` only
(`tools/origin-suite/suite/bench.browser.test.ts:394-404`) and cannot see the exhibit's THIRD
registry home, `strategies[].fenced` (`packages/switcher/src/config.ts:160`). Fix: derive a
fenced-path set from the same registry the chrome reads, refuse it in `assertBenchableTarget`,
extend the drift test over strategy-level fences, and mirror the refusal in the front build.

## Done means

Deployed `/methodology/` shows a chrome constant with its receipt; every published cell's
receipt carries `harness.quiescence` and post-#35 dates; the PDP reading table publishes
gallery-switch cells with bands and receipt links; `pnpm check` green; origin suite green in
both snapshot modes; no receipt in `workers/front/lab/receipts/` predates 2026-08-28.
