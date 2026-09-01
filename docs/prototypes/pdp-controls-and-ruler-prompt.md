# Next unit — MAKE THE CONTROLS REAL, THEN FIX THE RULER

Work under the standing best-judgment authorization: decide from the recorded
decisions and roll forward without pausing. Ultracode is ON (spec-layer
decisions plus a measurement-methodology change). Read
`docs/prototypes/finish-line-handoff-prompt.md`'s `## Progress log` FIRST — the
last entry is dated 2026-08-14 and is the state of record — then
`docs/decision-map.md`, then the ADRs named below IN FULL before any code.

──────────────────────────────────────────────────────────────────────────────
## NORTH STAR (why this project exists)

The site is a live-benchmarking portfolio: one Discogs-powered store built in
several rendering paradigms, instrumented so a **SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED**. The thesis is **fit, not a leaderboard** —
misapplication is costly, correct application is huge. Evidence for staff-level
frontend judgment; later a conference talk and an article.

**A confident wrong number costs this project more than a missing one.** The
last three units each existed largely to repair claims the one before it
published. That is not a slogan to quote and move past — it is the measured
failure rate of this chain, and the reason every number below carries the
command that produced it.

The PDP is where the thesis becomes falsifiable: editorial published React/Next
at 154.88 KB of JS against vanilla's 1.69 for the same article. The PDP is the
same variant where interactivity is genuine. If the numbers here say what
editorial's said, **the thesis is wrong and the site must publish that**. The
flip is a HYPOTHESIS, never a result to be arranged. ADR-0005 §6 and ADR-0007
§1 bind it; the decision-map's villain/contender language is planning-time
framing and is explicitly NOT publishable copy.

──────────────────────────────────────────────────────────────────────────────
## STATE OF THE WORLD (verified 2026-08-14 — but VERIFY IT AGAIN)

**Two facts in the last handoff were stale by the time it was read, and both
cost real time. Re-verify from the world, never from this prompt.**

- **`main` = `1f91d89`** — PR #24 merged the PDP build with a MERGE COMMIT (not
  a rebase: `b12b8d9` carries receipts pinning `7c5be98` by hash). All four
  pdp-build commits are ancestors of main. CI run 31836566192 green. **The PDP
  is LIVE**: `/vanilla/pdp/{id}-{artist}-{title}/` serves 200 in production,
  ~500 crate URLs. The once-per-new-URL deploy flake did not fire.
  Check with: `git merge-base --is-ancestor <sha> origin/main`.
- **Branch `record-repair`** off `1f91d89`, **three commits, UNPUSHED and
  UNMERGED — merging is Rob's call.** Worktree:
  `.claude/worktrees/record-repair`.
  - `deca3f9` — the record repairs (30 verify-slice findings adopted)
  - `7bac2c6` — qty clamp + the cart contract covering add-N
  - `3846bfe` — the two dead controls recorded in the ticket
- Final tree at handoff: `pnpm turbo run test lint typecheck` **30/30**,
  `@pm/reference` **37/37**. **The origin suite was NOT run** (it needs a live
  plane) — and see the structural gap below for why 30/30 is weaker than it
  looks.
- The `pdp-build` worktree is restored clean and its branch is merged; it is
  deletable at Rob's discretion.

**Live and verified in production:** `/methodology/` (now carrying the dilution
magnitude), `/_pm/lab/editorial.json` (three profiles) with dereferencing
receipts, receipt-linked readings with min–max bands on every editorial page,
home's receipt-linked spread, `/remix3/editorial/` reading benchmarked columns
with none of its own, and the vanilla PDP.

──────────────────────────────────────────────────────────────────────────────
## TASK 0 — RECONCILE, AND READ THE VERIFY-SLICE RESULT PROPERLY

1. `git fetch origin --prune`. Confirm whether `record-repair` has been merged
   or pushed since this was written. If merged, work from a fresh branch off
   main; if not, continue on `record-repair`.
2. **Two verify-slice runs are complete and fully collected. Do not re-run
   them.** `wf_f6eb8c8a-279` (4 lenses, 30 findings, against the two spec-layer
   commits) and `wf_f0689dcb-ad6` (2 lenses, 13 findings, scoped to the vanilla
   PDP). Every finding from both is either ADOPTED in the three commits above
   or RECORDED as owed in the `pdp-build` ticket. Journals:
   `~/.claude/projects/-Users-roblark-Work-project-matrix/<session>/subagents/workflows/<runId>/journal.jsonl`.
