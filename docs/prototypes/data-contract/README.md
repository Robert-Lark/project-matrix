# Prototype — the zero-bias data contract

The concrete artifact for the `data-contract` ticket. This is the "prepped tray"
every variant eats from, byte-identical.

- **`schema.ts`** — the single source of truth. Zod schemas (validate the frozen
  data at capture time) + inferred TS types (what every variant imports). Two
  shapes: `ReleaseSummary` (PLP card, small tray) and `ReleaseDetail` (PDP, full
  tray), plus the `PlpPage` wire shape and the dated `SnapshotManifest`.
- **`fixtures.json`** — an **illustrative** sample payload (not captured data)
  showing the shape a variant receives. Real values come from `snapshot-capture`.

## The three guardrails (why this shape, not another)

1. **DATA, not UI.** Typed primitives only — price is a number, duration is
   seconds, image dimensions are numbers. No pre-sorting, pre-formatting, or
   pre-computed render output, because those are real per-render costs and hiding
   them would flatter the frameworks and make the benchmark lie.
2. **Complete per surface.** Each tray carries everything its surface needs, so no
   variant does gap-filling fetches — that would import N+1 differences into the
   numbers.
3. **Self-hosted assets.** `image.src` points at our frozen assets (Discogs image
   URLs require auth + are rate-limited, verified against the API docs), and
   width/height ride along as data so every variant reserves layout space
   identically — honest CLS.

## Why this is fair, not rigged

Zero-bias = **same data content everywhere** (the control). How each paradigm
*accesses* that data — baked in at build time vs fetched at runtime vs a server
loader — is the **independent variable we're measuring**, and each paradigm
accesses it the way it really would in production. Same tray; different, realistic
way of picking it up.

See [ADR-0002](../../adr/0002-data-contract-and-frozen-snapshot.md) for the full
rationale, and [CONTEXT.md](../../../CONTEXT.md) for the vocabulary.
