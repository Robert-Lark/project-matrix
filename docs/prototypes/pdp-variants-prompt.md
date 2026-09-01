# Next unit — THE PDP GOES FOUR WAYS: react-next, astro, qwik

Work under the standing best-judgment authorization: decide from the recorded
decisions and roll forward without pausing. Read
`docs/prototypes/finish-line-handoff-prompt.md`'s `## Progress log` FIRST —
the last entry is dated 2026-08-17 and is the state of record — then
`docs/decision-map.md`'s `pdp-build` ticket, then **ADR-0008 IN FULL
(including addendum A)**, ADR-0002's amended interaction guardrail, and
ADR-0001 addenda **O/P/Q** (the publication rules your receipts will be
gated by) before any code.

──────────────────────────────────────────────────────────────────────────────
## NORTH STAR (why this project exists)

The site is a live-benchmarking portfolio: one Discogs-powered store built in
several rendering paradigms, instrumented so a **SKEPTICAL STAFF ENGINEER
CANNOT CALL THE NUMBERS RIGGED**. The thesis is **fit, not a leaderboard** —
misapplication is costly, correct application is huge. Evidence for staff-level
frontend judgment; later a conference talk and an article.

**This unit is the thesis flip's build-out.** The PDP is the surface where
interactivity is GENUINE (gallery, zoom, quantity, add-to-cart), so the
hypothesis under test is that the render-axis verdict INVERTS here — react-next
paying for hydration it finally uses, astro/qwik defending their islands. The
flip is a HYPOTHESIS the receipts will test, **never a result to be arranged**.
A confident wrong number costs this project more than a missing one. If a
variant's numbers embarrass its paradigm, they publish anyway.

──────────────────────────────────────────────────────────────────────────────
## STATE OF THE WORLD (verified 2026-08-17 — VERIFY IT AGAIN ANYWAY)

**Every handoff in this chain has had at least two facts go stale before it
was read** (this one's predecessor claimed a test file had "two it( blocks";
it had eleven). Re-verify from the world, never from this prompt.