3. **The standing lesson, paid for twice now:** an empty findings array is what
   a DEAD run looks like, AND a partial read is what an INCOMPLETE run looks
   like. Confirm `jq -r 'select(.type=="result") | .result.findings | length'`
   against the journal before believing any count. `findings-*.md` files did
   NOT get written in either run — the lens agents reported "file writes are
   blocked here", so the journal is the only durable record. If you rely on the
   disk-streaming resilience, verify it actually engaged.

──────────────────────────────────────────────────────────────────────────────
## THE UNIT — THE PDP'S CONTROLS, AND THE GUARD THAT WOULD HAVE CAUGHT THEM

**This hard-blocks the three remaining variants.** They are about to
re-implement whatever the master says, and the master currently says two things
that are not true.

### The decision you must make first (and it is a decision, not a bug fix)

The vanilla PDP shipped with **two of its four advertised interactions dead on
500 deployed pages**:

1. **The Zoom button can never toggle.** `packages/reference/render/pdp.mjs`
   renders `<button class="pm-gallery__zoom" aria-pressed="false">Zoom` and
   `packages/tokens/css/components/gallery.css:64-67` implements the pressed
   state — but `variants/vanilla/src/pdp.js` never references it
   (`grep -c zoom` → 0), and `aria-pressed` is not CSS-settable. A JS-on
   visitor hears "Zoom, toggle button, not pressed", presses it, and gets the
   same result forever. **WCAG 4.1.2 name/role/value**, on the site that ships
   an accessibility exhibit.
2. **The format radio group is inert.** `pdp.js`'s only two matches for
   "format" are `body.formatted`, the unrelated live-origin field. Selecting
   format 2 on the rich master (3 formats) leaves the price, stock line, meta
   list and the `#pm-cart-item` payload on format 0 — **the store takes an
   order for a format the visitor did not pick.** Index 0 is `checked` and the
   group is keyboard-operable, so it reads as live.
3. Smaller, same class: **`pm-pdp__scroll` is styled by nothing.**
   `pdp.mjs:83` emits `role="region" tabindex="0"` (the scrollable-region
   pattern) and the class matches **0 lines** across `packages/tokens/css/`.
   Every PDP page with a tracklist gives keyboard users a focus stop on a
   container that cannot scroll, and the WCAG 1.4.10 reflow protection the
   wrapper exists for is absent.

**Why this outranks an ordinary bug, and why it is the whole unit.** ADR-0002
§153 and the decision-map's guardrail make "gallery/zoom, add-to-cart with
client cart state, quantity, format switch" the propagated interaction set the
render-axis flip is measured over. react-next, astro and qwik will read that
guardrail and implement all four. **If vanilla implements two, vanilla's JS and
INP cells come out artificially low on the exact surface whose thesis is that
interactivity earns JS.** That is a rigging shape — unintentional, but exactly
what a hostile reader is entitled to call out.

