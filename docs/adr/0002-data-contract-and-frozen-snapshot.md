---
status: accepted
date: 2026-07-06
ticket: data-contract
---

# Data contract — frozen snapshot origin, zero-bias payload, R2/KV serving

## Context

Every variant of the Discogs vinyl store renders the same records, so the data
they consume is a shared, benchmark-critical surface. Five questions had to be
answered together: (1) where data comes from at request time, (2) the normalized
payload schema shared by all variants, (3) the Cloudflare Worker reverse-proxy
design, (4) cold vs edge/KV caching, and (5) how the commerce layer (price / cart
/ CTA) is handled — real marketplace data vs simulated.

The binding constraint is [ADR-0001](0001-benchmark-measurement-methodology.md):
numbers must be **reproducible, un-riggable, and served as dated snapshots tied to
commit SHAs**, with identical assets everywhere and one variable changing at a
time. A second constraint surfaced repeatedly in the grilling and is recorded as a
standing principle: **findings must replicate in the real world — no lab
artifacts.** A benchmark result that a working engineer could not reproduce in a
real production setting is worthless.

API facts below were verified in-session against the primary source
(`https://www.discogs.com/developers`), not model recall.

## Verified API facts

- **Price is inline on the release.** `GET /releases/{release_id}` returns
  `"lowest_price"` and `"num_for_sale"` directly (docs example:
  `"lowest_price": 0.63`, `"num_for_sale": 58`); `curr_abbr` pins currency
  (*"Currency for marketplace data. Defaults to the authenticated users
  currency"*). PDP is therefore **one call**, catalog + commerce aggregate
  together. (`/releases/{id}/stats` returns only `{num_have, num_want}` — community
  counts, not price.)
- **Search requires auth** — *"Authentication (as any user) is required"* — and
  accepts `genre, style, format, year, type` filters (the PLP facets).
- **Images require auth and are rate-limited** — *"Image requests require
  authentication and are subject to rate limiting."*
- **Rate limit: 60/min authenticated**, with `X-Discogs-Ratelimit[-Used/-Remaining]`
  headers. Pagination default 50, max 100 per page.

## Decision

**1. Provenance: a frozen snapshot is the canonical origin.** Real Discogs data is
captured once from the live API, normalized, and frozen; every published benchmark
number is measured against it. This is what makes the head-to-head reproducible —
live marketplace data mutates between runs, would blow the 60/min rate limit under
a benchmark batch, and could 500 in front of a viewer. Auth thereby collapses to
**capture time only**; the serving path needs no Discogs credential.

**2. Catalog vs commerce is the load-bearing distinction.** *Catalog* data
(title, artist, year, tracklist, cover art) is immutable and legitimately
pre-computable in production. *Commerce* data (price, availability) is mutable —
the only genuinely dynamic slice. Freezing the catalog is real-world-faithful
(CDNs, static generation, and ISR all pre-compute it); the only thing freezing
hides is the request-time cost of the dynamic slice.

**3. A live-origin demonstration, fenced and self-explaining.** The one thing the
freeze hides is put on stage: an on-demand action on the PDP fetches the price
from the live `api.discogs.com` (token as a Worker secret — the only serve-time
Discogs call), showing the real cost of a dynamic origin. It is **fenced like the
Remix 3 frontier** — never fed into the benchmark numbers, because it cannot be
reproduced run-to-run. It is presented as a demonstration, **not a "mode" toggle**:
a toggle named "live" would imply the default is fake, when the default is in fact
the rigorous, real-world-faithful measurement. Mandatory in-product copy states
that the default is real captured data served as production serves catalog data,
and that live is an excluded-from-numbers cost exhibit. (This applies the ADR-0001
"name the limits in-product" rule and the map's "every surface self-explains"
standing preference.)

**4. Commerce is thin: real frozen price, everything interactive simulated.** The
price/availability shown is the **real captured aggregate** (`lowest_price` +
`num_for_sale`, inline on the release). The **cart is client-side state only**;
**checkout is fully simulated** (real-looking form → fake confirmation, no real
payment, no orders, no PII) — that surface exists for INP-under-load and
a11y/forced-colors, not transactions. The per-seller listings table is
deliberately dropped: the public API has no clean "all listings for release X"
endpoint, and it would only duplicate the PLP's list/filter/sort story.
*Abuse case (per security standards, feature touches money):* a visitor believing
they are really buying is addressed by design — clearly a demo, zero payment data
collected.

**5. Endpoints and snapshot scope.** PLP grid ← `GET /database/search` (filtered);
PDP ← `GET /releases/{id}?curr_abbr=USD` (one call, price inline); images
**downloaded and self-hosted** (auth + rate-limit rules make hotlinking unviable
and un-fair). The snapshot is a **heavy curated crate** — one coherent slice
(~500 releases) with full detail + price + images. Heavy on purpose: more cards
widen the spread on *both* the render axis (more to hydrate) and the data axis
(more to fetch/filter/cache), and because it is frozen, "heavy" costs nothing in
reproducibility. The environment "data volume" knob is just *serve N (24 vs 240)
from the one heavy crate*.

**6. Zero-bias payload: normalize once into two trays.** Raw Discogs JSON is
normalized at capture into `ReleaseSummary` (PLP card, small) and `ReleaseDetail`
(PDP, full = summary + tracklist/images/labels/formats). Every variant consumes
this shape byte-identically; none parses raw Discogs, none re-fetches to fill gaps.
Normalization is the **production pattern** (BFF / edge view-model), so it moves
toward real-world fidelity, not away — shipping raw upstream JSON to five browsers
is what no real app does. The guardrail against over-normalizing: **data, not UI**
— typed primitives only (price = number, duration = seconds, image dimensions =
numbers), no pre-sorting / pre-formatting / pre-computed render output, no
artificial minifying. The contract is one file (Zod schema + inferred types, at
`docs/prototypes/data-contract/schema.ts`), validated at capture so frozen data
cannot drift from it.

**7. Zero-bias is same *data*, not same *access*.** The control is identical data
content. How each paradigm *gets* it — static/prerendered variants bake the tray
in at **build time**; SPA/server-loader/HTMX variants fetch it at **runtime** via
the Worker — is the independent variable being measured, and each matches that
paradigm's real production pattern. Forcing one access mechanism on all would be
the actual bias.

**8. Serving: R2 origin → Worker → KV warm tier.** The frozen JSON + images live
in **Cloudflare R2** (single source of truth). The **Worker** is a thin read API
over R2 (`GET /api/plp`, `GET /api/pdp/:id`) for the runtime-fetch variants, and
also carries the RUM beacon tagging (variant/surface/env/cache/location) and the
fenced live path. The **warm cache tier is Cloudflare KV** — chosen over the
per-datacenter Cache API because KV is globally replicated, so "warm" is
**reproducible everywhere**, which the cache-warmth column needs. **Cold** = bypass
the edge cache and read R2 (or the real API in the live demo). Cache state is
**driven explicitly by the harness** (cold = purge/bypass, warm = pre-populate
then measure), not left to random eviction; TTL is effectively infinite since the
data is frozen. This is faithful because cold and warm are the two real endpoints
of a real hit/miss spectrum, and the cost model interpolates at a stated hit-ratio
(ADR-0001 §7). *Client-side* caching (cold-fetch vs TanStack Query vs loaders) is
out of scope here — it is the `data-strategy-lab` variable, layered on top.

## Considered alternatives

- **Live API at request time.** Rejected: non-reproducible numbers, rate-limit
  exhaustion under a benchmark batch, uptime risk. Kept only as the fenced
  live-origin demonstration.
- **Rich commerce (real per-seller listings / synthesized listings table).**
  Rejected: no clean public endpoint, and it duplicates the PLP story without
  adding architectural signal.
- **One fat payload shape everywhere.** Rejected: the PLP would over-fetch detail
  fields, muddying the data-axis "bytes moved" numbers.
- **Cache API as the warm tier.** Rejected: per-datacenter and evictable, so
  "warm" is not deterministic; reproducibility outranks CDN-realism here.
- **Bundle the frozen data into every variant (no Worker read).** Rejected as a
  blanket rule: it would make runtime-fetching paradigms behave unrealistically.
  Adopted only for the variants whose real production pattern *is* build-time
  baking.
- **Hotlink Discogs images.** Rejected: auth + rate-limit rules break it for
  anonymous viewers and violate the "identical assets, real bytes" fairness rule.

## Consequences

- **Guardrail propagates:** the PDP must retain rich *product interactivity*
  (gallery/zoom, add-to-cart with client cart state, quantity, format switch) even
  though the commerce backend is thin — the render-axis "interactivity earns its
  JS" flip depends on it. Feeds `design-system` and the future PDP build.
- **New downstream ticket:** `snapshot-capture` (Task) — run the capture
  (respecting rate-limit headers with backoff), download images, normalize to the
  two trays, Zod-validate, land in R2 with a dated manifest + commit SHA. Includes
  picking the crate (genre/era).
- **Unblocks `data-strategy-lab`** (its deps `data-contract` + `measurement-
  methodology` are now both resolved).
- **Serve-time secret introduced** for the live path only: a Discogs token as a
  Worker secret, exercised solely by the live-origin demonstration.
- The contract file and its guardrails double as source content for the "How it
  was built" surface.

## Addendum — strategy-review corrections (2026-07-12)

Two claims above were sharpened by the strategy review
([`docs/reviews/2026-07-12-strategy-review.md`](../reviews/2026-07-12-strategy-review.md),
findings 7 and 9). Neither reverses a decision.

**"Reproducible everywhere" → "reproducible at a stated location" (§8).** KV
replication is demand-pulled, not proactively global: "Your data is not sent
automatically to every location's cache"; a cold read "must be read from the
nearest regional tier, followed by a central tier, degrading finally to the
central stores for a truly cold global read" — per
<https://developers.cloudflare.com/kv/concepts/how-kv-works/> (fetched
2026-07-12). A warm read is therefore warm **where it was primed**. The
cache-warmth column's design is unaffected (the runner primes and measures from
one location and the receipt carries the location label, ADR-0001 §4/§5), but
the *claim* is now stated at its true size — and any published warm/cold
magnitude must carry its measure (think-time vs total TTFB) + location + receipt
link. The review's live probe illustrates why: the same seam that shows
"~400 ms vs ~15 ms" as server think-time reads as ~236 ms vs ~119 ms total TTFB
from another location.

**Freezing hides two things, not one (§2).** Alongside the request-time cost of
the dynamic slice, freezing also removes **cache invalidation and coherence** —
TTL choice, purge-on-update, stampede control — which is the dominant real-world
cost of the edge-cache strategy and the reason `staleTime`-style knobs exist for
the client-cache strategy. The live-origin demonstration stages dynamic-fetch
cost only; it does not cover invalidation. This is stated in the methodology
page's limits-of-data list (ADR-0001 addendum §F), scoped honestly: the
catalog/commerce split (§2) is what makes the omission production-faithful for
*catalog* reads specifically — immutable catalog data genuinely never needs
invalidating within a snapshot's lifetime.
