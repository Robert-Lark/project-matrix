# data-strategy-lab — findings & evidence

All library facts verified in-session against primary sources (2026-07-12);
all numbers below are tool-measured outputs of this prototype — never
quoted from marketing pages or model recall.

## Verified library facts

- **TanStack Query is v5** — `@tanstack/react-query` 5.101.2 resolved from
  npm; "React Query is compatible with React v18+" (per
  tanstack.com/query/latest installation docs). Core API: `useQuery({
  queryKey, queryFn })`; pagination idiom `placeholderData:
  keepPreviousData` (per the paginated-queries guide).
- **The library default treats cached data as stale immediately** — "Query
  instances via `useQuery` … by default **consider cached data as stale**",
  and stale queries refetch automatically on new mounts (per the
  important-defaults guide). `gcTime` default 5 min. This is why the PLP
  build publishes its `staleTime` (ADR-0005 §4) instead of relying on
  silent defaults.
- **Apollo Client is v4** — `@apollo/client` 4.2.6 resolved; "a
  comprehensive GraphQL state management library for JavaScript" (per
  apollographql.com/docs/react). The docs mention no REST path.
- **The Apollo ecosystem's REST path is a pre-1.0 release candidate** —
  `apollo-link-rest` 0.10.0-rc.2 ("Query existing REST services with
  GraphQL"), peer-depending on `@apollo/client >=4`, last published
  2025-11. Its status is part of the fit evidence.

## Measured bundle sizes (build.mjs, esbuild minified; bytes)

Same React 19.2.7, same grid component — the delta is the data layer.

| bundle | raw | gzip | brotli | Δ data layer (brotli) |
|---|---|---|---|---|
| plain (baseline) | 195,451 | 61,019 | 52,514 | — |
| tanstack | 229,215 | 70,766 | 61,451 | **+8,937** |
| apollo (+link-rest+graphql+qs) | 438,540 | 135,192 | 117,620 | **+65,106** |
| htmx 2.0.10 (entire client data layer of the loaders leg) | 51,238 | 16,585 | 14,996 | n/a |

The misapplication exhibit's headline: **~7.3× the data-layer bytes of
TanStack Query for the same revisit behavior** (below).

## Probe results (probe.mjs, 15/15 assertions green)

Sequence: S1 load p1 → S2 next/p2 (fresh) → S3 prev/p1 (revisit); local
fixture origin (240 releases), n=24; raw local bytes, wall times
directional only.

| strategy | S2 fresh | S3 revisit | edge states |
|---|---|---|---|
| plain `?cache=cold` | 1 req, 11,652 B | **1 req, 11,664 B**, 41 ms | bypass ×3 |
| tanstack (staleTime 5 min) | 1 req, 11,652 B | **0 req, 0 B**, 15 ms | bypass ×2 |
| tanstack `?stale=0` (library default) | 1 req | **1 req, 11,664 B** (instant paint from cache + background refetch) | bypass ×3 |
| apollo (cache-first) | 1 req | **0 req, 0 B**, 16 ms | bypass ×2 |
| loaders/htmx `?cache=cold` | 1 req, 3,636 B | **1 req, 3,615 B**, 42 ms | bypass ×3 |
| plain, warm lane (`?run=…`, no bypass) | miss | **1 req, hit** | miss, miss, **hit** |
| loaders, warm lane | miss | **1 req, hit** | miss, miss, **hit** |

What that pins down:

1. **Fresh states cost everyone** — no strategy avoided the S2 fetch. The
   client cache's win is scoped to revisits; the scenario table says so.
2. **The revisit is where strategies separate** — client cache: 0 requests
   / 0 bytes; everything else pays a full round-trip.
3. **The published-config rule is load-bearing** — under the library
   default (`staleTime` 0) the revisit paints instantly from cache but
   still refetches (11.6 KB). "0 bytes on revisit" is only true of a
   *stated* config, so the cell copy states it (ADR-0005 §4).
4. **The exhibit's UX matches the lead** — Apollo's revisit is also 0
   requests. The misapplication cost is bytes + machinery, not broken UX;
   the exhibit can be honest.
5. **Edge semantics survive every access pattern** — `?cache=cold` yields
   `bypass` on every tray response; a nonce-keyed warm lane goes
   miss → **hit** on the revisit, including through the server-side data
   fetch (the loaders leg propagates `x-pm-cache-state` onto its HTML —
   the pass-through the real HTMX variant's Worker owes).
6. **The HTML partial is SMALLER than the JSON tray** (3.6 KB vs 11.6 KB
   raw): the tray carries facet counts + unrendered fields on every page.
   Noted for the PLP build: per-interaction bytes will favor hypermedia
   partials unless/until the tray's facet payload is split; that is a
   data-plane design fact shared by all strategies, and the numbers stay
   honest either way because both payloads are what each strategy really
   ships.
7. **First-load shape, directionally**: loaders S1 settled in ~47–52 ms
   locally vs ~80–99 ms for the shell→fetch pages — the waterfall
   difference exists even at LAN latencies; the slow-4G cell will scale
   it.

## Integration frictions (recorded, they cost real time)

- `apollo-link-rest`'s `main` is a UMD bundle with **no exports** and no
  `exports` map — esbuild resolves it and `RestLink` comes out
  `undefined`; the fix is a subpath import of its ESM entry
  (`apollo-link-rest/index.js`). Exhibit evidence: the REST path is not a
  paved road.
- The prototype dir is its own npm project root, so the repo's
  public-registry pin didn't reach it and the user-level CodeArtifact
  default 401'd; fixed with a local `.npmrc` (same ADR-0001 §9 rationale
  as the root's).
- Playwright's browser CDN is TLS-intercepted on this machine; adopted
  the origin suite's system-Chrome fallback (`channel: "chrome"`).
