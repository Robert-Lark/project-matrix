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

/** Response of GET /api/plp — the small tray, paginated, with facet counts. */
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
});

/**
 * Dataset manifest — ties the frozen snapshot to a date + commit SHA, per the
 * measurement methodology (ADR-0001): dated snapshots, not live-updated.
 */
export const SnapshotManifest = z.object({
  capturedAt: z.string(), // ISO date, e.g. "2026-07-06"
  source: z.literal("api.discogs.com"),
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
export type PlpPage = z.infer<typeof PlpPage>;
export type SnapshotManifest = z.infer<typeof SnapshotManifest>;
