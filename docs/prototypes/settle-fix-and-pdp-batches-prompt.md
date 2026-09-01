# Next unit: the settle fix, the qwik fairness question, and the PDP's first numbers

Read this whole file before acting. Caffeinate the machine for the duration.
You operate under Rob's standing best-judgment authorization: decide technical
questions yourself per the ADRs, roll through the chain without pausing, and
stop only for the gates named at the bottom.

**Everything in this file was verified against source on 2026-08-28**, in the
session that found the defect below. Every number is tool-derived at
measurement time. Where a fact is NOT established, it says so in those words —
there are four such places and they are the most important paragraphs here.
Re-open every cited range before you rely on it; line numbers drift, and the
predecessor of this file had already had to correct one stale citation
(`collect.ts:26` → `:33`) that survived in two documents.

## The project and the north star

project-matrix is a public benchmark plane: the same catalog surfaces built in
competing frontend paradigms (vanilla build-time, react-next, astro, qwik, plus
htmx and the fenced Remix 3 frontier), served through ONE composed origin — a
front Worker dispatches by first path segment and injects the switcher/HUD
chrome — with published byte and timing measurements.

The north star is **ADR-0001 §9**: every published number must survive a
hostile reader — tool-derived, receipt-backed, reproducible, with stated limits
instead of silent gaps. **When a guard can pass vacuously, it is not a guard.
When a number cannot be re-derived, it is not a measurement.** Rigging in
EITHER direction — flattering or punishing a paradigm — is the failure mode the
whole repo exists to prevent.

This unit is where that sentence stops being a slogan. The previous session set
out to publish the PDP's interaction cells and instead found that **the guard
behind the site's strongest published claim had never fired.** Read the next
section before you plan anything.

Authoritative context, in reading order: `docs/decision-map.md` (read
`pdp-build` end to end, `editorial-bench-batch` for how the first publication
was done, and `bench-instrumentation-dilution` for how a ruler change is
carried), `docs/build-log.md` Phases 13–15, ADR-0001 and its addenda C/F/K–Q
(the measurement + receipts discipline), ADR-0008 and addendum A (the PDP spec
layer), and `CONTEXT.md` for the ubiquitous language.

## THE BLOCKING FINDING: the post-click settle never waited

This is the unit's centre of gravity. It is fixed in the worktree but
**uncommitted and unproven** — see "The tree you are inheriting".

### What was wrong

The interaction byte boundary used
`page.waitForLoadState("networkidle", { timeout: settleCapMs })`. That is a
**document-load-lifecycle latch, not a measurement.** Playwright's own typings
say so — quote it in the ADR addendum, it is the primary source:

> "If the state has been already reached while loading current document, the
> method resolves immediately."
> — `node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/types/types.d.ts:5020`,
> which also marks `networkidle` **DISCOURAGED**.

No navigation happens across a scripted interaction, and the runner's OWN
pre-click settle loop guarantees the latch is already closed. So the post-click
call could never observe anything.

### The proof, and how to re-derive it

Measured on the deployed plane, `avg-broadband-desktop`, all four PDP
variants: **the post-click wait returned in 24–49 ms.** A genuine 500 ms quiet
window cannot resolve in under 500 ms, so that timing alone is proof no window
was measured — you do not need to trust the mechanism argument.

Consequence: `pdp-gallery-switch` fetches a 25,194 B image, and the runner
recorded **`interactionBytes: 0` with `interactionSettled: true`** — the flag
asserting that zero as *verified*. `interactionSettled` exists (ADR-0001
addendum M) precisely to make "nothing was fetched for the click" falsifiable
from the artifact. It was proving only that a latch was already closed.

**This inverts the premise the previous prompt was written on.** That prompt
expected a loud, expensive BUILD failure after the batches were already spent.
The truth is worse: `bundleFromReceipt` would have **passed**, and the site
would have published a confident false zero. The mechanism meant to catch it
was the broken thing.

### Why it survived every check — the durable lesson

Tool-derived: every `interactionId` any test has ever driven is `body-click` or
`none`.

```
tools/origin-suite/suite/bench.browser.test.ts:83   "body-click"
tools/origin-suite/suite/bench.browser.test.ts:84   "none"
tools/origin-suite/suite/bench.browser.test.ts:92   "body-click"
tools/origin-suite/suite/bench.browser.test.ts:395  "body-click"
tools/origin-suite/suite/cost.test.ts:94, :104      "none"
```

