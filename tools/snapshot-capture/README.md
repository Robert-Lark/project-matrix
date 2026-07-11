# @pm/snapshot-capture

The one-time capture of the real crate (ADR-0002 §1/§5/§6, [issue #9]): pulls
~500 releases from `api.discogs.com`, downloads + self-hosts their images,
normalizes ONCE into the two trays, Zod-validates against `@pm/data-contract`,
and freezes the result under `crate/` with a dated `SnapshotManifest`.

[issue #9]: https://github.com/Robert-Lark/project-matrix/issues/9

```
pnpm capture run        # the capture — checkpointed, resumable, hours at 60/min
pnpm capture status     # phase-by-phase progress, read purely from disk
pnpm capture seed       # frozen crate → local R2 (wrangler emulation)
pnpm capture seed --remote   # → the real pm-snapshot bucket (issue #3's credential gate)
```

## Token (capture-time only)

Search, details, and images all require auth (ADR-0002 verified facts). The
CLI reads `DISCOGS_TOKEN` or `~/.config/project-matrix/discogs-token`
(chmod 600), **lazily** — a fully-checkpointed re-run makes zero API requests
and needs no token. The token is sent only to the API host as an
`Authorization: Discogs token=…` header (never in URLs), never logged, never
committed. The serve path has no Discogs credential anywhere (ADR-0002 §1).

## The crate

Defined as data in `crate.spec.json` — Rob's pick (2026-07-10, recorded in
issue #9): ambient / melodic techno / neo-classical vinyl, 2006–2026, from his
label list. Curation is deterministic from the frozen search checkpoints:
start-anchored label-name match (probed live: mid-string matches admitted
"Par-ki-lee Publishing" and "Surfin' Ki Records" impostors), vinyl-only, year
window applied client-side (the API's `year` filter is single-value), dedupe
by release id, per-label quota ranked by community popularity (`have + want`),
global trim/backfill to the target, ordered reserve for substitutions.
Membership is authoritative at details time: the release's own `labels[]`
must open with a spec label (search-result label arrays mix in publishers).
The plan (`.capture/plan.json`) is **write-once**: re-running never silently
re-curates; delete the file to re-plan. **Known boundary:** membership is by
label *name*, not Discogs label-entity id — a distinct entity whose name
opens with a spec label would pass; the committed `curation.json` receipt
makes any such case auditable.

## Checkpoint discipline

Every fetched search page / release / image lands on disk (atomic
temp-file+rename) before the next request; a file's existence is its
checkpoint. Kill the run anywhere — a re-run resumes, never re-pulls. (One
boundary: rename-without-fsync means power loss can still tear a checkpoint;
the reconcile pass detects a non-JSON detail checkpoint, deletes it, and
refetches — corruption costs one fetch, never a good release.) Rate
limiting self-throttles under the documented 60/min moving window (1100ms
between request starts), parks a full window when
`X-Discogs-Ratelimit-Remaining` runs low, and honors 429 (Retry-After when
present, a full window otherwise). Only dead-image statuses (403/404/410)
become durable tombstones/skips; a retry-exhausted 429/5xx fails the run
loudly so transient upstream trouble can never silently rewrite crate
membership.

A release that cannot serve the contract (404, no images, no artists, a dead
primary image) is **tombstoned** (`.capture/tombstones/`) and a substitute is
drawn deterministically from the plan's ordered reserve — the final crate is a
pure function of (plan, tombstones), whatever a resumed run interleaved.

## Layout

```
.capture/            gitignored working state
  search/<label>/    raw search pages + complete.json markers
  plan.json          the frozen curation (write-once)
  details/<id>.json  raw releases, verbatim as returned
  img-original/      original image bytes — RETAINED so derivatives can be
                     re-cut without ever re-pulling from Discogs
  img-skip/          dead-secondary markers
  tombstones/        dropped releases + reason
crate/               the frozen snapshot, fixture layout (seeder-compatible)
  manifest.json      dated SnapshotManifest (capturedAt + commitSha) — committed
  summaries.json     the small tray — committed
  details.json       the full tray — committed
  images-index.json  sha256 + originalSha256/bytes/dims per derivative — committed
  curation.json      the curation receipt: spec + per-label stats +
                     tombstones with reasons (ADR-0001 §9) — committed
  img/               AVIF derivatives — gitignored (see below)
```

**What's committed:** the trays, manifest, image checksum index, and the
curation receipt. Discogs *catalog* data is CC0, and the public repo carrying
the actual frozen dataset is the anti-rigging move (ADR-0001 §9). The two
*commerce* aggregates riding in the trays (`priceFrom`, `numForSale` —
ADR-0002 §2's mutable slice) are **not** covered by CC0: they are published
here as a thin, dated, factual market snapshot (two numbers per release,
non-substitutive of Discogs's marketplace) — recorded on issue #9 and flagged
for Rob alongside the image decision. **Image bytes stay out of git**: cover
art is third-party copyrighted material — self-hosting it in the store
(ADR-0002 §5) is not the same act as redistributing it through a public git
history. Images live in `.capture/`/`crate/img/` locally and in R2; the
committed index chains served derivative → retained original by sha256 (the
chain necessarily ends at the retained originals — Discogs's live image URLs
are signed, auth-gated, and not byte-stable, so no public hash of their bytes
can exist).

**`manifest.commitSha` semantics:** the HEAD SHA only when the working tree
was clean at freeze — a SHA must not attest a tree that didn't produce the
trays. Dirty tree (the normal case for a first capture) → `null`, and the
commit that lands the trays is the provenance of record.

## Derivatives

Anchored to the reference render's 600×600 card media: fit inside 600×600,
aspect preserved, never upscaled, AVIF q55. True output dimensions are read
from the derivative files themselves into the trays (honest CLS). A follow-up
may refine sizing once `aesthetic-direction` / the PDP build fix final
component dimensions (issue #9 note) — re-derivation starts from the retained
originals, never from Discogs.

## Normalization notes (the mapping of record)

- `artist` joins the credit list (`anv` over `name`, `join` connectors, comma
  spacing normalized); the numeric `(2)` disambiguation suffix is stripped
  from artist and label names (database bookkeeping, not the name).
- `tracklist` keeps `type_ === "track"` rows only (headings/index rows are
  section furniture); `duration` "M:SS"/"H:MM:SS" → integer seconds, else null.
- `formats[].qty` arrives as a string → int; free-text `text` ("Clear",
  "Digipak") is folded into `descriptions` so it survives as data.
- `notes` are reduced to plain text at capture ([a=…]/[l=…]/[url=…]/[b] markup
  stripped, \r\n → \n) — no variant ships a Discogs-markup parser.
- `priceFrom` is null when `lowest_price` is null/absent (nothing for sale or
  sale-blocked); `num_for_sale` null → 0. Currency pinned `curr_abbr=USD`.
- Row order is id-ascending — the one neutral, deterministic order that is
  not a presentation choice (data-not-UI).
- The release's own `year` is kept even when it strays from the search-time
  window (the window is a curation filter, applied at search time).

## CI relationship

The synthesized fixture (`tools/snapshot-fixture`) **stays the CI seed**: the
origin suite and CI never touch this crate or `api.discogs.com`. The edge
seeder defaults to the fixture; only an explicit `--dir` (what
`pnpm capture seed` passes) seeds the real crate. The `?n=` knob (24 vs 240,
`clampN`) holds against the crate because it holds against anything ≥240
releases — the crate targets ~500.

No `test` script (`@pm/origin-suite` precedent): the frozen output is proven
by contract validation at capture time and by serving it through the composed
origin; the pipeline is probed against a mock API (session probes, issue #9).
