/**
 * The committed snapshot is the interim frozen origin (issue #4) — this test
 * gates it in CI: every release schema-valid against the shared contract,
 * counts ≥240, manifest consistent, and every referenced image file present.
 * Regenerating (pnpm run generate) must keep all of this true.
 *
 * Branch coverage (surface-design DRAFT §6): CI's drift gate exercises this
 * fixture, so it must contain every rendering branch the real crate contains
 * — asserted below so a regeneration cannot silently drop one.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  ReleaseDetail,
  ReleaseSummary,
  SnapshotManifest,
} from "@pm/data-contract";

const snapDir = join(dirname(fileURLToPath(import.meta.url)), "..", "snapshot");
const details = JSON.parse(
  readFileSync(join(snapDir, "details.json"), "utf8"),
) as unknown[];
const summaries = JSON.parse(
  readFileSync(join(snapDir, "summaries.json"), "utf8"),
) as unknown[];
const manifest = JSON.parse(readFileSync(join(snapDir, "manifest.json"), "utf8"));
const curation = JSON.parse(readFileSync(join(snapDir, "curation.json"), "utf8"));
const parsedDetails = details.map((d) => ReleaseDetail.parse(d));

describe("the interim frozen snapshot", () => {
  it("carries at least 240 releases, summaries matching details 1:1", () => {
    expect(details.length).toBeGreaterThanOrEqual(240);
    expect(summaries.length).toBe(details.length);
  });

  it("every detail tray validates against the shared contract", () => {
    for (const d of details) ReleaseDetail.parse(d);
  });

  it("every summary tray validates and is derivable from its detail", () => {
    const byId = new Map(
      details.map((d) => [ReleaseDetail.parse(d).id, ReleaseDetail.parse(d)]),
    );
    for (const s of summaries) {
      const summary = ReleaseSummary.parse(s);
      const detail = byId.get(summary.id);
      expect(detail, `summary ${summary.id} has no detail`).toBeDefined();
      expect(summary.title).toBe(detail!.title);
      expect(summary.priceFrom).toEqual(detail!.priceFrom);
    }
  });

  it("the manifest is dated, valid, and count-consistent", () => {
    const m = SnapshotManifest.parse(manifest);
    expect(m.releaseCount).toBe(details.length);
    expect(m.crate).toContain("placeholder");
  });

  it("every referenced image path resolves to a committed file", () => {
    const srcs = new Set<string>();
    for (const d of details) {
      const detail = ReleaseDetail.parse(d);
      srcs.add(detail.cover.src);
      for (const img of detail.images) srcs.add(img.src);
    }
    expect(srcs.size).toBeGreaterThan(0);
    for (const src of srcs) {
      expect(src.startsWith("/assets/img/")).toBe(true);
      const file = join(snapDir, "img", src.replace("/assets/img/", ""));
      expect(existsSync(file), `${src} missing on disk`).toBe(true);
    }
  });

  it("the data is clearly synthesized (throwaway labeling survives)", () => {
    const first = ReleaseDetail.parse(details[0]);
    expect(first.notes).toContain("Synthesized placeholder");
    expect(first.id).toBeGreaterThan(9000000);
  });
});

describe("the fixture is adversarially branch-covering (DRAFT §6)", () => {
  it("carries non-square covers whose tray dimensions match the committed pixels", async () => {
    const landscape = parsedDetails.filter((d) => d.cover.width > d.cover.height);
    const portrait = parsedDetails.filter((d) => d.cover.height > d.cover.width);
    expect(landscape.length).toBeGreaterThanOrEqual(1);
    expect(portrait.length).toBeGreaterThanOrEqual(1);
    // Dimensions are DATA (honest CLS) — the tray numbers must be the truth
    // of the committed files, for every unique referenced image.
    const seen = new Map<string, { width: number; height: number }>();
    for (const d of parsedDetails)
      for (const img of d.images) seen.set(img.src, { width: img.width, height: img.height });
    for (const [src, dims] of seen) {
      const file = join(snapDir, "img", src.replace("/assets/img/", ""));
      const meta = await sharp(file).metadata();
      expect({ src, width: meta.width, height: meta.height }).toEqual({ src, ...dims });
    }
  });

  it("covers the gallery extremes: exactly 5 images and exactly 1 image", () => {
    expect(parsedDetails.some((d) => d.images.length === 5)).toBe(true);
    expect(parsedDetails.some((d) => d.images.length === 1)).toBe(true);
  });

  it("covers duration branches: a ≥1 h track and several null durations", () => {
    const tracks = parsedDetails.flatMap((d) => d.tracklist);
    expect(
      tracks.some((t) => t.durationSeconds !== null && t.durationSeconds >= 3600),
    ).toBe(true);
    expect(tracks.filter((t) => t.durationSeconds === null).length).toBeGreaterThanOrEqual(3);
  });

  it("covers format branches: one 3-format release, mostly single-format", () => {
    expect(parsedDetails.some((d) => d.formats.length === 3)).toBe(true);
    const single = parsedDetails.filter((d) => d.formats.length === 1).length;
    expect(single).toBeGreaterThan(parsedDetails.length / 2);
  });

  it("covers the unpriced branch (priceFrom null + numForSale 0)", () => {
    expect(
      parsedDetails.some((d) => d.priceFrom === null && d.numForSale === 0),
    ).toBe(true);
  });

  it("spans >1 genre and >1 style so facet groups have multiple entries", () => {
    expect(new Set(parsedDetails.flatMap((d) => d.genres)).size).toBeGreaterThan(1);
    expect(new Set(parsedDetails.flatMap((d) => d.styles)).size).toBeGreaterThan(1);
  });

  it("carries a notes-null release (61/500 crate releases; the PDP no-notes branch)", () => {
    expect(parsedDetails.some((d) => d.notes === null)).toBe(true);
  });

  it("exercises the crate-symbols glyphs: 33 ⅓ RPM formats and a ℗ note", () => {
    // Space-wrapped exactly like the crate's format strings (U+2153).
    const rpm = parsedDetails.filter((d) => d.format.includes("33 ⅓ RPM"));
    expect(rpm.length).toBeGreaterThanOrEqual(3);
    expect(
      parsedDetails.some((d) => d.notes !== null && d.notes.includes("℗")),
    ).toBe(true);
  });

  it("curation.json mirrors the crate shape and features a rich release", () => {
    // Same top-level keys as the crate's curation receipt, plus the
    // fixture-introduced `featured` (documented in-file by featuredNote).
    for (const key of ["spec", "planGeneratedAt", "perLabel", "reserveSize", "tombstones"]) {
      expect(curation, `curation.json missing ${key}`).toHaveProperty(key);
    }
    const featured = parsedDetails.find((d) => d.id === curation.featured);
    expect(featured, "curation.featured names no committed release").toBeDefined();
    // The editorial/PDP reference renders read it — it must exercise the
    // rich path: multi-format, priced, 5-image gallery.
    expect(featured!.formats.length).toBeGreaterThanOrEqual(3);
    expect(featured!.priceFrom).not.toBeNull();
    expect(featured!.images.length).toBe(5);
  });

  it("every committed image has its 160px .thumb.avif twin (≤160 both sides)", async () => {
    const imgDir = join(snapDir, "img");
    const files = readdirSync(imgDir).filter((f) => f.endsWith(".avif"));
    const fulls = files.filter((f) => !f.endsWith(".thumb.avif"));
    const thumbs = new Set(files.filter((f) => f.endsWith(".thumb.avif")));
    expect(fulls.length).toBeGreaterThan(0);
    expect(thumbs.size).toBe(fulls.length); // 1:1, no orphan thumbs
    for (const full of fulls) {
      const thumb = full.replace(/\.avif$/, ".thumb.avif");
      expect(thumbs.has(thumb), `${thumb} missing`).toBe(true);
      const meta = await sharp(join(imgDir, thumb)).metadata();
      expect(Math.max(meta.width ?? 0, meta.height ?? 0), thumb).toBeLessThanOrEqual(160);
    }
  });
});
