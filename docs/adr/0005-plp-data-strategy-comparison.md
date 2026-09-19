---
status: accepted
date: 2026-07-12
ticket: data-strategy-lab
---

# PLP data-strategy comparison — scenarios, client warmth, strategy mapping

## Context

The PLP is the sparse matrix's data-axis spotlight: one surface, built in
React/Next + HTMX, varying **data strategy × cache warmth × network**. The
locked strategy lineup is cold → TanStack Query (the lead) → server loaders
+ progressive enhancement → edge/KV cache, with Apollo cut as
wrong-for-REST and retained as an optional misapplication exhibit (Rob
opted **in**, 2026-07-12). ADR-0002 §8 deliberately deferred the
client-side caching story here; ADR-0004 §5 requires every measurement
condition to remain a URL-shaped receipt; ADR-0001 §3/§4 supply the
per-interaction byte cost and the one-variable-at-a-time rule.

The open questions this ADR closes: the exact scenario cells and what each
proves (including where each strategy *wins*); how the strategies map onto
the two variant builds; how **client** cache warmth becomes reproducible
and harness-drivable the way `?cache=` already is for the edge; the PLP
switcher's control-set; and what the throwaway prototype had to prove.

Library facts were verified against primary sources in-session
(tanstack.com docs, apollographql.com docs, npm registry — quotes in
[`prototypes/data-strategy-lab/FINDINGS.md`](../prototypes/data-strategy-lab/FINDINGS.md)):
TanStack Query is v5 (`@tanstack/react-query`, React 18+); its default
treats cached data as stale immediately; Apollo Client is v4; the Apollo
ecosystem's REST path (`apollo-link-rest`) is a pre-1.0 RC peering on
`@apollo/client >=4`.

## Decision

**1. The strategy axis is "where the data layer lives": nowhere → browser
→ server → edge.** Four idiomatic exemplars, each differing from the
naive baseline by exactly one architectural move:

- **cold** — plain client fetch on render and on every interaction, edge
  tier bypassed (`?cache=cold`). The judgment-free default.
- **client cache** — the same page with TanStack Query v5 as the data
  layer (published config, §4); edge still bypassed, so the client layer
  is the only delta vs cold.
- **server loaders + PE** — the HTMX variant: the server fetches the tray
  and returns finished HTML; interactions are real links enhanced into
  partial swaps (works JS-off); edge bypassed in comparison cells.
- **edge cache** — **byte-identical code to cold** with the bypass
  dropped: the KV warm tier does the work. The only delta vs cold is the
  serving tier — the purest single-variable cell on the site.

The story the switcher tells: start naive, then fix it three legitimate
ways — remember in the browser, render on the server, cache at the edge —
and let the environment decide which fix fits.

**2. Strategy ↔ variant mapping; strategy is path, condition is query.**
The React/Next variant hosts the client-side strategies as PLP routes
(`/react-next/plp/plain/`, `/react-next/plp/tanstack/`, and the fenced
`/react-next/plp/apollo/`); the HTMX variant hosts `/htmx/plp/`. A
strategy is shipped code — identity — so it lives in the **path**
(ADR-0004 §5); cold vs edge is a serving condition, so it lives in the
**query**. The switcher's options are (path, query) presets:

| switcher option | navigates to |
|---|---|
| No caching (cold) | `/react-next/plp/plain/?cache=cold` |
| Client cache — TanStack Query | `/react-next/plp/tanstack/?cache=cold` |
| Server-rendered — loaders + PE | `/htmx/plp/?cache=cold` |
| Edge cache — KV | `/react-next/plp/plain/` |
| (fenced) Misapplication exhibit | `/react-next/plp/apollo/?cache=cold` |

Every option differs from the cold baseline by exactly one thing, so the
switcher IS the scenario table. Beacon tagging needs no contract change:
the data strategy rides in the existing `surface` tag's value
(`plp-plain`, `plp-tanstack`, `plp-loaders`, `plp-apollo`).

