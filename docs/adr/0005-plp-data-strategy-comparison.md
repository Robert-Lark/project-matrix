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
