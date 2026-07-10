/**
 * Pixel comparison (ADR-0003 §6): the drift gate's second check — it catches
 * what the DOM check cannot (identical markup rendering differently, e.g. a
 * re-valued token: ADR-0003 §2 "changing a token value is not [fine]").
 *
 * Both screenshots in a comparison come from the SAME browser build in the
 * same run (the reference render is captured live, not stored as a baseline
 * image), so rendering is deterministic and the pass criterion is strict:
 * ZERO differing pixels. pixelmatch's per-pixel color threshold (0.1, its
 * documented default) only absorbs sub-perceptual channel noise; any visible
 * difference counts — including anti-aliased edge pixels (`includeAA: true`):
 * the AA exclusion exists for cross-environment comparisons, and here it
 * would let edge-confined drift (a font-axis nudge, a hairline border tint)
 * pass as 0. Same-run determinism, not the AA heuristic, absorbs benign
 * variance.
 */
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface PixelComparison {
  equal: boolean;
  reason: "match" | "dimension-mismatch" | "pixel-drift";
  a: { width: number; height: number };
  b: { width: number; height: number };
  /** Differing pixel count (0 on dimension mismatch — nothing comparable). */
  diffPixels: number;
  /** Diff visualization (drift in red), present only on pixel-drift. */
  diffPng?: Buffer;
}

export function comparePixels(
  aPngBytes: Uint8Array,
  bPngBytes: Uint8Array,
): PixelComparison {
  const a = PNG.sync.read(Buffer.from(aPngBytes));
  const b = PNG.sync.read(Buffer.from(bPngBytes));
  const dims = {
    a: { width: a.width, height: a.height },
    b: { width: b.width, height: b.height },
  };

  // A page whose drift shifts layout changes its full-page height — that IS
  // drift, reported as such rather than as a pixelmatch precondition error.
  if (a.width !== b.width || a.height !== b.height) {
    return { equal: false, reason: "dimension-mismatch", ...dims, diffPixels: 0 };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
    includeAA: true,
  });
  if (diffPixels === 0) {
    return { equal: true, reason: "match", ...dims, diffPixels };
  }
  return {
    equal: false,
    reason: "pixel-drift",
    ...dims,
    diffPixels,
    diffPng: PNG.sync.write(diff),
  };
}