**3. Client cache warmth = a scripted priming prefix, never a URL knob.**
An in-memory client cache cannot pre-exist a hard navigation (every swap
is one, ADR-0004 §4), and a knob that pre-populated it would be a lab
artifact — the exact thing real-world fidelity forbids. Client warmth
only exists *within* a session, produced by interactions; so the
reproducible unit is the **interaction sequence**: a named, versioned
entry in the bench runner's interaction registry, split into an
**unmeasured priming prefix** and a **measured step**. The registry
entry shape grows from `(page) => …` to `{ prime?, measure }`; the
resource-timing snapshot is taken after `prime`, and the byte delta +
wall-latency are recorded across `measure` only. This is the exact
symmetry of the edge tier's design: edge warmth = one unmeasured priming
*request*; client warmth = unmeasured priming *interactions*.

The URL-as-receipt model survives by precedent, not exception: receipts
have carried the interaction registry id since the foundation build
(issue #7) — the URL remains the complete condition for load-level cells;
URL + registry id is the complete condition for interaction-level cells.
Planned registry entries: `plp-revisit` (A→B→A, measure the return),
`plp-fresh` (A→B→C, measure C — the honest boundary), `plp-facet-toggle`,
`plp-sort-change`, `plp-paginate`, `plp-search-type`.

**4. Client-cache config is published copy, never a silent default.** The
TanStack build ships `staleTime: 5min` — the production-defensible
setting for a catalog whose only volatile field is a price aggregate —
printed in the cell copy and methodology page. The prototype demonstrated
why this rule is load-bearing: under the library default (`staleTime 0`,
"consider cached data as stale"), a revisit paints instantly from cache
but **still refetches in the background** (measured: 1 request, 11.6 KB)
— so "revisit = 0 bytes" is only true of a *stated* config. The
default-config behavior is shown as a labeled footnote run. The general
fairness rule: idiomatic, documented, published configuration is fair;
hand-tuning is configuration that exists only to win a cell.

**5. Every strategy delegates filter/sort/search to the data plane.** The
edge Worker grows canonical PLP params (`genre`, `style`, `format`,
`sort`, `q`) validated against the snapshot's real facet values — junk
values are a 400 (`x-pm-cache-state: none`, never cached, no KV key
minted), and the canonical-key discipline extends to the new params.
Client-side filtering over a cached superset is **rejected**: it breaks
under pagination (the client never holds the full set), forks the
filtering logic per variant (a confound), and isn't the client-cache
docs' own model (server state, one query key per param set). This is the
PLP build's contract; the prototype deliberately used page-flips (already
canonical) so the origin stayed untouched.

**6. The published cells — six, each proving one thing.** Defaults unless
stated: `n=24`, `avg-broadband-desktop`, edge cold, median-of-N. Verdicts
are what the receipts say; cell copy states the *question* and the
mechanism, never a presumed winner.

| # | cell | condition | proves |
|---|---|---|---|
| 1 | **First contact** | all four, first load | A client cache cannot help a first visit — the lead pays its library bytes and wins nothing here. The site's headline strategy loses its own opener: anti-rigging by design. |
| 2 | **The revisit** | `plp-revisit` + `plp-fresh`, cold vs client-cache vs loaders | A client cache makes *revisits* free (measured: 0 requests / 0 bytes) and does nothing for *fresh* states — the win, honestly fenced. |
| 3 | **The edge flip** | plain build, same URL ± `cache=cold` | Identical code, the serving tier flips: infrastructure as the fix (the live plane already shows ~400 ms R2 vs ~15 ms KV on this exact seam). |
| 4 | **The waterfall on a bad network** | `slow-4g-mid-phone`, first load, loaders vs cold/client-cache | Round-trips are the currency of slow networks: finished HTML in one trip vs shell-then-data in two. |
| 5 | **The volume flip** | `n=24` vs `n=240`, client-cache vs loaders, `slow-4g-mid-phone` | Who turns 240 rows into DOM — the server or a mid-range phone — decides LCP/INP at volume. Verdict deliberately unwritten until measured. |
| 6 | **The forgiving environment** | `fast-wifi-laptop`, first load + one interaction, all four | On fast networks with modest data every strategy is fine: cold's win is simplicity — don't buy complexity your audience doesn't need. Fit, not leaderboard. |

Where each strategy wins: cold → cell 6; client cache → cell 2; server
loaders → cells 4/5 (examined, not presumed); edge → cell 3. The cost
story rides the same receipts (ADR-0001 §7): loaders pays server CPU-ms
per interaction, edge ~zeroes origin reads, client cache moves the work
to the visitor's device — priced by the existing calculator.

