/**
 * The pixel check's sensitivity proof (audit 2026-08-01). The deliberate-drift
 * fixture only exercises a LARGE re-valuation (`--color-text` → a red), so the
 * threshold's FLOOR went untested — and pixelmatch's former default (0.1) let a
 * uniform token re-valuation of ~26 neutral levels pass with 0 differing
 * pixels, the exact re-valued-token drift the pixel leg exists to catch
 * (ADR-0003 §2 "changing a token value is not [fine]"). With `threshold: 0`
 * (tools/drift-gate/src/pixels.ts) even a single-level uniform shift must
 * register; this pins that so the threshold cannot silently drift back up.
 *
 * Pure `comparePixels` over controlled swatches — no browser, no origin — so it
 * runs deterministically wherever the suite runs. A uniform shift is all-or-
 * nothing (every pixel carries the identical delta), so a caught drift is
 * exactly W×H differing pixels.
 */
import { describe, expect, it } from "vitest";
import { comparePixels, solidPng } from "@pm/drift-gate";

const W = 64;
const H = 64;
const NEUTRAL: readonly [number, number, number] = [26, 26, 26]; // ≈ --pm-neutral-900

describe("comparePixels is zero-tolerance to a uniform token re-valuation", () => {
  it("identical swatches compare equal (0 differing pixels)", () => {
    const result = comparePixels(solidPng(W, H, NEUTRAL), solidPng(W, H, NEUTRAL));
    expect(result.equal).toBe(true);
    expect(result.reason).toBe("match");
    expect(result.diffPixels).toBe(0);
  });

  it("a SINGLE-level uniform shift is caught — the floor the 0.1 default missed", () => {
    const result = comparePixels(solidPng(W, H, NEUTRAL), solidPng(W, H, [27, 27, 27]));
    expect(result.equal).toBe(false);
    expect(result.reason).toBe("pixel-drift");
    expect(result.diffPixels).toBe(W * H);
  });

  it("the ~26-level neutral re-valuation from the finding is caught", () => {
    const result = comparePixels(solidPng(W, H, NEUTRAL), solidPng(W, H, [52, 52, 52]));
    expect(result.equal).toBe(false);
    expect(result.diffPixels).toBe(W * H);
  });

  it("a single-level BLUE-only shift is caught — chroma the neutral eye barely reads", () => {
    const result = comparePixels(solidPng(W, H, NEUTRAL), solidPng(W, H, [26, 26, 27]));
    expect(result.equal).toBe(false);
    expect(result.diffPixels).toBe(W * H);
  });

  it("a dimension change reads as drift, not a pixelmatch precondition error", () => {
    const result = comparePixels(solidPng(W, H, NEUTRAL), solidPng(W, H + 1, NEUTRAL));
    expect(result.equal).toBe(false);
    expect(result.reason).toBe("dimension-mismatch");
  });
});
