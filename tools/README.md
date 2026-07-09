# tools/

Dev/CI-only tooling — never shipped to a visitor (ADR-0004 §2).

- `repo-checks` — CI guards for the monorepo's structural guarantees (dependency
  isolation, no shared component runtime). Its `test` task is deliberately
  **uncached** (`@pm/repo-checks#test` in turbo.json): the guards read state
  outside their own workspace (the `packages/` listing, sibling manifests, the
  installed store), which Turborepo's package-scoped hash can't see — a cached
  PASS would replay stale exactly when a violation lands (demonstrated
  2026-07-07 with a probe package and a probe `main` entry).

The bench runner, cost calculator, drift tools, and snapshot capture arrive with
their slices (issues #6–#8, `snapshot-capture`).
