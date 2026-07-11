/**
 * Edge data plane through the composed origin (issue #4) — same seam as the
 * composition suite: plain HTTP at PM_ORIGIN, responses validated against the
 * shared Zod contract. Discogs is never contacted; local runs read wrangler's
 * local R2/KV/Analytics Engine emulation, the post-deploy smoke reads the
 * real plane.
 *
 * Snapshot-aware (issue #11): the suite first asks the origin WHICH frozen
 * snapshot it serves (/api/snapshot — the dated SnapshotManifest, ADR-0002
 * §1) and asserts THAT snapshot's committed artifacts — ids, trays, and
 * image sha256s from the fixture's or the crate's committed files. If the
 * snapshot can't be identified, resolution throws and every test here fails;
 * nothing skips (ADR-0001 §9).
 *
 * Every request here that traverses the warm tier rides the run-unique
 * `?run=` nonce (the documented harness isolation knob), for two reasons.
 * Reads: the KV warm tier is persistent and its keys carry no snapshot
 * identity, so an un-nonced request against the deployed plane could be
 * served a PREVIOUS smoke's warm payload — across the fixture→crate
 * re-seed that would false-fail the re-smoke (or let a torn re-seed
 * false-pass behind a warm hit). Writes: the smoke must plant no
 * un-nonced warm entries, or a real visitor would later HIT a stale
 * payload across that re-seed. The discipline is enforced repo-wide by
 * the repo-checks warm-tier guard; requests that provably never touch
 * the tier (malformed-id 400s, method-gated 405s) carry a `kv-exempt:`
 * marker naming why.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PlpPage, ReleaseDetail } from "@pm/data-contract";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
// The deployed plane (the smoke) runs against real, eventually-consistent KV.
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";
const RUN_NONCE = `suite-${Date.now()}`;

const snap = await loadServedSnapshot();

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

describe("snapshot provenance (ADR-0002 §1, issue #11)", () => {
  it("GET /api/snapshot serves the dated manifest of a known committed snapshot", async () => {
    // Resolution already proved this once (or this file would have failed to
    // load); assert the visible contract at the seam like everything else.
    const res = await get("/api/snapshot");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    // Raw-vs-raw: the committed manifest exactly as committed, not the
    // Zod-parsed view (parsing strips unknown keys, which would make this
    // asymmetric the day a manifest legitimately grows a field).
    expect(await res.json()).toEqual(snap.manifestRaw);
  });

  it("POST to the manifest is 405 with Allow (provenance is read-only)", async () => {
    const res = await get("/api/snapshot", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("GET");
  });
});

describe("tray API validates against the shared contract (ADR-0002 §6)", () => {
  it("GET /api/plp serves the snapshot's committed summaries, facets computed", async () => {
    const res = await get(`/api/plp?run=${RUN_NONCE}`);
    expect(res.status).toBe(200);
    const raw = (await res.json()) as PlpPage;
    const page = PlpPage.parse(raw);
    expect(page.perPage).toBe(24);
    expect(page.total).toBe(snap.manifest.releaseCount);
    expect(page.totalPages).toBe(Math.ceil(page.total / page.perPage));
    // The first page IS the committed tray content, in committed order —
    // deep-equal against the snapshot's own summaries.json.
    expect(raw.items).toEqual(snap.summaries.slice(0, page.perPage));
    // Facets are computed from the stored crate, not copied from samples.
    expect(page.facets.genres.length).toBeGreaterThan(0);
    expect(page.facets.styles.length).toBeGreaterThan(1);
    expect(page.facets.formats.length).toBeGreaterThan(1);
    const genreTotal = page.facets.genres.reduce((n, b) => n + b.count, 0);
    expect(genreTotal).toBeGreaterThanOrEqual(page.total);
  });

  it("GET /api/pdp/:id serves the committed full tray, contract-valid", async () => {
    const res = await get(`/api/pdp/${snap.pdpDetail.id}?run=${RUN_NONCE}`);
    expect(res.status).toBe(200);
    const raw = (await res.json()) as ReleaseDetail;
    const detail = ReleaseDetail.parse(raw);
    expect(detail.id).toBe(snap.pdpDetail.id);
    // The probe release is chosen to exercise the full tray shape…
    expect(detail.tracklist.length).toBeGreaterThan(0);
    expect(detail.images.length).toBeGreaterThanOrEqual(2);
    // …and the wire payload is the committed detail, byte-for-byte in value.
    expect(raw).toEqual(snap.pdpDetail);
  });

  it("every committed summary is served, in committed order (full PLP sweep)", async () => {
    // Page 1 alone would let a seed doctored only in later rows pass; at
    // n=240 the sweep is 1–3 requests and covers 100% of the committed
    // summaries for both known snapshots.
    const n = 240;
    const pages = Math.ceil(snap.manifest.releaseCount / n);
    for (let p = 1; p <= pages; p++) {
      const raw = (await (
        await get(`/api/plp?n=${n}&page=${p}&run=${RUN_NONCE}`)
      ).json()) as PlpPage;
      expect(raw.items).toEqual(snap.summaries.slice((p - 1) * n, p * n));
    }
  });

  it("a deterministic sample of PDP trays deep-equals the committed details", async () => {
    // Five evenly-spread positions (+ the probe detail above). Known
    // boundary, stated honestly: a detail outside the sample whose summary
    // still matches would escape — full-detail coverage would cost one
    // request per release on every run, which the sweep above plus the
    // committed-artifact provenance does not justify.
    const positions = [0, 1, 2, 3, 4].map((i) =>
      Math.floor((i * (snap.details.length - 1)) / 4),
    );
    for (const pos of new Set(positions)) {
      const committed = snap.details[pos]!;
      const res = await get(`/api/pdp/${committed.id}?run=${RUN_NONCE}`);
      expect(res.status).toBe(200);
      const raw = (await res.json()) as ReleaseDetail;
      ReleaseDetail.parse(raw);
      expect(raw).toEqual(committed);
    }
  });

  it("unknown id 404s; malformed id 400s; both generic", async () => {
    // Nonced although 404s are never written: the warm READ still happens
    // first, and a cross-era id collision (a past snapshot's warmed 200
    // under this snapshot's missing id) must not reach this probe.
    const missing = await get(`/api/pdp/${snap.missingId}?run=${RUN_NONCE}`);
    expect(missing.status).toBe(404);
    // kv-exempt: malformed ids 400 before the warm tier is consulted
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
      const page = PlpPage.parse(await (await get(`/api/plp?n=${n}&run=${RUN_NONCE}`)).json());
      expect(page.perPage).toBe(n);
      expect(page.items).toHaveLength(Math.min(n, page.total));
      expect(page.totalPages).toBe(Math.ceil(page.total / n));
    }
  });

  it("pages beyond the crate are valid and empty", async () => {
    const page = PlpPage.parse(
      await (await get(`/api/plp?n=240&page=99&run=${RUN_NONCE}`)).json(),
    );
    expect(page.items).toHaveLength(0);
    expect(page.page).toBe(99);
  });
});

describe("KV warm tier: harness-driven cache state (ADR-0002 §8)", () => {
  // The cache legs get their own sub-nonce: their miss/hit choreography
  // must be impossible for any other test to pre-warm, no matter which ids
  // a future snapshot makes the resolver derive (the PDP sample and the
  // cold-bypass leg could otherwise collide on details[0]).
  const CACHE_NONCE = `${RUN_NONCE}-cache`;

  it("bypass → miss → hit across three requests, marker header carried", async () => {
    const path = `/api/plp?n=48&run=${CACHE_NONCE}`;
    const bypass = await get(`${path}&cache=cold`);
    expect(bypass.headers.get("x-pm-cache-state")).toBe("bypass");

    const miss = await get(path);
    expect(miss.headers.get("x-pm-cache-state")).toBe("miss");

    const hit = await expectEventuallyHit(path);

    // Warm serves the identical payload.
    expect(await hit.text()).toBe(await miss.text());
  }, 120_000);

  it("cold bypass never warms: bypass twice stays bypass, then still misses", async () => {
    const path = `/api/pdp/${snap.cachePdpId}?run=${CACHE_NONCE}`;
    expect((await get(`${path}&cache=cold`)).headers.get("x-pm-cache-state")).toBe("bypass");
    expect((await get(`${path}&cache=cold`)).headers.get("x-pm-cache-state")).toBe("bypass");
    expect((await get(path)).headers.get("x-pm-cache-state")).toBe("miss");
  });

  it("4xx data responses carry the marker as `none` (never cached)", async () => {
    const missing = await get(`/api/pdp/${snap.missingId}?run=${CACHE_NONCE}`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-pm-cache-state")).toBe("none");
    // kv-exempt: malformed ids 400 before the warm tier is consulted
    const malformed = await get("/api/pdp/abc");
    expect(malformed.headers.get("x-pm-cache-state")).toBe("none");
  });
});

describe("frozen self-hosted images (ADR-0002 §5)", () => {
  it("an image through the composed origin carries the snapshot's frozen byte identity", async () => {
    const res = await get(snap.image.path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/avif");
    const wire = Buffer.from(await res.arrayBuffer());
    // sha256 IS the byte-identity check — it's how the crate commits its
    // image truth (images-index.json; the bytes themselves are deliberately
    // not in git). When the snapshot's bytes ARE committed (the fixture),
    // they were the hash's own source, so this one assertion covers both.
    expect(createHash("sha256").update(wire).digest("hex")).toBe(snap.image.sha256);
    if (snap.image.bytes) {
      expect(wire.equals(snap.image.bytes)).toBe(true);
    }
  });

  it("a deterministic sample of committed derivatives carries the frozen byte identity", async () => {
    // Boundary, stated honestly (mirrors the PDP sample): derivatives
    // outside this five-position spread + the probe image above are not
    // fetched — full coverage would be one request per derivative
    // (~1,800 for the crate) on every run.
    for (const { path, sha256 } of snap.imageSample) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      const wire = Buffer.from(await res.arrayBuffer());
      expect(createHash("sha256").update(wire).digest("hex"), path).toBe(sha256);
    }
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
    // kv-exempt: the method gate rejects POST before any handler runs
    const res = await get("/api/plp", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("GET");
  });

  it("HEAD works on data routes (uptime probes see the plane)", async () => {
    // Nonced like every other warm-tier request: HEAD traverses the
    // write-through, and an un-nonced probe would plant the canonical
    // default-PLP key — the one entry a real visitor would later HIT as a
    // stale payload across a snapshot re-seed.
    const res = await get(`/api/plp?run=${RUN_NONCE}`, { method: "HEAD" });
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