- **`main` = `28d01fc2`** — the ENTIRE ruler arc is merged, deployed, and
  published (PRs #26–#29). **Nothing is unmerged. No worktree carries
  pending work.** Check: `git fetch origin --prune` then
  `git log --oneline -5 origin/main`.
- **The dilution is undone in public.** Published editorial cells
  (avg-broadband, warm): astro 0.76 KB, vanilla 1.81, htmx 19.54, qwik
  29.69, react-next 154.98. The floors caveat is GONE from `/methodology/`.
- **The plane attests its build**: `/_pm/build.json` serves
  `{sha: 28d01fc2…, dirty: false}`. The chrome constant is fully attested
  (+88 ms FCP/LCP, wire 2,321 B at calibrated q4, commit pin == origin
  attestation, fragment hash-verified).
- **The vanilla PDP is live and healthy** (~500 slug URLs, 200s), zoom
  WIRED, thumb strip WRAPPED, meta list renders full composition.
- **The wire is zstd for browsers.** Chromium negotiates zstd; Cloudflare
  serves it; curl-shaped br-only clients still get brotli. Any pre-warm
  for measurement uses browser-shaped `Accept-Encoding: gzip, deflate,
  br, zstd`. The ruler prices by the wire's own codec
  (`loo-wire-normalised`; ADR-0001 addendum O coda).

## TASK 0 — RECONCILE

1. `git fetch origin --prune`; confirm main == `28d01fc2` or note what
   moved. Branch off origin/main in a fresh worktree
   (`git worktree add .claude/worktrees/<name> -b <name> origin/main`).
   **A fresh worktree has NO node_modules and NO
   `tools/snapshot-capture/crate/img`** — `pnpm install --frozen-lockfile`,
   and symlink the img dir from the main checkout for crate runs (remove
   before committing; untracked, NOT gitignored).
2. Spot-check the plane: `/_pm/build.json` sha == origin/main,
   `/vanilla/pdp/…` a 200, `/_pm/lab/editorial.json` carries the corrected
   cells above.
3. **The `verify-slice` workflow's findings-files claim is stale twice
   over**: lens agents have NOT written `findings-*.md` in the last two
   runs — the workflow JOURNAL is the durable record
   (`jq` the `result` lines). Don't wait for files.

──────────────────────────────────────────────────────────────────────────────
## THE UNIT — the three remaining PDP variants, each with its guards

`docs/decision-map.md` → `pdp-build` ticket carries full state. Build
`/{variant}/pdp/{slug}/` in **react-next, astro, and qwik** against the
ADR-0008 spec layer (four masters under `packages/reference/surfaces/pdp/`,
derived by `render/lib.mjs pdpMasterIds`). htmx and remix3 are correctly
OUT of scope. Slice them one variant at a time (the editorial-build
precedent: one slice, its guards, verify, commit, next), or as one unit if
the shared spec work dominates — your call, recorded either way.

### The settled contracts (do not relitigate)

- **URL contract:** slug-keyed `/{variant}/pdp/{id}-{artist}-{title}/`.
  Request-time variants parse the leading id, fetch the tray, then
  **verify the tray's `slug` equals the requested slug; mismatch → 404**.
  A canonical 301 was REJECTED (build-time variants cannot serve one — it
  would be an observable behavioural divergence between paradigms).
- **astro stays STATIC:** `getStaticPaths` over the catalogue, **no
  `@astrojs/cloudflare`** — an SSR adapter would confound the cross-surface
  comparison with a paradigm change. Its snapshot bake resolves exactly ONE
  payload into one generated module; a second needs a matching
  `@pm/astro#build` turbo `outputs` entry or a cache hit ships a page
  importing a module that isn't there.
- **Interaction set:** gallery/zoom/quantity/add-to-cart, IDENTICAL across
  all four variants or the comparison is confounded. **Format switch is
  OUT** (ADR-0008 addendum A — a Discogs `formats` array is the composition
  of ONE release, not a menu; do not re-add it). `pdp-gallery-switch` and
  `pdp-add-to-cart` are PLANNED and **registered nowhere** (`INTERACTIONS`
  in collect.ts holds only none/body-click/editorial-add-to-cart) — say
  "planned", not "registered". Registering them belongs to the batches
  unit, not this one.
- **CART_CONTRACT binds every implementation** — including the uniqueness
  clause (one entry per release id, checked in all seven `read()`s) and
  the "9+" badge cap. `namedGlyph` discipline: no bare em-dash for
  price/year absence.
- **No new ports, Workers, CI deploy lines, or wrangler changes.** New
  SURFACES on EXISTING Workers. Ports already run: vanilla 8792/9235,
  react-next 8793/9236, astro 8794/9237, qwik 8795/9238.

### Per-variant traps (verified in source 2026-08-15 — RE-VERIFY)

- **react-next**: the ROOT layout (`src/app/layout.tsx`, `CSS_FILES`)
  hardcodes editorial's stylesheets. **qwik** has the same defect at
  `src/root.tsx:94-101`. **astro is the precedent** — `Shell.astro` takes
  a `css` prop. Parameterise both; there is now a sabotage-proven
  stylesheet-list-identity guard that will catch drift.
- **astro**: `Shell.astro`'s HOSTS map has no `pdp` key, and
  `ReleaseCard.astro:26` types the href literally.
- The react-next/qwik masthead `current` marker typed `"plp" | "editorial"`
  needs **NO** change — the PDP master deliberately marks `current: "plp"`.
- Each build MOVES its name from `plannedVariants` → `variants` in
  `SURFACE_CONTROLS.pdp` — **and the `pdp-controls` guards will then FAIL
  until you point them at that variant's enhancement**. That is deliberate:
  `pdp-controls-wired` runs pdp.js's own selectors against the master DOM;
  give each variant its registered enhancement equivalent.
- The JS-ON browser leg (`pdp-controls.browser.test.ts`) iterates
  `SURFACE_CONTROLS.pdp.variants`, so it extends itself — but its "no
  button may change nothing when pressed" rule and the reflow leg (probes
  the WIDEST gallery in the served snapshot, fails under four) will hold
  every new variant to what vanilla now honors. **The fixture is not a
  scale model of the crate** — the thumb-wrap defect was invisible on the
  fixture's two-image probe release and live on 316 of 500 crate pages.
- Every variant×surface pair needs its pre-merge variant-master identity
  guard over BOTH snapshots (the editorial slices' pattern; vanilla's PDP
  guard covers all 740 trays in ~90 ms — match that shape).

