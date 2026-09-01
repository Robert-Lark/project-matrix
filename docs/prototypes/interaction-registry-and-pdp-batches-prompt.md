# Next unit: the interaction registry, and the PDP's first numbers

Read this whole file before acting. Caffeinate the machine for the duration.
You operate under Rob's standing best-judgment authorization: decide technical
questions yourself per the ADRs, roll through the chain without pausing, and
stop only for the gates named at the bottom.

**Everything in this file was verified against source on 2026-08-28.** Where a
fact is not established, it says so. Re-open every cited range before you rely
on it — line numbers drift, and this file has already had to correct one stale
citation (`collect.ts:26` → `:33`) that had survived in two documents.

## The project and the north star

project-matrix is a public benchmark plane: the same catalog surfaces built in
competing frontend paradigms (vanilla build-time, react-next, astro, qwik, plus
htmx and the fenced Remix 3 frontier), served through ONE composed origin — a
front Worker dispatches by first path segment and injects the switcher/HUD
chrome — with published byte and timing measurements.

The north star is **ADR-0001 §9**: every published number must survive a
hostile reader — tool-derived, receipt-backed, reproducible, with stated limits
instead of silent gaps. When a guard can pass vacuously, it is not a guard.
When a number cannot be re-derived, it is not a measurement. Rigging in EITHER
direction — flattering or punishing a paradigm — is the failure mode the whole
repo exists to prevent.

The overarching goal is an honest paradigm comparison carrying the frontend
architecture argument (cache-first, SSR-at-the-edge, HTML-first, islands over
hydration) on evidence rather than taste. **This unit is where that argument
gets its second surface** — and the PDP is the surface the whole thesis turns
on, because it is where the render-axis verdict is expected to INVERT. The flip
is a hypothesis this unit tests, never a result to be arranged.

Authoritative context, in reading order: `docs/decision-map.md` (the ticket
ledger — read `pdp-build` end to end, and `editorial-bench-batch` for how the
first publication was done), `docs/build-log.md` Phases 13–15, ADR-0001 and its
addenda C/F/K–Q (the measurement + receipts discipline), ADR-0008 and addendum A
(the PDP spec layer), and `CONTEXT.md` for the ubiquitous language. The progress
log lives at the bottom of `docs/prototypes/finish-line-handoff-prompt.md`
(untracked, MAIN checkout).

## Where the last session left off (2026-08-28)

**Production is healthy and serving the PDP.** Verify this from the world
before believing any record, including this one:

```sh
curl -s https://pm-front.robresearch87.workers.dev/_pm/build.json
for v in vanilla react-next astro qwik; do
  curl -s -o /dev/null -w "$v %{http_code}\n" \
    "https://pm-front.robresearch87.workers.dev/$v/pdp/896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone/"
done
```

Four PRs landed on main in sequence:

| PR | Commit | What |
|---|---|---|
| #31 | `c5707f6` | Catalogue sweep budgets → `300_000`. **This is what unblocked the deploy** — PR #30 had merged red, the deploy job was skipped, and the plane served pre-merge code with no PDP routes. |
| #32 | `8137785` | The crate's 1,817 `.thumb.avif` derivatives regenerated, add-only, receipted at `crate/regenerations.json`. |
| #33 | `e467fa5` | **The publication pipeline generalised off the `editorial-` filename gate.** This is what unblocks you. |
| #34 | open | Record repair: sweep comments carried projections the CI run falsified. |

Tree at handoff: turbo `check` **30/30**; fixture AND crate origin suites both
**479 passed / 0 failed / 24 env-gated skips** (all 24 are `blog.test.ts`
credential gates — the "published-readings and bench REMOTE" phrasing in older
handoffs is imprecise).

Editorial byte cells are PUBLISHED and PINNED. **PDP cells are not, and this
unit is what publishes them.**

## What this unit is

Two things, in this order:

1. **Register the PDP interactions** in the bench runner's `INTERACTIONS`
   registry — `pdp-gallery-switch` and `pdp-add-to-cart`, the two ids ADR-0008
   names as PLANNED (neither exists in the codebase today).