**The choice, and it is binary:**
- **(a) Make them real.** Wire zoom (five lines: read `aria-pressed`, write the
  inverse, state on the native attribute per `pdp.js`'s own rule) and wire the
  format switch (price, stock line, meta list AND the `#pm-cart-item` payload
  must all follow the selection; the cart item shape gains a format
  discriminator). Then EVERY variant owes both.
- **(b) Take the cut explicitly.** REMOVE the zoom button from `pdp.mjs` and
  its rule from `gallery.css`, and remove the format group, so no variant
  copies a dead control. Record the cut in the ADR.

**Shipping them inert is not a third option** — it is the "falsely
interactive" state `pdp.js:3-4` explicitly disclaims, and it silently zeroes
the same cell in all four paradigms.

**Recommendation, argued:** take **(a) for zoom** (it is five lines, it is a
live WCAG failure, and it is the interaction most likely to differentiate the
paradigms — DOM swap vs state re-render vs resumed handler) and **(a) for
format switch** (a store that takes the wrong format is a correctness bug, not
a scope question). The case against: (a) changes master markup and the cart
payload shape, invalidates the committed masters, forces a vanilla re-render
and a redeploy, and grows the interaction registry — real cost. The case
against (b): removing the format switch guts the PDP's claim to be the surface
where interactivity is genuine, which is the reason this surface was chosen to
carry the thesis. If you take (b) for anything, take it for zoom, never for
format.

**Either way this is a SPEC-LAYER change: ADR-0008 owns the masters, so it owes
an addendum, not an improvisation.** The cart payload shape change also owes a
CART_CONTRACT update in `packages/reference/render/shell.mjs` — that comment is
the contract three paradigms re-implement from, and it has already drifted
twice (see the traps).

### The guard that would have caught all of this — land it in the same unit

- **`@pm/vanilla` contributes ZERO tasks to turbo's 30.** Verify:
  `pnpm exec turbo run lint typecheck test --dry=json` → 75 nodes, 30 with a
  real command, none of them `@pm/vanilla` (`cmd=<NONEXISTENT>` for `#test`,
  `#typecheck`, `#topo`). So "Turbo 30/30 on the final tree" is the identical
  30 tasks that were green before the PDP existed, and **has never covered this
  variant at all.**
- **No pre-merge variant-master identity guard exists for the PDP.**
  `tools/repo-checks/test/variant-master-identity.test.ts` has exactly three
  `describe`s, all EDITORIAL (vanilla / htmx / react-next). No test anywhere
  reads `renderPdpPage`. `tools/origin-suite/suite/` has no `pdp*.test.ts` and
  `drift.browser.test.ts` never fetches a `/vanilla/pdp/` URL.
- All 740 pages DO currently match in both snapshots (re-verified 2026-08-14,
  0 DIFFs) — **an unguarded true statement, which by this repo's standard is
  the defect.**
- **The cheap close (~15 lines, do this):** a fourth `describe` in
  `variant-master-identity.test.ts` — that workspace's `test` script IS inside
  the 30 — looping `Object.entries(pdpMasterIds(snapshot))` for both snapshots
  and comparing `stripDelivery(renderPdp(...))` against
  `stripDelivery(renderPdpPage(..., { depth: 2 }))`. Cheap enough to loop ALL
  `snapshot.details` (both snapshots ran in ~2 s), which also covers the three
  render-class combinations the crate has and the fixture does not.
- The browser drift-gate PDP leg is the stronger check but only runs the
  fixture in CI and costs a Playwright leg per master. **Do both eventually;
  the in-process guard is the one that catches crate drift pre-merge, so it is
  the one that blocks a merge.**
- **The drift gate is JS-OFF by construction** (`drift.browser.test.ts:340`,
  `:573`, `:902`), so a control that is dead only when JS is on is in its blind
  spot. Zoom and format-switch need a **JS-ON** test; there is none for the PDP
  today. That is why both shipped.

### Also owed from the same pass

- **The two cart implementations disagree on a schema-valid input.**
  CART_CONTRACT's validity rule does not require unique ids, so
  `{"v":1,"items":[{"id":7,"qty":1},{"id":7,"qty":1}]}` plus one add gives
  **3 on editorial and 4 on the PDP**. `pdp.js`'s comment asserts this cannot
  happen. Either the contract requires uniqueness (and both `read()`s
  normalise), or the divergence is recorded.
- **`pdp.mjs` still has bare-glyph accessible-name defects** the stepper fix
  swept past: `:113` renders `${price ?? "—"}` (the unpriced master, which this
  chain created, announces "em dash" or silence) and `:125` renders
  `<dd>${d.year ?? "—"}</dd>`. The year case is invisible to every test because
  all four resolved masters have years. Apply the file's own established
  pattern (`<span aria-hidden="true">—</span><span class="pm-sr-only">…</span>`)
  and consider a repo-check that no committed master contains a bare glyph
  inside an element that computes an accessible name.

──────────────────────────────────────────────────────────────────────────────
## THEN: `bench-instrumentation-dilution` (fix the ruler)

Ticket is in `docs/decision-map.md`, **substantially rewritten 2026-08-14 with
re-derived numbers — read the current version, not your memory of it.** It hard-
blocks any PDP byte publication, on the rule that held the first editorial batch
behind issue #16. Rob's 2026-07-24 precedent: a ruler change is its own unit.

**The defect** (unchanged and real): `decomposeDocument`
(`tools/bench-runner/src/collect.ts:224`) apportions the document's compressed
`transferSize` across html/js/data/instrumentation **by share of UNCOMPRESSED
bytes**. ADR-0001 addendum G states the limit; the injected chrome violates it
hardest and the bias scales with the chrome, running toward flattering the
site's smallest published cells.

**What was re-derived 2026-08-14, and what it corrected.** The ticket's original
figures (4,290 B wire, 282.9 B current, 426.1 B corrected, 33.6%) were
node-brotli-q11 and described no published cell. Measured against the SAVED
CLOUDFLARE-SERVED BODY:

| Quantity | Value |
|---|---|
| Document uncompressed | 19,289 B (instrumentation 12,076 B, 62.6%) |
| **Cloudflare wire body** | **5,243 B — 3.68×** |
| node-brotli-q11 of the same body | 4,321 B — 4.46× |
| Current rule, astro's inline bundle | **347 B** |
| **The fix as written** (brotli each region, normalise to `transferSize`) | **660 B — 47.4% under-report** |

**Cloudflare compresses materially WORSE than local brotli at q11.** Any ratio
taken from local brotli therefore carries a quality mismatch.

**THE CENTRAL DECISION OF THIS UNIT IS THE ESTIMATOR, AND IT IS RECORDED AS
UNSETTLED.** The honest range is **34–47%** and the two methods disagree by a
third. Isolated-region brotli has a known upward bias for small regions —
astro's 1,278 B bundle compresses only **2.2× alone against 3.68× in context** —
so 47% is probably high. A leave-one-out marginal estimator removes that bias
and is the obvious alternative; it needs care, because the carve-outs are
non-contiguous and the marginals do not sum to the whole either. **Measure,
choose, and publish the reasoning — do not inherit a number.**

**Correction already made to the fix's own claim:** "local brotli gives the
ratios, `transferSize` stays the authority on the total, so no
local-vs-Cloudflare quality mismatch leaks into the published number" is **too
strong**. Normalising fixes the LEVEL, not the between-region RATIOS. Either
measure at Cloudflare's actual quality, or publish the residual as a stated
limit.

**Consequences to plan for:**
- Needs an **ADR-0001 addendum superseding G's attribution rule**.
- **It invalidates every committed receipt.** The editorial batch re-runs a
  third time (~7 minutes for all three profiles, measured). Same discipline:
  clean tree, one nonce, all ten effective URLs pre-warmed to compressed first.
- Re-measure the chrome constant if the change touches what it reports.
- Validate against the THREE delivery shapes that already exist — vanilla
  (external single), astro (inlined), qwik (external-many).
- `/methodology/` already carries the magnitude, direction and "read the
  smallest JS cells as floors". **Update that copy when the fix lands** —
  `published-readings.test.ts` should pin the new sentence the way it pins the
  serialization caveat.

### Two anti-rigging holes recorded in ADR-0001 addendum N — this unit is their natural owner

1. **The constant describes the chrome measured BEFORE the deploy it enables.**
   The front build regenerates the chrome fragment FROM the receipts, so the
   fragment that ships is not the one the probe hashed (11,931 B against 12,023
   B here — 0.8%, but unbounded, and it grows with each surface added to the
   strip). `workers/front/build.mjs`'s only identity check is `populated`,
   which both fragments satisfy. **The obligation is structurally re-incurred
   by its own discharge.** Fix: after the front build renders the chrome it
   will ship, hash it with the probe's own regex and refuse when it differs
   from `chromeConstant.measuredChrome.sha256` — an explicit two-pass publish
   (build → measure → rebuild → deploy) instead of silent staleness.
2. **Nothing ties a receipt's `commit.sha` to the code the plane was serving.**
   `tools/bench-runner/src/git.ts:9` `commitPin` reads the LOCAL checkout, and
   `--origin` is now a REMOTE plane. `pnpm bench reproduce` is the published
   one-command path, so a skeptic following it measures a different tree than
   the receipt names with no way to detect it. Fix: expose the build's SHA from
   the front Worker (`x-pm-commit` header or `/_pm/build.json`), record it as
   `originCommit` beside the local pin, and refuse a batch or probe whose
   origin SHA disagrees (with an explicit escape for deliberate cross-tree
   measurement).

──────────────────────────────────────────────────────────────────────────────
## AFTER THIS: FINISH THE PDP

`docs/decision-map.md` → `pdp-build` ticket carries full state. Landed: spec
layer + vanilla (+ this unit's repairs). Remaining:

- **react-next, astro, qwik.** New SURFACES on EXISTING Workers — no new ports,
  Workers, CI deploy lines or wrangler changes. Ports already run: vanilla
  8792/9235, react-next 8793/9236, astro 8794/9237, qwik 8795/9238. Each build
  MOVES its name from `plannedVariants` → `variants` in `SURFACE_CONTROLS.pdp`
  (vanilla is already moved). htmx and remix3 are correctly OUT of scope.
- **The drift-gate and origin-suite PDP legs** (all four masters × four
  variants; mirror the editorial legs in `drift.browser.test.ts`), **plus a
  JS-ON leg** — the JS-off gate is why two dead controls shipped.
- **The publication pipeline's generalisation** off its `editorial-`
  hardcoding (below).
- **Interaction registry + batches.**

### Decisions already made — do NOT re-litigate

- **URL contract:** slug-keyed `/{variant}/pdp/{id}-{artist}-{title}/`. The
  edge API is id-keyed and rejects non-numeric (`/api/pdp/{id}`, `^\d{1,15}$`),
  so request-time variants parse the leading id, fetch the tray, then **verify
  the tray's `slug` equals the requested slug; mismatch → 404**. A canonical
  301 was REJECTED: the build-time variants cannot serve one, so it would be an
  observable behavioural divergence between paradigms on the very surface that
  measures them.
- **astro stays STATIC:** `getStaticPaths` over the catalogue, **no
  `@astrojs/cloudflare`**. An SSR adapter changes what the column means.
  **Trap:** its snapshot bake (`scripts/resolve-snapshot.mjs` →
  `src/data/snapshot.json`) resolves exactly ONE payload into one generated
  module; a second needs a matching `@pm/astro#build` turbo `outputs` entry or a
  cache hit ships a page importing a module that isn't there.
- **`{prime?, measure}` is NOT needed here** — neither planned PDP interaction
  needs a priming prefix. It stays with the PLP (ADR-0005 §3).
- **ADR-0003's CSS-delivery ambiguity is resolved: the PLP owns it.** The PDP's
  CSS cell publishes as "held constant (raw sheets)".
- **Planned interactions:** `pdp-gallery-switch` (headline — DOM swap vs state
  re-render vs resumed handler) and `pdp-add-to-cart` (controlled cross-surface
  twin of `editorial-add-to-cart`). The CLI applies ONE `--interaction` per
  batch → two batch families. `INTERACTIONS` (`collect.ts:26`) currently holds
  only `none`, `body-click`, `editorial-add-to-cart`. **The live-origin button
  is never registered — the fence is that no registry id names it.** If zoom
  and format-switch become real, they need registry entries too, and the
  interaction set must be identical across all four variants or the comparison
  is confounded.

### Per-variant traps (verified in source)

- **react-next**: its ROOT layout (`src/app/layout.tsx`, `CSS_FILES`) hardcodes
  editorial's stylesheets, so every future route inherits editorial CSS. Same
  defect in **qwik**'s `src/root.tsx:94-101`. **astro is the precedent** —
  `Shell.astro` takes a `css` prop. Parameterise both.
- **react-next + qwik**: the masthead `current` marker is typed
  `"plp" | "editorial"`. **NO change needed** — the PDP master deliberately
  marks `current: "plp"`. Recorded so nobody "fixes" a non-defect.
- **astro**: `Shell.astro`'s HOSTS map has no `pdp` key and
  `ReleaseCard.astro:26` types the href literally. The spec of record
  (`shell.mjs` HOSTS) already has `pdp: (slug) => …`.
- **vanilla** (fixed, for reference): asset URLs were the literal `"../"`,
  correct only one level deep; the base is now derived from page depth
  (`assetBase(depth)`). Note `renderPdpPage`'s `depth` defaults to 2 and
  `build.mjs:84` passes a literal 2, while editorial still carries two
  hardcoded depths of its own — a third surface is how that goes wrong.

### The publication pipeline is editorial-hardcoded — VERIFY before relying

Dropping a `pdp-*.json` receipt into `workers/front/lab/receipts/` today **fails
the build loudly**: `build.mjs:274` gates on the filename prefix `editorial-`,
and because `dist` is deleted at `:49` before the throw and the Worker
statically imports a file inside it, the Worker bundle dies with it.

Must generalise: the filename→surface gate (`:274`); `labProfiles` (`:261`,
keyed by profile alone so it cannot hold two surfaces); the single hardcoded
`/_pm/lab/editorial.json` output (`:296` — ADR-0008 §3 specifies per-surface
`/_pm/lab/{surface}.json`); the Worker's single static import
(`workers/front/src/index.js:28`, though `LAB_BUNDLES` at `:30` is already a
surface-keyed map); the `FIT` registry (`lab/fit.mjs`, one entry hard-naming
five editorial variants in prose AND in a machine-checked `requires`); home's
and the methodology page's editorial-named markers; and
`published-readings.test.ts` (editorial-only in five distinct ways, incl. the
13 KiB fragment budget asserted on editorial pages only).

Already generic: `bundleFromReceipt`, the `SurfaceLabBundle` type, the chrome
renderer, `labFor`. **Related latent inconsistency:** `bundleFromReceipt`'s
bands-overlap early return skips the no-fetch verification entirely.

### The live-origin demonstration — EXTERNALLY BLOCKED, needs Rob

ADR-0002 §3: the ONLY serve-time Discogs call, fenced, mandatory
self-explaining copy, a demonstration and never a "mode". Already in the master
as a `data-pm-fenced` plaque.

- **The edge Worker has NO live route.** Verified: `/api/plp`, `/api/pdp/:id`,
  `/api/snapshot`, `/api/beacon`, `/assets/img/*`.
- Arming it needs the Discogs token as a **Worker secret**
  (`~/.config/project-matrix/discogs-token`). **That leaves this machine and is
  Rob's to set — ask, do not do it unprompted.**
- vanilla's `pdp.js` already wires the button to `/api/live-price/{id}`; its
  `<output>` states the absence rather than being a silent no-op.
- The route needs rate limiting and generic-error handling (security.md).
- **The plaque is COMPARED by the drift gate like any other markup** — the
  fence excludes it from benchmark NUMBERS, not from the identity contract. So
  core PDP comparisons must NOT pass `dropFencedSubtrees`, and the fenced count
  on a PDP page is exactly 1. Editorial's "zero fenced on core pages" assertion
  is editorial-scoped and must be **re-scoped, not deleted**.

──────────────────────────────────────────────────────────────────────────────
## PUBLICATION DISCIPLINE (unchanged, non-negotiable)

- Official batches run OUT OF BAND on a quiet machine, never in a CI gate; the
  post-deploy smoke asserts receipt SHAPE only, never magnitudes.
- Throttled timing cells publish numbers, **never verdicts**, until the
  WebPageTest cross-check exists. The fit line rides bytes.
- Every cell publishes its median WITH its min–max band; comparative language
  only where bands do not overlap, else "Indistinguishable at this sample
  size". **This binds the chrome constant too** — addendum N states its
  long-task figure as 0 ms median, 0–64 ms across 7 runs.
- No initial-JS comparison between two hydrating frameworks publishes as a
  verdict without the addendum-M serialization caveat riding it.
- **No publication is a legitimate state**: the bundle builds empty and the
  pages say so plainly. Never a number-shaped hole. Corollary decided
  2026-08-14: when a ruler defect is found, **caveat live receipted cells with
  the measured magnitude and direction — do not pull them.**
- The CSS cell is BARRED from publishing as a render-axis verdict until native
  CSS delivery lands (PLP owns it).
- Nothing publishes a number without a receipt.

──────────────────────────────────────────────────────────────────────────────
## TRAPS THIS CHAIN HAS ALREADY PAID FOR (don't repay)

- **A receipt records `commit.dirty` AS MEASURED.** Editing ANY tracked file
  while a batch runs makes every receipt it mints unpublishable — cost a full
  batch re-run. Commit everything first, then measure.
- The constant's own artifact left in the tree dirties the NEXT measurement.
- **Never `| tail` a background run** — it buffers all output to the end.
- **OFFICIAL NUMBERS NEED A QUIET MACHINE.** One heavy job at a time;
  verify-slice runs while you probe INLINE, never while a batch measures.
- Playwright's `route.fulfill` IGNORES a declared `content-encoding` — a brotli
  body yields a corrupt document. The chrome-constant probe pads to equal bytes.
- Only `run-local.mjs` builds variants with the matching snapshot selector.
  `PM_HOLD=1` brings the plane up and HOLDS it.
- Deployed-origin runs need `PM_ORIGIN` + `PM_EXPECT_BROTLI=1` +
  **`NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`** (Node
  does not trust the corp MITM CA; the browser uses the keychain).
- `pnpm install --force` lies about resolution changes — wipe `node_modules`.
- The local crate `img/` dir is missing exactly one file
  (`9861004-primary.thumb.avif`), which is why the crate suite reads N−1
  locally. **NOT a defect** — it serves 200 in prod.
- **Numbers from tools, never typed.** The record-not-code class survives
  review; verify-slice has now caught it in every single slice — eleven times
  in the last two passes, including three hand-typed counts (`16 combinations`,
  `5,116 tracklist rows`, `three commits`) that were derivable in one line.
- **The worktree/main-checkout path trap.** Bash `cwd` was the worktree while
  `Edit`/`Write` were given absolute paths into the MAIN checkout — edits
  silently landed in the wrong tree. **Use the worktree's absolute path in
  every file tool call**, or verify with `git -C <tree> status` after editing.
- **`git apply --3way` STAGES what it applies**, and a later `git commit` with
  a pre-populated index sweeps those files into an unrelated commit. Check
  `git diff --cached --name-only` immediately before every commit.
- Never issue two `Edit` calls to the same file in one parallel block — they
  race and both can silently no-op.
- **A CSS-contract comment is part of the spec.** `qty.css` and `tracklist.css`
  documented pre-fix markup that four paradigms re-implement from; both were
  wrong for a full slice. When you change a master's markup, change the
  contract comment in the same commit.

──────────────────────────────────────────────────────────────────────────────
## SESSION DISCIPLINE (standing)

One unit at a time. Run the saved verify-slice workflow in the BACKGROUND while
probing INLINE; **refute every finding inline against source before adopting —
agents overstate.** (This session's own case: a lens claimed the 33.6%
under-report figure was simply wrong; measuring showed the RATIO survived under
one estimator and nearly doubled under another, and the real finding was that
the ticket contained two inconsistent methods. Neither the lens nor my first
derivation was right on its own.) Re-run BOTH suite modes (fixture and
`PM_SEED_DIR=tools/snapshot-capture/crate`) on the FINAL tree and only then
write numbers into the record. Explicit paths, never `git add -A`.

Records to update at the end: `docs/build-log.md` (a new Phase),
`docs/decision-map.md` (the ticket), any ADR addenda your decisions require, a
dated line in `docs/prototypes/finish-line-handoff-prompt.md`'s progress log
(main checkout, untracked), and the branch-state memory.

## DO NOT

No live Discogs calls except the fenced live-origin demonstration, and never in
a measured path. No verdict copy the receipts don't support — bands-overlap
renders indistinguishable, and the villain/contender framing never ships. No
perf assertions in blocking CI gates. Nothing that publishes a number without a
receipt. No new primitive tokens and no spec-layer redesign by improvisation —
ADR-0008 owns the masters, the chrome anatomy and SURFACE_CONTROLS semantics; a
needed change is an ADR addendum. Don't rig the variant to fit the instrument
(the rejected `assetsInlineLimit: 0` precedent) — fix the instrument or state
the limit. **Do not ship a control that cannot do what its markup says it
does.**

## AFTER ALL OF THIS

Merge is Rob's call (merging deploys; watch for the once-per-new-URL deploy
flake — three signatures so far: first-hit uncompressed, binding-propagation
chrome-count-0, and stale chrome on existing URLs. Probe the live plane healthy
FIRST, then `gh run rerun <id> --failed`).

Then the recorded order: **PLP** (the data axis — owns the Apollo fence
mechanism, the frames-partial generalization, and the `{prime, measure}`
registry shape), then **Checkout**, **a11y**, and **"How it was built"** —
whose arrival moves the methodology page from its recorded interim home.
