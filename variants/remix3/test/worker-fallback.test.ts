/**
 * The remix3 Worker's branded-fallback boundary + route shapes (editorial-
 * build slice F; the slice-E precedent made render-inside-the-guard a
 * standing duty). The Worker's whole promise is "never an unbranded stack
 * page": a data-plane failure — OR a render-time throw on a malformed-but-
 * 200 tray, OR a framework-internal ≥500 — must answer 503 INSIDE the
 * store's own shell, chrome slot included, because an exception that escapes
 * the service binding surfaces as pm-front's plain-text 502. The drain-
 * before-respond deviation in src/worker.ts exists exactly for this test's
 * middle case.
 *
 * In-process, but NOT in repo-checks: rendering needs remix/ui's JSX runtime
 * and renderToStream, so the guard lives in the variant's own workspace (the
 * astro precedent — hosting a framework's compiler in repo-checks would
 * route every repo-wide guard through it). The happy path renders from the
 * COMMITTED fixture trays through the variant's own snapshot policy, so
 * `featuredIdFor`/`isFixtureCrate` execute here pre-merge too.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import worker from "../src/worker.ts";

const variantRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(variantRoot, "..", "..", "tools", "snapshot-fixture", "snapshot");

const readJson = (file: string) => JSON.parse(readFileSync(join(fixtureDir, file), "utf8"));

const workerFetch = (env: unknown, path = "/remix3/editorial/", init?: RequestInit) =>
  worker.fetch(
    new Request(`https://pm-front.example${path}`, init),
    env as Parameters<typeof worker.fetch>[1],
  );

/** An EDGE stub serving `routes` by pathname, like pm-edge's own router. */
const edgeServing = (routes: Record<string, unknown>) => ({
  EDGE: {
    fetch: (input: string) => {
      const body = routes[new URL(input).pathname];
      return Promise.resolve(
        body === undefined
          ? new Response("not found\n", { status: 404 })
          : Response.json(body),
      );
    },
  },
});

const fixtureEnv = () => {
  const manifest = readJson("manifest.json");
  const featured = readJson("curation.json").featured as number;
  const detail = (readJson("details.json") as { id: number }[]).find((d) => d.id === featured);
  expect(detail).toBeDefined();
  return edgeServing({
    "/api/snapshot": manifest,
    [`/api/pdp/${featured}`]: detail,
  });
};

/** The branded shell, not a stack page: 503, HTML, chrome slot present. */
async function expectBrandedUnavailable(res: Response) {
  expect(res.status).toBe(503);
  expect(res.headers.get("content-type")).toContain("text/html");
  const body = await res.text();
  expect(body).toContain('<div id="pm-chrome-slot"></div>');
  expect(body).toContain("This page couldn");
  expect(body).toContain('class="pm-masthead"');
}

