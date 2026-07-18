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
}