Both fetch nothing. `bench.browser.test.ts:183` and `:225` assert
`interactionBytes === 0` — which a latched wait and a working wait produce
identically. **No test has ever driven an interaction that fetches**, and
`editorial-add-to-cart` is exercised by no test at all. A guard proven only
against inputs that cannot distinguish pass from fail is not proven.

**You owe a suite leg that would have caught this**: drive a scripted
interaction that DOES fetch and assert non-zero bytes. `pdp-gallery-switch` on
the rich master is the natural one. Without it the next latch regression is
invisible again.

### What is NOT wrong — verified, so you do not re-litigate it

**No published number is wrong.** Under a real quiescence wait,
`editorial-add-to-cart` fetches **0 B on all five live variants** (vanilla,
react-next, astro, qwik, htmx). The published fit line's "and none of them
fetches another byte for the click" is TRUE. The guard was vacuous; the claim
held. Editorial receipts' VALUES stand. Only their `interactionSettled`
attestation was unearned, and that is a record problem, not a number problem.

**The same latch also made the pre-click loop's trailing wait vacuous**
(`collect.ts` old `:694`), so its comment's claim that the wait "bridges the
import + the preload cascade" described a mechanism that did not exist. That
one **costs nothing, measured**: a genuine quiescence wait placed after the
loop surfaces **0 new resource entries and 0 byte change on all five editorial
and all four PDP variants**. The requestIdleCallback passes plus the
entry-count stability check already gave the cascade its time. This is why the
fix moves **no published byte cell** — state that in the addendum, because it
is what keeps this from being a fourth editorial re-run of the byte columns.

## The tree you are inheriting

Worktree `.claude/worktrees/interaction-registry`, branch
`interaction-registry`, off main `832e9cd`. **Two files modified, nothing
committed:**

```
 M tools/bench-runner/src/batch.ts     (1 line: the methodNotes correction)
 M tools/bench-runner/src/collect.ts   (+205/-13)
```

`pnpm --dir <WT>/tools/bench-runner run typecheck` passes. **The full suite and
turbo have NOT been run against this change. Run them before you believe
anything.**

**A backup of the uncommitted work exists** at
`~/.claude/projects/-Users-roblark-Work-project-matrix/interaction-registry-wip/`
— `settle-fix.patch` (the full diff), plus verbatim copies of `collect.ts` and
`batch.ts`. It is there because this work is uncommitted and the sabotage
discipline below involves deliberately breaking these very files. Restore from
those copies, never with `git checkout --`. Once you have committed the settle
fix slice, delete the directory so a stale copy cannot be restored over newer
work by mistake. The `body-click` assertions above should still pass (a click on
`main h1` fetches nothing under a real wait too) but that is a prediction, not
a measurement — go measure it.

### What the fix is, by symbol (line numbers will drift — grep the names)

In `tools/bench-runner/src/collect.ts`:

- `NETWORK_QUIET_MS = 500` (`:666`) — the quiet window. Deliberately the same
  500 ms Playwright's `networkidle` names, so the boundary's DEFINITION is
  unchanged and only the mechanism moves.
