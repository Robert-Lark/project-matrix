# Clear the merge blockers on PRs #36, #38, #39

You are picking up three open PRs that a five-lens review found **not ready to merge**. Two sibling
PRs from the same batch (#13 ImgBot, #37 how-it-was-built spec) are already merged; `main` is at
`0eec463`. Your job is to get #36, #38 and #39 to a mergeable state, in that order.

Every file:line below was read from source and re-verified by an adversarial pass. Re-open each one
before you change it — do not trust this document over the code.

---

## The theme that ties all three together

**Each PR ships a page that tells its visitor something false about itself.** On a project whose
entire value is "a sceptical staff engineer can't call this rigged", a served falsehood is not a
nitpick — it is the product failing at its one job. The repo has already ruled this way once, at
`docs/decision-map.md:323` and `:358`, for the PDP. Apply the same standard.

Fix the falsehood or delete the claim. Both are acceptable. Shipping the claim with the gap is not.

---

## PR #36 — `checkout-vanilla` · "Build the vanilla checkout and guard it"

CI green, no code-file overlap with the other two. Merges first once fixed. It also clears a live
site-wide bug: every masthead Cart link points at `/vanilla/checkout/`, which 404s today
(`packages/reference/render/shell.mjs:40,152`).

### Blocker 1 — with JS off, the card fields POST to the edge

Verified chain, all at `origin/checkout-vanilla`:

- `variants/vanilla/render.mjs:540` — `<form class="pm-checkout__form" method="post" action="">`
- `variants/vanilla/render.mjs:498` — `field()` stamps `name="${id}"` on **every** input
- `variants/vanilla/render.mjs:582,585,586` — `autocomplete="cc-number"`, `cc-exp`, `cc-csc`
- `variants/vanilla/src/checkout.js:382` — `event.preventDefault()` exists **only in JS**
- `variants/vanilla/render.mjs:537` — the plaque reads *"what you type never leaves your browser"*

With JavaScript off, blocked, or the deferred script failing, "Place order" natively POSTs card
number, CVC, expiry and full address to the origin. The `cc-*` tokens are what make a browser offer
a **real saved card**, so this is not hypothetical test data.

**Fix:** give `field()` an option that omits `name` and sets `autocomplete="off"`, and use it for
`card`, `cardname`, `expiry`, `cvc`. A submittable control with no `name` is not serialized, so the
JS-off submit carries no card data while `method`/`action` and the form's realism are untouched.

**The coupling that is the real cost:** this must land in `packages/reference/render/checkout.mjs`
(same helper, lines 16-21 and 79-83) **and** its regenerated
`packages/reference/surfaces/checkout/index.html` in the same commit, or the drift gate fails on DOM
divergence.

**Reproduce:** serve `dist/vanilla/checkout/index.html`, disable JS, fill the card field, press
"Place order", watch the DevTools Network panel.

### Blocker 2 — the page advertises native validation it does not have

`variants/vanilla/render.mjs:590` reads *"With JavaScript off, every field here still works —
labels, hints, native validation"*.

Counted, not guessed:

```
git show origin/checkout-vanilla:variants/vanilla/render.mjs \
  | awk 'NR>=490 && NR<=600' | grep -c 'required\|pattern='
# → 0
```

There is no `required` and no `pattern` anywhere in the checkout markup, so nothing gates the JS-off
submit. Either add the constraint attributes to `field()` (in the master too) or delete the claim.
The same assertion also sits at `packages/reference/render/checkout.mjs:9-12` and
`variants/vanilla/src/checkout.js:215-219` — fix all three.

### Blocker 3 — the switcher says the page is served by nobody

`packages/switcher/src/config.ts:154` still has `checkout.variants: []` while this PR makes
`/vanilla/checkout/` real. `chrome.ts:184,190` renders `Served by ${controls.variants.length} of
${planned} planned variants today`, so the page renders "Served by 0 of 3".

**Fix, one line:**
```ts
checkout: { variants: ["vanilla"], plannedVariants: ["react-next", "htmx"] }
```

**Reproduce:** `renderChrome({variant:"vanilla", surface:"checkout", pathname:"/vanilla/checkout/",
search:"", location:"local"})` and grep for "Served by".

### Follow-ups for #36 (not merge-blocking)

- Even with the payment fields unnamed, a JS-off submit still sends email + full postal address and
  lands on a zero-length 405 (`workers/front/src/index.js:101` → `variants/vanilla/src/index.js:7` →
  ASSETS). Either soften the plaque copy at `render.mjs:537` / `checkout.mjs:34`, or drop `name` from
  every input. Pick one and say which in the build log.
- CLS on the phone profile: `packages/tokens/css/surfaces/checkout.css:40-43` puts
  `.pm-cart { order: -1 }` above the form at ≤52em, and `cart-summary.css:37`'s `min-block-size:
  12rem` is a floor, not a fixed height — late catalogue population (`checkout.js:190`) grows the
  summary and shifts the whole form. Does not move a published number (the measured state is the
  empty cart), but it contradicts `checkout.js:97-98`.
- No checkout entry in `tools/bench-runner/src/collect.ts` INTERACTIONS (closes at `:149`) — the
  surface whose stated subject is INP has no scripted interaction. Add `checkout-invalid-submit`
  clicking "Place order" on the pristine form.
- Add `"@pm/vanilla#test": { "cache": false }` to `turbo.json` and delete lines 647-719 of
  `tools/repo-checks/test/variant-master-identity.test.ts`. **Net −73 lines.** The PR skipped this
  fearing a conflict with #38/#39; that fear is unfounded — both edited `turbo.json` and the
  three-way merge is clean.
- `variants/vanilla/src/checkout.js:32,54,55` is the third byte-identical copy of
  `read`/`count`/`renderCount` (`cart.js:13,35,36`, `pdp.js:17,39,40`). The no-module-graph
  justification holds; the drift risk does not. Add one repo-check asserting the three copies match
  after comment stripping (~20 lines; the `codeOnly()` stripper already exists at
  `pdp-controls-wired.test.ts:284`).
- `tools/repo-checks/test/pdp-controls-wired.test.ts:521-662` is a near-verbatim copy of the PDP
  block at `359-519`. Parameterising saves ~40 lines.

---

## PR #38 — `plp-react-next` · "Build the PLP's react-next data-strategy arm"

CI green. The leanest code in the batch — the review found **no defect in the three strategy arms
themselves**. Everything blocking is integration the PR did not do.

### Blocker 1 — the PLP switcher renders dead

`packages/switcher/src/config.ts:139` is still `plp: { variants: [] }`, and #38 touches
`packages/switcher` not at all (verified: 27 changed files, none under it).

`chrome.ts:145` filters strategy cells by `controls.variants.includes(...)`, so with an empty array
the surface's **entire measured-axis control** — the whole point of the PLP — renders as one dead
`<span aria-current="page">`, and the panel prints "Served by 0 of 2 planned variants today".

**Fix:** set `variants: ["react-next"], plannedVariants: ["htmx"]` — **and land the fenced-current
arm in `chrome.ts` with it.** The strategies branch at `chrome.ts:156-157` was the only thing marking
the fenced Apollo preset current, so the naive two-line registration leaves `/react-next/plp/apollo/`
with three anchors and zero `aria-current`.

### Blocker 2 — search, sort and the facet rail silently return the unfiltered grid

`workers/edge/src/index.js` `handlePlp` (read at `origin/main:121-142`) parses `n`, `page` and `run`
only. `genre`, `style`, `format`, `sort`, `q` appear nowhere, and **neither PLP branch touches
`workers/edge`** (verified: empty diff).

Both arms render the master's facet rail, search form and sort select (`plp.tsx:323-382`). So a facet
click navigates to a filtered URL and gets the unfiltered grid back, with the toolbar still reading
"Showing 1–24 of 500 releases" and **no error state**. A silently wrong answer is the worst outcome
for this project.

**Fix:** land ADR-0005 §5's five params, validated against the snapshot's real facet values, 400 on
junk, folded into the KV key.

**Or take the cut explicitly**, exactly as `pdp-controls` did: amend
`packages/reference/render/plp.mjs` to stop rendering the three affordances and re-render the master.
`docs/decision-map.md:323` already ruled that shipping them inert is not an option.

**Reproduce:** `curl -s '/api/plp?n=24&genre=Ambient' | jq '.total'` returns the full crate count.

### Blocker 3 — two chrome rows promise controls this build does not deliver

`packages/switcher/src/chrome.ts:403` (and its neighbour) emit, whenever `controls.nKnob` is set —
and PLP is the only surface with one — that the per-interaction byte readout and the replay control
"land with the store's PLP build". This *is* the PLP build, and it delivers neither.

```
git grep -l 'pm-hud-interaction' origin/plp-react-next -- ':!docs'
# → only chrome.ts and chrome.test.ts
```

**Fix:** rewrite both notes to state the absence, using the "not built yet" wording `chrome.ts:236-239`
already uses — or implement the two HUD controls (ADR-0005 §8 lists them). Do it in the integration
commit: `workers/front/build.mjs` hashes the chrome fragment, so a text edit triggers the two-pass
re-measure.

### Blocker 4 — the two PLP arms disagree about page ≥ 2 (shared with #39)

- `variants/react-next/src/lib/plp.tsx:411` emits the Next link **unconditionally** and renders
  `0–0` on an empty page.
- `variants/htmx/src/render.mjs:489` gates Next behind `hasNext` and `:447` renders `0`.

The two arms therefore serve **structurally different DOM for the same URL**, which is precisely what
the canonical markup contract exists to prevent. The drift gate cannot see it because the reference
master renders page 1 only.

It will not self-correct: both suites currently pin the contradictory answers
(`react-next test:459-468` asserts `0–0`; `htmx test:367-380` asserts `0` and no `rel="next"`).

**Fix:** adopt htmx's `hasNext` generalization — it is the honest one — and make react-next match,
ideally by landing `page`/`hasNext` in `packages/reference/render/plp.mjs` so both arms mirror one
master. Add one cross-variant leg rendering both implementations at page `totalPages+1` from the same
tray and asserting equal normalized DOM. Reachable in one click at `n=240` on the fixture.

---

## PR #39 — `plp-htmx` · "Build the PLP surface in the htmx variant"

**Draft, red CI.** Merges last. It is the second PLP arm and must match whatever page ≥ 2 shape #38
lands.

### Blocker 1 — the red CI: two stale assertions, not a bad change

**The `PERMITTED_NOISE["htmx"]` registration is CORRECT. Do not delete it to go green.**

`tools/drift-gate/src/normalize.ts:148-152` now defines:
```ts
htmx: { attrPatterns: [], classPatterns: [], behaviorAttrPatterns: ["^hx-"] }
```
This fulfils a prediction written into the comment it replaces — the old note ended *"if a later
surface (the PLP build …) puts `hx-*` on a page, THAT build registers `^hx-` under
behaviorAttrPatterns deliberately."* This is that build. `render.mjs:416` ships three real `hx-*`
attributes (`hx-boost`, `hx-target`, `hx-swap`) on the one `<nav class="pm-pagination">`, and
`master-identity.test.js:302-310` proves the entry is load-bearing.

Two assertions in `tools/origin-suite` still require it to be undefined, and **#39 touches no file
under `tools/origin-suite`** (verified: empty diff):

- `tools/origin-suite/suite/editorial.test.ts:1264`
- `tools/origin-suite/suite/drift.browser.test.ts:908`

**Fix:** replace each with
```ts
expect(PERMITTED_NOISE["htmx"]).toEqual({
  attrPatterns: [], classPatterns: [], behaviorAttrPatterns: ["^hx-"],
});
```
and **keep the `not.toMatch(/\s(?:data-)?hx-/i)` byte assertion above it** — that is the line
actually keeping editorial free of `hx-*`, and it is still true. Rewrite the two surrounding comment
blocks, which still tell the reader htmx registers nothing.

Note the editorial drift leg already passes `NO_NOISE` explicitly (`drift.browser.test.ts:910`), so
the registry entry never loosened editorial's comparison. The `toBeUndefined()` line was
belt-and-braces and is now simply obsolete.

### Blocker 2 — prose that is now false

- `variants/README.md:51-53` — *"Registers NOTHING in `PERMITTED_NOISE` — a measured outcome, like
  `astro`'s"* (read this session; untouched by the branch)
- `README.md:71`
- `variants/remix3/DIFF-TO-STARTER.md:179`

Update all three in the same commit as the assertion edits.

### Blocker 3 — the justifying handoff lives outside the repo

`docs/decision-map.md:438` on this branch points the reviewer at
`~/Desktop/pm-unit2-plp-htmx-handoff.md` for the exact diffs that reconcile the fairness gate.

**A gate loosening whose justification cannot be opened by a reviewer defeats the purpose of the
gate.** Move it to `docs/handoffs/2026-08-28-plp-htmx.md`, alongside the nine handoffs already
committed there.

### Blocker 4 — page ≥ 2 agreement with #38

Same as #38's Blocker 4, from the other side. htmx's shape is the correct one; whichever arm merges
second must not land until both emit the same DOM and one cross-variant leg exists.

### Then take the PR out of draft.

### Follow-ups for #39 (not merge-blocking)

- **Fix upstream, not in this PR:** `packages/measurement/src/client.ts` has no re-entry guard (0
  hits for any init flag), and `hx-boost` turns on htmx's history restore, which re-executes every
  `<script>` in `<body>` — including the injected `/_pm/measure.js` (`chrome.ts:477-478`). One Back
  press gives a second `onTTFB`/`onFCP`/`onLCP`/`onCLS`/`onINP` registration and a second flush pair.
  Harmless today (the bench runner never presses Back, nothing reads the `pm_rum` dataset) but it
  will silently double-count the moment field data matters. Fix it in `packages/measurement` so every
  variant benefits, plus `hx-history-elt` on `div.pm-page` (`render.mjs:205`) as the variant-side
  belt — both the chrome slot (`:204`) and the scripts (`:228`) sit outside that div.
- `variants/htmx/src/index.js:46` declares `x-pm-partial: 1` but `workers/front/src/index.js:112-131`
  never reads it, so every boosted page-flip runs through HTMLRewriter, matches zero slots and writes
  an ERROR-level `chrome-slot-count` log (`index.js:177-183`) against a Worker behaving correctly.
  Land the one-line generalization the PR's own comment already writes out:
  `if (upstream.headers.get("x-pm-partial")) return upstream;` after the content-type guard,
  replacing the hardcoded `/remix3/editorial/frames/` check.
- `?page=` has no ceiling: `workers/edge/src/index.js:125` floors at 1, and `:84` writes an
  infinite-TTL KV entry for any page value without a `?run=` nonce (~7.5 KB each, measured). Shared
  with #38. Cap `page` at the last real page in `handlePlp` so out-of-range values collapse onto one
  key.

---

## Merge mechanics

**Order: #36 → #38 → #39.**

- #36 shares no code file with the other two.
- #38 before #39 because #38 is green and mergeable now while #39 is a blocked draft — gating a
  mergeable PR behind a blocked one buys nothing. #38 also carries the shared PLP integration
  (switcher registration, edge-Worker params, chrome HUD copy) that #39 then inherits.
- #39 last: it is the only PR that must change to be mergeable at all.

**Conflicts — verified with `git merge-tree`, not guessed:**

| File | Status |
|---|---|
| `tools/drift-gate/src/normalize.ts` (#38 + #39) | **Auto-merges clean.** Named as the semantic risk; it is not a textual one. Merged blob has `htmx: {` at :148 and `"react-next": {` at :177, zero markers. |
| `turbo.json` (#38 + #39) | **Auto-merges clean.** Distinct keys (`@pm/react-next#test`, `@pm/htmx#test`), non-adjacent hunks. |
| `pnpm-lock.yaml` (#38 + #39) | **Auto-merges clean.** Different importer sections. If a future rebase does conflict, regenerate with `pnpm install --lockfile-only` — do not hand-merge. |
| `docs/decision-map.md` | **Conflicts on every pairing.** Append collision at the same insertion point. Keep both blocks in merge order. Trivial. |
| `docs/build-log.md` | **Conflicts on every pairing.** Same. Checked for verbatim overlap: zero shared 12-word sentences, so the accounts are independent. |

All three branches now conflict with `main` on those two docs files only (#13 and #37 landed since
the branches were cut). Each needs a rebase touching nothing but those two files.

`packages/switcher/src/config.ts` is not a textual conflict — none of the three branches touches it —
but **three separate registrations are owed in the same object**: `checkout.variants: ["vanilla"]`
(#36), `plp.variants: ["react-next"]` (#38), then `plp.variants: ["react-next","htmx"]` + dropping
`plannedVariants` (#39). Land each in the same commit as the routes it makes true, and each is
correct at the moment it lands.

## Two documentation debts to settle in the last merge

1. **The (fog) node at `docs/decision-map.md:236`** still says PLP / Checkout / a11y /
   how-it-was-built run "in that order, one node at a time". This batch resolves three of them in
   parallel and skips a11y. All four branches leave it byte-unchanged. Rewrite it once, in the last
   merge, or the next session loads a plan that contradicts the code.
2. **`docs/prds/how-it-was-built-build.md:528`** (already on `main` via #37) pins `pnpm run check` at
   30/30. #36, #38 and #39 each add one workspace test task, so the real number becomes 33. Reword to
   "green on every task, count recorded in the build log".

Also worth a decision, not a fix: this batch grows `decision-map.md` from 133,451 to 179,685 bytes
(+35%) in a file whose own line 3 says keep it compact and put narrative in `build-log.md`. Either
trim the entries or amend line 3 — every recent PR breaks that rule.

## What this batch does NOT finish

Do not report the step closed when these three merge. What lands is **surfaces, not receipts**:

- **The PLP is served but not measured.** No bench batch has run against it, `plp` has no
  `labBundle` in the switcher config, `workers/front/lab/fit.mjs` has no `plp` key, and the front
  build throws on any plp receipt. Zero published PLP numbers — which is the entire point of the
  surface.
- **Checkout is 1 of 3 variants** and has no interaction-registry entry, so nothing can measure the
  INP the surface exists to price.
- **how-it-was-built is a spec, not a surface.** The 2,006 store pages linking `/how-it-was-built/`
  still 404.
- **a11y has not been touched.**

The step closes when the PLP and checkout bench batches run and their cells publish.
