import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ReleaseDetail, SnapshotManifest } from "@pm/data-contract";
import { featuredIdFor } from "./snapshot";

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