**7. The misapplication exhibit is measured, fenced, and fair.** Apollo
Client 4 + `apollo-link-rest` on the identical page and sequences — the
ecosystem's documented REST path, not a strawman rig. The prototype's
verdict: the exhibit's UX *matches* the lead (revisit = 0 requests,
cache-first) while its data layer costs **+65.1 KB brotli vs +9.0 KB**
(7.3×, build-measured), and the REST glue is a pre-1.0 RC whose package
entry broke the build once (FINDINGS). The exhibit's claim is "the wrong
tool works — you pay in bytes and machinery," which is the staff-level
point: misapplication is expensive, not catastrophic. Fenced like the
live-origin demonstration: labeled on-surface, never in the four-strategy
cells; its copy states what Apollo is the *right* tool for.

**8. The PLP switcher control-set** (ADR-0004 §7's per-surface function):
the five options of §2, the `n` knob (24/240), the profile selector the
HUD already owns — plus a **per-interaction HUD readout** (bytes + ms of
the visitor's own last interaction, from the same resource-timing
mechanism the runner uses) and a **replay affordance** that runs the
published sequence in-page, so a visitor *sees* the revisit cost 0 bytes
live. Both are JS-enhanced chrome, stripped from measured KB as chrome
already is; the anchor-link core stays JS-off functional.

## Considered alternatives

- **A `?clientcache=warm` URL knob** (persisted cache, e.g.
  `persistQueryClient`). Rejected: persistence is opt-in machinery, not
  the idiomatic default; faking in-memory warmth on a first load is a lab
  artifact; and it would make the receipt lie about what a real visitor
  experiences. The scripted-priming design measures the real thing.
- **Edge-KV as its own page build** (Worker-rendered HTML from KV).
  Rejected: a fifth build outside the sparse React/Next + HTMX matrix,
  and it conflates the render axis with the data axis. Riding the plain
  build makes the edge cell the cleanest one-variable comparison instead.
- **Client-side filtering over a cached superset.** Rejected (§5).
- **Strategy as a query param** (`?strategy=`). Rejected: strategy is
  shipped code — identity — and ADR-0004 §5 puts identity in the path;
  a query strategy would also break "the access pattern is the code."
- **Apollo via a GraphQL façade over the tray.** Rejected: builds a
  server to justify a client, and the added hop would make the exhibit
  riggable-looking. `apollo-link-rest` is the ecosystem's own REST path.
- **Silent library defaults for the client cache.** Rejected (§4): the
  default's background refetch would quietly erase the strategy's
  headline win — the un-riggable move is publishing the config.

## Consequences

- **The PLP build ticket** (downstream, now unblocked) consumes: the §5
  Worker param contract, the §2 routes + switcher presets, the §3
  registry extension (`{ prime?, measure }` + the six entries, wall-ms
  per measured step in the receipt), the §8 HUD additions, and the §4
  published config. The facets payload observation (the JSON tray carries
  facet counts on every page — FINDINGS §6) is a data-plane design note
  for that ticket.
- **Prototype**, runnable at
  [`prototypes/data-strategy-lab/`](../prototypes/data-strategy-lab/):
  15/15 assertions against the real local composed origin; evidence in
  FINDINGS.md + evidence.json. Throwaway — the PLP build re-implements
  idiomatically per variant.
- **Vocabulary** (CONTEXT.md): data strategy, client warmth, priming
  interaction, misapplication exhibit.
- The x-pm-cache-state **pass-through** onto server-rendered HTML is the
  HTMX variant Worker's obligation (proven in the prototype's loaders
  leg).
- The exhibit pins exact versions (`@apollo/client`, `apollo-link-rest`
  RC) — a future bump re-runs the prototype's probe as the canary, the
  remix3 pattern.

## Addendum — strategy-review qualifications (2026-07-12)

Three qualifications from the strategy review
([`docs/reviews/2026-07-12-strategy-review.md`](../reviews/2026-07-12-strategy-review.md),
findings 3, 7, 8). The cells stand; their claims are resized.

