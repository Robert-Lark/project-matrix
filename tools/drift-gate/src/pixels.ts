/**
 * Pixel comparison (ADR-0003 §6): the drift gate's second check — it catches
 * what the DOM check cannot (identical markup rendering differently, e.g. a
 * re-valued token: ADR-0003 §2 "changing a token value is not [fine]").
 *
 * Both screenshots in a comparison come from the SAME browser build in the
 * same run (the reference render is captured live, not stored as a baseline
 * image), so rendering is deterministic: identical DOM + identical CSS produce
 * byte-identical pixels. The pass criterion is therefore literal zero-tolerance
 * — `threshold: 0`, so ANY non-zero per-pixel delta counts. pixelmatch's
 * documented default (0.1) was masking exactly the drift this leg exists to
 * catch: a uniform token re-valuation of ~26 neutral levels (or ~75 blue-only
 * levels) stays under it and passes with 0 differing pixels (audit 2026-08-01).
 * Same-run determinism — not a perceptual threshold — is what absorbs benign
 * variance here, and it absorbs it to zero; the 0.1 default is for the
 * CROSS-environment baselines this comparison never uses. `includeAA: true`
 * for the same reason: the AA exclusion exists for cross-environment
 * comparisons, and here it would let edge-confined drift (a font-axis nudge, a
 * hairline border tint) pass as 0. The `solidPng` sensitivity proof
 * (tools/origin-suite/suite/pixels.test.ts) pins a single-level uniform shift
 * as caught, so the threshold cannot silently drift back up.
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
    threshold: 0,
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

/**
 * A solid-colour PNG — test support for this check's own sensitivity proof.
 * It lives here beside `comparePixels` because origin-suite cannot import
 * `pngjs` directly (the workspace's non-hoisted isolation), so the code that
 * builds a controlled small-drift image and the code being tested share one
 * pngjs. `rgba` alpha defaults to opaque.
 */
export function solidPng(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number?],
): Buffer {
  const png = new PNG({ width, height });
  const [r, g, b, a = 255] = rgba;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    png.data[o] = r;
    png.data[o + 1] = g;
    png.data[o + 2] = b;
    png.data[o + 3] = a;
  }
  return PNG.sync.write(png);
}
