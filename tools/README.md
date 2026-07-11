# tools/

Dev/CI-only tooling — never shipped to a visitor (ADR-0004 §2).

- `repo-checks` — CI guards for the monorepo's structural guarantees (dependency
  isolation, no shared component runtime). Its `test` task is deliberately
  **uncached** (`@pm/repo-checks#test` in turbo.json): the guards read state
  outside their own workspace (the `packages/` listing, sibling manifests, the
  installed store), which Turborepo's package-scoped hash can't see — a cached
  PASS would replay stale exactly when a violation lands (demonstrated
  2026-07-07 with a probe package and a probe `main` entry).
- `origin-suite` — the composed-origin integration suite (issue #3): the one
  command (`pnpm run origin-suite`) that builds everything, starts one
  `wrangler dev` per Worker, and asserts outside-in at the seam; re-run
  against the deployed origin as the post-deploy smoke.
- `drift-gate` — the ADR-0003 §6 drift gate tooling (issue #6): normalized-DOM
  extractor + permitted-noise registry, pixel comparator, the reference/fixture
  static server, and the deliberate-drift fixture. The checks themselves run
  inside the origin suite (`suite/drift.browser.test.ts`).
- `bench-runner` — the ADR-0001 comparison engine (issue #7): profiled
  batches over composed-origin URLs emitting SHA-pinned receipts, with
  `pnpm bench run` / `pnpm bench reproduce`. Proven at the seam by
  `suite/bench.browser.test.ts`.
- `cost-calculator` — the ADR-0001 §7 cost model (issue #8): measured
  resource profile (from receipts) × dated, swappable rate card →
  $/1M visits at a required cache-hit ratio and region, architecture-only
  and real-world views, full arithmetic published (`pnpm cost
  from-receipt`). Asserted pure by `suite/cost.test.ts`; proven against a
  real receipt at the seam by `suite/bench.browser.test.ts`.

- `snapshot-capture` — the one-time capture of the real crate (ADR-0002
  §1/§5/§6, issue #9): a checkpointed, resumable CLI (`pnpm capture run`)
  that pulls the curated ~500-release crate from api.discogs.com under the
  documented rate limits, normalizes ONCE into the two trays, Zod-validates
  via `@pm/data-contract`, and freezes the result under its `crate/` dir in
  the fixture snapshot layout (`pnpm capture seed` pushes it into R2). The
  token is capture-time only; the synthesized fixture remains the CI seed —
  CI never touches the crate artifact or the Discogs API.