**§1's "exactly one architectural move" holds within the React/Next build
only (finding 3).** plain → TanStack and plain → edge are genuinely
one-variable (cells 2 and 3, the pure cells). The **loaders exemplar is not**:
riding the HTMX variant, it changes the renderer, the client runtime
(15.0 KB htmx vs the 52.5 KB React baseline, brotli — prototype FINDINGS),
and the wire format (HTML partial vs JSON tray) in the same move. That bundle
is deliberate — "move the data layer to the server" arrives as a package in
real decisions, and hosting loaders+PE anywhere else would add a fifth PLP
build outside the sparse matrix (the same reasoning that rejected an own-build
edge-KV page). But cells 4/5's copy must say it: their verdicts compare
*strategy + paradigm* against *strategy*, and part of any loaders win is the
render axis's bundle story. A same-variant alternative (Next server-rendering
+ form-based PE) exists and was not chosen — recorded here so the choice is
visible, not discovered.

**Magnitudes travel only with their conditions (finding 7).** §6 cell 3's
"~400 ms R2 vs ~15 ms KV" is planning shorthand from one location and one
measure. Published cell copy quotes magnitudes only with measure (server
think-time vs total TTFB) + location + receipt attached — the review's probe
saw the same seam as ~236 ms vs ~119 ms total TTFB from elsewhere, and a
visitor's HUD will happily contradict any bare number.

**The tray's facet payload is resolved before byte verdicts publish
(finding 8).** The prototype found the JSON tray (facet counts + unrendered
fields on every page) triple the HTML partial's bytes — an API-shape choice
of ours that taxes only the JSON-fetching strategies. Before any
per-interaction byte cell publishes a verdict, the PLP build either splits
the facet payload and re-measures, or the cell shows **both** numbers
(tray-as-shipped and facets-excluded) so the payload-design share of the gap
is visible instead of credited to the paradigm.

## Addendum — §5 implemented: the two open questions, the key-cardinality policy, and what the data plane serves (2026-09-04)

§5 named the contract — five canonical params, validated against the real
facet values, junk a 400, no junk KV keys — and left two questions and one
bound open. The PLP data-plane unit (the 2026-08-29 audit's priority 3;
`docs/prototypes/plp-data-plane-prompt.md`) closes them. Every file:line here
was read from source that day; the numbers are tool-derived and say where.

**Q1 — facet counts under a filter RECOUNT over the filtered set, with the
selected group's own filter lifted.** For each group (genre, style, format)
the buckets are counted over the items that pass every applied filter EXCEPT
that group's own. In the group you filtered by, every value compatible with
the other filters stays listed with the count you would get by *switching*
to it; in the other groups a count is what you get by *adding* that facet.
A bucket with zero items is not listed — with one exception, found by the
2026-09-18 verify-slice pass: the selected value is always listed, so the
rail always offers the toggle-off. On an empty intersection
(`genre=Jazz&style=Minimal` with no such record — 637 of the crate's 855
genre × style pairs are empty) the recount leaves the selected value no
bucket, and every renderer drew a rail with no marked facet and no link that
removed either filter. The query module now appends the selected value at
its honest count, 0 — the one zero a rail may show. Unfiltered, this is the
whole-crate count, so the committed master (the default condition) did not
change under the rule. *Rejected:* whole-crate counts under a filter — cheaper to explain
and byte-stable across conditions, but a count that does not predict the
click ("Ambient 37" → 3 results) is the served-falsehood class the
2026-08-29 cut removed. *Given up:* the tray's facet payload now varies by
condition, so a byte cell measuring a facet toggle carries a variable facet
share — the first addendum's finding 8 already requires that share to be
shown separately before any byte verdict publishes. The display rule stays
the spec layer's: all genres, top 12 styles, top 8 formats, each group
titled with its cut, and the selected value always listed (appended after
the cut when it ranks outside it).

