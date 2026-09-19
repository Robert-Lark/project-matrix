/**
 * The security-header floor (2026-08-29 audit, priority 4; decision map
 * `security-floor`; ADR-0004 §3 addendum of 2026-09-18) at the composed-
 * origin seam — plain HTTP, outside-in, no Worker internals.
 *
 * Every response the plane serves carries the same three headers:
 *   x-content-type-options: nosniff
 *   referrer-policy: strict-origin-when-cross-origin
 *   x-frame-options: DENY
 * Two mechanisms behind one definition (workers/front/src/security-floor.js):
 * the front script wraps everything it proxies or answers, and the build
 * writes dist/_headers for the assets-first paths the script never sees — so
 * this file probes BOTH classes, plus the front's own 404, the data plane's
 * refusals, and the blog.
 *
 * The leg that matters is the identity one: the floor is part of the held-
 * constant TRANSPORT (ADR-0004 §3), so it must be byte-identical on every
 * variant — it cancels in every comparison only if it is the same everywhere.
 *
 * A Content-Security-Policy is deliberately ABSENT on store pages and that
 * absence is pinned: a full CSP is a recorded, separate decision (qwik and
 * astro emit inline scripts, so a script-src needs nonces or
 * 'unsafe-inline', and nonces touch the byte-identity guards), and a
 * half-CSP must not arrive by accident. The blog keeps its own, stronger set
 * (ADR-0009 §5): the floor may only ever ADD to an upstream's headers.
 *
 * Warm-tier discipline: every tray and PLP page request here is cold and
 * nonced (the repo-checks warm-tier guard reads these lines).
 */
import { describe, expect, it } from "vitest";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const NONCE = `suite-floor-${Date.now()}`;

const snap = await loadServedSnapshot();

const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

/** The contract, spelled here independently of the module that ships it. */
const FLOOR: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
};
const floorOf = (res: Response): Record<string, string | null> =>
  Object.fromEntries(Object.keys(FLOOR).map((name) => [name, res.headers.get(name)]));

const editorial = SURFACE_CONTROLS["editorial"]!;
/** Every variant serving the editorial surface — the five benchmarked plus
 *  the fenced exhibit (the fence excludes numbers, not the transport). */
const EDITORIAL_VARIANTS = [
  ...editorial.variants,
  ...(editorial.fencedExhibits ?? []).map((f) => f.variant),
];

/** Assets-first: the script never sees these; dist/_headers must. */
const ASSET_PATHS = [
  "/",
  "/methodology/",
  "/how-it-was-built/",
  "/_pm/chrome.css",
  "/_pm/measure.js",
  "/_pm/build.json",
  "/pm/css/fonts.css",
];

/** Proxied HTML — every surface, every variant that serves it, plus two
 *  fragments that are HTML but not a page. */
const PAGE_PATHS = [
  ...EDITORIAL_VARIANTS.map((v) => `/${v}/editorial/`),
  ...SURFACE_CONTROLS["sample"]!.variants.map((v) => `/${v}/sample/`),
  ...SURFACE_CONTROLS["pdp"]!.variants.map((v) => `/${v}/pdp/${snap.pdpDetail.slug}/`),
  "/vanilla/checkout/",
  "/vanilla/a11y/",
  `/react-next/plp/plain/?cache=cold&run=${NONCE}`,
  `/htmx/plp/?cache=cold&run=${NONCE}`,
  "/remix3/editorial/frames/demo",
];

/** The data plane through the front: JSON trays, the manifest, an image. */
const DATA_PATHS = [
  "/api/snapshot",
  `/api/plp?n=24&cache=cold&run=${NONCE}`,
  `/api/pdp/${snap.pdpDetail.id}?cache=cold&run=${NONCE}`,
  snap.image.path,
];

describe("the security-header floor rides every response class", () => {
  it.each(ASSET_PATHS)("assets-first %s — dist/_headers", async (path) => {
    const res = await get(path);
    expect(res.status, path).toBe(200);
    expect(floorOf(res), path).toEqual(FLOOR);
  });

  it.each(PAGE_PATHS)("proxied page or fragment %s — the script's floor", async (path) => {
    const res = await get(path);
    expect(res.status, path).toBe(200);
    expect(floorOf(res), path).toEqual(FLOOR);
  });

  it.each(DATA_PATHS)("data plane %s", async (path) => {
    const res = await get(path);
    expect(res.status, path).toBe(200);
    expect(floorOf(res), path).toEqual(FLOOR);
  });

  it("the data plane's refusals carry it — a 405 and a 400", async () => {
    const wrongMethod = await get("/api/beacon");
    expect(wrongMethod.status).toBe(405);
    expect(floorOf(wrongMethod)).toEqual(FLOOR);
    // kv-exempt: a malformed release id is refused before any lookup.
    const malformed = await get("/api/pdp/not-a-number");
    expect(malformed.status).toBe(400);
    expect(floorOf(malformed)).toEqual(FLOOR);
  });

  it("the front's own 404 for an unknown prefix carries it", async () => {
    const res = await get("/nope/");
    expect(res.status).toBe(404);
    expect(floorOf(res)).toEqual(FLOOR);
  });

  it("the blog carries it — the public contents page and the admin wall alike", async () => {
    const contents = await get("/blog/");
    expect(contents.status).toBe(200);
    expect(floorOf(contents)).toEqual(FLOOR);
    const wall = await get("/blog/admin/");
    expect(wall.status).toBe(401);
    expect(floorOf(wall)).toEqual(FLOOR);
  });
});

describe("the floor is a transport CONSTANT", () => {
  it("every variant's editorial answers with the identical triple — the cancels-in-comparison claim", async () => {
    // Non-vacuity: five benchmarked variants plus the fenced exhibit.
    expect(EDITORIAL_VARIANTS.length).toBeGreaterThanOrEqual(6);
    const triples = await Promise.all(
      EDITORIAL_VARIANTS.map(async (v) => JSON.stringify(floorOf(await get(`/${v}/editorial/`)))),
    );
    expect(new Set(triples).size).toBe(1);
    expect(triples[0]).toBe(JSON.stringify(FLOOR));
  });

  it("the floor OVERRIDES rather than appends — one value per header, never a list", async () => {
    for (const path of ["/vanilla/editorial/", "/blog/", "/api/snapshot"]) {
      const res = await get(path);
      for (const name of Object.keys(FLOOR)) {
        expect(res.headers.get(name), `${path} ${name}`).not.toContain(",");
      }
    }
  });
});

describe("what the floor deliberately is not", () => {
  it("no Content-Security-Policy on store pages, assets or the data plane — the separate decision, pinned", async () => {
    for (const path of ["/", "/vanilla/editorial/", "/qwik/editorial/", "/_pm/chrome.css", "/api/snapshot"]) {
      expect((await get(path)).headers.get("content-security-policy"), path).toBeNull();
    }
  });

  it("the blog's own CSP survives the front's floor — the floor only adds", async () => {
    const res = await get("/blog/");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(floorOf(res)).toEqual(FLOOR);
  });

  it("the _headers file is parsed by the platform, never served", async () => {
    expect((await get("/_headers")).status).toBe(404);
  });
});