2. **Run the PDP bench batches and publish the cells** through the now-generic
   pipeline.

Plus one **bound obligation** inherited from PR #33, below.

## Read this before you plan the batches — two structural problems

Both were found by source recon, both fire late and expensively, and **both are
decisions this unit owns.** Settle them on paper before spending a batch.

### 1. `pdp-gallery-switch` fetches bytes, and the build refuses that

`bundleFromReceipt` refuses any receipt whose `interactionBytes` median is
non-zero, in EITHER column, for ANY target — and the check is **hardcoded, not
driven by the fit sentence**:

```js
// workers/front/build.mjs (post-#33)
if (column.medians.interactionBytes !== 0) {
  throw new Error(`front lab: the fit sentence claims no interaction fetch, but ${t.variant} measured …`);
}
```

Every variant's gallery switch swaps the stage to the FULL-size AVIF — a URL
never fetched at load, because the thumb carries the `.thumb.avif` derivative.
Recon estimates **~25–34 KB on every variant**. So a `pdp-gallery-switch`
publication is **impossible today**, and it fails at BUILD time, after the
batches are already spent.

Worse for the thesis: that image mass would swamp any per-paradigm JS
difference, which is the opposite of what the cell is for.

Your options, none free:

- **Make the clause template-driven** — move the no-fetch assertion into the
  surface's `FIT` spec so a surface that legitimately fetches can publish with
  the fetch stated. This is a pipeline change and needs its own sabotage proof,
  but it is the honest generalisation and it keeps the claim tied to what the
  sentence actually says.
- **Publish `pdp-add-to-cart` only** and record the gallery switch as measured
  but unpublished, with the reason.
