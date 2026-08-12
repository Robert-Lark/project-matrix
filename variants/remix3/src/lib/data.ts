// The editorial page's whole data dependency, resolved per request through
// this Worker's OWN pm-edge service binding (the slice-B/D/E request-time
// precedent: the front Worker's EDGE binding does not reach a variant
// server-side). The host in the URL is unused by pm-edge's router (path-only
// dispatch); it exists only because `fetch` requires an absolute URL.
import { featuredIdFor, isFixtureCrate } from "../snapshot.mjs";
import type { Detail } from "./format.ts";
import type { EditorialData } from "../ui/editorial-page.tsx";

export interface Env {
  EDGE: { fetch(input: string | Request): Promise<Response> };
}

const edgeFetch = (env: Env, path: string) => env.EDGE.fetch(`https://pm-edge${path}`);

/** The served manifest (its `crate` field picks the honest essay, its
 *  `capturedAt` IS the dateline) plus the featured release's detail tray. */
export async function loadEditorialData(env: Env): Promise<EditorialData> {
  const manifestRes = await edgeFetch(env, "/api/snapshot");
  if (!manifestRes.ok) throw new Error(`GET /api/snapshot -> ${manifestRes.status}`);
  const manifest = (await manifestRes.json()) as { crate: string; capturedAt: string };

  const id = featuredIdFor(manifest.crate);
  const detailRes = await edgeFetch(env, `/api/pdp/${id}`);
  if (!detailRes.ok) throw new Error(`GET /api/pdp/${id} -> ${detailRes.status}`);
  const featured = (await detailRes.json()) as Detail;

  return {
    isFixture: isFixtureCrate(manifest.crate),
    capturedAt: manifest.capturedAt,
    featured,
  };
}
