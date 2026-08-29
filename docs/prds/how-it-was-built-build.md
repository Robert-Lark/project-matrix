<!--
  Written 2026-08-28 in worktree `how-it-was-built-spec` off `ae97f8e`
  (PR #35, origin/main). A SPEC ONLY — this unit shipped no implementation,
  deliberately: the surface is a front-Worker singleton and `workers/front/**`
  was owned by a concurrent measurement pass whose `commitPin` treats any
  porcelain output as a dirty tree.

  Every file:line below was opened in that session. Counts are tool-derived
  (`grep -c`, `wc -c`, `ls | wc -l`, `jq length`) and the command is named
  beside the number. Two guard behaviours were proven by sabotage against this
  worktree and restored from a backup copy (never `git checkout --`): the
  phase-index pin fires, and its ADR twin does not exist. See §Duties D1.
-->

# PRD: How it was built — the decision record as a served surface

**Ticket:** `how-it-was-built` — the last of the per-surface builds (decision
map `### (fog) remaining per-surface builds`, `docs/decision-map.md:236-237`,
whose order of record is PDP → PLP → Checkout → a11y → how-it-was-built). This
surface is a **singleton off the benchmarked matrix**, so it is not a variant
build and borrows the editorial PRD's slice table for nothing but its shape.

**Spec of record:** [ADR-0008 §8](../adr/0008-store-surfaces-and-instrument.md)
(`docs/adr/0008-store-surfaces-and-instrument.md:223-227`) for the surface;
[ADR-0007 §5–§6](../adr/0007-home-surface.md) for the singleton-serving
precedent; [ADR-0004 §7](../adr/0004-deployment-topology-and-contextual-switcher.md:144-147)
for what a singleton's chrome may offer. This PRD adds no design where those
decide; it settles what they leave open and turns it into one buildable slice.

---

## What ADR-0008 §8 already decided — restated, not re-litigated

Read verbatim from `docs/adr/0008-store-surfaces-and-instrument.md:223-227`:

> **How it was built** — front-Worker static singleton at `/how-it-was-built/`
> (the home build precedent; owner workers/front), a `pm-doc` TOC + prose
> layout whose content is generated from `docs/` (the master renders the real
> ADR index and build-log phases at build — never retyped).

So four questions a reader might expect this PRD to open are **already shut**,
and it does not reopen them:

| Question | Settled by | Answer |
|---|---|---|
| Where does it live? | ADR-0008 §8 | `/how-it-was-built/`, one URL, no variant prefix |
| Who owns it? | ADR-0008 §8 | `workers/front` |
| Assets-first or composed? | ADR-0008 §8 ("the home build precedent") + ADR-0007 §6 | Assets-first from the front Worker's own `dist` |
| Layout? | ADR-0008 §8 + `packages/tokens/css/surfaces/how-built.css:20-30` | `pm-doc` — a TOC rail beside `pm-prose` |

The registry entry already exists and is already correct
(`packages/switcher/src/config.ts:167-172`): `variants: []`, `singleton: true`,
no `host`, no `labBundle`. **This build needs no `config.ts` change** — see
§"The switcher-config diff (there isn't one)".

What is genuinely open, and what this PRD spends its weight on: the **drift
tie**, the **methodology page's fate**, the **duties table**, and the **limits**.

---

## What this build is

`/how-it-was-built/` returns 404 today. That is not a cosmetic gap: the
canonical footer links it (`packages/reference/render/shell.mjs:163`, via
`HOSTS.howBuilt` at `:42`) and every one of the six variants re-types the same
link —
`variants/vanilla/render.mjs:264,444`,
`variants/react-next/src/lib/render.tsx:296`,
`variants/astro/src/layouts/Shell.astro:111`,
`variants/qwik/src/lib/hosts.ts:13`,
`variants/htmx/src/render.mjs:176`,
`variants/remix3/src/unavailable.ts:59`.

The front Worker has no asset at that path (`workers/front/build.mjs` writes
only `dist/index.html`, `dist/methodology/index.html`, `dist/pm/*` and
`dist/_pm/*` — `:53-56`, `:1133`, `:1237`, `:1241`, `:1249`), and an unmatched
prefix falls through to `workers/front/src/index.js:95-98`, which returns
`not found\n` with status 404.

Scale of the dead link, tool-derived: the deployed plane serves the editorial
surface in 6 variants and the PDP in 4, over a crate of **500** releases
(`jq '.releaseCount' tools/snapshot-capture/crate/manifest.json` → `500`;
`jq 'length' tools/snapshot-capture/crate/details.json` → `500`). That is
6 + (4 × 500) = **2,006 store pages, each carrying a footer link to a 404**.

Shipping this surface is what makes that link resolve. Everything else in this
PRD is about making it resolve to something that cannot go quietly stale.

---

## Decision 1 — the content model

**The surface indexes records; it never copies them.** Every list on the page
is generated at build from the file it names. No prose on the page restates a
document's contents, and no figure appears on the page at all.

### What it indexes, and from where

| Section | Source | Generator | Count today (tool) |
|---|---|---|---|
| Decision records | `docs/adr/*.md` frontmatter + `# title` | `packages/reference/render/how-built.mjs:17-28` (exists) | 9 (`ls docs/adr/*.md \| wc -l`) |
| …and each ADR's corrections | `^## Addendum` headings in the same files | **new** — extend `adrIndex()` | 19 (`grep -h '^## Addendum' docs/adr/*.md \| wc -l`) |
| Build log | `^## Phase \d+ — ` headings | `how-built.mjs:30-32` (exists) | 16 (`grep -c '^## Phase ' docs/build-log.md`) |
| Adversarial reviews | `docs/reviews/*.md` | **new** | 1 (`ls docs/reviews/*.md \| wc -l`) |
| How the numbers are made | the `<h2 id>` list in `workers/front/methodology/index.html` | **new** — see Decision 2 | 10 (`grep -c '<h2 id=' workers/front/methodology/index.html`) |

The addenda entry is the one addition that changes what the page *is*. An index
that renders ADR-0001 as a single `2026-07-06, accepted` line hides **five**
later corrections to it (`grep -c '^## Addendum' docs/adr/0001-*.md` → `5`) —
including the two ruler defects Phase 15 records. The corrections are the
strongest evidence this surface has; a list that omits them argues the opposite
of what the surface exists to argue.

### Deep links are pinned to a commit, not to `main`

Today every generated link targets `blob/main/…`
(`how-built.mjs:67` and `:77`). `main` is a moving ref, so a link the page
renders today can dereference to different bytes tomorrow. That is the same
class of defect as an unreproducible number: **a citation that cannot be
re-fetched at the state cited is not a citation.**

`renderHowBuilt` gains a `ref` option. The committed master keeps `ref: "main"`
(it is a spec artifact, not a served page, so its bytes must stay stable). The
front build passes the SHA it already stamps into `/_pm/build.json`
(`workers/front/stamp-build.mjs`, `{kind, sha, dirty}`), and the page renders
one build line derived from the same value.

**The dirty case is handled, not ignored.** `stampBuild()` records
`dirty: git("status","--porcelain").length > 0`. When the tree is dirty the SHA
does not describe what is served, so the front passes `ref: "main"` and the
build line says the tree was unclean. A SHA-pinned link off a dirty tree would
be a receipt that points at the wrong bytes — worse than an honest moving ref.

### What it does NOT index, stated rather than implied

`docs/handoffs/` (9 files), `docs/prototypes/` (8 directories), `docs/prds/`
(2 files) and `docs/decision-map.md` (25 `###` tickets — `grep -c '^### '`) are
**not** rendered by this build. The page's frame prose must therefore not say
"the decision record" without qualification; the exact scope it claims is
listed in Decision 5.

Note a stale claim this creates, which this unit could not fix:
`packages/tokens/css/surfaces/how-built.css:5` says content is generated from
"ADR excerpts, decision-map rows, build-log phases". No decision-map row has
ever been rendered, and this build does not add them. That comment is wrong
today and stays wrong under this spec — `packages/tokens/**` was outside this
unit's file boundary. **Correcting it is a duty of the executing session.**

### Rejected: rendering whole ADRs as readable pages

`how-built.mjs:5-7` records an intent to render "whole ADRs as readable pages"
downstream in the front build. This PRD **declines it for this build**, on
four grounds:

1. It is not what the spec of record says. ADR-0008 §8 specifies "the real ADR
   index and build-log phases".
2. Cost, measured: the ADR corpus is **212,884 B** raw / **70,309 B** brotli-q11
   (`cat docs/adr/*.md | wc -c`; `| brotli -q 11 -c | wc -c`). The build log is
   **295,287 B** / **98,768 B**. Against home's whole measured wire cost of
   ~37.7 KB (ADR-0007 §6), neither is servable as one page; per-document pages
   mean 9 ADR pages (largest: ADR-0001 at 63,272 B raw / 21,511 B brotli) plus
   16 phase pages, each needing its own anchor and link guards.
3. It needs a markdown→HTML dependency inside the front Worker's build. A new
   dependency is a reviewable decision, not a slice's improvisation.
4. The marginal evidence is small once links are SHA-pinned: the documents are
   already public and GitHub renders them better than a hand-rolled pipeline
   would.

**What that gives up, plainly:** the surface stays a navigational index rather
than a reading surface, and its SEO contribution is titles, dates and
correction headings rather than prose. That is a real loss on a portfolio whose
argument is the record. It is reversible in a later ticket, and this build's
one-renderer seam (Decision 4) is what makes it cheap to reverse.

---

## Decision 2 — the methodology page is KEPT, indexed, and not moved

`workers/front/methodology/index.html:17-18` says its "long-term home is the
'How it was built' surface (ADR-0008 §8), which is unbuilt; this standalone
page is the recorded interim."

**Decision: `/methodology/` keeps its URL and its bytes. The surface indexes
it — one generated entry per `<h2 id>` section, deep-linked to
`/methodology/#anchor` — exactly as it indexes an ADR. Nothing is absorbed,
nothing is redirected.**

### Why — the chrome link is the deciding evidence

`packages/switcher/src/chrome.ts:288` renders
`<a href="/methodology/">How these numbers are made — and what they can't
say</a>` into the **populated chrome fragment**, which is injected into every
measured page. Changing that href changes the fragment's bytes, and
`workers/front/build.mjs:947-957` hashes the rendered fragment and **refuses
the build** when it does not match the chrome constant's `sha256`:

> `front lab: the chrome constant describes a fragment this build does not ship`

So a redirect is not a redirect. It is: a `chrome.ts` edit → a fragment-hash
mismatch → a chrome-constant re-measurement (7 runs per condition, under the
two-pass cycle ADR-0001 addendum P enforces) → a fresh committed artifact →
rebuild. Paid to move a link that a canonical index entry leaves working.

Three supporting reasons:

- ADR-0001 §9 requires "a plain-language methodology page". A stable,
  quotable URL for the fairness rules is itself an anti-rigging asset; burying
  it under a fragment of a longer page makes it harder to cite in a hostile
  review.
- The page is not in the surface's declared source tree. ADR-0008 §8 says
  content is "generated from `docs/`"; `/methodology/` is hand-written prose at
  `workers/front/methodology/index.html` with build-time substitution. Absorbing
  it would mean the one section of this surface that is *not* generated from
  `docs/`.
- ADR-0001's own Consequences say the methodology page "double[s] as source
  content" for this surface. Indexing is exactly that; copying is not.

### What "absorb" would actually have cost — all 11 markers, not four

`grep -o '%%[A-Z_]*%%' workers/front/methodology/index.html | sort -u | wc -l`
→ **11 unique markers**, **13 occurrences**
(`| wc -l` → 13; `%%TOKEN_VINYL_URI%%` and `%%LAB_RUNS%%` appear twice each).
Every one is substituted at `workers/front/build.mjs:1222-1233`, and the build
throws on any survivor (`:1234-1236`).

| Marker | Line(s) in the page | What it substitutes | Moves under "absorb"? |
|---|---|---|---|
| `%%TOKEN_PAPER%%` | `:8` | `theme-color` from `--pm-neutral-0` | The surface needs its own; not portable |
| `%%TOKEN_VINYL_URI%%` | `:9` (×2) | favicon SVG data-URI fill | Same |
| `%%TOKEN_PAPER_SUNK_URI%%` | `:9` | favicon SVG data-URI fill | Same |
| `%%PM_TOKENS_CSS%%` | `:22` | the whole inlined tokens+button CSS | The surface's CSS set differs (`prose.css`, `how-built.css`) |
| `%%PM_METHODOLOGY_CSS%%` | `:25` | `methodology.css`, inlined | Would have to merge with `how-built.css` |
| `%%LAB_RUNS%%` | `:83`, `:90` | runs-per-cell, per-surface-aware | Content |
| `%%CC_STATEMENT%%` | `:180` | the whole chrome-constant sentence, both directions | Content |
| `%%LAB_BATCH_STATEMENT%%` | `:191` | per-surface batch statements | Content |
| `%%SNAP_COUNT%%` | `:218` | crate release count | Content |
| `%%SNAP_DATE%%` | `:219` | crate freeze date | Content |
| `%%LAB_INP_SPREAD%%` | `:254` | derived INP band sentence | Content |

Five of the eleven are **not content at all** — they are head-level theme,
favicon and stylesheet-inlining markers whose destination page has a different
head and a different CSS composition. A spec that treated this as "move the
four numbers" would ship a page with no favicon, no `theme-color`, and no
stylesheet.

### Which origin-suite legs move, re-point, or retire

**None move. None re-point. None retire.** Under this decision the entire
`/methodology/` block stands unchanged:

| Leg | Location | Fate |
|---|---|---|
| "serves the page with the limits-of-data framing and no injected chrome" (9 `expect`s) | `tools/origin-suite/suite/published-readings.test.ts:422-440` | Unchanged |
| "states the chrome constant, or states plainly that none is published — both directions" (8 `expect`s) | `:442-473` | Unchanged |
| chrome's limits link on an editorial page | `:344` (`expect(body).toContain('href="/methodology/"')`) | Unchanged — still resolves |
| home's band link | `:488` | Unchanged — still resolves |

The 13 KiB populated-fragment budget needs a correction to the framing this
unit was handed. `toBeLessThan(13312)` occurs exactly once in that file, at
**`published-readings.test.ts:405`** (`grep -n '13312'`), inside the describe
*"the chrome renders the published readings (C2 populated, end to end)"* at
`:365-408` — **not** at `:337,348`, which are two `expect(body).toContain(...)`
calls about receipt-linked editorial cells. The budget also appears twice in
`packages/switcher/test/chrome.test.ts:270,309`.

That leg iterates `LAB_SURFACES` — the `labBundle`-flagged surfaces. **It can
never cover this surface**, because `workers/front/build.mjs:521-527` throws by
name on a surface that is both `singleton` and `labBundle`. A chrome-free page
receives no injected fragment and therefore pays no fragment budget. The leg
neither moves nor re-points; it is simply out of scope, and this PRD says so
rather than leaving a reader to infer coverage that does not exist.

### The one thing that must change in the methodology page

Its header comment (`:17-18`) promises a move this spec declines. Leaving it
would keep a code comment promising a future that is no longer planned.
**Duty:** the executing session rewrites `:17-18` to record the decision — the
page stays at `/methodology/`, and `/how-it-was-built/` indexes it. This unit
could not make the edit (`workers/front/**` was another agent's).

---

## Decision 3 — serving: assets-first, chrome-free, no in-page HUD

**Assets-first** is decided by ADR-0008 §8 ("the home build precedent") and is
free in mechanism: `workers/front/wrangler.jsonc:14-16` binds
`assets.directory: "./dist"` with default handling, so writing
`dist/how-it-was-built/index.html` serves the URL without one line of change to
`src/index.js`. That is exactly how `/methodology/` is served
(`workers/front/build.mjs:1237`; `src/index.js:18-19`).

**Chrome-free**, on three grounds:

1. *Mechanism.* Assets-first means the request never reaches the Worker script
   (`src/index.js:3-5`), so HTMLRewriter injection cannot happen without
   `run_worker_first`, which would also change how `/` is served.
2. *Policy.* ADR-0004 §7 (`:144-147`) names Home, A11y and How-it-was-built as
   the singletons that "get no render-switcher", and `chrome.ts:204-211` gives
   a singleton the plain sentence instead of a reading table. With no switcher
   and no table, the injected chrome's remaining content is the HUD.
3. *Cost.* A chrome-free page pays no fragment budget (above) and adds no
   render-blocking chrome stylesheet or mono preload — the two things the
   chrome constant prices.

**No in-page HUD either** — this is the one place this PRD diverges from home,
and the divergence is deliberate. Home renders its own HUD
(`workers/front/home/index.html:216-221,275`: `id="pm-chrome"`,
`data-pm-variant="singleton"`, `data-pm-surface="home"`, plus a deferred
`/_pm/measure.js`); `/methodology/` renders none (`grep -n 'pm-chrome' … ` →
no match), and its suite leg pins the absence
(`published-readings.test.ts:438-439`).

Reasons to follow methodology rather than home:

- A HUD is a reality check placed *next to a published number*. This surface
  publishes none.
- Every committed master is asserted script-free
  (`packages/reference/test/reference.test.ts:99-113`). A served-only HUD would
  make the served body diverge from the master, which would cost the drift tie
  in Decision 4 a normalizer exclusion for no measurement benefit.
- It keeps the page's only JavaScript at zero.

**What that gives up:** no field/RUM data for this surface. Reversible for the
cost of ~2.5 KB of `measure.js` (ADR-0007 §6's measured figure) plus one
`dropElementSelectors` entry in the D2 comparison. Recorded so the next session
can take it without re-deriving the tradeoff.

---

## Decision 4 — the drift tie: one renderer, two heads

This is the question ADR-0008 §8 leaves genuinely open, and it is the hard one.

**Today the only tie between this surface and its sources is a phase INDEX
pin.** `packages/reference/test/reference.test.ts:196-207` re-reads
`docs/build-log.md`, extracts every `^## Phase (\d+)` and asserts the committed
master contains `id="phase-{n}"`. Its sibling comment at `:157-164` records the
deliberate exemption: this master alone is *not* regeneration-checked
byte-for-byte, because it reads the whole `docs/` tree and docs change nearly
every session — so **its prose is knowingly unpinned**.

**Proven this session, by sabotage against this worktree:**

- The phase pin is real. Appending `## Phase 16 — sabotage probe (delete me)`
  to `docs/build-log.md` and running `pnpm --dir packages/reference run test`
  failed **1 of 37** with the message the guard was written to give:
  `committed how-built is missing Phase 16 — re-run: node render/build.mjs`.
  Restored from a backup copy taken first (never `git checkout --`); 37/37 green
  after restore.
- **Its ADR twin does not exist.** Creating `docs/adr/0010-sabotage-probe.md`
  with valid frontmatter and a `# title` and running the same command gave
  **37 passed** — a tenth ADR that the committed master has never listed, and
  nothing anywhere went red. Probe file deleted; tree clean.

That is precisely the shape `reference.test.ts:188-195` describes paying for
once already ("adding a phase silently left the committed master a phase
behind"), reproduced on the arm the fix did not cover.

**And a second, larger gap:** nothing at all ties the *served* page to the
master. The drift gate's masters-health block
(`tools/origin-suite/suite/drift.browser.test.ts:497-526`) lists
`how-it-was-built` among 11 masters, but proves only normalizer
self-consistency and pixel stability against the master itself — it explicitly
records "No variant comparisons yet — no variant serves these surfaces"
(`:502-503`). A hostless singleton never gets a variant, so it never gets a
comparison leg by that route.

### The decision

**Remove the class rather than guard it: `@pm/front` renders the surface with
the same function that renders the master.**

- `@pm/front` declares `@pm/reference` as a dependency, resolved the way it
  already resolves `@pm/tokens` (`workers/front/build.mjs:43,48-49` —
  `createRequire` + `require.resolve`). Precedent: ADR-0007 §6 made `@pm/tokens`
  a declared dependency of `@pm/front` for exactly this reason.
- `renderHowBuilt` (`how-built.mjs:35`) gains two options and no new behaviour
  when they are omitted: `ref` (Decision 1) and `head` (a pre-composed `<head>`
  inner). The front passes its own head — inlined CSS and `/pm/` font paths,
  the home delivery shape (ADR-0007 §6) — and the reference renderer keeps
  `head({depth: 2, …})` (`shell.mjs:116-137`) for the master.
- The `<head>` divergence is contractually free: ADR-0008's serialization
  freedoms exempt the `<head>` subtree, and `head()`'s per-consumer base path is
  the established pattern every variant already uses
  (`variants/vanilla/render.mjs:152-165`).

The alternative — re-implementing the body in `workers/front/build.mjs` behind
`%%` markers, the way home and methodology are built — is **rejected**: it puts
two renderers over one source, and this repo's recurring failure is exactly
that shape. The cost of the pick, stated: `@pm/front`'s build now depends on
`@pm/reference`, a package whose own description says it is "never deployed as
a variant". It still is not deployed; it becomes a build-time dependency, the
same class as `@pm/tokens`.

**Turbo input duty, load-bearing.** `@pm/reference#test` already declares
`docs/adr/*.md` and `docs/build-log.md` as inputs (`turbo.json:231-243`).
`@pm/front#build` declares `$TURBO_DEFAULT$` plus the crate manifest
(`turbo.json:37-52`, `inputs` at `:45`) — its own comment explains the failure
mode. Once the front build reads `docs/`, **it must declare the same doc inputs**
or a docs change will replay a cached dist carrying the old page, and the deploy
leg will ship it.

---

## Decision 5 — what the surface must not claim

This surface renders process as evidence, which makes it the easiest page on
the site to overstate. The limits are content, not a footnote:

1. **Not "the whole record."** The page indexes ADRs, their addenda, build-log
   phases, reviews and the methodology sections. It does not index the decision
   map, the handoffs (9), the prototypes (8 directories) or the PRDs (2). The
   frame prose states that scope explicitly and links the repository for the
   rest.
2. **Not peer review.** The adversarial panels are the project's own
   (ADR-0008's Context, `:30-40`, describes a seven-lens panel the session ran
   on itself). The page may say the decisions were attacked before they were
   built on; it may not imply an external reviewer.
3. **No figures, at all.** The surface is off the benchmarked matrix — no lab
   snapshot will ever exist for it (ADR-0007 §5). The page therefore quotes no
   measurement, not even one lifted from a record it indexes. Every number on
   this site carries its artifact; the cheapest way to keep that true here is to
   render no numbers. The one exception is the build line, which is a receipt
   (a SHA that dereferences).
4. **Not "nothing was retyped" without the qualifier.** The current prose says
   "generated from the repository's own files; nothing here is retyped for
   presentation" (`how-built.mjs:60`). True of every list; the two frame
   paragraphs are hand-written. The sentence must scope itself to the lists.
5. **Not a claim that the process was tidy.** The build log's value is that it
   argues with itself. The page's own copy should point at the corrections
   (the 19 addenda) rather than at the nine clean titles.

---

## Duties — what fails, and the sabotage that proves it

**A guard that can pass vacuously is not a guard.** Each row states the failure
it exists to cause and the exact sabotage that must produce it. Green is not
proof; a sabotage that produces *some* failure is not proof either — the
failure must carry the guard's own message.

| # | Duty | Owner file | Fails when | Sabotage that proves it | Non-vacuity |
|---|---|---|---|---|---|
| **D1** | The committed master cannot fall behind the ADR index | `packages/reference/test/reference.test.ts` (extend the block at `:196-207`) | A new/renamed/deleted ADR is not reflected in the master | Add `docs/adr/0010-probe.md` with frontmatter + `# Title`; expect `committed how-built is missing ADR 0010-probe — re-run: node render/build.mjs`. **Proven absent today: this gave 37 passed.** Delete the untracked probe to restore | Assert the derived ADR list is non-empty and `> 5`, mirroring `:201`'s "no phase headings found — the pattern moved" |
| **D2** | The served page cannot drift from the master | new origin-suite leg, e.g. `tools/origin-suite/suite/how-it-was-built.test.ts` | The front's composition diverges from the reference body | Change one word in the front's composition path; expect the leg to name the divergent node. Guard re-renders `renderHowBuilt({ref: <sha from /_pm/build.json>})` and compares the normalized `.pm-page` subtree — the ADR-0008 §9 re-render-from-the-served-state pattern | Assert the extracted subtree is non-empty and starts with the `pm-doc` root before comparing; an empty-vs-empty match is the vacuous pass here |
| **D3** | The phase index cannot fall behind | `reference.test.ts:196-207` (exists) | A phase heading is added without a re-render | Append `## Phase 16 — …` to `docs/build-log.md`. **Proven this session: 1 of 37 failed with `committed how-built is missing Phase 16`** | Already present at `:201` |
| **D4** | An on-disk link cannot rot | `tools/repo-checks/` (Unit 3's directory — the executing session adds it) | A generated `blob/{ref}/{path}` names a file that no longer exists | Rename `docs/adr/0009-blog-plane.md`; expect the check to name the missing path. Offline: strip the `blob/{ref}/` prefix and `existsSync` the remainder | Assert the extracted path list is non-empty (today: 9 ADR + 16 phase links) — an empty list passes every existence check |
| **D5** | An in-page anchor cannot rot | same check | A TOC `href="#x"` has no matching `id="x"` | Change one `id="phase-3"` to `id="phase-33"` in the master; expect the pair-check to name it | Assert the anchor list is non-empty; assert the id list is non-empty |
| **D6** | The surface cannot acquire a lab table | `workers/front/build.mjs:521-527` (**exists**) | Someone sets `labBundle: true` on a singleton | Add `labBundle: true` to `config.ts:167-172`; expect `front lab: surface "how-it-was-built" is both singleton and labBundle …` | The build also refuses an empty `LAB_SURFACES` (`:528-532`), so the guard cannot be satisfied by emptying the registry |
| **D7** | The URL must actually serve | the D2 leg | `/how-it-was-built/` 404s or serves without the doc root | Remove the `dist/how-it-was-built/` write; expect a 404 assertion, not a soft skip. Assert `200`, `class="pm-doc"`, and — the current-state pin — `not.toContain('data-pm-chrome')` and `not.toContain('pm-chrome-slot')`, mirroring `published-readings.test.ts:438-439` | Assert the status is exactly `200` before reading the body; a 404 body is a string too |
| **D8** | A docs change cannot be cached past | `turbo.json` `@pm/front#build` `inputs` | A new ADR or phase replays a cached front dist | Add a phase heading; run `turbo run build --filter=@pm/front` twice; the second run must be a MISS, not a cache replay | Compare turbo's own cache verdict, not the output bytes — identical bytes are the expected result of a correct replay too |
| **D9** | A dirty build cannot mint a false receipt | the front composition + the D2 leg | The page SHA-pins links from an unclean tree | Touch a tracked file, rebuild, assert the page renders the `main` fallback and says the tree was unclean | Assert both branches in one leg — the clean branch's SHA text and the dirty branch's fallback text — the both-directions pattern at `published-readings.test.ts:442-473` |

Two of these (D3, D6) exist today and were confirmed against source this
session. D3 was fired by sabotage. D1's absence was proven by sabotage.

---

## Non-goals — fences that hold

- **No variant of this surface, ever.** It is a singleton with no `host`
  (`config.ts:167-172`). It gets no `/{variant}/how-it-was-built/` route, no
  drift-gate variant leg, and no reading-table column.
- **No lab publication.** `labBundle` stays unset; D6 is the mechanism.
- **No markdown rendering pipeline** (Decision 1's rejected option). If a later
  ticket wants it, it is an ADR-0008 addendum question plus a dependency review,
  not a slice's improvisation.
- **No `/methodology/` redirect or absorption** (Decision 2).
- **No `workers/front` chrome change.** The chrome's `/methodology/` link
  (`chrome.ts:288`) stays exactly as it is; touching it invalidates the chrome
  constant (`build.mjs:947-957`).
- **No `packages/switcher/src/config.ts` change** — see below.

---

## The switcher-config diff (there isn't one)

The handoff protocol asks for the exact one-line `config.ts` diff this unit did
not apply. **There is none, and that is a finding, not an omission.**
`packages/switcher/src/config.ts:167-172` already reads:

```ts
"how-it-was-built": {
  variants: [],
  singleton: true,
  proves:
    "The decision record as content — ADRs, build log, reviews. The process is the evidence.",
},
```

Every field a singleton needs is set: `variants: []` (no anchors), `singleton:
true` (plain sentence, no table — `chrome.ts:204-211`), no `host` (correct: no
host variant exists, unlike `a11y` at `:160-166`), no `labBundle` (correct:
D6 would refuse it).

One consequence worth recording rather than quietly accepting: under Decision 3
this surface is chrome-free, so `renderChrome` never runs for it and its
`proves` line is **never rendered anywhere**. The entry is registration-correct
and presentationally inert. That is fine — but it means the line's promise of
"reviews" is unchecked by any guard, which is why Decision 1 renders the
reviews index rather than leaving the config claiming content the page lacks.
That is the same defect class as `SURFACE_CONTROLS.pdp.proves` advertising a cut
control (`docs/decision-map.md:358`), caught before it could ship.

If a future session reverses Decision 3 and serves the surface through the
Worker with injected chrome, the config still needs no change — the reversal is
entirely in `workers/front`.

---

## Acceptance criteria

1. `/how-it-was-built/` returns **200** through the composed origin, locally
   (fixture) and deployed (crate), and the footer link on all 2,006 store pages
   resolves.
2. The page carries `class="pm-doc"`, the generated ADR index (with addenda),
   the build-log phase index, the reviews index, and the methodology section
   index — every one derived from its source file, none typed.
3. The page carries **no** `data-pm-chrome`, **no** `pm-chrome-slot`, **no**
   `<script>`, and **no** measurement figure.
4. Every generated deep link is pinned to the build's attested SHA, or falls
   back to `main` with the page saying the tree was unclean (D9).
5. The served body and a fresh `renderHowBuilt` at the served ref are
   normalized-equal (D2).
6. D1, D2, D4, D5, D7, D8, D9 exist and each has been sabotage-proven, with the
   failing message recorded in the build log. D3 and D6 are re-confirmed, not
   rewritten.
7. `pnpm run check` is green on **every** task, with the count recorded in
   the build log at the time it ran. The count is not a constant and must
   not be typed: it was 30 on `main` at `0eec463`, and is 33 once #36/#38/#39
   land, each adding one workspace `test` script. Derive it —
   `turbo run lint typecheck test --dry=json | jq '[.tasks[]|select(.command!="<NONEXISTENT>")]|length'`
   (`--dry=json` is turbo 2.10's spelling, and the `<NONEXISTENT>` filter is
   load-bearing: a bare `.tasks | length` is 75, counting synthetic `#topo`
   nodes and packages with no such script). Then
   `node packages/reference/render/build.mjs` followed by
   `git status --porcelain packages/reference/surfaces/` shows
   `how-it-was-built/` and nothing else.
8. `workers/front/methodology/index.html:17-18` and
   `packages/tokens/css/surfaces/how-built.css:5` are corrected to match the
   decisions above.

---

## What this spec could not settle

- **Nothing was verified against a running origin.** Three agents held the
  composed origin's ports (8787–8797 / 9230–9240) during this session, so
  `tools/origin-suite/run-local.mjs`, `pnpm run dev` and `wrangler dev` were all
  off-limits by instruction. Every serving claim here is read from source
  (`wrangler.jsonc:14-16`, `src/index.js:81-98`, `build.mjs:53-56,1237`) and
  **is not an observed 404 or an observed 200.** The executing session must
  confirm the 404 before the change and the 200 after it — the before-shot is
  what makes D7 non-vacuous.
- **The chrome-constant cost of a `/methodology/` redirect is reasoned, not
  timed.** The refusal at `build.mjs:947-957` is certain (read from source);
  the wall-clock of a re-measure is not measured here. Decision 2 does not
  depend on the magnitude — it depends on the cost being non-zero against a
  benefit a canonical index entry already delivers.
- **Whether the frame prose should change at all** is left to the executing
  session. `reference.test.ts:157-164` deliberately leaves this master's prose
  unpinned, so a copy edit is free of guard consequences — which cuts both ways,
  and is the reason Decision 5's limits are specified as content rather than
  left to taste.
