/**
 * `loadPlp`'s seam rule (src/lib/edge.ts): the plane ANSWERING 400 — a facet
 * or sort value the snapshot does not hold — is `null`, which the route turns
 * into its 404 "No such filter"; every other non-2xx is a data-plane failure
 * and throws to the error boundary's "the catalogue didn't answer". The origin
 * suite proves the visible half at the seam (plp.test.ts: a junk filter is a
 * 404 on both arms). This pins the function in-process, because the
 * 2026-09-18 sabotage table deleted the 400 branch and nothing pre-merge went
 * red — the guard file drives the edge Worker directly and never went through
 * `loadPlp`, so the one line that decides 404-vs-outage had no test.
 *
 * `getCloudflareContext` and `server-only` are Next-runtime modules; both are
 * replaced here so the function under test is the only thing under test.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlpPage } from "@pm/data-contract";

const { edgeFetch } = vi.hoisted(() => ({
  edgeFetch: vi.fn<(url: string) => Promise<Response>>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { EDGE: { fetch: edgeFetch } } }),
}));

import { loadDetail, loadPlp } from "../src/lib/edge";
import { conditionFromSearchParams } from "../src/lib/plp-condition";

afterEach(() => {
  edgeFetch.mockReset();
});

describe("loadPlp: the plane answered vs the plane failed", () => {
  it("a 400 — a junk facet or sort value — is null: the route's 404, never the error boundary", async () => {
    edgeFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "unknown facet value" }), { status: 400 }),
    );
    await expect(loadPlp(conditionFromSearchParams({ genre: "Junk" }))).resolves.toBeNull();
    expect(edgeFetch).toHaveBeenCalledTimes(1);
    expect(edgeFetch.mock.calls[0]![0]).toContain("/api/plp?");
    expect(edgeFetch.mock.calls[0]![0]).toContain("genre=Junk");
  });

  it("any other non-2xx throws, naming the path and status — the boundary's 'didn't answer'", async () => {
    for (const status of [500, 502, 503]) {
      edgeFetch.mockResolvedValueOnce(new Response("down", { status }));
      await expect(loadPlp(conditionFromSearchParams({}))).rejects.toThrow(
        new RegExp(`GET /api/plp\\?.* -> ${status}$`),
      );
    }
  });

  it("a 200 is the parsed tray, untouched", async () => {
    const tray: PlpPage = {
      items: [],
      page: 1,
      perPage: 24,
      total: 0,
      totalPages: 0,
      facets: { genres: [], styles: [], formats: [] },
      applied: { genre: null, style: null, format: null, sort: null, q: null },
    };
    edgeFetch.mockResolvedValue(new Response(JSON.stringify(tray), { status: 200 }));
    await expect(loadPlp(conditionFromSearchParams({}))).resolves.toEqual(tray);
  });

  it("the precedent it copies still holds: loadDetail's 404 is null, its 500 throws", async () => {
    edgeFetch.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(loadDetail(1)).resolves.toBeNull();
    edgeFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(loadDetail(1)).rejects.toThrow(/GET \/api\/pdp\/1 -> 500$/);
  });
});
