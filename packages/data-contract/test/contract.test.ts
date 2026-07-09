/**
 * The prototype fixtures must validate against the lifted schema (issue #2
 * acceptance). The fixtures are ILLUSTRATIVE (not captured data) — they pin the
 * contract's shape, not real values. Real data arrives via `snapshot-capture`.
 */
import { describe, expect, it } from "vitest";
import {
  PlpPage,
  ReleaseDetail,
  ReleaseSummary,
  SnapshotManifest,
} from "../src/schema";
import fixtures from "../fixtures/fixtures.json";

describe("prototype fixtures validate against the lifted schema", () => {
  it("ReleaseSummary parses the sample summary tray", () => {
    const parsed = ReleaseSummary.parse(fixtures.sampleSummary);
    // Inferred-type check: `parsed` is the z.infer type, not `any`.
    const summary: ReleaseSummary = parsed;
    expect(summary.slug).toBe("1611072-miles-davis-kind-of-blue");
    expect(summary.priceFrom?.currency).toBe("USD");
  });

  it("ReleaseDetail parses the sample detail tray", () => {
    const detail: ReleaseDetail = ReleaseDetail.parse(fixtures.sampleDetail);
    expect(detail.tracklist).toHaveLength(5);
    expect(detail.images[0]?.width).toBe(600);
  });

  it("PlpPage parses the sample wire page", () => {
    const page: PlpPage = PlpPage.parse(fixtures.samplePlpPage);
    expect(page.items).toHaveLength(2);
    expect(page.facets.styles.length).toBeGreaterThan(0);
  });

  it("SnapshotManifest parses the sample manifest", () => {
    const manifest: SnapshotManifest = SnapshotManifest.parse(
      fixtures.sampleManifest,
    );
    expect(manifest.source).toBe("api.discogs.com");
  });
});

describe("the contract rejects data that breaks its guardrails", () => {
  it("rejects a negative price (typed primitives, not UI strings)", () => {
    const broken = {
      ...fixtures.sampleSummary,
      priceFrom: { amount: -1, currency: "USD" },
    };
    expect(() => ReleaseSummary.parse(broken)).toThrow();
  });

  it("rejects a pre-formatted price string", () => {
    const broken = {
      ...fixtures.sampleSummary,
      priceFrom: { amount: "$21.50", currency: "USD" },
    };
    expect(() => ReleaseSummary.parse(broken)).toThrow();
  });

  it("rejects an image without dimensions (honest CLS needs them as data)", () => {
    const { width: _width, ...coverWithoutWidth } = fixtures.sampleSummary.cover;
    const broken = { ...fixtures.sampleSummary, cover: coverWithoutWidth };
    expect(() => ReleaseSummary.parse(broken)).toThrow();
  });

  it("rejects a non-USD currency (pinned via curr_abbr=USD at capture)", () => {
    const broken = {
      ...fixtures.sampleSummary,
      priceFrom: { amount: 21.5, currency: "EUR" },
    };
    expect(() => ReleaseSummary.parse(broken)).toThrow();
  });
});