### What this unit does NOT include

- **PDP byte publication.** It is UNBLOCKED in principle (the ruler is
  fixed; any receipt now carries `docAttribution` + `originCommit` by
  construction) but still needs the **publication pipeline's
  generalisation** off its `editorial-` hardcoding — that is the NEXT unit
  (decision-map: `build.mjs:274` filename gate, single-surface
  `labProfiles`, the one hardcoded `/_pm/lab/editorial.json` output, the
  Worker's single static import, the FIT registry, home's and methodology's
  editorial-named markers, `published-readings.test.ts`). Dropping a
  `pdp-*.json` receipt into `workers/front/lab/receipts/` today **fails
  the build loudly** and kills the Worker bundle with it. Don't fold that
  generalisation in here; don't publish PDP numbers through a side door.
- **Interaction registry entries and batches** (the unit after).
- **The live-origin demonstration** — EXTERNALLY BLOCKED on Rob setting
  the Worker secret; ask, never do it unprompted. But note: the plaque IS
  compared by the drift gate — core PDP comparisons must NOT pass
  `dropFencedSubtrees`, and the fenced count on a PDP page is exactly 1.

### Measurement rules that now bind you (the ruler arc's legacy)

- Receipts dated 2026-08-16+ MUST carry `originCommit` + `docAttribution`
  (build gate). A ruler-touching change can never mint publishable
  receipts from a branch — the provenance gate refuses a checkout
  measuring a plane on a different SHA. If you touch the ruler: merge,
  deploy, THEN measure at the merge SHA.
- Any receipts-changing publication re-incurs the chrome-constant two-pass
  (P gate): receipts commit deletes the stale constant → local-interim
  probe on a held plane → deployed-plane re-measure after deploy.
- Official numbers: quiet machine, one nonce, receipts written to SCRATCH
  during the runs (the tree must stay clean across all profiles),
  browser-shaped pre-warm.

──────────────────────────────────────────────────────────────────────────────
## PUBLICATION DISCIPLINE (unchanged, non-negotiable)

- Throttled timing cells publish numbers, **never verdicts**, until the
  WebPageTest cross-check exists. The fit line rides bytes.
- Every cell publishes median WITH min–max band; comparative language only
  where bands do not overlap, else "Indistinguishable at this sample size".
- No initial-JS comparison between two hydrating frameworks publishes as a
  verdict without the addendum-M serialization caveat riding it.
- **No publication is a legitimate state** — never a number-shaped hole.
- The CSS cell is BARRED from render-axis verdicts until native CSS
  delivery lands (the PLP owns it, ADR-0003).
- Nothing publishes a number without a receipt.

──────────────────────────────────────────────────────────────────────────────
## TRAPS THIS CHAIN HAS PAID FOR (don't repay — three were paid AGAIN last session)

- **`git restore`/`git checkout <file>` destroys uncommitted work** — last
  session it wiped a fresh probe artifact during a sabotage proof (4-min
  re-run). Scratchpad-copy FIRST, then sabotage.
- **Commit everything first, THEN measure.** A receipt records
  `commit.dirty` AS MEASURED — an entire 3-profile batch was minted
  unpublishable last session because the fix under test was uncommitted.
- **The worktree/main-checkout path trap**: the shell cwd resets to the
  MAIN checkout between calls. `pnpm install` and a typecheck were once
  run against the WRONG TREE and reported green. Use absolute worktree
  paths or re-`cd` in every command; verify with `pwd` when it matters.
- **The 30 s `page.goto` timeout flake** (recorded class, addendum K): it
  hit the post-deploy smoke AND one batch profile last session. Probe the
  live plane healthy FIRST, then `gh run rerun <id> --failed` (or re-run
  the one profile on the same nonce). Signatures so far: first-hit
  uncompressed, binding-propagation chrome-count-0, stale chrome, and
  plain goto timeout with a healthy plane.
- **Numbers from tools, never typed.** Caught again last session (a
  findings count was wrong in a commit message and needed an amend).
  Re-derive, never re-read.
- Only `run-local.mjs` builds variants with the matching snapshot selector.
  **A hand-run `pnpm --filter @pm/<variant> build` re-bakes with the
  FIXTURE and crate URLs 404.** `PM_HOLD=1` brings the plane up and HOLDS it.
