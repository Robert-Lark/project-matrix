/**
 * Request-time tray access through the edge Worker (ADR-0002 §7: a
 * request-time variant fetches trays through the edge Worker on the same
 * plane; only build-time variants bake them in).
 *
 * The variant binds pm-edge ITSELF (`services` in its own wrangler.jsonc) —
 * the front Worker's own EDGE binding does not reach a variant server-side
 * (the editorial-build PRD's per-slice binding duties, established by slice
 * B). wrangler's local dev registry resolves it because run-local.mjs spawns
 * edge before every variant, and CI's deploy step deploys pm-edge before the
 * variants.
 */
import type { ReleaseDetail, SnapshotManifest } from "@pm/data-contract";
import { featuredIdFor } from "./snapshot";

/** What this variant needs from the platform. `QwikCityPlatform` is
 *  `PlatformCloudflarePages`, whose `env` is `Record<string, any>` — so the
 *  binding is typed here, once, instead of `any` leaking into the loader. */
export interface EdgeEnv {
  readonly EDGE: { fetch(input: string): Promise<Response> };
}

/** The host in the URL is unused by pm-edge's router (path-only dispatch); it
 *  exists only because `fetch` requires an absolute URL. */
function edgeFetch(env: EdgeEnv, path: string): Promise<Response> {
  return env.EDGE.fetch(`https://pm-edge${path}`);
}

/** Exactly the tray fields the editorial page renders — the shape the route
 *  loader projects to, and therefore the only shape that reaches the page's
 *  serialized resumability state. Derived from the shared tray contract with
 *  `Pick`, so a renamed field is a type error here rather than a missing
 *  string on the page. */
export type FeaturedRelease = Pick<
  ReleaseDetail,
  | "id"
  | "slug"
  | "title"
  | "artist"
  | "year"
  | "format"
  | "numForSale"
  | "priceFrom"
  | "labels"
  | "cover"
  | "images"
>;

/** The projection itself, as a function rather than an object literal inside
 *  the route loader — so the pre-merge master-identity guard (test/) drives the
 *  SAME projection the served page does instead of a copy of it that could
 *  drift. */
export function projectFeatured(detail: ReleaseDetail): FeaturedRelease {
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    artist: detail.artist,
    year: detail.year,
    format: detail.format,
    numForSale: detail.numForSale,
    priceFrom: detail.priceFrom,
    labels: detail.labels.slice(0, 1),
    cover: detail.cover,
    images: detail.images.slice(0, 2),
  };
}

/** The editorial page's whole data dependency, resolved per request: the
 *  freeze date (the dateline IS this value — ADR-0008 §8) plus the featured
 *  release's detail tray. */
export interface EditorialData {
  /** The served manifest's `crate` — selects which essay is the honest one. */
  readonly crate: string;
  readonly capturedAt: string;
  readonly featured: ReleaseDetail;
}

export async function loadEditorialData(env: EdgeEnv): Promise<EditorialData> {
  const manifestRes = await edgeFetch(env, "/api/snapshot");
  if (!manifestRes.ok) throw new Error(`GET /api/snapshot -> ${manifestRes.status}`);
  const manifest = (await manifestRes.json()) as SnapshotManifest;

  const id = featuredIdFor(manifest.crate);
  const detailRes = await edgeFetch(env, `/api/pdp/${id}`);
  if (!detailRes.ok) throw new Error(`GET /api/pdp/${id} -> ${detailRes.status}`);
  const featured = (await detailRes.json()) as ReleaseDetail;

  return { crate: manifest.crate, capturedAt: manifest.capturedAt, featured };
}
