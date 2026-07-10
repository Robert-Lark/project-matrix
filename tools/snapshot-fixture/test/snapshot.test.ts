/**
 * The committed snapshot is the interim frozen origin (issue #4) — this test
 * gates it in CI: every release schema-valid against the shared contract,
 * counts ≥240, manifest consistent, and every referenced image file present.
 * Regenerating (pnpm run generate) must keep all of this true.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
