/**
 * The `?page=` KV ceiling (2026-08-29 audit, priority 3 step 0).
 *
 * `handlePlp` floors `page` at 1 and — until this commit — applied no
 * ceiling, folded the raw integer into the KV key, and wrote every miss
 * through with no TTL. So `for p in $(seq 1 1000000)` minted one immortal
 * entry per integer: the attacker pays nothing, the project pays KV writes
 * ($5/M) and storage (~10 KB × forever) on the surface whose thesis is
 * pricing infrastructure honestly. (`?page=1e15` did NOT mint — `parseInt`
 * stops at `1` — but every plain digit string did.)
 *
 * The fix is on the way OUT, not the way in: a page past `totalPages` is
 * still served as the honest empty 200 every arm renders as "0" (the
 * contract `plp-arms-agree.test.ts` and `data-plane.test.ts` pin), but it is
 * never written through and says so (`x-pm-cache-state: none`). Applying the
 * ceiling BEFORE the KV lookup would need `totalPages`, which needs the
 * snapshot, which needs R2 — putting ~400 ms of origin on every warm hit and
 * erasing the edge-cache cell (ADR-0005 §6 cell 3). Lookup-first keeps the
 * hit path a single KV read; a past-the-end key can never hit because it is
 * never written.
 *
 * Driven in-process with stub bindings — the same shape the react-next
 * identity guard uses to drive this Worker — over the committed fixture
 * snapshot, reached through this workspace's own declared dependency.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const fixtureDir = join(
  dirname(createRequire(import.meta.url).resolve("@pm/snapshot-fixture/package.json")),
  "snapshot",
);
const summaries = JSON.parse(readFileSync(join(fixtureDir, "summaries.json"), "utf8"));

/** Stub R2 + a RECORDING KV: every put is kept so "never written" is an
 *  assertion on the store, not an inference from the header. */
function stubEnv() {
  const warm = new Map();
  const puts = [];
  return {
    puts,
    warm,
    env: {
      SNAPSHOT: {
        get: (key) =>
          Promise.resolve(
            key === "snapshot/summaries.json" ? { json: () => Promise.resolve(summaries) } : null,
          ),
      },
      WARM: {
        get: (key) => Promise.resolve(warm.get(key) ?? null),
        put: (key, value, options) => {
          puts.push({ key, options });
          warm.set(key, value);
          return Promise.resolve();
        },
      },
    },
  };
}

const get = (env, path) => worker.fetch(new Request(`https://pm-edge${path}`), env);

