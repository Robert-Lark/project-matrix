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

The bench runner, cost calculator, and snapshot capture arrive with their
slices (issues #7–#8, `snapshot-capture`).