- `LOAD_QUIET_CAP_MS = 30_000` (`:678`) — the PRE-interaction cap. Much larger
  than `SETTLE_CAP_MS` on purpose: capping the initial side early would move
  `initialJsBytes`, the published headline, whereas capping the interaction
  side only records `interactionSettled: false`, which refuses publication
  instead of corrupting a number. Matches the effective bound the superseded
  calls carried (Playwright's 30 s default) and **throws** on cap-out, as those
  calls did.
- `armNetworkQuiescence(page)` (`:726`) — tracks in-flight requests from the
  page's own `request`/`requestfinished`/`requestfailed` events and resolves
  only after a fresh quiet window measured **from the call**, so each boundary
  gets its own window. Returns whether the window was observed.
- `const network = armNetworkQuiescence(page)` (`:799`) — armed BEFORE `goto`,
  so no request of the visit is missed. Never detached: it must outlive the
  first wait to serve the interaction boundary, and it dies with the page.
- `quietAfterLoad()` (`:840`) — used for the initial boundary and inside the
  5-pass settle loop; throws on cap-out.
- `const interactionSettled = await network.wait(NETWORK_QUIET_MS, settleCapMs)`
  (`:913`) — the fixed boundary. No longer a `let` mutated by a swallowed catch.
- `INTERACTIONS` (`:33`) gained **`pdp-gallery-switch`** (`:90`) and
  **`pdp-add-to-cart`** (`:111`), the two ids ADR-0008 names as PLANNED.

In `tools/bench-runner/src/batch.ts`: the `methodNotes[0]` entry now states the
mechanism and says in the receipt itself that **receipts dated before
2026-08-28 carry the weaker guarantee under the same sentence.** That is the
only thing distinguishing a pre-fix from a post-fix receipt in the artifact —
there is no schema field for it. Decide deliberately whether that is enough; a
field is a legal option and the schema takes optional additions.

### Registry entry decisions already taken (do not re-litigate)

- **`.nth(1)`, not `.nth(0)`.** Thumb 0 is already `aria-current` and the stage
  already carries `images[0]`, so clicking it re-assigns the same `src`,
  changes nothing, fetches nothing — and still records a real INP, because the
  event registers regardless. That is a plausible-looking meaningless cell,
  which is worse than a missing one.
- **Both PDP interactions select by CLASS, not accessible name.** The thumb's
  name is `View image N of M: {alt}` and the alt embeds the release title, so a
  name-based locator breaks when the bench slug changes. And editorial's
  `getByRole("button", { name: "Add to cart" })` idiom resolves **ZERO nodes**
  on the unpriced master, where the button reads "None for sale"
  (`packages/reference/render/pdp.mjs:117`). `.pm-pdp__buy button.pm-button`
  matches exactly one node on every master — the fenced live-origin plaque's
  button is a `pm-button--secondary` OUTSIDE `.pm-pdp__buy`. Playwright's
  strict mode turns a duplicate or missing node into a loud failure.

## The numbers this session measured (probe-only — a dirty tree, unpublishable)

Fixed runner, `avg-broadband-desktop`, release
`896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone`, deployed plane
at `832e9cd`. Five fresh visits per cell in the standalone probes, distinct
values = 1 in every case; the runner reproduced the qwik figure 6/6.

| | vanilla | react-next | astro | qwik |
|---|---|---|---|---|
| `pdp-gallery-switch` interaction bytes | 25,194 | 25,194 | 25,194 | **52,032** |
| `pdp-add-to-cart` interaction bytes | 0 | 0 | 0 | 0 |
| `pdp-gallery-switch` INP median (ms) | 24 | 24 | 24 | **8** |
| initial JS (B, warm) | ~4,636 | ~160,237 | ~1,699 | ~35,047 |

Asset sizes on the deployed plane, release 896191 — full: primary 80,340 · -2
24,894 · -3 69,553 · -4 67,717 · -5 50,629. Thumbs: 8,130 · 2,718 · 3,951 ·
5,220 · 5,319.

**One consequence worth knowing before you plan:** those initial-JS medians are
far apart (1.7 / 4.6 / 35 / 160 KB), so `bandsOverlap` will be **false** and
`bundleFromReceipt` WILL reach the interaction checks. The predecessor prompt's
warning about the band-overlap early return silently skipping them does not
fire on this data. Verify it on your own batch rather than trusting this line.

**`thumbSrc` REPLACES the `.avif` suffix** — `/assets/img/896191-2.thumb.avif`
(`packages/reference/render/lib.mjs:161`). It does not append. A probe of
`…-2.avif.thumb.avif` 404s; that was the previous session's own error, caught
by checking, and ADR-0008 §11's "`{src}.thumb.avif` by URL convention" phrasing
is what invites it. Do not re-make it.

## GATE 1: the qwik fairness question — resolve this before any cell publishes

**qwik's gallery switch costs 52,032 B against 25,194 B for the other three.
The extra 26,838 B is all five thumbnails, re-fetched.** Root-caused, not
guessed. A MutationObserver over `.pm-gallery` during the click:

```
qwik (9 mutations):
  attr img.pm-gallery__main [src] "…896191-primary.avif" -> "…896191-2.avif"
  attr img.pm-gallery__main [alt] "…front cover" -> "…release photo 2"
  attr button.pm-gallery__thumb [aria-current] "true" -> "null"
  attr img [src] "…896191-primary.thumb.avif" -> "…896191-primary.thumb.avif"   <-- identical
  attr button.pm-gallery__thumb [aria-current] "null" -> "true"
  attr img [src] "…896191-2.thumb.avif" -> "…896191-2.thumb.avif"               <-- identical
  attr img [src] "…896191-3.thumb.avif" -> "…896191-3.thumb.avif"               <-- identical
  attr img [src] "…896191-4.thumb.avif" -> "…896191-4.thumb.avif"               <-- identical
  attr img [src] "…896191-5.thumb.avif" -> "…896191-5.thumb.avif"               <-- identical

react-next (4 mutations): the two stage attrs and the two aria-current flips. No thumb src writes.
```

qwik re-applies `src` on every thumb with an **identical value**, and setting
`src` re-fetches even when unchanged. All five thumb `<img>` nodes **survive**
(marker-property test, 5/5), so this is NOT node replacement — that was the
first hypothesis and it is **refuted**; do not spend time on it.

**What is NOT established, and it decides whether the number may publish:** is
this inherent to qwik's renderer, or a defect in
`variants/qwik/src/components/PdpGallery.tsx`? The component reads
`selected.value` in the parent component scope, so the whole gallery
re-renders — a React idiom, not qwik's fine-grained one. Qwik's entire selling
point is that a signal read localises the re-render.

- **If idiomatic factoring removes the refetch** (thumb list hoisted into its
  own `component$`, or each thumb reading only what it needs), then 52,032
  measures a badly-factored component and publishing it as a paradigm cost is
  **rigging AGAINST qwik** — the mirror of the dilution defect that flattered
  the smallest cells. Fix the variant, then measure.
- **If it survives idiomatic factoring**, it is a real measured property of
  this qwik version's renderer, and it publishes with the mechanism stated and
  scoped to the version — never as "resumability costs 2×" (addendum M's
  precedent: publish with the stated caveat, never silently reclassify).

Settle it empirically. It needs a local qwik build — `PM_HOLD=1 node
tools/origin-suite/run-local.mjs` with `PM_SEED_DIR=tools/snapshot-capture/crate`
so the served data has the 5-image release. Whichever way it goes, the
reasoning and the measurement are a build-log paragraph and a decision-map
line: CONTEXT.md's canonical-markup rule says "that variant is slow because its
components were written differently" is **never** a valid excuse, and that rule
cuts in qwik's favour here.

Note also: whatever you change must keep the served DOM byte-identical to the
master (`variant-master-identity.test.ts` covers all 740 pages in both
snapshots) and must keep the JS-ON contract the `pdp-controls.browser.test.ts`
leg polices, including the `aria-current` null-vs-undefined subtlety documented
at `PdpGallery.tsx:53-58` — qwik's diff treats `undefined` as "leave
unchanged", which once left two thumbs announcing selected.

## GATE 2: qwik's INP is 8 ms while it does strictly MORE work

On the same click, qwik measures **INP 8 ms** against **24 ms** for the other
three — while fetching 26,838 B more. A number that flatters one paradigm
precisely where it does more work must be explained before it publishes; that
is the anti-rigging discipline pointed at our own favourite result.

**Unverified hypothesis, labeled as such:** qwik's handler is resumed
asynchronously, so the event's own duration closes early and the real work
happens outside the event-timing entry the INP pipeline reads. Supporting but
not conclusive: the same click took **~104 ms** to land its DOM change on qwik
against **~0–1 ms** on the other three (polled `aria-current` transition, one
sample each, unthrottled). If that is the mechanism, then the PDP's headline
INP cell **measures something different for qwik than for the others**, which
is a comparability limit of the same class as ADR-0001 addendum M's
serialization asymmetry — and it must be stated on `/methodology/` and ride the
cell, not be discovered by a reader.

The pdp-build ticket calls `pdp-gallery-switch` "the headline INP cell". If
that cell is not like-for-like, say so before publishing it. Do not resolve
this by dropping the cell quietly.

## The two structural problems the predecessor named

### 1. The hardcoded no-fetch refusal — DECIDED: make it template-driven

`bundleFromReceipt` refuses any receipt whose `interactionBytes` median is
non-zero in either column for any target, and the check is **hardcoded, not
driven by the fit sentence** (`workers/front/build.mjs:235`). With the settle
fixed, a real `pdp-gallery-switch` batch now measures 25,194–52,032 B and this
refusal fires — correctly, and at build time, which is where the predecessor
expected it.

**Decision taken:** move the assertion into the surface's `FIT` spec so a
surface that legitimately fetches publishes with the fetch STATED. Shape it as
a declared expectation the build checks the measurement against, e.g.
`interactionFetch: "none"` (assert zero medians, both columns — editorial and
`pdp-add-to-cart`) versus a declared constant (assert the variants AGREE within
a stated tolerance, and publish the figure in the sentence). **A declaration
that cannot fail is not a generalisation, it is a loosening** — so it needs its
own sabotage proof in both directions: a surface declaring "none" that fetches
must fail, and a surface declaring a constant whose variants disagree must fail.

Rejected, with reasons: **priming the full-size image** so the switch is a
repaint — it changes what the paradigm does on a real visit, which is a lab
artifact (ADR-0004 §6's logic). **Publishing `pdp-add-to-cart` only** — that
publishes the control and withholds the experiment, since `pdp-build` names
gallery-switch the interaction "this surface genuinely owns, where the
paradigms differ most". Keep add-to-cart-only as a fallback if Gate 1 or Gate 2
cannot be settled honestly, and record the reason if you take it.

Note the qwik figure is **not** a cross-variant constant (52,032 vs 25,194), so
a "stated constant" clause cannot describe this batch as it stands. Gate 1 may
change that. If it does not, the sentence must name the per-paradigm figures,
which is what the editorial template already does for bytes.

### 2. Two interaction families, one receipt slot — OPEN, and it is a schema decision

The CLI applies ONE `--interaction` per batch (`cli.ts:108-112`), so the two
interactions are two batch families. But the pipeline keys receipts by surface
and profile: `build.mjs:502` refuses any file not named exactly
`{surface}-{receipt.profile.id}.json`. **`pdp-avg-broadband-desktop.json` is a
single slot, and both families cannot publish under one profile as things
stand.**

Two dead ends, both checked so you do not re-check them:

- **A second pseudo-surface (`pdp-cart`) does not work.** `target.surface` is
  derived from path segment 2 (`batch.ts:244`), so every PDP target
  self-labels `pdp`, and `build.mjs:508` refuses a receipt whose targets
  disagree with the filename surface. The longest-match parse at `:494`
  anticipated the *name collision* but the target check still blocks it. That
  check is doing its job; do not weaken it.
- **Merging both families into one bundle needs a table change.**
  `READING_METRICS` (`packages/switcher/src/lab.ts:19-26`) is
  `initial JS · TTFB · FCP · LCP · CLS · INP (scripted)` — there is **no
  interaction-bytes row at all**, so the published "interaction cell" IS the
  INP row, and the table **never names which interaction produced it**. Fine on
  editorial, which has exactly one. On a PDP with two families it is an honesty
  gap: two different measurements would render in identically-labeled cells,
  distinguishable only by downloading the receipt — which is the "it's in the
  receipt" answer ADR-0001 addendum C pre-rejected.

So the real decision is bigger than a filename: **if the PDP publishes two
interaction families, the reading table must name the interaction.** Weigh at
least these, pick one, and record the alternatives in one line each: extend the
receipt key to carry the interaction; make the INP row interaction-labeled and
let one bundle carry both; or publish one family per profile and state the
other as measured-but-unpublished with its numbers and its reason. Whatever you
pick, `labBundle` must stay "the whole registration" — the
`publication-pipeline` unit's hard-won property (its generated
`workers/front/generated/lab-bundles.js` is what makes registration reach the
EMBED, not just the serving).

## What a PDP receipt must satisfy (verified in `build.mjs` post-#33)

- **`FIT.pdp` must exist** or the receipt is refused by name (`:517`). Only
  `editorial` exists today (`workers/front/lab/fit.mjs:19-39`). The build reads
  exactly two fields: `requires` (the exact variant set) and `sentence(kb)`.
  The `metric` field is JSDoc — nothing reads it. Write the sentence WITH the
  batch, against what it measured (addendum C).
- **Exactly the four registered variants**, sorted-set equality both ways:
  `vanilla, react-next, astro, qwik` (`packages/switcher/src/config.ts:116-137`,
  where `pdp` already carries `labBundle: true` and serves an empty bundle).
  One target per variant. Benching two release pages per variant to average
  across entities fails this.
- **Filename** exactly `pdp-{profile.id}.json` in
  `workers/front/lab/receipts/`. The CLI's default `--out` is elsewhere — pass
  it explicitly.
- **Every `target.surface` must equal `pdp`** — derived from path segment 2
  automatically, so `/vanilla/pdp/{slug}/` self-labels correctly.
- **Provenance**: dated past the 2026-08-16 cutoff, so `originCommit` must be
  present, non-null, `dirty: false`, and `sha === commit.sha`; every run in
  both columns needs `kb.docAttribution` whose estimator is
  `loo-wire-normalised` or `uncompressed-share-identity`, whose codec matches
  the wire's content-encoding, whose `calibrationTargetSource` is
  `encoded-body`, and whose residual is within `max(64 B, 2%)`.
  Degraded/fallback attributions are legal receipts and unpublishable ones.
- **One batch**: all PDP receipts share one SHA, one date, one `runLocation`,
  one shape. Per surface — it need NOT match editorial's batch (that is exactly
  what PR #33 made legal).
- **Full run set**: each target needs exactly `runsPerUrl` finite warm
  `initialJsBytes` samples. Hand-trimming an outlier breaks the publication.
- **`commitPin` treats ANY porcelain output as dirty**, untracked files
  included (`tools/bench-runner/src/git.ts:8-14`). A stray probe script in the
  tree makes every receipt of that batch unpublishable. Keep probes in the
  scratchpad and run them from `<WT>/tools/bench-runner/` so they resolve
  `playwright`, then delete them.

## The DOM hooks (identical across all four variants — a policed contract)

- **add-to-cart**: `.pm-pdp__buy button.pm-button` — one node per page; the qty
  steppers are `.pm-qty__step`.
- **gallery switch**: `.pm-gallery__thumb`, accessible name
  `View image N of M: {alt}`, selected thumb carries `aria-current="true"`.
- The stage swap is `stage.src = img.src.replace(/\.thumb\.avif$/, ".avif")`
  in vanilla (`variants/vanilla/src/pdp.js:74`) and astro
  (`variants/astro/src/scripts/pdp.ts:117`); react-next and qwik bind
  `src={current.src}` in their `PdpGallery` components. All four resolve to the
  same full-size URL, which is why the 25,194 B is identical for three of them.

**Bench target: the rich master**,
`896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone`
(5 images, 3 formats, $30, 7 for sale). The other masters cannot host these
interactions: `one-image` (815241) renders no thumb list at all, and `unpriced`
(707725) renders a disabled buy button. **There is no committed pin of a bench
slug anywhere** — the masters are a drift-gate device, not a bench target
list — so this choice is yours to carry, and it must be recorded for the
re-run. All four targets must use the SAME slug: the receipt has no slug field,
it survives only in `targets[].path`, and nothing enforces agreement.

## Comparability limits you must state, not discover

Publishing these without saying so is the rigging shape ADR-0001 §9 forbids:

- **Render placement differs across the four variants** — vanilla and astro
  serve static files, react-next is `force-dynamic`, qwik is request-time. PDP
  TTFB is not like-for-like the way editorial's was.
- **qwik's INP may not measure the same thing** — Gate 2 above. This is the
  sharpest one and it is unresolved.
- **The chrome constant does not cover interaction time**, so a PDP INP cell
  carries the injected instrument's own main-thread work with no subtractable
  constant behind it. The constant's `renderContext` is `vanilla/editorial`,
  and publishing PDP readings does not change the fragment it hashes — so the
  addendum-P identity gate will not fire, but ADR-0008 §5's re-measure duty is
  a documented obligation, not a mechanism. Do not read a green build as
  coverage.
- **`--local-cpu` is refused against a non-loopback origin**
  (`cli.ts:61-67`), so a published remote batch records `cpuMs: null` by
  construction. Do not try to pair it with local CPU numbers.

## The bound obligation from PR #33 (unchanged, still owed)

`/methodology/` states editorial's batch as though it were the whole site's.
Verified: `batchStatement` at `workers/front/build.mjs:786-793` is composed
from `labFacts`, which is derived from `editorialReceipts` **only** (`:753-765`),
and renders at `workers/front/methodology/index.html:188` via
`%%LAB_BATCH_STATEMENT%%` (`build.mjs:910`). **`%%LAB_RUNS%%` has the same
editorial-only derivation** (`labRuns`, `:780`) and feeds the "One batch,
%%LAB_RUNS%% runs per cell" heading at `index.html:83` — the predecessor prompt
missed that second one.

**Publishing any PDP cell REQUIRES making both statements per-surface first.**
Otherwise a reader on a PDP page follows the methodology link and reads a
description of a batch that is not the one behind the numbers they just read —
falsified by the receipt links on those very cells. This is a correctness bug
the moment a PDP cell publishes, not copy polish for afterwards.

## The gate-forced choreography (this is not optional)

The provenance gate refuses a local checkout measuring a plane on a different
SHA — by design, so a ruler or pipeline change can never mint publishable
receipts from a branch. **You are changing the ruler, so this applies to you
with full force.** The sequence:

1. Land the code (the settle fix, the registry entries, any qwik variant fix,
   `FIT.pdp`, the pipeline change, the methodology statements) and **merge it**,
   so the deploy ships at merge SHA `M`.
2. Clean checkout at `M`. Pre-warm every effective URL with browser-shaped
   `Accept-Encoding` (zstd!) until it serves compressed.
3. Run the profiles against **`https://pm-front.robresearch87.workers.dev`**,
   receipts to SCRATCH first — the tree must stay clean across all runs.
4. Receipts commit, then the records.
5. PR, merge, deploy.

**The gate fires at three moments**: before any browser launches (origin's
attested SHA ≠ local HEAD), after the last run (attestation changed mid-batch),
and at build time. So: do not merge or push to main while a batch is running,
and **do not edit any tracked file while a batch is running** — that has
already cost one full batch run. Commit or stash first, run, then write.

**Also decide, and it is a real decision:** the settle fix means editorial's
committed receipts carry an `interactionSettled` flag minted by a mechanism
that did not measure it. The VALUES are right (verified above). Options: re-run
editorial at `M` so both surfaces' flags are earned (~7 minutes for three
profiles, measured previously, and the per-surface batch integrity at
`build.mjs:549-565` means the two surfaces may legitimately differ in date and
SHA), or leave editorial's receipts and record the weaker attestation in the
addendum and on `/methodology/`. Recommend the re-run — it is cheap, and
"receipted numbers whose receipt overstates its own proof" is the class this
repo exists not to ship. Argue the other side before you commit to it.

