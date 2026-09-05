# PLP data plane — design note (draft for ADR-0005 addendum), 2026-09-04

> **Superseded — kept as the artefact the design critique attacked.** The ADR-0005
> addendum of 2026-09-04 is the record. Where this note and the addendum disagree,
> the addendum is right: the ceiling table below predates the recount and the
> `applied` bytes (0.11 GB / $0.05 here → 0.162 GB / $0.08 of record), and the key
> shape below (`v1:`, `encodeURIComponent`, a 64-char bound) became `v2:`,
> form-encoding and a 96-byte encoded bound in the Worker (verify-slice, 2026-09-18).

Repo: /Users/roblark/Work/project-matrix. Unit prompt: docs/prototypes/plp-data-plane-prompt.md.
ADR of record: docs/adr/0005-plp-data-strategy-comparison.md (§5 is the contract being implemented).

## The two ADR-0005 open questions

**Q1 — facet counts under a filter: RECOUNT over the filtered set, with the selected group's own filter lifted.**
For each facet group G (genre, style, format), the buckets are counted over the items that pass every
applied filter EXCEPT G's own (q and the other two groups still apply). So in the group you already
filtered by, every value compatible with the other filters stays listed with the count you would get by
SWITCHING to it; in the other groups, a count is what you get by ADDING that facet. A bucket with zero
items is not listed. Unfiltered, this reduces to today's whole-crate counts, so the committed master
(the default condition) is unchanged by this rule.
- Rejected: whole-crate counts under a filter. Cheaper to explain and byte-stable across conditions, but
  a count that does not predict the click ("Ambient 37" → 3 results) is the served-falsehood class the
  2026-08-29 cut was made to remove.
- What it gives up: the tray's facet payload varies by condition (a byte cell measuring a facet toggle
  carries a variable facet share — ADR-0005 addendum finding 8 already requires the facet share to be
  shown separately before any byte verdict publishes).
- Display rule (spec layer): all genres; top 12 styles; top 8 formats, by count desc, code-unit tie-break
  (the Worker's comparator). The SELECTED value is always listed: if it ranks outside its group's cut it
  is appended after the cut.

**Q2 — `PlpPage` GROWS `applied`**: `{ genre, style, format, sort, q }`, each `string | null`, always
present. Reason: `PlpArticle`/`plpBlock` derive EVERYTHING they render from the payload (the page-2 fix
established that); under `keepPreviousData`/`previousData` the previous payload is on screen while the
new condition is in flight, so a rail whose selected state came from the URL/condition would disagree
with the grid — the exact URL-vs-`aria-current` disagreement `usePushWhenSettled` was written to end.
With `applied` in the tray, `settled` = the payload's applied query equals the requested one.
- Rejected: derive the selected state from the request URL. Works for the server render; wrong during
  in-flight windows on the two client-cache arms.
- Cost: ~90 bytes per tray; the Apollo exhibit's document grows a field (part of the exhibit's cost).

## The KV key-cardinality policy (Step 2)

Cloudflare KV pricing, fetched 2026-09-04 from developers.cloudflare.com/kv/platform/pricing/:
writes "$5.00/million", reads "$0.50/million", storage "$0.50/ GB-month". Limits page: key size
"512 bytes", value "25 MiB".

**Cacheable ⇔ `q` absent AND `n ∈ {24, 240}` (the published knob values, `PLP_N.default`/`PLP_N.max`)
AND `page ≤ totalPages` (of the filtered set).** Everything else is SERVED from R2 with
`x-pm-cache-state: none` and never written. `?cache=cold` still bypasses (state `bypass`).
- Order of operations on a request: build the canonical key from the parsed, length-bounded params →
  KV lookup (a junk or uncacheable condition can never HIT because it is never written) → on miss, read
  R2 summaries → validate facet values against the real facet sets (junk → 400, `none`, no write) →
  filter/sort/slice → write-through only if cacheable. The HIT path stays exactly today's (one KV read,
  no R2) — reading R2 before the lookup would destroy the edge-cache cell (~400 ms R2 vs ~15 ms KV).
- Key shape: `v1:/api/plp?n=<n>&page=<p>[&genre=<enc>][&style=<enc>][&format=<enc>][&sort=<s>][&run=<r>]`
  with `encodeURIComponent` on facet values, fixed param order, defaults omitted → one condition, one key.
  Facet values are exact-match (case-sensitive) against the snapshot's values; the rail emits exact
  encoded values, so UI-generated URLs always validate; hand-typed near-misses 400. Raw facet values
  longer than 64 chars (longest real value: 37) and `q` longer than 64 are 400/trimmed BEFORE the lookup,
  so the key can never exceed 512 bytes.
- Ceiling, tool-derived from the real crate (scratchpad kv-ceiling.mjs; non-empty (genre?,style?,format?)
  combos only — an empty result has totalPages 0 so page 1 is past the end and never written; 6 sorts):
  | policy | keys | storage | writes (one-off, full enumeration) | storage/month |
  | n free in 1..240 | 4,548,342 | 13.0 GB | $22.74 | $6.50 |
  | n ∈ {24, 240} | 37,182 | 0.11 GB | $0.19 | $0.05 |
  Fixture: 4,140 keys / 0.03 GB under the adopted policy. Today (unfiltered, no page cap): unbounded.
