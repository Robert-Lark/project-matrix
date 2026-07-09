# Project Matrix

A live-benchmarking portfolio: one coherent commercial product — a Discogs-powered vinyl store — built across several rendering paradigms and instrumented to expose perf/UX/infra-cost tradeoffs. Evidence for staff-level frontend work.

**Thesis:** when anyone can generate working code, the differentiator is architectural judgment — *fit, not a leaderboard*.

Planning artifacts (the canonical record):
- `docs/decision-map.md` — canonical plan (load in full every session)
- `docs/build-log.md` — how this is being built with AI (feeds the "How this was built" page)
- `docs/adr/` — the rationale of record; on any conflict, the ADR wins

Implementation (in progress — the foundation build, issues #2–#8):
- `packages/` — shared, consumed by every variant: the data contract, the
  design-system tokens + placeholder font, the golden-master reference render,
  the measurement profile spec. Deliberately no shared component runtime.
- `variants/` · `workers/` · `tools/` — arriving with their slices.

Monorepo: pnpm workspaces + Turborepo, strict non-hoisted isolation
(`pnpm install`, `pnpm exec turbo run lint typecheck test`).