**Q2 — `PlpPage` grows `applied`**: `{ genre, style, format, sort, q }`,
each `string | null`, always present (`packages/data-contract/src/schema.ts`
`PlpApplied`). Every renderer derives EVERYTHING it shows — grid, count,
selected facet, chosen sort, search value — from the payload; the URL
contributes only the three knobs a tray cannot know (`cache`, `run`,
`profile`). The reason is live on the two client-cache arms: under
`keepPreviousData`/`previousData` the previous tray is on screen while a new
condition is in flight, and controls rendered from the request would show one
condition's selection over another condition's grid — a toggle-off link that
does not toggle off. With `applied` in the tray, "settled" (the moment the
address bar may move) is `appliedMatches(payload, condition)`, not
`payload.page === condition.page`. *Rejected:* deriving the selected state
from the URL — right for the server render, wrong for every in-flight
window. *Cost:* ~90 bytes per tray, one more `@type` in the Apollo
exhibit's document. **The tray's shape is versioned by the KV key prefix**
(`plp-query.mjs PLP_TRAY_VERSION`, now `v2:`): visitor-facing entries have no
TTL, so without the bump the default condition's pre-deploy entry would have
served a tray without `applied` to every visitor after the deploy — caught by
the design critique before a line shipped.

**One implementation, not two.** The query semantics — filter, ASCII-case-
insensitive substring search over title or artist, five sorts with nulls
last and committed-order tie-breaks, the recount, the slice — are ONE pure
module, `packages/reference/render/plp-query.mjs`, imported by the reference
renderer (the markup contract of record) AND by the edge Worker (the data
plane). The Worker had re-typed the reference's facet comparator and nothing
compared the two; filtering and sorting would have been a second and third
copy. `@pm/edge` therefore declares `@pm/reference` — the third consumer,
scoped in the ADR-0004 §2 addendum of the same date: the Worker is the data
plane, not a paradigm, its bundle is never a measured client bundle, and the
module is import-free by construction. The two arms still re-type the
MARKUP (ADR-0003 §1) and are held to the reference's `renderPlpBlock` for
every condition by `tools/repo-checks/test/plp-arms-agree.test.ts`; the
three rules a paradigm cannot import (the n clamp, the q normalizer, the
href rule) are re-typed in react-next and pinned equal over tables of inputs.

**The key-cardinality policy (the §5 bound, made a mechanism).** A KV key is
WRITTEN only for a condition the tier can hold a finite number of:

> cacheable ⇔ `q` absent ∧ n ∈ {24, 240} ∧ page ≤ totalPages (of the filtered set)

Everything else is served from R2 and marked `x-pm-cache-state: none` ("not
a warm-tier resource"; `?cache=cold` is still `bypass`). The URL-derivable
half (`q`, `n`) is ONE derivation — `plpWarmable` in `@pm/measurement`,
consumed by the Worker (which then skips KV in both directions) and by the
chrome's `cacheState` tag (which would otherwise stamp a search as `default`,
a KV-tier column, while every such request read R2). The page half needs
the snapshot and lives in the Worker alone: the lookup runs first, so the
hit path stays one KV read, and a page past the end is served as the honest
empty "0" every arm renders and never stored. Empty values are absent, never
400 (`?sort=` and `?q=` are what a GET form submits for an untouched
control). Facet values are validated exact-match against the snapshot's
real sets after the lookup (a junk key can never hit because it is never
written); a value too long to be real (encoded > 96 bytes; the longest real
value is 37 characters) is refused before the lookup so the key stays far
below KV's 512-byte limit. `sort` is validated against the five names.

- **Why `q` is never cached:** free text has no finite key space. A search
  costs one R2 read plus Worker CPU per request, bounded per request, and
  nothing accretes. *Rejected:* TTL-caching search — $5/M writes for junk
  searches against $0.36/M R2 class-B reads uncached, to buy warm hits on
  repeated searches nobody on a demo site repeats within an hour.
- **Why `n` is warmed at the two knob values only:** every n in 1..240 is a
  real served condition (`clampN`, unchanged), but the instrument names only
  `SURFACE_CONTROLS.plp.nKnob = [24, 240]`, and warming all 240 multiplies
  the key space ~120× for conditions nothing publishes. The bench runner
  refuses a PLP batch at any other n (`tools/bench-runner/src/batch.ts`), so
  a typo cannot mint a receipt whose warm column read R2.
