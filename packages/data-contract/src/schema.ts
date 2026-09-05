/**
 * Project Matrix — the data contract
 * The zero-bias normalized payload schema. Every variant consumes THIS shape,
 * byte-identical. Raw Discogs JSON is normalized into it once, at capture time,
 * and frozen; no variant ever parses a raw Discogs response.
 *
 * Guardrails baked in (see docs/adr/0002):
 *  - DATA, not UI: typed primitives only (price = number, duration = seconds).
 *    No pre-sorting, no pre-formatting, no pre-computed render output — those are
 *    real per-render work and hiding them would make the benchmark lie.
 *  - Complete per surface: no variant re-fetches to fill gaps (kills N+1 bias).
 *  - Self-hosted assets: image `src` points at our frozen assets; width/height
 *    are carried as DATA so every variant can reserve space (honest CLS).
 *
 * This file is the single source of truth for the contract: the Zod schemas
 * validate the frozen data at capture time, and the inferred types are what
 * every variant imports. Lifted verbatim from docs/prototypes/data-contract/.
 *
 * Field provenance verified against https://www.discogs.com/developers
 * (release response carries `lowest_price` + `num_for_sale` inline).
 */
import { z } from "zod";

/** Money as data — formatted in-render, never here. */
export const Price = z.object({
  amount: z.number().nonnegative(), // Discogs `lowest_price`
  currency: z.literal("USD"), // pinned via `curr_abbr=USD` at capture time
});

/** Self-hosted image. Dimensions are DATA (needed for honest CLS). */
export const Image = z.object({
  src: z.string(), // frozen asset path, e.g. /assets/img/1611072-primary.avif
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
});

// ── The small tray: PLP grid card ────────────────────────────────────────────
export const ReleaseSummary = z.object({
  id: z.number().int(), // Discogs release id
  slug: z.string(), // our clean URL slug, e.g. "1611072-miles-davis-kind-of-blue"
  title: z.string(),
  artist: z.string(), // primary artist display name(s), joined
  cover: Image,
  format: z.string(), // primary format label, e.g. "Vinyl, LP, Album, Reissue"
  year: z.number().int().nullable(),
  priceFrom: Price.nullable(), // null when nothing is for sale
  numForSale: z.number().int().nonnegative(),
  genres: z.array(z.string()), // facet source
  styles: z.array(z.string()), // facet source
});

export const Track = z.object({
  position: z.string(), // "A1", "2" — Discogs positions are not all numeric
  title: z.string(),
  durationSeconds: z.number().int().nonnegative().nullable(), // "4:35" -> 275
});

export const Label = z.object({
  name: z.string(),
  catno: z.string(),
});

export const Format = z.object({
  name: z.string(), // "Vinyl"
  qty: z.number().int().positive(),
  descriptions: z.array(z.string()), // ["LP", "Album", "Reissue", "180 Gram"]
});

// ── The full tray: PDP = summary + everything a detail page needs, complete ───
export const ReleaseDetail = ReleaseSummary.extend({
  images: z.array(Image), // [primary, ...secondary]
  tracklist: z.array(Track),
  labels: z.array(Label),
  formats: z.array(Format),
  notes: z.string().nullable(),
  // videos deliberately omitted from the store surface; add here if one needs it
});

// ── Wire shapes served by the Worker ─────────────────────────────────────────

/** A single facet bucket with its count, for the PLP filter rail. */
export const FacetBucket = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});

/** The sort orders the data plane implements (ADR-0005 §5 `sort`). The
 *  default — absent, or `null` in `applied` — is the snapshot's committed
 *  order, which is id-ascending (snapshot-capture normalize.ts: "the one
 *  neutral, deterministic order that is not a presentation choice"); the UI
 *  labels it "Catalogue order", never "Popularity", because it is not one. */
export const PlpSort = z.enum(["year-desc", "year-asc", "price-asc", "price-desc", "title"]);

/**
 * The query the data plane APPLIED to produce a page (ADR-0005 addendum,
 * 2026-09-04). Always present, `null` for an unapplied knob, so the tray is
 * self-describing: a renderer derives the rail's selected facet, the sort
 * select's chosen option and the search box's value from the payload it is
 * showing — never from the URL it was asked for — so a client-cache arm
 * holding the PREVIOUS page on screen while a new one is in flight cannot
 * show one condition's grid under another condition's controls.
 */
export const PlpApplied = z.object({
  genre: z.string().nullable(),
  style: z.string().nullable(),
  format: z.string().nullable(),
  sort: PlpSort.nullable(),
  q: z.string().nullable(),
});

/** Response of GET /api/plp — the small tray, paginated, with facet counts
 *  RECOUNTED over the filtered set (each group with its own filter lifted) and
 *  the applied query. */
export const PlpPage = z.object({
  items: z.array(ReleaseSummary),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(), // env "data volume" knob: serve 24 vs 240
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  facets: z.object({
    genres: z.array(FacetBucket),
    styles: z.array(FacetBucket),
    formats: z.array(FacetBucket),
  }),
  applied: PlpApplied,
});

/**
 * Dataset manifest — ties the frozen snapshot to a date + commit SHA, per the
 * measurement methodology (ADR-0001): dated snapshots, not live-updated.
 */
export const SnapshotManifest = z.object({
  capturedAt: z.string(), // ISO date, e.g. "2026-07-06"
  // Truthful provenance (ADR-0002 addendum, 2026-08-01): the real crate comes
  // from the Discogs API; the committed placeholder fixture is synthesized and
  // must be able to SAY so rather than borrow the API's provenance. A single
  // literal forced the fixture to claim "api.discogs.com"; the union lets it be
  // honest without loosening to a free string.
  source: z.union([z.literal("api.discogs.com"), z.literal("synthesized-fixture")]),
  crate: z.string(), // the curated slice, e.g. "jazz-original-pressings"
  releaseCount: z.number().int().positive(),
  commitSha: z.string().nullable(),
});

// z.infer types share the schema's name (value + type live in separate namespaces).
export type Price = z.infer<typeof Price>;
export type Image = z.infer<typeof Image>;
export type ReleaseSummary = z.infer<typeof ReleaseSummary>;
export type Track = z.infer<typeof Track>;
export type Label = z.infer<typeof Label>;
export type Format = z.infer<typeof Format>;
export type ReleaseDetail = z.infer<typeof ReleaseDetail>;
export type FacetBucket = z.infer<typeof FacetBucket>;
export type PlpSort = z.infer<typeof PlpSort>;
export type PlpApplied = z.infer<typeof PlpApplied>;
export type PlpPage = z.infer<typeof PlpPage>;
export type SnapshotManifest = z.infer<typeof SnapshotManifest>;