## Standing disciplines (non-negotiable, all learned the hard way)

- **Verify every slice** with the saved `verify-slice` workflow (sequential
  lenses, findings streamed to disk). A dead lens's empty findings is a DEAD
  RUN, never a clean pass — the journal distinguishes them. Keep durable resume
  notes in the home session dir, NOT the scratchpad. Never run the origin suite
  while a lens is working. Triage every finding against source; refute with
  evidence, never with agreement. The last three runs adopted 12, 7 and 18
  findings, and the most valuable were defects in the slice's own new work.
- **Sabotage-prove every new guard.** Green is not proof. Break the thing it
  guards, watch it fail, restore — and **restore from a backup copy, never
  `git checkout -- <file>`**, which reverts to the last COMMIT and wipes
  uncommitted work (this cost a full re-apply of `build.mjs` in an earlier
  unit, and right now the settle fix is uncommitted, so that mistake would
  destroy this unit's centre).
  The settle fix specifically needs: a latched-wait regression must fail a
  test; a fetching interaction must record non-zero bytes; a capped-out
  interaction wait must record `interactionSettled: false`.
- **Numbers are tool-derived at measurement time**, never recalled, never
  estimated — and **never extrapolated**. An earlier session projected a CI
  time from a scalar and the CI run falsified it (PR #34 is the repair). If you
  need a runner number, measure it on the runner.
- **Probe before you plan.** This entire unit's shape came from one empirical
  probe of a number a document asserted. The predecessor prompt's estimate
  ("~25–34 KB") was right about the bytes and wrong about the consequence, and
  only measurement separated them.
- **One commit per slice**; subject <50 chars imperative, body wrapped at 72,
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, no Jira ID. Stage
  explicit paths — never `git add -A`, never the crate img symlink. The settle
  fix, the registry entries, the qwik fix, the pipeline change and the batches
  are separate commits.
- **Re-stamp `node workers/front/stamp-build.mjs` after ANY commit** — the
  provenance gate refuses bench legs when HEAD outruns the plane's attestation.
  It fired three times in one unit.
- **Records are part of the slice, in the same commit**: a `docs/build-log.md`
  section, the decision-map ticket paragraph, a handoff-log line in MAIN
  `docs/prototypes/finish-line-handoff-prompt.md` (untracked — append, don't
  commit), and the branch-state memory. Record failures and detours honestly —
  the log's value is that it argues. **And correct stale claims in CODE
  COMMENTS too**, not just in the docs: that gap is exactly what PR #34 exists
  to repair, and this unit already had to correct two comments that described
  mechanisms which did not exist.
- **The settle fix is a methodology decision and needs an ADR-0001 addendum**
  (next letter after Q). It supersedes addendum I's claim that the settle waits
  are signal-based — that claim was true of the beacon flush and the INP wait,
  and false of the interaction byte boundary. Say which, and say that no
  published value changed.

## Environment notes that will save you hours

- Work in a fresh worktree off `main` (`.claude/worktrees/<unit>`) — or continue
  the existing `interaction-registry` one, which already has `node_modules`
  installed. Run everything from **absolute paths**.
- **`pnpm bench` resolves to the MAIN checkout's `dist`, not your worktree's.**
  It cost this session a confusing "unknown interaction id" for an id that was
  registered. Build with
  `pnpm --dir <WT>/tools/bench-runner run build` and run with
  `node <WT>/tools/bench-runner/dist/cli.mjs run …`.
- **Remote fetches need
  `NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`** — TLS
  interception on this machine otherwise fails node's `fetch` with
  `SELF_SIGNED_CERT_IN_CHAIN` before any browser launches. Playwright's own
  Chromium is fine.
- **Standalone probe scripts must live under `<WT>/tools/bench-runner/`** to
  resolve `playwright` from that package, and must be deleted afterwards (the
  dirty-tree rule above).
- **Never run two browser measurements concurrently** — they contaminate each
  other's timings. Same rule as "never run the origin suite while a lens is
  working".
- Local plane: `PM_HOLD=1 node tools/origin-suite/run-local.mjs` (add
  `PM_SEED_DIR=tools/snapshot-capture/crate` for crate mode — it seeds R2 AND
  derives `PM_SNAPSHOT` for the build-time variants; a hand-started `wrangler
  dev` serves whatever its dists were last built with, a demonstrated
  wrong-data failure mode). Probe `127.0.0.1:8787`, never `localhost`.
  Suite: `PM_HELD=1 pnpm exec vitest run` from `tools/origin-suite`.
- **A held plane WEDGES after ~6 h** — connections hang with no refusal, and the
  readiness probe will not catch it. `pkill -f wrangler; pkill -f workerd;
  pkill -f run-local` and restart is the whole cure.
- **CI never runs crate mode** — `ci.yml` sets no `PM_SEED_DIR`, so the crate
  full-suite run is a manual, local, unit-end obligation. That is how the
  21-failure thumb class was found. Note Gate 1 needs crate mode anyway (the
  fixture's probe release has fewer images).
- A red `check` job silently costs you the deploy. That is exactly how PR #30
  merged without reaching production. After any push to main, check the DEPLOY
  job's own conclusion, and `curl /_pm/build.json` to confirm the SHA moved.
- vitest 4: no `--reporter=basic`. Never pipe a background command through
  `tail` — you lose the failure detail and learn only the exit code.
- Do not edit files while a turbo run is hashing the tree.
- Docker runs out of disk here; npm scripts run against host `node_modules`.

## State of the world at handoff (verify, don't trust)

```sh
curl -s https://pm-front.robresearch87.workers.dev/_pm/build.json   # expect sha 832e9cd…, dirty false
for v in vanilla react-next astro qwik; do
  curl -s -o /dev/null -w "$v %{http_code}\n" \
    "https://pm-front.robresearch87.workers.dev/$v/pdp/896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone/"
done
```

Main is `832e9cd` ("Replace sweep projections with measured times (#34)"), CI
green, and the plane deployed it during the previous session — so prod and main
agree. PRs #31–#34 all landed. Editorial byte cells are PUBLISHED and PINNED;
**PDP cells are not, and no PDP receipt has ever been minted.** Tree at the last
full verification (before this session's changes): turbo `check` 30/30; fixture
AND crate origin suites both 479 passed / 0 failed / 24 env-gated skips (all 24
are `blog.test.ts` credential gates).

## Suggested order

1. **Suite + turbo on the inherited fix.** You cannot reason about anything
   until you know what the change breaks.
2. **Sabotage-prove the settle fix** and add the suite leg that would have
   caught the latch (a fetching interaction, non-zero bytes asserted).
3. **Gate 1 — the qwik idiom question.** It decides what may publish. Needs a
   local crate-mode plane.
4. **Gate 2 — qwik's INP.** Establish the mechanism or state the limit.
5. **`FIT.pdp` + the template-driven fetch clause**, sabotage-proven both ways.
6. **The receipt-slot / interaction-naming decision** (structural problem 2).
7. **The per-surface methodology statements** — both `%%LAB_BATCH_STATEMENT%%`
   and `%%LAB_RUNS%%`.
8. **verify-slice** the whole thing before merging.
9. **Merge, then the gate-forced batch choreography**, editorial re-run
   included if you took that call.
10. **Records**, then present the branch to Rob.

## Ask first (everything else is yours)

- Destructive or hard to undo: force-push, `reset --hard`, history rewrite,
  deleting branches or files.
- Anything that leaves this machine: pushing, PRs, merges, Slack, tickets.

When the unit is done: full fixture suite + crate suite + turbo numbers, all
records, and the summary to Rob — lead with whether it is ready to merge and
what needs fixing first. Present the branch; the merge is his call.
