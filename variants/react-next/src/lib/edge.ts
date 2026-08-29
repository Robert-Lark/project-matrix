import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PlpPage, ReleaseDetail, SnapshotManifest } from "@pm/data-contract";
import { featuredIdFor } from "./snapshot";
import { plpApiPath, type PlpCondition } from "./plp-condition";

/** The variant binds pm-edge itself (wrangler.jsonc `services`) — the
 *  front Worker's own EDGE binding doesn't reach a variant server-side
 *  (editorial-build PRD's per-slice binding duties). The host in the request
 *  URL is unused by pm-edge's router (path-only dispatch); it exists only
 *  because `fetch` requires an absolute URL. */
async function edgeFetch(path: string): Promise<Response> {
  const { env } = getCloudflareContext();
  return env.EDGE.fetch(`https://pm-edge${path}`);
}

export async function loadManifest(): Promise<SnapshotManifest> {
  const res = await edgeFetch("/api/snapshot");
  if (!res.ok) throw new Error(`GET /api/snapshot -> ${res.status}`);
  return res.json();
}

export async function loadFeatured(manifest: SnapshotManifest): Promise<ReleaseDetail> {
  const id = featuredIdFor(manifest.crate);
  const res = await edgeFetch(`/api/pdp/${id}`);
  if (!res.ok) throw new Error(`GET /api/pdp/${id} -> ${res.status}`);
  return res.json();
}

/** One detail tray by id, or null when the plane has no such release — the
 *  PDP route turns that null into its 404 (the slug contract: parse the
 *  leading id, fetch, verify). Any other non-2xx is a data-plane failure and
 *  throws to the route's error boundary, exactly like loadFeatured. */
export async function loadDetail(id: number): Promise<ReleaseDetail | null> {
  const res = await edgeFetch(`/api/pdp/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/pdp/${id} -> ${res.status}`);
  return res.json();
}

/** The catalogue tray for one measurement condition (ADR-0005 §2: strategy is
 *  the PATH, condition is the QUERY). All three PLP routes fetch through this
 *  one function — the `cache=cold` bypass and the `?n=` volume knob reach the
 *  data plane exactly as the visitor's URL asked, which is what makes the
 *  "Edge cache — KV" preset byte-identical code to the cold one with only the
 *  serving tier flipped (ADR-0005 §1, the purest single-variable cell). */
export async function loadPlp(condition: PlpCondition): Promise<PlpPage> {
  const path = plpApiPath(condition);
  const res = await edgeFetch(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}
