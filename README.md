# Project Matrix

**Live:** https://pm-front.robresearch87.workers.dev

One vinyl store — 500 real Discogs releases, frozen 2026-07-11
(`tools/snapshot-capture/crate/manifest.json`) — built under five rendering
architectures and measured with one pinned ruler. Every published lab number links
the receipt that produced it, and every receipt can be re-run.

**Thesis:** when anyone can generate working code, the differentiator is
architectural judgment — *fit, not a leaderboard*. The site states that as the
premise under test, never as a result.

## Sixty seconds, for a reviewer

1. Open [`/`](https://pm-front.robresearch87.workers.dev/): the argument, the
   catalogue of surfaces, and a HUD reading your own visit off the same ruler.
2. Open [an editorial reading](https://pm-front.robresearch87.workers.dev/vanilla/editorial/).
   Swap the variant in the switcher; the reading table beneath it holds the
   published lab numbers per variant.
3. Click any number in that table. Each one links its receipt — profile, date,
   commit, run location (`/_pm/lab/receipts/…`).
4. Read [`/methodology/`](https://pm-front.robresearch87.workers.dev/methodology/):
   how the numbers are made, and what they cannot say.

## What is live

Read from `SURFACE_CONTROLS` in `packages/switcher/src/config.ts` — the
registry the site's own chrome renders from. If this table and the site
disagree, the registry is right and this table is stale.

| Surface | Served by | Entry | Publishes numbers |
|---|---|---|---|
| Editorial | vanilla, react-next, astro, qwik, htmx; remix3 as a fenced pre-release exhibit | `/vanilla/editorial/` | Yes — three profiles, receipts committed under `workers/front/lab/receipts/` |
| Product page | vanilla, react-next, astro, qwik | `/vanilla/pdp/{slug}/` | Registered; the bundle is empty until the PDP batches run |
| Search + filters | react-next (`plain`, `tanstack`, the fenced `apollo`), htmx | `/react-next/plp/plain/`, `/htmx/plp/` | Not yet. The grid serves; search, filters and sort do not |
| Checkout | vanilla; react-next and htmx still planned | `/vanilla/checkout/` | Not yet |
| Accessibility | not built | — | — |
| How it was built | surface not built; the home row links its source, `docs/build-log.md` | — | — |

## Reproduce

```sh
pnpm install
pnpm bench reproduce workers/front/lab/receipts/editorial-avg-broadband-desktop.json
```

`reproduce` re-runs the receipt's batch — same URLs, profile, run count,
interactions — against the live plane and mints a new, dated receipt. It
refuses to run if the plane attests a different commit than your checkout;
`--allow-cross-tree` is the deliberate escape. Details in
`tools/bench-runner/README.md`.

To build the whole plane locally and assert it at the seam:
`pnpm run origin-suite`.

## The record

- `docs/decision-map.md` — the canonical plan: every unit's question, answer and status
- `docs/adr/` — the rationale of record; on any conflict, the ADR wins
- `docs/build-log.md` — how this was built with AI
- `variants/` one workspace per paradigm · `workers/` the Cloudflare Workers
  that compose the one origin · `packages/` the shared contracts (data, tokens,
  reference masters, measurement, switcher) · `tools/` dev/CI-only tooling

Monorepo: pnpm workspaces + Turborepo, strict non-hoisted isolation
(`pnpm install`, `pnpm check`).
