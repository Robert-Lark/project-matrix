/**
 * The htmx Worker's branded-fallback boundary (editorial-build slice E;
 * verify-slice finding, correctness + anti-rigging lenses). The Worker's
 * whole promise is "never an unbranded stack page": a data-plane failure —
 * OR a render-time throw on a malformed-but-200 tray — must answer 503
 * INSIDE the store's own shell, chrome slot included, because an exception
 * that escapes the service binding surfaces as pm-front's plain-text 502.
 * Before this file, that branch had zero coverage anywhere (the origin
 * suite cannot make a healthy local edge fail on demand).
 *
 * Pure in-process: the Worker module is framework-neutral (globals only —
 * Request/Response/URL, all present in Node 24), so its `fetch` is driven
 * directly with stub EDGE bindings. The happy path renders from the
 * COMMITTED fixture trays through the variant's own snapshot policy, so
 * `featuredIdFor`/`isFixtureCrate` execute here pre-merge too.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixtureDir = join(repoRoot, "tools", "snapshot-fixture", "snapshot");

const readJson = (file: string) =>
  JSON.parse(readFileSync(join(fixtureDir, file), "utf8"));

async function workerFetch(env: unknown, path = "/htmx/editorial/") {
  const worker = (
    await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "index.js")).href
    )
  ).default as {
    fetch(request: Request, env: unknown): Promise<Response>;
  };
  return worker.fetch(new Request(`https://pm-front.example${path}`), env);
}

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

/** The branded shell, not a stack page: 503, HTML, chrome slot present. */
async function expectBrandedUnavailable(res: Response) {
  expect(res.status).toBe(503);
  expect(res.headers.get("content-type")).toContain("text/html");
  const body = await res.text();
  expect(body).toContain('<div id="pm-chrome-slot"></div>');
  expect(body).toContain("This page couldn");
  expect(body).toContain('class="pm-masthead"');
}

describe("the htmx Worker's branded 503 boundary", () => {
  it("a dead data plane answers the branded shell, never an escaped exception", async () => {
    const env = { EDGE: { fetch: () => Promise.reject(new Error("edge down")) } };
    await expectBrandedUnavailable(await workerFetch(env));
  });

  it("a malformed-but-200 detail tray is caught by the SAME boundary (the render is inside the guard)", async () => {
    // /api/snapshot answers the real committed manifest, /api/pdp/{id}
    // answers 200 with a structurally degenerate tray (no images, no
    // cover) — before the fix this threw during template interpolation
    // and escaped the Worker as pm-front's unbranded plain-text 502.
    const manifest = readJson("manifest.json");
    const featured = readJson("curation.json").featured as number;
    const env = edgeServing({
      "/api/snapshot": manifest,
      [`/api/pdp/${featured}`]: { id: featured, title: "broken", images: [] },
    });
    await expectBrandedUnavailable(await workerFetch(env));
  });

  it("the committed fixture trays render the real page through the variant's own snapshot policy", async () => {
    const manifest = readJson("manifest.json");
    const featured = readJson("curation.json").featured as number;
    const detail = (readJson("details.json") as { id: number }[]).find(
      (d) => d.id === featured,
    );
    expect(detail).toBeDefined();
    const env = edgeServing({
      "/api/snapshot": manifest,
      [`/api/pdp/${featured}`]: detail,
    });
    const res = await workerFetch(env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<article class="pm-editorial">');
    // The fixture essay, selected by isFixtureCrate on the served manifest.
    expect(body).toContain("A quiet variation, on repeat");
  });
});