- Never `| tail` a background run; `cmd > log; echo EXIT=$?` reports the
  echo's status — append the exit code INSIDE the redirect.
- Long compound background commands have been killed mid-run by the
  environment twice — run suites as separate background jobs and check
  logs for actual completion, not just the notification.
- `pnpm install --force` lies; wipe node_modules. Deployed-origin node
  fetches need `NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`.
- The crate img dir is missing exactly one file
  (`9861004-primary.thumb.avif`): crate suite reads **N−1 of N** locally.
  NOT a defect — 200 in prod.
- `jq ... | wc -l` is not a count; use `jq -s 'length'`.
- **A CSS-contract comment is wire bytes** (sheets copy raw). Change the
  contract comment in the same commit as the markup; keep it load-bearing.
- Never issue two Edits to the same file in one parallel block.
- `git apply --3way` STAGES; check `git diff --cached --name-only` before
  every commit.

──────────────────────────────────────────────────────────────────────────────
## SESSION DISCIPLINE (standing)

One slice at a time. Run the saved **verify-slice** workflow in the
BACKGROUND per slice while probing INLINE; **refute every finding against
source before adopting** — agents overstate, and so do you. Confirm any
empty findings array against the journal
(`jq -s '[.[]|select(.type=="result")|.result.findings|length]|add' journal.jsonl`)
— a dead run looks exactly like a clean pass. Never run the origin suite
while a lens works (bench.browser's 300 s hook blows under contention and
17 skips read like a regression).

Re-run BOTH suite modes (fixture and `PM_SEED_DIR=tools/snapshot-capture/crate`)
on the FINAL tree and only then write numbers into the record. Current
baselines: **fixture 360/360, crate 359/360** (the known thumbnail miss) —
your unit should only ADD tests. Turbo baseline: **30/30**.

Stage explicit paths, never `git add -A`. One commit per slice branch;
amend to update — EXCEPT when a committed artifact pins an earlier commit's
SHA (receipts, constants): then stack commits, never squash, and say so in
the PR body.

**Records at the end of each slice:** `docs/build-log.md` (a new Phase
heading requires re-rendering the how-it-was-built master —
`cd packages/reference && node render/build.mjs` — or `reference.test.ts`
fails), `docs/decision-map.md`, any ADR addendum your decisions require
(mark supersessions in place, never silently rewrite),
a dated line in `docs/prototypes/finish-line-handoff-prompt.md`'s progress
log (MAIN checkout — untracked), and the branch-state memory.

**Merge is Rob's call** (merging deploys). Push/PR only with his
authorization; his "merge in" covers the stated plan it responds to.

## DO NOT

No live Discogs calls except the fenced demonstration, never in a measured
path. No verdict copy the receipts don't support. No perf assertions in
blocking CI gates. **Don't rig the variant to fit the instrument** — and
don't rig the instrument to flatter the variant; if a PDP number
embarrasses the thesis, it publishes anyway. Don't fold the pipeline
generalisation or the interaction registry into this unit. Don't re-add
the format switch. Don't touch `packages/reference` masters to make a
variant's life easier — variants match masters, never the reverse.

──────────────────────────────────────────────────────────────────────────────
## AFTER THIS UNIT — the recorded order

1. **The publication pipeline's generalisation** off `editorial-`
   hardcoding (per-surface `/_pm/lab/{surface}.json`, ADR-0008 §3; the
   full inventory is in the decision map and in
   `docs/prototypes/ruler-unit-prompt.md`'s AFTER section).
2. **Interaction registry + PDP batches** (`pdp-gallery-switch`,
   `pdp-add-to-cart` — identical across variants), then the PDP byte
   publication the ruler arc unblocked.
3. Then the surface order: **PLP** (data axis — Apollo fence, frames
   partial generalization, `{prime, measure}` registry, ADR-0003's CSS
   question), **Checkout**, **a11y**, **"How it was built"** (which
   re-homes the methodology page).

Then the recorded merge/deploy discipline applies to every leg: probe the
plane healthy first on any red deploy, rerun --failed, and keep the
receipt chain unbroken — the whole point of the arc just finished is that
a skeptic can now verify every number from the artifact alone.