describe("the ?page= ceiling: a page past the end is served but never stored", () => {
  const total = summaries.length;
  const lastPage = Math.ceil(total / 24);

  it("non-vacuity: the fixture has more than one page at n=24, so 'past the end' is a real state", () => {
    expect(total).toBeGreaterThan(24);
    expect(lastPage).toBeGreaterThan(1);
  });

  it("a page past the end is the honest empty 200 the arms render as '0' — and it is NOT a warm-tier resource", async () => {
    const { env, puts } = stubEnv();
    const res = await get(env, `/api/plp?page=${lastPage + 1}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.page).toBe(lastPage + 1);
    expect(body.totalPages).toBe(lastPage);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    expect(puts, "a page past the end minted a KV key").toEqual([]);
  });

  it("a curl loop over the integers mints nothing", async () => {
    const { env, puts } = stubEnv();
    for (const page of [lastPage + 1, lastPage + 2, 99, 1000, 123456789, 999999999999]) {
      const res = await get(env, `/api/plp?page=${page}`);
      expect(res.status, `page=${page}`).toBe(200);
      expect(res.headers.get("x-pm-cache-state"), `page=${page}`).toBe("none");
    }
    expect(puts).toEqual([]);
    // And a second visit to the same past-the-end page is still not a hit —
    // there is nothing to hit.
    const again = await get(env, `/api/plp?page=${lastPage + 1}`);
    expect(again.headers.get("x-pm-cache-state")).toBe("none");
  });

  it("the last REAL page still warms: miss, then hit, under exactly one key", async () => {
    const { env, puts, warm } = stubEnv();
    const miss = await get(env, `/api/plp?page=${lastPage}`);
    expect(miss.headers.get("x-pm-cache-state")).toBe("miss");
    expect((await miss.json()).items.length).toBeGreaterThan(0);
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toBe(`v2:/api/plp?n=24&page=${lastPage}`);
    // Visitor-facing (un-nonced): the frozen-data infinite TTL, unchanged.
    expect(puts[0].options).toBeUndefined();
    const hit = await get(env, `/api/plp?page=${lastPage}`);
    expect(hit.headers.get("x-pm-cache-state")).toBe("hit");
    expect(warm.size).toBe(1);
  });

  it("the ceiling is the FILTER-AGNOSTIC arithmetic of the served condition: n=240 has fewer real pages", async () => {
    const { env, puts } = stubEnv();
    const pagesAt240 = Math.ceil(total / 240);
    const real = await get(env, `/api/plp?n=240&page=${pagesAt240}`);
    expect(real.headers.get("x-pm-cache-state")).toBe("miss");
    const past = await get(env, `/api/plp?n=240&page=${pagesAt240 + 1}`);
    expect(past.headers.get("x-pm-cache-state")).toBe("none");
    expect(puts.map((p) => p.key)).toEqual([`v2:/api/plp?n=240&page=${pagesAt240}`]);
  });

  it("cold bypass past the end is still `bypass` — the visitor asked for R2 and got it", async () => {
    const { env, puts } = stubEnv();
    const res = await get(env, `/api/plp?page=${lastPage + 1}&cache=cold`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-pm-cache-state")).toBe("bypass");
    expect(puts).toEqual([]);
  });

  it("the verifier's correction holds: `?page=1e15` is page 1 (parseInt stops at the `e`), and mints page 1's key", async () => {
    const { env, puts } = stubEnv();
    const res = await get(env, "/api/plp?page=1e15");
    expect((await res.json()).page).toBe(1);
    expect(res.headers.get("x-pm-cache-state")).toBe("miss");
    expect(puts.map((p) => p.key)).toEqual(["v2:/api/plp?n=24&page=1"]);
  });

  it("a page of 400 digits is still a finite, contract-valid empty page — never `page: null`", async () => {
    // `parseInt` of 309+ digits is Infinity, which JSON writes as null: the
    // first draft served a tray the PlpPage contract rejects, the htmx arm
    // answered a false "data plane didn't answer" 503, and react-next held
    // page Infinity against a Worker that read `page=Infinity` as page 1
    // (verify-slice, 2026-09-18). Capped at MAX_SAFE_INTEGER: past the end,
    // empty, `none`, never stored — the ceiling's own semantics.
    const { env, puts } = stubEnv();
    const res = await get(env, `/api/plp?page=${"9".repeat(400)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Number.isSafeInteger(body.page), `page serialized as ${body.page}`).toBe(true);
    expect(body.page).toBe(Number.MAX_SAFE_INTEGER);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(summaries.length);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    expect(puts).toEqual([]);
    // The spelling react-next would have sent before its clamp was fixed is
    // junk to the Worker, not a silent page 1 under a URL that says otherwise:
    // parseInt("Infinity") is NaN, so it IS page 1 — pinned so the two
    // clamps' agreement (react-next identity guard) is what keeps that
    // shape from ever being requested.
    expect((await (await get(env, "/api/plp?page=Infinity")).json()).page).toBe(1);
  });

  it("junk and sub-floor pages collapse to page 1 — one key, not one per spelling", async () => {
    const { env, puts } = stubEnv();
    for (const raw of ["0", "-3", "abc", "", "01", "1.9", "1abc"]) {
      const res = await get(env, `/api/plp?page=${encodeURIComponent(raw)}`);
      expect((await res.json()).page, `page=${raw}`).toBe(1);
    }
    expect(new Set(puts.map((p) => p.key)).size).toBe(1);
  });

  it("a `?run=`-nonced past-the-end page is not stored either, TTL or no TTL", async () => {
    const { env, puts } = stubEnv();
    const res = await get(env, `/api/plp?page=${lastPage + 1}&run=suite-1`);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    expect(puts).toEqual([]);
    // …while a nonced REAL page keeps its self-expiring entry.
    await get(env, `/api/plp?page=1&run=suite-1`);
    expect(puts).toHaveLength(1);
    expect(puts[0].options).toEqual({ expirationTtl: 3600 });
  });
});