- **Prime the full-size image** so the switch is a repaint rather than a fetch —
  *rejected on sight unless you can argue it:* it changes what the paradigm
  actually does on a real visit, which is a lab artifact (ADR-0004 §6's logic).

**Probe it empirically before deciding.** Hold a plane, run one gallery-switch
visit, read `interactionBytes` per variant. Do not plan around the estimate.

### 2. Two interaction families, one receipt slot

The CLI applies ONE `--interaction` to every target in a batch
(`cli.ts:108-112`), so the two interactions are two batch families — which the
decision map already records. But the pipeline keys receipts by surface and
profile:

```js
if (file !== `${surface}-${receipt.profile.id}.json`) { throw … }
```

`pdp-avg-broadband-desktop.json` is a **single slot**. Both families cannot
publish under one profile as things stand. Decide the schema question BEFORE
running batches — discovering it at publish time costs a clean re-run, and a
re-run must repeat the whole gate-forced choreography below.

## What a PDP receipt must satisfy (all verified in `build.mjs` post-#33)

- **`FIT.pdp` must exist** or the receipt is refused by name. Only `editorial`
  exists today. The build reads exactly two fields: `requires` (the exact
  variant set) and `sentence(kb)`. The `metric` field is JSDoc — nothing reads
  it. Write the sentence WITH the batch, against what it measured (addendum C).
- **Exactly the four registered variants**, sorted-set equality both ways:
  `vanilla, react-next, astro, qwik`. One target per variant. Benching two
  release pages per variant to average across entities fails this.
- **Filename** exactly `pdp-{profile.id}.json` in `workers/front/lab/receipts/`.
  The CLI's default `--out` is elsewhere — pass it explicitly.
- **Every `target.surface` must equal `pdp`.** It is derived from path segment 2
  automatically, so a `/vanilla/pdp/{slug}/` target self-labels correctly.
- **Provenance**: dated past the 2026-08-16 cutoff, so `originCommit` must be
  present, non-null, `dirty: false`, and `sha === commit.sha`; every run in both
  columns needs `kb.docAttribution` whose estimator is `loo-wire-normalised` or
  `uncompressed-share-identity`, whose codec matches the wire's
  content-encoding, whose `calibrationTargetSource` is `encoded-body`, and whose
  residual is within `max(64 B, 2%)`. Degraded/fallback attributions are legal
  receipts and unpublishable ones.
- **One batch**: all PDP receipts share one SHA, one date, one `runLocation`,
  one shape. Per surface — it need NOT match editorial's 2026-08-17 batch.
- **Full run set**: each target needs exactly `runsPerUrl` finite warm
  `initialJsBytes` samples. Hand-trimming an outlier breaks the publication.

**A green build does not prove the no-fetch claim held** — if the initial-JS
bands overlap, `bundleFromReceipt` returns early and never reaches the
interaction checks. Read `bandsOverlap` in the emitted `pdp.json` before
concluding anything about the interaction cells.

## The DOM hooks (identical across all four variants — a policed contract)

- **add-to-cart**: `.pm-pdp__buy button.pm-button` — one node per page; the qty
  steppers are `.pm-qty__step`. Editorial's `getByRole("button", {name: "Add to
  cart"})` idiom works on a priced PDP but resolves ZERO nodes on the unpriced
  master, where the button reads "None for sale".
- **gallery switch**: `.pm-gallery__thumb`, accessible name `View image N of M:
  {alt}`, selected thumb carries `aria-current="true"`. **Use `.nth(1)`** —
  `.nth(0)` is already selected, so it is a no-op that still records a real INP
  with zero bytes: a plausible-looking, meaningless cell.
- Do NOT hard-code a release title in a name-based locator; the thumb's
  accessible name embeds it and breaks when the slug changes.

**Bench target: the rich master**, `896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone`
(5 images, 3 formats, $30, 7 for sale). The other masters cannot host these
interactions: `one-image` (815241) renders no thumb list at all, and `unpriced`
(707725) renders a disabled buy button. There is no committed pin of a bench
slug anywhere — the masters are a drift-gate device, not a bench target list —
so **you are choosing this, and the choice must be recorded** for the re-run.

All four targets must use the SAME slug. The receipt has no slug field; it
survives only in `targets[].path`, and nothing enforces agreement.

## Comparability limits you must state, not discover

The PDP is not editorial, and three things make its columns different in kind.
Publishing them without saying so is the rigging shape ADR-0001 §9 forbids:

- **Render placement differs across the four variants** — vanilla and astro
  serve static files, react-next is `force-dynamic`, qwik is request-time. So
  PDP TTFB is not like-for-like the way editorial's was.
- **qwik's deferred handler fetching** already settles onto the initial-byte
  side before any click, so its interaction-byte cell measures resolving and
  running the handler, not downloading it.
- **The chrome constant does not cover interaction time**, so a PDP INP cell
  carries the injected instrument's own main-thread work with no subtractable
  constant behind it. The constant's `renderContext` is `vanilla/editorial`, and
  publishing PDP readings does not change the fragment it hashes — so the
  identity gate will not fire, but ADR-0008 §5's re-measure duty is a documented
  obligation, not a mechanism. Do not read a green build as coverage.

## The bound obligation from PR #33

`/methodology/` states editorial's batch as though it were the whole site's:
"The current published batch ran … 5 variants × 3 profiles". PR #33 is what
makes a divergent second batch legal.

**Publishing any PDP cell REQUIRES making that statement per-surface first.**
Otherwise a reader on a PDP page follows the methodology link and reads a
description of a batch that is not the one behind the numbers they just read —
falsified by the receipt links on those very cells. This is a correctness bug
the moment a PDP cell publishes, not copy polish for afterwards.

## The gate-forced choreography (this is not optional)

The provenance gate refuses a local checkout measuring a plane on a different
SHA — by design, so a ruler or pipeline change can never mint publishable
receipts from a branch. The editorial re-run paid for this lesson twice. The
sequence:

1. Land the code (registry entries, `FIT.pdp`, any pipeline change) and **merge
   it**, so the deploy ships at merge SHA `M`.
2. Clean checkout at `M`. Pre-warm every effective URL with browser-shaped
   `Accept-Encoding` (zstd!) until it serves compressed.
3. Run the profiles against **`https://pm-front.robresearch87.workers.dev`**,
   receipts to SCRATCH first — the tree must stay clean across all runs.
4. Receipts commit, then the records.
5. PR, merge, deploy.

**The gate fires at three moments**: before any browser launches (origin's
attested SHA ≠ local HEAD), after the last run (attestation changed mid-batch),
and at build time. So: do not merge or push to main while a batch is running,
and **do not edit any tracked file while a batch is running** — that has already
cost one full batch run. Commit or stash first, run, then write.

`--local-cpu` is refused against a non-loopback origin, so a published remote
batch records `cpuMs: null` by construction. Do not try to pair it with local
CPU numbers.

## Standing disciplines (non-negotiable, all learned the hard way)

- **Verify every slice** with the saved `verify-slice` workflow (sequential
  lenses, findings streamed to disk). A dead lens's empty findings is a DEAD
  RUN, never a clean pass — the journal distinguishes them. Keep durable resume
  notes in the home session dir, NOT the scratchpad. Never run the origin suite
  while a lens is working. Triage every finding against source; refute with
  evidence, never with agreement. The last two runs adopted 12 distinct findings
  between them, and the most valuable were defects in the slice's own new work.
- **Sabotage-prove every new guard.** Green is not proof. Break the thing it
  guards, watch it fail, restore — and **restore from a backup copy, never
  `git checkout -- <file>`**, which reverts to the last COMMIT and wipes
  uncommitted work (this cost a full re-apply of `build.mjs` last session).
- **Numbers are tool-derived at measurement time**, never recalled, never
  estimated — and **never extrapolated**. Last session projected a CI time from
  a scalar and the CI run falsified it; the correction is in PR #34. If you need
  a runner number, measure it on the runner.
- **One commit per slice**; subject <50 chars imperative, body wrapped at 72,
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, no Jira ID. Stage
  explicit paths — never `git add -A`, never the crate img symlink.
- **Re-stamp `node workers/front/stamp-build.mjs` after ANY commit** — the
  provenance gate refuses bench legs when HEAD outruns the plane's attestation.
  It fired three times in one unit.
- **Records are part of the slice, in the same commit**: a `docs/build-log.md`
  section, the decision-map ticket paragraph, a handoff-log line in MAIN
  `docs/prototypes/finish-line-handoff-prompt.md` (untracked — append, don't
  commit), and the branch-state memory. Record failures and detours honestly —
  the log's value is that it argues. **And correct stale claims in CODE
  COMMENTS too**, not just in the docs: that gap is exactly what PR #34 exists
  to repair.

## Environment notes that will save you hours

- Work in a fresh worktree off `main` (`.claude/worktrees/<unit>`); run
  everything from absolute paths (pnpm resets cwd in worktrees).
- Local plane: `PM_HOLD=1 node tools/origin-suite/run-local.mjs` (add
  `PM_SEED_DIR=tools/snapshot-capture/crate` for crate mode — it seeds R2 AND
  derives `PM_SNAPSHOT` for the build-time variants; a hand-started `wrangler
  dev` serves whatever its dists were last built with, a demonstrated
  wrong-data failure mode). Probe `127.0.0.1:8787`, never `localhost`.
  Suite: `PM_HELD=1 pnpm exec vitest run` from `tools/origin-suite`.
- **A held plane WEDGES after ~6 h** — connections hang with no refusal, and the
  readiness probe will not catch it. `pkill -f wrangler; pkill -f workerd;
  pkill -f run-local` and restart is the whole cure. Bench batches are long;
  a plane held since session start may be wedged by the time you run.
- **CI never runs crate mode** — `ci.yml` sets no `PM_SEED_DIR`, so the crate
  full-suite run is a manual, local, unit-end obligation. That is how the
  21-failure thumb class was found.
- A red `check` job silently costs you the deploy. That is exactly how PR #30
  merged without reaching production.
- vitest 4: no `--reporter=basic`. Never pipe a background command through
  `tail` — you lose the failure detail and learn only the exit code.
- Do not edit files while a turbo run is hashing the tree.
- Docker runs out of disk here; npm scripts run against host `node_modules`.

## Ask first (everything else is yours)

- Destructive or hard to undo: force-push, `reset --hard`, history rewrite,
  deleting branches or files.
- Anything that leaves this machine: pushing, PRs, merges, Slack, tickets.

When the unit is done: full fixture suite + crate suite + turbo numbers, all
records, and the summary to Rob. Present the branch; the merge is his call.
