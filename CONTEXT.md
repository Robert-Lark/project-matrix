# Project Matrix — Context

The ubiquitous language for the project: a live-benchmarking portfolio built as one
Discogs vinyl store across several rendering paradigms. This file is a glossary and
nothing else — no implementation detail. Rationale lives in `docs/adr/`; planning
state in `docs/decision-map.md`.

## Language

### The store & its evidence

**Canonical store**:
The default store every visitor sees — real Discogs data captured once and frozen,
served the way production serves cacheable data. It is the rigorous, reproducible
measurement, and needs no qualifying label.
_Avoid_: "static mode", "frozen mode", "the fake one".

**Live-origin demonstration**:
An on-demand action (scoped to the PDP) that fetches from the live Discogs API to
expose the real cost of a dynamic origin. Deliberately fenced — never fed into the
benchmark numbers, because it cannot be reproduced run-to-run.
_Avoid_: "live mode" (implies the canonical store is not real).

**Variant**:
One exemplar of a rendering *paradigm* (vanilla, heavy-hydration, islands,
resumability, hypermedia, + the Remix 3 frontier). The thing being compared.
_Avoid_: "framework", "stack" (we compare paradigms, not framework collections).

**Surface**:
One of the store's five pages, each proving a distinct tradeoff (Editorial, PDP,
PLP, Checkout, "How it was built").
_Avoid_: "lab", "page type".

### The data

**Frozen snapshot**:
The captured, normalized, dated copy of Discogs data that is the canonical origin.
Tied to a capture date + commit SHA.
_Avoid_: "cache", "dump", "mirror".

**Catalog data**:
The immutable slice — title, artist, year, tracklist, cover art. Legitimately
pre-computable in production, so freezing it is real-world-faithful.

**Commerce data**:
The mutable slice — price, availability. The only genuinely dynamic data; the only
thing the live-origin demonstration shows changing.

**Crate**:
The curated snapshot scope — one coherent slice of records (e.g. a genre or era),
~500 releases, chosen for a realistic facet distribution. Heavy on purpose.
_Avoid_: "dataset", "corpus".

**Release summary**:
The small normalized payload for a PLP grid card (cover, title, artist, price,
facets). One of the two "trays".

**Release detail**:
The full normalized payload for a PDP — the summary plus tracklist, images, labels,
formats. The other "tray".

**Tray**:
Informal name for a normalized payload shape (summary or detail). The prepped
ingredients every variant is handed identically.

**Zero-bias guarantee**:
Every variant consumes byte-identical data content (the control), so no variant is
advantaged by a better data shape. How each paradigm *accesses* that data is the
measured variable, not a bias.

### Serving

**Origin**:
Cloudflare R2 — the single source of truth holding the frozen JSON + self-hosted
images.

**Warm tier**:
Cloudflare KV — the globally-replicated edge cache that makes a "warm" read
reproducible everywhere. Contrast **cold**: bypass the edge and read the origin.

**Product interactivity**:
The genuine client-side interaction on a PDP (image gallery/zoom, add-to-cart with
cart state, quantity, format switch). Distinct from commerce-backend fidelity, and
kept rich because the render-axis thesis depends on it.

## Standing principle

**Real-world fidelity**: a finding is worthless if a working engineer could not
reproduce it in a real production setting. Every design choice is checked against
this — normalization, freezing, and forced cold/warm are all adopted specifically
because they map to real production patterns, and the one thing freezing hides
(dynamic-origin cost) is surfaced honestly via the live-origin demonstration.
