// The htmx variant Worker: hypermedia — the server renders complete HTML per
// request (editorial-build slice E). Assets under /htmx/assets/* are served
// assets-first from dist/ and never reach this script; everything else lands
// here. The front Worker forwards the ORIGINAL request untouched, so the
// /htmx/ prefix — routes, asset URLs, redirects — is this Worker's own duty.
import { renderEditorialPage, renderUnavailablePage } from "./render.mjs";
import { featuredIdFor, isFixtureCrate } from "./snapshot.mjs";

const HTML = { "content-type": "text/html; charset=utf-8" };

/** The host in the URL is unused by pm-edge's router (path-only dispatch);
 *  it exists only because `fetch` requires an absolute URL (the slice-B/D
 *  request-time precedent: this Worker binds pm-edge ITSELF — the front
 *  Worker's own EDGE binding does not reach a variant server-side). */
const edgeFetch = (env, path) => env.EDGE.fetch(`https://pm-edge${path}`);

/** The editorial page's whole data dependency, resolved per request: the
 *  served manifest (the dateline IS its freeze date, and its `crate` field
 *  picks the honest essay) plus the featured release's detail tray. */
async function loadEditorialData(env) {
  const manifestRes = await edgeFetch(env, "/api/snapshot");
  if (!manifestRes.ok) throw new Error(`GET /api/snapshot -> ${manifestRes.status}`);
  const manifest = await manifestRes.json();

  const id = featuredIdFor(manifest.crate);
  const detailRes = await edgeFetch(env, `/api/pdp/${id}`);
  if (!detailRes.ok) throw new Error(`GET /api/pdp/${id} -> ${detailRes.status}`);
  const featured = await detailRes.json();

  return {
    isFixture: isFixtureCrate(manifest.crate),
    capturedAt: manifest.capturedAt,
    featured,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed\n", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    // Normalize to the trailing-slash form, permanently — the same shape
    // qwik-city's router uses (its 301 is asserted in the origin suite);
    // a redirect that dropped the /htmx/ prefix would strand the visitor
    // on a path the front Worker routes nowhere. The Location is RELATIVE
    // (RFC 9110 §10.2.2) so the one composed origin stays host-agnostic —
    // an absolute URL here would bake in whichever host the front Worker
    // was reached on.
    if (url.pathname === "/htmx/editorial") {
      return new Response(null, {
        status: 301,
        headers: { location: `/htmx/editorial/${url.search}` },
      });
    }

    if (url.pathname === "/htmx/editorial/") {
      try {
        const data = await loadEditorialData(env);
        return new Response(renderEditorialPage(data), { headers: HTML });
      } catch {
        // A live data-plane failure is a real runtime state for a
        // request-time variant (the slice-B/D precedent): stay inside the
        // store's own shell, answer 503, never an unbranded stack page.
        // The RENDER sits inside the same guard (verify-slice finding): a
        // malformed-but-200 tray — say a future re-freeze shipping the
        // featured detail with zero images — would otherwise throw during
        // template interpolation and surface as pm-front's plain-text 502,
        // exactly the unbranded page this branch exists to prevent.
        // renderUnavailablePage takes no data, so the fallback cannot
        // itself throw.
        return new Response(renderUnavailablePage(), { status: 503, headers: HTML });
      }
    }

    // An unbuilt path under this variant's own prefix is a clean 404 — the
    // router is reached and answers (the qwik-block suite precedent).
    return new Response("not found\n", { status: 404 });
  },
};
