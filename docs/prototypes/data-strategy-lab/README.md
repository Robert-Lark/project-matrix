# data-strategy-lab prototype

Throwaway prototype resolving the `data-strategy-lab` ticket in
[`docs/decision-map.md`](../../decision-map.md): prove that the PLP
data-strategy scenarios are buildable and their differences observable
against the real serving stack. Decisions + rationale live in
[ADR-0005](../../adr/0005-plp-data-strategy-comparison.md); measured
evidence in [FINDINGS.md](FINDINGS.md).

## What it proves

Four data strategies (plus the fenced misapplication exhibit), each an
idiomatic access pattern over the SAME tray from the real local composed
origin, driven through the same interaction sequence:

- **`/plain/`** — cold / no caching: plain `fetch` on render and on every
  interaction. This exact build doubles as the **edge-cache** strategy:
  cold pins `?cache=cold`, edge drops it — same code, one condition flip.
- **`/tanstack/`** — client cache: TanStack Query v5, published config
  (`staleTime` 5 min; `?stale=0` runs the library default so the
  difference is a demonstrated fact, not a tuning secret).
- **`/loaders/`** — server loaders + progressive enhancement: this
  server fetches the tray, renders full HTML; pagination is plain
  `<a href>` (works JS-off) enhanced by htmx into grid-only swaps. The
  upstream `x-pm-cache-state` is propagated onto the HTML response — the
  design the real HTMX variant's Worker owes.
- **`/apollo/`** — the fenced exhibit: Apollo Client 4 +
  `apollo-link-rest` (the ecosystem's documented REST path, pre-1.0 RC)
  on the identical page.

The three React bundles share one grid component and differ ONLY in the
data layer, so the measured byte delta IS the library
([FINDINGS](FINDINGS.md) — build-measured raw/gzip/brotli).

The probe drives S1 load → S2 next (a **fresh** state) → S3 prev (a
**revisit**) and records per step: tray requests, bytes, wall time,
`x-pm-cache-state`. Fifteen assertions pin the claims the scenario table
makes (revisit free under a client cache, background refetch under the
default `staleTime`, bypass/miss→hit edge semantics through both client
and server data paths).

## Run it

Needs the local composed origin up (`pnpm dev` at the repo root; seed
local R2 once — see `workers/README.md`).

```sh
npm install
npm run build    # esbuild → dist/ + vendor/htmx.min.js + dist/sizes.json
npm run serve &  # :8940, proxies /api/* to the front Worker on :8787
npm run probe    # drives every strategy page, writes evidence.json
```

Wall times printed by the probe are local and directional only — the
bench runner owns published latency under real profiles. Uses the origin
suite's system-Chrome fallback when the Playwright CDN is blocked.

## Deliberate scope lines

- Interactions are **page flips**, not facet filters: `/api/plp` grows
  canonical facet/sort/search params in the PLP build (ADR-0005 §5); the
  cache mechanics the prototype had to prove are identical per query key.
- The grid is **text-only**: image delivery is strategy-invariant
  (outside the warm tier, identical bytes everywhere), so it stays out of
  the per-interaction deltas.
- Local responses are uncompressed; cross-strategy byte comparisons here
  are raw and directional. Published numbers come from the bench runner
  against the deployed plane (Brotli, ADR-0001 §6).
