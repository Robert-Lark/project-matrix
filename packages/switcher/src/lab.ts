/**
 * The published-runs contract (surface-design session, 2026-07-17).
 *
 * C2 discipline (ADR-0007), made structural: a lab value CANNOT exist in the
 * chrome without its receipt — the type carries the receipt as a required
 * field, and the renderer takes the whole `PublishedReading`, never a bare
 * number. Until the first benchmark publication every slot renders its
 * designed empty state.
 *
 * Ownership (panel seams finding): published snapshots are committed
 * artifacts built into the front Worker's dist and served from
 * `/_pm/lab/{surface}.json` — the chrome-owned excluded path (ADR-0001 §6).
 * The front build hands the bundle to `renderChrome`; nothing here fetches.
 */
import type { ProfileId } from "@pm/measurement";

/** Reading-table rows. Initial JS KB is the headline (ADR-0001 §3); INP is
 *  always the scripted lab INP, named exactly that (ADR-0001 addendum B). */
export const READING_METRICS = [
  "initial JS",
  "TTFB",
  "FCP",
  "LCP",
  "CLS",
  "INP (scripted)",
] as const;
export type ReadingMetric = (typeof READING_METRICS)[number];

export interface LabReceipt {
  profile: ProfileId;
  /** Publication date of the dated snapshot (ADR-0001 §9). */
  date: string;
  commitSha: string;
  location: string;
  /** URL of the raw receipt artifact — the anti-rigging chain. */
  url: string;
}

export interface PublishedReading {
  value: number;
  unit: "ms" | "KB" | "";
  receipt: LabReceipt;
  /**
   * The median's min–max band across the batch's runs (ADR-0001 addendum C:
   * "cells now also publish the median with its min–max band"). Without it
   * the table invites comparisons the noise does not support — two medians
   * 44 ms apart whose bands overlap completely read as a difference, and
   * the only way to falsify that is to download the receipt and compute the
   * band by hand, which is the "it's in the receipt" answer the addendum
   * pre-rejected. Optional so a single-run or unmeasured cell degrades to
   * the bare median rather than inventing a band.
   */
  band?: { min: number; max: number };
}

/** One surface's published bundle. Keyed by column (variant, or data
 *  strategy on the PLP), then by reading-table row. */
export interface SurfaceLabBundle {
  surface: string;
  profile: ProfileId;
  columns: Record<string, Partial<Record<ReadingMetric, PublishedReading>>>;
  /**
   * The fit line — one sentence for THIS surface under THIS condition,
   * never a global ranking. Publishable only when the compared bands do not
   * overlap (ADR-0001 addendum C); otherwise the bundle carries
   * `bandsOverlap: true` and the chrome renders the indistinguishable state.
   */
  fit?: { sentence: string; receipt: LabReceipt };
  bandsOverlap?: boolean;
  /**
   * The scripted interaction the INP row was driven by, named in the row
   * itself.
   *
   * `READING_METRICS` has no interaction-bytes row, so the published
   * "interaction cell" IS the INP row — and until 2026-08-28 the table never
   * said WHICH interaction produced it. That was harmless while editorial was
   * the only publishing surface and had exactly one interaction. It stops
   * being harmless the moment a second surface publishes: the PDP's
   * `pdp-gallery-switch` and editorial's `editorial-add-to-cart` would render
   * in identically-labeled rows, and the only way to tell them apart would be
   * to download the receipt — the "it's in the receipt" answer ADR-0001
   * addendum C pre-rejected.
   *
   * Optional so a bundle minted before this field existed still renders (the
   * bare "INP (scripted)" label, exactly as it did); the build sets it for
   * every receipt it publishes.
   */
  interactionId?: string;
  /**
   * Whether this surface's INP row publishes at all, and why not when it
   * doesn't.
   *
   * A surface withholds it when the metric is demonstrably not measuring the
   * same thing in every column. Chromium closes an interaction's event-timing
   * entry at the first paint after the handler's SYNCHRONOUS processing
   * returns, so a resumed handler that returns having only SCHEDULED the
   * render closes its entry on a paint carrying nothing. On the PDP that is
   * measured and unstable: qwik reads 8 ms on the default profile, 0 ms under
   * slow-4G on the gallery switch, and 24 ms under slow-4G on add-to-cart,
   * while the other three sit at 24 throughout — so the cell swings across
   * conditions for one column and not the others, which is what a metric
   * measuring a paradigm property does not do.
   *
   * Withheld LOUDLY, never quietly: the reason rides the row, the fit sentence
   * refuses the timing comparison in its own words, and `/methodology/` carries
   * the mechanism with its figures. The alternative — publishing 0 ms beside
   * three 24s under a caveat — is a number no prose can rescue.
   */
  interactionTiming?: { published: boolean; reason?: string };
}
