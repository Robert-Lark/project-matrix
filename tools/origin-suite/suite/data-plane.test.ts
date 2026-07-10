/**
 * Edge data plane through the composed origin (issue #4) — same seam as the
 * composition suite: plain HTTP at PM_ORIGIN, responses validated against the
 * shared Zod contract. Discogs is never contacted; local runs read wrangler's
 * local R2/KV/Analytics Engine emulation, the post-deploy smoke reads the
 * real plane.
 *
 * The cache assertions ride a run-unique query param: the KV key
 * canonicalizes the full query (minus `cache`), so a nonce isolates this
 * run's bypass→miss→hit sequence from any earlier warming — including
 * previous post-deploy smokes against the same persistent KV.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PlpPage, ReleaseDetail } from "@pm/data-contract";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
// The deployed plane (the smoke) runs against real, eventually-consistent KV.
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RUN_NONCE = `suite-${Date.now()}`;

const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

/**
 * Real KV is eventually consistent and caches negative lookups ("not advised
 * to rely on" read-after-write, per the KV docs) — so against the deployed
 * plane the hit may take a propagation window to appear. Locally (miniflare,
 * strongly consistent) the first read after the miss must already be a hit.
 */
async function expectEventuallyHit(path: string): Promise<Response> {
  const deadline = Date.now() + (REMOTE ? 90_000 : 0);
  for (;;) {
    const res = await get(path);
    const state = res.headers.get("x-pm-cache-state");
    if (state === "hit" || Date.now() > deadline) {
      expect(state).toBe("hit");
      return res;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

describe("tray API validates against the shared contract (ADR-0002 §6)", () => {
  it("GET /api/plp returns a contract-valid page with computed facets", async () => {
    const res = await get("/api/plp");
    expect(res.status).toBe(200);
    const page = PlpPage.parse(await res.json());
    expect(page.perPage).toBe(24);
    expect(page.total).toBeGreaterThanOrEqual(240);
    expect(page.items).toHaveLength(24);
    expect(page.totalPages).toBe(Math.ceil(page.total / page.perPage));
    // Facets are computed from the stored crate, not copied from samples.
    expect(page.facets.genres.length).toBeGreaterThan(0);
    expect(page.facets.styles.length).toBeGreaterThan(1);
    expect(page.facets.formats.length).toBeGreaterThan(1);
    const genreTotal = page.facets.genres.reduce((n, b) => n + b.count, 0);
    expect(genreTotal).toBeGreaterThanOrEqual(page.total);
  });

  it("GET /api/pdp/:id returns a contract-valid full tray", async () => {
    const res = await get("/api/pdp/9000001");
    expect(res.status).toBe(200);
    const detail = ReleaseDetail.parse(await res.json());
    expect(detail.id).toBe(9000001);
    expect(detail.tracklist.length).toBeGreaterThan(0);
    expect(detail.images.length).toBeGreaterThanOrEqual(2);
  });

  it("unknown id 404s; malformed id 400s; both generic", async () => {
    const missing = await get("/api/pdp/1234567");
    expect(missing.status).toBe(404);
    const malformed = await get("/api/pdp/not-a-number");
    expect(malformed.status).toBe(400);
    for (const res of [missing, malformed]) {
      const body = JSON.stringify(await res.clone().json());
      expect(body).not.toMatch(/\bat .+\.js/);
      expect(body).not.toContain("stack");
    }
  });
});

describe("the ?n= data-volume knob (ADR-0002 §5, ADR-0004 §5)", () => {
  it("serves 24 vs 240 from the one snapshot, pagination consistent", async () => {
    for (const n of [24, 240]) {
      const page = PlpPage.parse(await (await get(`/api/plp?n=${n}`)).json());
      expect(page.perPage).toBe(n);
      expect(page.items).toHaveLength(Math.min(n, page.total));
      expect(page.totalPages).toBe(Math.ceil(page.total / n));
    }
  });

  it("pages beyond the crate are valid and empty", async () => {
    const page = PlpPage.parse(
      await (await get("/api/plp?n=240&page=99")).json(),
    );
    expect(page.items).toHaveLength(0);
    expect(page.page).toBe(99);
  });
});

describe("KV warm tier: harness-driven cache state (ADR-0002 §8)", () => {
  it("bypass → miss → hit across three requests, marker header carried", async () => {
    const path = `/api/plp?n=48&run=${RUN_NONCE}`;
    const bypass = await get(`${path}&cache=cold`);
    expect(bypass.headers.get("x-pm-cache-state")).toBe("bypass");

    const miss = await get(path);
    expect(miss.headers.get("x-pm-cache-state")).toBe("miss");

    const hit = await expectEventuallyHit(path);

    // Warm serves the identical payload.
    expect(await hit.text()).toBe(await miss.text());
  }, 120_000);

  it("cold bypass never warms: bypass twice stays bypass, then still misses", async () => {
    const path = `/api/pdp/9000002?run=${RUN_NONCE}`;
    expect((await get(`${path}&cache=cold`)).headers.get("x-pm-cache-state")).toBe("bypass");
    expect((await get(`${path}&cache=cold`)).headers.get("x-pm-cache-state")).toBe("bypass");
    expect((await get(path)).headers.get("x-pm-cache-state")).toBe("miss");
  });

  it("4xx data responses carry the marker as `none` (never cached)", async () => {
    const missing = await get(`/api/pdp/1234567?run=${RUN_NONCE}`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-pm-cache-state")).toBe("none");
    const malformed = await get("/api/pdp/abc");
    expect(malformed.headers.get("x-pm-cache-state")).toBe("none");
  });
});

describe("frozen self-hosted images (ADR-0002 §5)", () => {
  it("an image through the composed origin returns the expected bytes and content-type", async () => {
    const res = await get("/assets/img/ph-00-primary.avif");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/avif");
    const source = readFileSync(
      join(repoRoot, "tools/snapshot-fixture/snapshot/img/ph-00-primary.avif"),
    );
    const wire = Buffer.from(await res.arrayBuffer());
    // Non-HTML guard on binary content: byte-identical through the hop.
    expect(wire.equals(source)).toBe(true);
  });

  it("a missing image 404s", async () => {
    expect((await get("/assets/img/nope.avif")).status).toBe(404);
  });
});

describe("beacon collector (ADR-0001 §8)", () => {
  // Reserved synthetic tag values: the post-deploy smoke writes REAL,
  // undeletable Analytics Engine points — "ci-smoke" marks them excludable
  // forever, and location says where the suite actually ran.
  const fullEvent = {
    name: "LCP",
    value: 1234.5,
    tags: {
      variant: "ci-smoke",
      surface: "ci-smoke",
      environment: "n=24",
      cacheState: "warm",
      location: REMOTE ? "ci-smoke-remote" : "local-dev",
    },
  };

  it("accepts a fully-tagged event (success after the write call completes)", async () => {
    const res = await get("/api/beacon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fullEvent),
    });
    expect(res.status).toBe(204);
  });

  it("rejects an event missing any of the five tags, naming it", async () => {
    for (const tag of ["variant", "surface", "environment", "cacheState", "location"]) {
      const tags: Record<string, string> = { ...fullEvent.tags };
      delete tags[tag];
      const res = await get("/api/beacon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fullEvent, tags }),
      });
      expect(res.status, `missing ${tag} must 400`).toBe(400);
      expect(await res.text()).toContain(tag);
    }
  });

  it("rejects non-JSON bodies and oversized tags as client errors", async () => {
    const bad = await get("/api/beacon", { method: "POST", body: "not json" });
    expect(bad.status).toBe(400);
    const oversized = await get("/api/beacon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...fullEvent,
        tags: { ...fullEvent.tags, variant: "x".repeat(200) },
      }),
    });
    expect(oversized.status).toBe(400);
  });

  it("GET is not a state change (405)", async () => {
    expect((await get("/api/beacon")).status).toBe(405);
  });
});

describe("HTTP method semantics (known resource + wrong method = 405)", () => {
  it("POST to a data route is 405 with Allow, not 404", async () => {
    const res = await get("/api/plp", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("GET");
  });

  it("HEAD works on data routes (uptime probes see the plane)", async () => {
    const res = await get("/api/plp", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-pm-cache-state")).toBeTruthy();
  });
});

describe("data-plane 404 + observability posture", () => {
  it("unknown /api/ paths 404 generically through the composed origin", async () => {
    const res = await get("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/\bat .+\.js/);
  });
});