- **The ceiling, measured** (`docs/prototypes/plp-data-plane/kv-ceiling.mjs`; it
  builds every cacheable payload with the real query module and counts its
  bytes; the rejected policy's bytes are estimated from one page per sort):

  | policy | keys | storage | writes, full enumeration | storage / month |
  |---|---|---|---|---|
  | adopted — n ∈ {24, 240}, real crate | **37,182** | **0.162 GB** (avg 4,345 B/value; longest key 128 B) | **$0.19** | **$0.08** |
  | rejected — n free in 1..240, real crate | 4,548,342 | ~19.7 GB | $22.74 | $9.87 |
  | adopted, fixture | 4,140 | 0.036 GB | $0.02 | $0.02 |
  | before this unit (unfiltered, no page cap) | unbounded | unbounded | — | — |

  Prices fetched 2026-09-04 from `developers.cloudflare.com/kv/platform/pricing/`
  ("$5.00/million" writes, "$0.50/million" reads, "$0.50/ GB-month" storage;
  free tier "1,000 / day" writes, "1 GB") and `/kv/platform/limits/` (key
  "512 bytes"); R2 from `/r2/pricing/` ("$0.36 / million requests" class B).
  List prices, before any included allotment.
- **The residual, honestly.** A junk or uncacheable request costs one Worker
  invocation, one R2 read, and — for a junk facet value — one KV read-miss:
  bounded per request, zero storage. The `run` nonce is a DIFFERENT class:
  any well-formed nonce on a cacheable condition is one KV write plus one
  ~4 KB entry for an hour (the TTL), so 1M distinct nonces in an hour cost
  ~$5 and ~4 GB-hours — time-bounded, not zero, and the same holds for
  `/api/pdp/<id>?run=`. Not narrowed: the harness mints `bench-…`/`suite-…`
  nonces and a prefix rule would not stop anyone who read this paragraph.
  **Unverified:** whether the `pm-warm` namespace is on the Free plan (1,000
  writes/day) — on Free this is an outage vector, not a cost line. Flagged
  for the account owner.
- **What is given up:** a page past the end and an empty intersection are
  served `none` (the page half of the policy lives in the Worker alone) but
  RUM-tagged `default` by the chrome's URL-derivable `plpWarmable` — both are
  hand-typed conditions no cell reads; a mechanism (the page surfacing the
  tray's `x-pm-cache-state` for the beacon) is ADR-0001 §8 territory for the
  measurement pass (verify-slice, skeptic lens, 2026-09-18). A hand-typed `?n=48` is never warm; RUM for such a
  page is tagged `cacheState: none`; a nonced batch at an unwarmed n is
  refused. The beacon's `environment` tag stays `n|cache` — a 3-card
  filtered page pools with the unfiltered condition in Analytics Engine
  (an ADR-0001 §8 amendment, not this unit's).

**The served surface.** The facet rail, the search form and the sort select
are back in the master and both arms, working. One href rule for every
in-surface link, both forms' hidden inputs and every client-side history
write (`plp.mjs conditionHref`; re-typed in htmx and react-next): knobs in
the order page, n, cache, run, profile, genre, style, format, sort, q, each
omitted at its default, the bare condition spelled `?page=1`, in
`URLSearchParams`' form-submit encoding (`+` for a space) so a JS-off form
and a JS-on push spell one condition alike. This closes the first PLP build's
handoff §6.2(ii): a page-flip from `?cache=cold` stays cold. The two known
spellings that still differ are recorded rather than hidden — a boosted htmx
form submit encodes with `encodeURIComponent` (`%20`), and a native submit of
an untouched select spells `sort=`; both parse to the same condition. The
strategy presets now carry the visitor's whole condition (only `cache` moves
with the preset) and the n knob drops `page`. A facet or sort value the
snapshot does not hold is a branded **404 "No such filter"** on both arms —
the plane answered, with a 400 — never the "data plane didn't answer" 503.
An empty result renders "Showing 0 of 0 releases" and no pagination
landmark. The default sort is labelled **"Catalogue order"**: the committed
order is id-ascending (snapshot-capture normalize.ts), and the pre-cut master
had called it "Popularity", which it is not.

**Consequences for the cells.** No PLP number publishes here (the batches
belong to the measurement pass, after its route-level fence). Three things
the pass inherits from this unit: `plpWarmable` and `PLP_N.warmed` are the
tier's contract; the warm column's priming visit loads the page only
(`batch.ts` `interactionId: "none"`), so a measured facet/sort/page
interaction on the edge arm is a MISS that also pays the awaited KV put —
prime with the target's own interaction before the first PLP interaction
cell; and the `x-pm-partial` pass-through means every htmx page-flip is now a
correct, chrome-less fragment on the composed origin.