describe("the remix3 Worker's branded 503 boundary", () => {
  it("a dead data plane answers the branded shell, never an escaped exception", async () => {
    const env = { EDGE: { fetch: () => Promise.reject(new Error("edge down")) } };
    await expectBrandedUnavailable(await workerFetch(env));
  });

  it("a malformed-but-200 detail tray is caught by the SAME boundary (drain-before-respond)", async () => {
    // /api/snapshot answers the real committed manifest, /api/pdp/{id}
    // answers 200 with a structurally degenerate tray (no images, no
    // cover) — the throw happens INSIDE renderToStream's output, which is
    // exactly why src/worker.ts drains the stream before committing a
    // status.
    const manifest = readJson("manifest.json");
    const featured = readJson("curation.json").featured as number;
    const env = edgeServing({
      "/api/snapshot": manifest,
      [`/api/pdp/${featured}`]: { id: featured, title: "broken", images: [] },
    });
    await expectBrandedUnavailable(await workerFetch(env));
  });

  it("the committed fixture trays render the real page through the variant's own snapshot policy", async () => {
    const res = await workerFetch(fixtureEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('<article class="pm-editorial">');
    // The fixture essay, selected by isFixtureCrate on the served manifest.
    expect(body).toContain("A quiet variation, on repeat");
    // The frame resolved INLINE during SSR: the demo card's content is
    // already in the served document (FINDINGS §4's flagship behavior).
    // Attribute order is remix's own (class serializes last) — a recorded
    // serialization freedom; assert the two attributes, not their order.
    expect(body).toMatch(/<div data-pick="0" class="pm-frontier-demo__card">/);
    // The #rmx-data hydration script IS in the served document (end of
    // body, the frame-status map) — pinned POSITIVELY here as the
    // PERMITTED_NOISE registry record's standing measurement, not gate
    // policy (it is a <script>: delivery, dropped by every comparison
    // either way). HISTORY, kept deliberately: an earlier draft recorded
    // its ABSENCE as measured — a misreading of a post-strip test dump —
    // and the moment the anti-rigging lens forced the citation to become a
    // real assertion, the assertion disproved the claim. If a pin bump
    // changes this element's presence or shape, this fails and the registry
    // record gets re-measured instead of silently rotting.
    expect(body).toMatch(/<script type="application\/json" id="rmx-data">\{"f":/);
    // Labeling layer 1 on-surface (FINDINGS §7(c)1), asserted not assumed.
    expect(body).toContain('data-pm-fenced="true"');
    expect(body).toContain("excluded from every benchmark number");
  });
});

describe("the remix3 Worker's route shapes (the qwik/htmx suite conventions)", () => {
  it("/remix3/editorial 301s to the trailing-slash form with a RELATIVE location", async () => {
    const res = await workerFetch(fixtureEnv(), "/remix3/editorial?pick=1");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/remix3/editorial/?pick=1");
  });

  it("an unbuilt path under the prefix is a clean 404", async () => {
    const res = await workerFetch(fixtureEnv(), "/remix3/nope/");
    expect(res.status).toBe(404);
  });

  it("non-GET/HEAD answers 405 with Allow", async () => {
    const res = await workerFetch(fixtureEnv(), "/remix3/editorial/", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("HEAD answers 200 with no body (routed as GET)", async () => {
    const res = await workerFetch(fixtureEnv(), "/remix3/editorial/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("HEAD carries no content on the non-200 exits either (RFC 9110 §9.3.2 — verify-slice finding)", async () => {
    const notFound = await workerFetch(fixtureEnv(), "/remix3/nope/", { method: "HEAD" });
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toBe("");

    const env = { EDGE: { fetch: () => Promise.reject(new Error("edge down")) } };
    const unavailable = await workerFetch(env, "/remix3/editorial/", { method: "HEAD" });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).toBe("");
  });

  it("the frames partial serves standalone HTML at its own URL", async () => {
    const res = await workerFetch(fixtureEnv(), "/remix3/editorial/frames/demo?pick=1");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/<div data-pick="1" class="pm-frontier-demo__card">/);
    // The partial is a fragment plus doctype — no document shell.
    expect(body).not.toContain("pm-masthead");
  });

  it("?pick= only swaps the fenced demo card — the canonical page around it is byte-identical", async () => {
    const strip = (html: string) =>
      // Remove the two fenced subtrees (plaque + demo) and the per-render
      // rmx frame ids; what remains is the canonical page, which must not
      // vary with the demo's state.
      html
        .replace(/<aside[^>]*data-pm-fenced="true"[^>]*>[\s\S]*?<\/aside>/g, "")
        .replace(/<section[^>]*data-pm-fenced="true"[^>]*>[\s\S]*?<\/section>/g, "")
        .replace(/<!-- rmx:f:[^ ]* -->/g, "<!-- rmx:f -->")
        .replace(/<script type="application\/json" id="rmx-data">[\s\S]*?<\/script>/g, "");
    const [a, b] = await Promise.all([
      workerFetch(fixtureEnv(), "/remix3/editorial/").then((r) => r.text()),
      workerFetch(fixtureEnv(), "/remix3/editorial/?pick=2").then((r) => r.text()),
    ]);
    expect(strip(a)).toContain("pm-editorial"); // non-vacuity: real page left
    expect(strip(a)).toBe(strip(b));
  });
});
