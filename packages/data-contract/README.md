# @pm/data-contract

The zero-bias data contract ([ADR-0002](../../docs/adr/0002-data-contract-and-frozen-snapshot.md)),
lifted verbatim from [`docs/prototypes/data-contract/`](../../docs/prototypes/data-contract/).

- `src/schema.ts` — the single source of truth: Zod schemas (validate the frozen
  snapshot at capture time) + inferred TS types (what every variant and the edge
  Worker import). Two trays — `ReleaseSummary` (PLP) and `ReleaseDetail` (PDP) —
  plus the `PlpPage` wire shape and the dated `SnapshotManifest`.
- `fixtures/fixtures.json` — illustrative sample payloads (not captured data);
  the tests pin them to the schema. Real values arrive via `snapshot-capture`.

The package exports TypeScript source directly (`exports: "./src/schema.ts"`);
every consumer in this monorepo bundles TS (wrangler, vite, vitest), so there is
no build step to drift from the source of truth.

Guardrails (why this shape): **data, not UI** (typed primitives only — no
pre-formatting, no pre-computed render work); **complete per surface** (no
gap-filling fetches); **self-hosted assets** (image dimensions ride along as data
for honest CLS). See the ADR for rationale and
[CONTEXT.md](../../CONTEXT.md) for vocabulary.