- `q` never cached: free text has no finite key space; a search is the textbook un-cacheable-by-key
  request. Cost of a search: one R2 read + Worker CPU per request, bounded per request, nothing accretes.
  Rejected: TTL-caching `q` — $5/M writes for junk searches vs $0.36/M R2 reads uncached, for warm hits on
  repeated searches nobody on a demo site repeats within an hour.
- Residual: a curl loop over junk/uncacheable conditions still costs one KV get-miss ($0.50/M) + one R2
  read ($0.36/M class B) + a Worker request per hit. Bounded per request; zero storage.
- What is given up: a hand-typed `?n=48` is never warm (R2 every time, `none`); `run`-nonced keys follow
  the same rule (a nonced batch at n=48 would record docCacheState `none` — visible in the receipt).
  data-plane.test.ts's cache legs move from n=48 to a knob value.

## Step 0 — the `?page=` ceiling (its own commit, branch plp-page-ceiling)
`serveData` gains a `cacheable(payload)` predicate; `handlePlp` passes `page <= totalPages`. A page past
the end is still the honest empty 200 every arm and guard pins ("0", no Next) but it never writes through
and carries `x-pm-cache-state: none`. Lookup-first keeps the hit path unchanged. Tests: new
`workers/edge/test/` (vitest) driving the Worker in-process with stub R2/KV: past-end → 200, empty,
`none`, zero puts; real page → miss then hit; `?page=1e15` collapses to 1 (parseInt).

## Semantics (the spec, implemented in packages/reference/render/plp.mjs AND workers/edge; pinned equal)
1. Start from `summaries` in committed order (id-ascending — snapshot-capture normalize.ts:11).
2. Filter: `genre ∈ s.genres`; `style ∈ s.styles`; `format ∈ s.format.split(", ").slice(1)`;
   `q`: after trim + whitespace-collapse + 64-char cap, ASCII-case-insensitive substring of title OR
   artist (`[A-Z]` folded only — no `toLowerCase` on non-ASCII, no ICU). Empty `q` after trim = absent.
3. Facets: recount per Q1.
4. Sort: `year-desc | year-asc | price-asc | price-desc | title`; default = committed order, labelled
   "Catalogue order" (the pre-cut master said "Popularity" — FALSE: rows are id-ascending). Nulls
   (year, priceFrom) sort LAST in either direction; `title` = ASCII-folded code-unit compare; every tie
   breaks on committed order (explicit index compare, not engine sort stability).
5. `total` = filtered length; `totalPages = ceil(total/n)`; `items` = slice; `applied` = normalized values.

## Markup (restored in the master first; both arms mirror)
- Rail `<nav class="pm-facets" aria-label="Filters">`, groups per the pre-cut facets.css skeleton;
  selected facet `aria-current="true"` with an href that REMOVES its param; every facet href resets
  `page` and keeps every other applied knob.
- Toolbar: search GET form (`q`, hidden inputs for the other non-default knobs) and sort GET form
  (`sort` select with `selected` on the applied option, hidden inputs for the rest). Hidden inputs in the
  canonical param order so a JS-off submit and a JS-on push spell the same URL.
- ONE href rule for pagination, facets, forms and pushState (was two: pageHref vs plpHistoryUrl):
  order `page, n, cache, run, profile, genre, style, format, sort, q`; `page` always emitted; every other
  knob only when non-default. This also closes handoff §6.2(ii): `cache`, `run`, `profile` ride every
  in-surface href, so a page-flip from `?cache=cold` stays cold. Unchanged at the default condition, so
  the committed master's existing hrefs are byte-identical.
- htmx: the three `hx-*` attributes move from the pagination `<nav>` to the `.pm-plp` root so facet links
  and both forms are boosted too (hx-boost covers descendant anchors AND forms). Still three attributes on
  one element; registration `^hx-` unchanged.
- react-next: `PlpArticle({ payload, condition, onNavigate })` — one seam for page/facet/sort/search;
  `PlpCondition` becomes flat `{ n, page, cache, run, profile, genre, style, format, sort, q }`;
  `plpApiPath` forwards the five params again (the tripwire retires); islands navigate on any condition
  change.

## Instrument gaps (Step 4)
- warm-tier-discipline: also match PAGE requests that proxy the tray server-side — `/htmx/plp` AND
  `/react-next/plp` (react-next forwards cache/run from the page URL; `a11y.test.ts:192`
  `get("/react-next/plp/plain/")` plants a canonical key on the deployed plane TODAY). Page pattern
  requires a call-site `(` before the quote so `expect(body).toContain('href="/react-next/plp/plain/"')`
  is not a false positive.
- front Worker: `if (upstream.headers.get("x-pm-partial")) return upstream;`

## Step 5
`.pm-plp__head` and `.pm-plp__results` get real rules in surfaces/plp.css; the two OWED entries go.

## Verification plan
turbo check; master regeneration idempotent; origin suite alone in both snapshot modes; new
origin-suite PLP leg (filtered tray through the composed origin; both arms serve identical normalized
`.pm-plp` DOM for the same filtered URL; junk 400s; partial through the FRONT carries no chrome); a
browser leg (JS-on facet click swaps/intercepts; JS-off is a real navigation) on both arms; sabotage
table; verify-slice (4 lenses); KV ceiling numbers into the addendum.
